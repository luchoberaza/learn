#!/usr/bin/env python3
"""Curación de cursos: validar, revisar un diff y publicar sin tocar fuentes existentes."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
import difflib
import hashlib
import json
from math import ceil
import os
from pathlib import Path
import re
import shutil
import sys

import pymupdf
import yaml

from almacen import Conflicto, atomico, bloquear, guardar_json, leer_json, ruta_segura, sha256
from pipeline import TIPOS, cita, firma

SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"


class YAMLUnico(yaml.SafeLoader):
    def compose_node(self, parent, index):
        if self.check_event(yaml.AliasEvent):
            raise ValueError("El YAML no admite alias; usá valores explícitos.")
        return super().compose_node(parent, index)

    def construct_mapping(self, node, deep=False):
        resultado = {}
        for clave, valor in node.value:
            k = self.construct_object(clave, deep=deep)
            if not isinstance(k, str) or k in resultado:
                raise ValueError("El YAML necesita claves de texto únicas.")
            resultado[k] = self.construct_object(valor, deep=deep)
        return resultado


def cargar_yaml(texto: str):
    if len(texto.encode()) > 2_000_000:
        raise ValueError("El YAML supera 2 MB.")
    try:
        return yaml.load(texto, Loader=YAMLUnico)
    except yaml.YAMLError:
        raise ValueError("YAML inválido; se preservó el archivo.") from None


def carpeta(vault: Path, slug: str) -> Path:
    if not isinstance(slug, str) or not re.fullmatch(SLUG, slug):
        raise ValueError("Curso inválido: usá un slug sin tildes.")
    return ruta_segura(vault, f"cursos/{slug}")


def texto(raiz: Path, nombre: str) -> str:
    archivo = ruta_segura(raiz, nombre)
    if archivo.stat().st_size > 2_000_000:
        raise ValueError(f"{nombre} supera 2 MB.")
    return archivo.read_text(encoding="utf-8")


def validar(raiz: Path, slug: str, *, indice=None, contrato=None, origenes=None, max_tokens=1500) -> dict:
    errores, avisos, pendientes = [], [], set()
    documentos, temas, items = {}, {}, {}
    usados = set()
    resultado = {"curso": slug, "errores": errores, "avisos": avisos, "pendientes": [], "ok": False, "listo_estudio": False}
    try:
        indice = cargar_yaml(texto(raiz, "indice.yaml")) if indice is None else indice
        contrato = texto(raiz, "curso.md") if contrato is None else contrato
        if not isinstance(indice, dict) or type(indice.get("version")) is not int or indice["version"] != 1:
            raise ValueError("indice.yaml necesita version: 1.")
        if not isinstance(indice.get("documentos"), list) or not indice["documentos"] or not isinstance(indice.get("temas"), list):
            raise ValueError("El índice necesita documentos no vacíos y una lista de temas.")
        cabecera = re.match(r"\A---\n(.*?)\n---(?:\n|$)", contrato, re.S)
        front = cargar_yaml(cabecera[1]) if cabecera else None
        if not isinstance(front, dict) or front.get("slug") != slug or not isinstance(front.get("nombre"), str) or not front["nombre"].strip():
            errores.append("curso.md necesita frontmatter con nombre y slug coincidente.")
        ids_objetivos = re.findall(r"(?m)^- (O\d+(?:\.\d+)*):\s+\S", contrato)
        if not ids_objetivos or len(set(ids_objetivos)) != len(ids_objetivos):
            errores.append("curso.md necesita objetivos con ids únicos (por ejemplo, '- O1.1: ...').")
        resultado["tokens_estimados_contrato"] = ceil(len(contrato.encode()) / 4)
        if resultado["tokens_estimados_contrato"] > max_tokens:
            avisos.append(f"curso.md supera el presupuesto estimado de {max_tokens} tokens (bytes UTF-8 / 4; no es un tokenizer exacto).")
        for d in indice["documentos"]:
            if not isinstance(d, dict) or not isinstance(d.get("id"), str) or not re.fullmatch(SLUG, d["id"]) or d["id"] in documentos:
                raise ValueError("Documentos con ids inválidos o duplicados.")
            if d.get("tipo") not in TIPOS or not isinstance(d.get("titulo"), str) or not d["titulo"].strip():
                raise ValueError(f"Documento {d['id']}: tipo o título inválido.")
            relativa = d.get("archivo")
            if not isinstance(relativa, str) or any(c in relativa for c in "#[]|\n\r") or Path(relativa).parts[:2] != ("fuentes", d["tipo"]) or Path(relativa).suffix.lower() != ".pdf":
                raise ValueError(f"Documento {d['id']}: usá fuentes/<tipo>/archivo.pdf, compatible con citas.")
            fuente = ruta_segura(raiz, relativa)
            if origenes and d["id"] in origenes:
                fuente = origenes[d["id"]]
            with pymupdf.open(fuente) as pdf:
                if pdf.needs_pass or type(d.get("paginas")) is not int or d["paginas"] != len(pdf):
                    raise ValueError(f"Documento {d['id']}: cantidad de páginas incorrecta o PDF protegido.")
            if d["tipo"] == "bibliografia" and d.get("prioridad") not in {"principal", "complementaria"}:
                errores.append(f"Bibliografía {d['id']}: falta prioridad principal/complementaria.")
            if relativa in {x["archivo"] for x in documentos.values()}:
                errores.append(f"Dos documentos apuntan al mismo PDF: {relativa}.")
            documentos[d["id"]] = d
            meta = leer_json(raiz, f"_procesado/{d['id']}/meta.json")
            item_file = ruta_segura(raiz, f"_procesado/{d['id']}/items.yaml")
            huella_fuente = sha256(fuente) if meta is not None or item_file.exists() else None
            if meta is not None and (not isinstance(meta, dict) or meta.get("id") != d["id"] or meta.get("sha256") != huella_fuente):
                errores.append(f"Fuente distinta de la preparada: {d['id']}.")
            if item_file.exists():
                banco = cargar_yaml(texto(raiz, f"_procesado/{d['id']}/items.yaml"))
                if not isinstance(banco, dict) or banco.get("doc") != d["id"] or not isinstance(banco.get("items"), list):
                    raise ValueError(f"Banco de ítems inválido: {d['id']}.")
                if banco.get("sha256_fuente", huella_fuente) != huella_fuente:
                    errores.append(f"Banco de ítems de otra versión del PDF: {d['id']}.")
                items[d["id"]] = {}
                for item in banco["items"]:
                    if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"].strip() or item["id"] in items[d["id"]]:
                        raise ValueError(f"Ítems duplicados o inválidos: {d['id']}.")
                    if not isinstance(item.get("enunciado"), str) or not item["enunciado"].strip() or not isinstance(item.get("paginas"), list) or not item["paginas"] or any(type(p) is not int or not 1 <= p <= d["paginas"] for p in item["paginas"]):
                        raise ValueError(f"Enunciado o páginas inválidos en {d['id']}/{item['id']}.")
                    items[d["id"]][item["id"]] = item
                for item in items[d["id"]].values():
                    enunciado = items[d["id"]].get(item["solucion_de"]) if isinstance(item.get("solucion_de"), str) else None
                    if "solucion_de" in item and (enunciado is None or "solucion_de" in enunciado):
                        errores.append(f"Solución integrada inválida: {d['id']}/{item['id']} (solucion_de debe nombrar un enunciado del mismo documento).")
        for d in documentos.values():
            if "soluciones" in d and documentos.get(d["soluciones"], {}).get("tipo") != "soluciones":
                errores.append(f"{d['id']}: documento de soluciones inexistente o de otro tipo.")
        for t in indice["temas"]:
            if not isinstance(t, dict) or not isinstance(t.get("id"), str) or not re.fullmatch(SLUG, t["id"]) or t["id"] in temas:
                raise ValueError("Temas con ids inválidos o duplicados.")
            if not isinstance(t.get("nombre"), str) or not t["nombre"].strip() or type(t.get("unidad")) is not int or t["unidad"] < 1:
                raise ValueError(f"Tema {t['id']}: nombre o unidad inválidos.")
            for campo in ["alias", "prerequisitos", "objetivos"]:
                valores = t.get(campo)
                if not isinstance(valores, list) or any(not isinstance(v, str) or not v.strip() for v in valores) or len(set(valores)) != len(valores):
                    raise ValueError(f"Tema {t['id']}: lista {campo} inválida o duplicada.")
            if not t["objetivos"] or set(t["objetivos"]) - set(ids_objetivos):
                errores.append(f"Tema {t['id']}: objetivos ausentes o no definidos en curso.md.")
            temas[t["id"]] = t
        def revisar_paginas(doc, numeros):
            calidades = leer_json(raiz, f"_procesado/{doc}/calidad.json", {"paginas": {}})
            if not isinstance(calidades, dict) or not isinstance(calidades.get("paginas"), dict):
                raise ValueError(f"Registro de calidad inválido: {doc}.")
            qs = calidades["paginas"]
            for p in numeros:
                q = qs.get(str(p))
                archivo = ruta_segura(raiz, f"_procesado/{doc}/paginas/{p:04}.md")
                if q is not None and not isinstance(q, dict):
                    raise ValueError(f"Registro de página inválido: {doc}/{p}.")
                if not q or q.get("pendiente") or q.get("ruta") == "pendiente" or not archivo.exists():
                    pendientes.add((doc, p))
                elif q.get("sha256_markdown") and sha256(archivo) != q["sha256_markdown"]:
                    errores.append(f"Transcripción editada fuera de la ingesta: {doc}/{p}.")
        for t in temas.values():
            if set(t["prerequisitos"]) - temas.keys():
                errores.append(f"Tema {t['id']}: prerequisito inexistente.")
            tiene_material = False
            for clase, tipo in [("bibliografia", "bibliografia"), ("ejercicios", "ejercicios"), ("evaluaciones", "evaluaciones")]:
                refs = t.get(clase, [])
                if not isinstance(refs, list):
                    raise ValueError(f"Tema {t['id']}: {clase} debe ser una lista.")
                for ref in refs:
                    if not isinstance(ref, dict) or not isinstance(ref.get("doc"), str) or documentos.get(ref["doc"], {}).get("tipo") != tipo:
                        errores.append(f"Tema {t['id']}: referencia {clase} a documento inexistente o de otro tipo.")
                        continue
                    doc = ref["doc"]
                    if clase == "bibliografia":
                        rango = ref.get("paginas")
                        if not isinstance(rango, list) or len(rango) != 2 or any(type(p) is not int for p in rango) or not 1 <= rango[0] <= rango[1] <= documentos[doc]["paginas"] or not isinstance(ref.get("seccion"), str):
                            errores.append(f"Tema {t['id']}: rango PDF o sección inválidos en {doc}.")
                            continue
                        revisar_paginas(doc, range(rango[0], rango[1] + 1))
                        tiene_material = True
                    else:
                        ids = ref.get("items")
                        if not isinstance(ids, list) or not ids or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
                            errores.append(f"Tema {t['id']}: lista de ítems inválida en {doc}.")
                            continue
                        for i in ids:
                            if i not in items.get(doc, {}):
                                errores.append(f"Tema {t['id']}: ítem inexistente {doc}/{i}.")
                            elif "solucion_de" in items[doc][i]:
                                errores.append(f"Tema {t['id']}: {doc}/{i} es una solución; referenciá su enunciado.")
                            else:
                                usados.add((doc, i))
                                revisar_paginas(doc, items[doc][i]["paginas"])
                                tiene_material = True
            if not tiene_material:
                avisos.append(f"Tema sin material: {t['id']}.")
        # DFS con colores: un nodo gris indica un ciclo, incluso en componentes desconectados.
        colores = {}
        def visitar(n):
            if colores.get(n) == 1:
                raise ValueError("Hay prerequisitos circulares.")
            if colores.get(n) == 2:
                return
            colores[n] = 1
            for padre in temas[n]["prerequisitos"]:
                if padre in temas:
                    visitar(padre)
            colores[n] = 2
        for n in temas:
            visitar(n)
        progreso_file = ruta_segura(raiz, "progreso.yaml")
        if progreso_file.exists():
            validar_progreso(cargar_yaml(texto(raiz, "progreso.yaml")), temas, documentos, items)
        elif raiz.exists():
            errores.append("Falta progreso.yaml; no se creó ni restauró automáticamente.")
        for doc, banco in items.items():
            for identificador, item in banco.items():
                solucion = item.get("solucion")
                if solucion is not None and (not isinstance(solucion, dict) or documentos.get(solucion.get("doc"), {}).get("tipo") != "soluciones" or solucion.get("id") not in items.get(solucion.get("doc"), {})):
                    errores.append(f"Solución inexistente o inválida: {doc}/{identificador}.")
        sin_asignar = [{"doc": d, "id": i} for d, banco in items.items() for i in banco if (d, i) not in usados and "solucion_de" not in banco[i]]
        resultado["items_sin_asignar"] = sin_asignar
        for d in documentos.values():
            if d["tipo"] in {"ejercicios", "evaluaciones", "soluciones"} and d["id"] not in items:
                avisos.append(f"Sin segmentación todavía: {d['id']}.")
        resultado.update(documentos=len(documentos), temas=len(temas))
    except (OSError, ValueError, KeyError, TypeError, RecursionError, RuntimeError) as e:
        errores.append(f"No se pudo validar: {e}")
    resultado["pendientes"] = [{"doc": d, "pagina": p} for d, p in sorted(pendientes)]
    if pendientes:
        avisos.append(f"{len(pendientes)} páginas referidas pendientes o sin preparar; no está listo para estudiar esos pasajes.")
    resultado["ok"] = not errores
    resultado["listo_estudio"] = not errores and not avisos
    return resultado


def validar_progreso(p, temas, documentos, items):
    if not isinstance(p, dict) or type(p.get("version")) is not int or p["version"] != 1 or not isinstance(p.get("temas"), dict) or not isinstance(p.get("historial"), list):
        raise ValueError("progreso.yaml no cumple el esquema version/temas/historial.")
    def fecha(f):
        return date.fromisoformat(str(f))
    for nombre, t in p["temas"].items():
        if nombre not in temas or not isinstance(t, dict) or t.get("estado") not in {"sin_empezar", "en_curso", "dominado", "repasar"}:
            raise ValueError("Tema o estado inválido en progreso.yaml.")
        if "actualizado" in t:
            fecha(t["actualizado"])
        for campo in ["conceptos_firmes", "discrepancias"]:
            if not isinstance(t.get(campo, []), list) or any(not isinstance(v, str) for v in t.get(campo, [])):
                raise ValueError(f"progreso.yaml: {campo} debe ser una lista de textos.")
        borde = t.get("borde", {})
        if not isinstance(borde, dict) or any(not isinstance(borde.get(k, []), list) or any(not isinstance(v, str) for v in borde.get(k, [])) for k in ["domina", "falla"]):
            raise ValueError("Borde inválido en progreso.yaml.")
        if not isinstance(t.get("proximo_paso", ""), str):
            raise ValueError("Próximo paso inválido en progreso.yaml.")
        for campo in ["errores_de_concepto", "ejercicios"]:
            if not isinstance(t.get(campo, []), list):
                raise ValueError(f"progreso.yaml: {campo} debe ser una lista.")
        for e in t.get("errores_de_concepto", []):
            if not isinstance(e, dict) or not isinstance(e.get("descripcion"), str) or type(e.get("resuelto")) is not bool:
                raise ValueError("Error de concepto inválido en progreso.yaml.")
            fecha(e.get("detectado"))
        for e in t.get("ejercicios", []):
            if not isinstance(e, dict) or e.get("item") not in items.get(e.get("doc"), {}) or e.get("resultado") not in {"correcto", "parcial", "incorrecto"} or not isinstance(e.get("puntaje", ""), str) or not isinstance(e.get("notas", ""), str):
                raise ValueError("Ejercicio inválido en progreso.yaml.")
            fecha(e.get("fecha"))
    for h in p["historial"]:
        if not isinstance(h, dict) or h.get("tema") not in temas or not isinstance(h.get("resumen"), str) or not isinstance(h.get("log"), str):
            raise ValueError("Historial inválido en progreso.yaml.")
        fecha(h.get("fecha"))
        if any(k in h and type(h[k]) is not bool for k in ["cierre", "reconstruido"]):
            raise ValueError("Cierre/reconstruido del historial deben ser booleanos.")
        log = Path(h["log"])
        if log.is_absolute() or ".." in log.parts or log.parts[:1] != ("sesiones",) or log.suffix != ".md":
            raise ValueError("El log del historial debe estar en sesiones/.")


def vivo(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    return True


def revisar(vault: Path, slug: str, propuesta: Path, max_tokens=1500) -> tuple[dict, dict]:
    raiz = carpeta(vault, slug)
    relativa = propuesta.absolute().relative_to(vault)
    if relativa.parts[:1] != ("_procesado",) or any(p in relativa.parts for p in ["fuentes", "_entrada"]):
        raise ValueError(f"La propuesta está en {relativa.as_posix()}: movela a _procesado/ de la raíz del vault (no a cursos/<curso>/_procesado/) y repetí.")
    crudo = texto(vault, str(relativa))
    paquete = json.loads(crudo)
    if not isinstance(paquete, dict) or not isinstance(paquete.get("indice_yaml"), str) or not isinstance(paquete.get("curso_md"), str) or not isinstance(paquete.get("origenes", {}), dict):
        raise ValueError("La propuesta necesita indice_yaml, curso_md y origenes (para PDFs nuevos).")
    indice = cargar_yaml(paquete["indice_yaml"])
    anteriores = {}
    base = {}
    if raiz.exists() and not ruta_segura(raiz, "indice.yaml").exists():
        raise FileExistsError(f"cursos/{slug}/ existe sin indice.yaml (curso incompleto o carpeta ajena): movela fuera de cursos/ y repetí.")
    if raiz.exists():
        # Copias de un aplicar cortado sin limpieza (SIGTERM): sólo las de procesos que ya terminaron.
        for parcial in raiz.glob("fuentes/*/.*.parcial-*"):
            pid = re.fullmatch(r"\..+\.parcial-(\d+)", parcial.name)
            if pid and not vivo(int(pid[1])):
                ruta_segura(raiz, str(parcial.relative_to(raiz))).unlink()
        for nombre in ["indice.yaml", "curso.md", "progreso.yaml"]:
            base[nombre] = texto(raiz, nombre)
        anteriores = {d["id"]: d for d in cargar_yaml(base["indice.yaml"])["documentos"]}
        nuevos = {d["id"]: d for d in indice["documentos"]}
        temas_antes = {t["id"] for t in cargar_yaml(base["indice.yaml"])["temas"]}
        if anteriores.keys() - nuevos.keys() or temas_antes - {t["id"] for t in indice["temas"]}:
            raise Conflicto("La ampliación no puede eliminar documentos ni temas existentes.")
        if any(nuevos[d]["archivo"] != v["archivo"] or nuevos[d]["tipo"] != v["tipo"] for d, v in anteriores.items()):
            raise Conflicto("Los PDFs existentes no se renombran ni se reclasifican con una ampliación.")
    origenes, copias = {}, []
    for d in indice["documentos"]:
        if d["id"] in anteriores:
            continue
        o = paquete.get("origenes", {}).get(d["id"], {})
        origen = o.get("archivo", "")
        if not isinstance(origen, str) or Path(origen).parts[:1] != ("_entrada",):
            raise ValueError(f"Falta origen explícito en _entrada/ para {d['id']}.")
        fuente = ruta_segura(vault, origen)
        if fuente.suffix.lower() != ".pdf" or sha256(fuente) != o.get("sha256"):
            raise Conflicto(f"Cambió la fuente de {d['id']} o su SHA-256 es incorrecto.")
        destino = ruta_segura(raiz, d["archivo"])
        if destino.exists() and sha256(destino) != o.get("sha256"):
            raise Conflicto("La copia de destino ya existe y es otro archivo; se preservó sin sobrescribirla.")
        origenes[d["id"]] = fuente
        copias.append({"origen": origen, "archivo": d["archivo"], "sha256": o["sha256"]})
    validacion = validar(raiz, slug, indice=indice, contrato=paquete["curso_md"], origenes=origenes, max_tokens=max_tokens)
    if not validacion["ok"]:
        raise ValueError("Propuesta inválida: " + "; ".join(validacion["errores"]))
    cambios = "".join("".join(difflib.unified_diff(base.get(nombre, "").splitlines(True), nuevo.splitlines(True), fromfile=nombre, tofile=nombre + " (propuesta)"))
                      for nombre, nuevo in [("indice.yaml", paquete["indice_yaml"]), ("curso.md", paquete["curso_md"])])
    resumen = {"curso": slug, "nuevo": not raiz.exists(), "base": firma(base), "huella": hashlib.sha256(crudo.encode()).hexdigest(),
               "diff": cambios, "copias": copias, "validacion": validacion}
    return resumen, paquete


def aplicar(vault: Path, slug: str, propuesta: Path, base: str, huella: str, max_tokens=1500) -> dict:
    with bloquear(vault / "_procesado/curacion", vault):
        revision, paquete = revisar(vault, slug, propuesta, max_tokens)
        if revision["base"] != base or revision["huella"] != huella:
            raise Conflicto("Cambió el curso o la propuesta desde la revisión; revisá el diff otra vez.")
        final = raiz = carpeta(vault, slug)
        if revision["nuevo"]:
            # El curso nuevo se arma aparte y aparece completo; un armado cortado antes es nuestro (tenemos el bloqueo).
            raiz = ruta_segura(vault, f"cursos/.{slug}.nuevo")
            if raiz.exists():
                shutil.rmtree(raiz)
            raiz.mkdir(parents=True)
        for copia in revision["copias"]:
            fuente = ruta_segura(vault, copia["origen"])
            destino = ruta_segura(raiz, copia["archivo"])
            if destino.exists():
                continue  # revisar comprobó que es la misma copia, completa
            destino.parent.mkdir(parents=True, exist_ok=True)
            parcial = destino.with_name(f".{destino.name}.parcial-{os.getpid()}")
            try:
                with fuente.open("rb") as entrada, parcial.open("wb") as salida:
                    shutil.copyfileobj(entrada, salida)
                    salida.flush()
                    os.fsync(salida.fileno())
                if sha256(parcial) != copia["sha256"]:
                    raise Conflicto("La fuente cambió durante la copia; no se publicó el índice.")
                os.link(parcial, destino)
            finally:
                parcial.unlink(missing_ok=True)
        if not revision["nuevo"] and firma({n: texto(raiz, n) for n in ["indice.yaml", "curso.md", "progreso.yaml"]}) != base:
            raise Conflicto("El curso se editó durante la copia; se preservaron sus documentos de curación.")
        for nombre in ["sesiones/adjuntos", "notas/verificaciones"]:
            ruta_segura(raiz, nombre).mkdir(parents=True, exist_ok=True)
        if revision["nuevo"]:
            atomico(raiz, "progreso.yaml", "version: 1\ntemas: {}\nhistorial: []\n")
        for nombre, nuevo in [("indice.yaml", paquete["indice_yaml"]), ("curso.md", paquete["curso_md"])]:
            if not ruta_segura(raiz, nombre).exists() or texto(raiz, nombre) != nuevo:
                atomico(raiz, nombre, nuevo)
        if raiz != final:
            os.rename(raiz, final)
            raiz = final
        return {"curso": slug, "nuevo": revision["nuevo"], "copiados": len(revision["copias"]), "validacion": validar(raiz, slug, max_tokens=max_tokens)}


def publicar_informe(vault: Path, slug: str, max_tokens=1500) -> dict:
    raiz = carpeta(vault, slug)
    resultado = validar(raiz, slug, max_tokens=max_tokens)
    if not resultado["ok"]:
        raise ValueError("Corregí los errores de /curso-check antes de regenerar el informe: " + "; ".join(resultado["errores"]))
    indice = cargar_yaml(texto(raiz, "indice.yaml"))
    docs = {d["id"]: d for d in indice["documentos"]}
    lineas = [f"# Informe de {slug}", "", "Borrador curado para revisión del usuario. Página PDF base 1; rangos inclusivos.",
              "", "## Validación", "", f"- Estructura: {'válida' if resultado['ok'] else 'con errores'}.",
              f"- Listo para estudio sin avisos: {'sí' if resultado['listo_estudio'] else 'no'}."]
    lineas += [f"- {a}" for a in resultado["errores"] + resultado["avisos"]]
    lineas += ["", "## Tema → material", "", "| Unidad | Tema | Bibliografía (páginas PDF) | Ejercicios | Evaluaciones |", "|---|---|---|---|---|"]
    for t in indice["temas"]:
        bib = "; ".join(f"{r['doc']} · {r['seccion']} · " + cita(f"cursos/{slug}/{docs[r['doc']]['archivo']}", r["paginas"][0]) + f"–{r['paginas'][1]}" for r in t.get("bibliografia", []) if r.get("doc") in docs and isinstance(r.get("paginas"), list) and len(r["paginas"]) == 2)
        refs = ["; ".join(r["doc"] + ": " + ", ".join(r.get("items", [])) for r in t.get(k, [])) or "Pendiente de asignar" for k in ["ejercicios", "evaluaciones"]]
        celdas = [str(t["unidad"]), t["nombre"], bib or "Sin material", *refs]
        lineas.append("| " + " | ".join(x.replace("|", "\\|").replace("\n", " ") for x in celdas) + " |")
    lineas += ["", "## Ítems sin asignar", ""] + [f"- {i['doc']}/{i['id']}" for i in resultado.get("items_sin_asignar", [])]
    if not resultado.get("items_sin_asignar"):
        lineas.append("Ninguno entre los bancos ya segmentados; los documentos sin segmentación se avisan arriba.")
    lineas += ["", "## Documentos y preparación", ""]
    for d in docs.values():
        qs = leer_json(raiz, f"_procesado/{d['id']}/calidad.json", {"paginas": {}})["paginas"]
        rutas = Counter(q.get("ruta", "pendiente") for q in qs.values())
        lineas += [f"### {d['titulo']}", "", f"- {d['paginas']} páginas totales; {len(qs)} con registro; {d['paginas'] - len(qs)} sin preparar.",
                   "- Rutas sobre el PDF completo: " + ", ".join(f"{k}: {rutas[k]} ({100 * rutas[k] / d['paginas']:.1f} %)" for k in ["digital", "ocr", "vision", "pendiente"]) + ".", ""]
        for p, q in qs.items():
            if q.get("pendiente"):
                lineas.append(f"- Dudosa: {cita(f'cursos/{slug}/{d['archivo']}', int(p))} — {'; '.join(q.get('avisos', []))}")
    lineas += ["", "## Páginas referidas aún pendientes", ""]
    lineas += [f"- {i['doc']}: {cita(f'cursos/{slug}/{docs[i['doc']]['archivo']}', i['pagina'])}" for i in resultado["pendientes"]]
    with bloquear(raiz / "_procesado", vault) as salida:
        destino = ruta_segura(raiz, "informe-ingesta.md")
        control = leer_json(salida, "informe-curso.json")
        actual = sha256(destino) if destino.exists() else None
        if actual is not None and (not control or actual not in {control["sha256"], control.get("sha256_anterior")}):
            raise Conflicto("informe-ingesta.md tiene cambios manuales; se preservó.")
        contenido = "\n".join(lineas) + "\n"
        guardar_json(salida, "informe-curso.json", {"sha256": hashlib.sha256(contenido.encode()).hexdigest(), "sha256_anterior": actual})
        atomico(raiz, "informe-ingesta.md", contenido)
    return resultado


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("accion", choices=["validar", "revisar", "aplicar", "informe"])
    p.add_argument("--curso", required=True)
    p.add_argument("--vault", type=Path, default=Path.cwd())
    p.add_argument("--propuesta", type=Path)
    p.add_argument("--base")
    p.add_argument("--huella")
    args = p.parse_args()
    vault = args.vault.resolve()
    config = json.loads((Path(__file__).resolve().parents[2] / "curso.config.json").read_text())
    limite = config["max_tokens_curso_md"]
    if args.accion in {"revisar", "aplicar"}:
        if args.propuesta is None:
            p.error("Indicá --propuesta con un JSON dentro de _procesado/.")
        resultado = revisar(vault, args.curso, args.propuesta, limite)[0] if args.accion == "revisar" else aplicar(vault, args.curso, args.propuesta, args.base, args.huella, limite)
    else:
        resultado = validar(carpeta(vault, args.curso), args.curso, max_tokens=limite) if args.accion == "validar" else publicar_informe(vault, args.curso, limite)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 1 if resultado.get("ok") is False else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as e:
        print(f"No se completó la curación: {e}", file=sys.stderr)
        raise SystemExit(1)
