"""Persistencia de visión e ítems. Sin red: el modelo lo llama la extensión."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys

import pymupdf
import yaml

from almacen import Conflicto, atomico, bloquear, guardar_json, leer_json, ruta_segura, sha256
from cursos import puntos_validos
from extraccion import calidad
from pipeline import ahora, cita, construir_busqueda, firma, informe, pagina_verificada, recuperar_registro

PROMPT = r"""Transcribí fielmente TODA esta única página, en su idioma original.
No corrijas, completes ni uses tu memoria para reconstruir partes ausentes.
Conservá títulos, numeración de ejercicios y apartados, encabezados y pies.
Toda la matemática debe ir en LaTeX ($…$ o $$…$$).
Escapá los signos de moneda como \$ fuera de LaTeX; no son delimitadores matemáticos.
Conservá las tablas con sus filas, columnas, alineación y celdas vacías; no agregues filas.
Para figuras no tabulares escribí [Figura: descripción breve y fiel], sin inventar detalles.
Marcá [ilegible] sólo donde haya caracteres visibles que no puedas leer; no adivines.
Conservá los fragmentos que continúan en otra página sin completarlos: un salto de página no es ilegible.
Devolvé solamente Markdown, sin cercos de código ni comentarios sobre tu trabajo."""


def cargar(raiz: Path, vault: Path, doc: str):
    if not isinstance(doc, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", doc):
        raise ValueError("Documento inválido: se necesita su id, no una ruta.")
    meta = leer_json(raiz, f"{doc}/meta.json")
    if not meta or meta.get("id") != doc:
        raise ValueError("El documento no fue preparado por la ingesta base.")
    fuente = ruta_segura(vault, meta["archivo"])
    if fuente.suffix.lower() != ".pdf" or sha256(fuente) != meta["sha256"]:
        raise Conflicto("Cambió el PDF original; no se transcribió ni sobrescribió nada.")
    return meta, fuente, leer_json(raiz, f"{doc}/calidad.json")


def pagina(raiz: Path, doc: str, numero: int, meta: dict, calidades: dict):
    if type(numero) is not int or numero not in meta["seleccion"]:
        raise ValueError("La página debe estar en la selección de ingesta (PDF base 1).")
    anterior = calidades["paginas"].get(str(numero), {})
    q = recuperar_registro(raiz, doc, numero, anterior)
    if not q:
        raise ValueError("Falta el registro base de esa página; reanudá primero la ingesta.")
    texto = pagina_verificada(raiz, doc, numero, q)
    calidades["paginas"][str(numero)] = q
    if q != anterior:
        guardar_json(raiz, f"{doc}/calidad.json", calidades)
        actualizar(raiz)
    return q, texto


def clave_vision(meta: dict, modelo: str) -> str:
    if not isinstance(modelo, str) or not modelo.strip() or "/" not in modelo:
        raise ValueError("Falta el modelo de visión configurado.")
    return firma({"sha256": meta["sha256"], "archivo": meta["archivo"], "tipo": meta["tipo"],
                  "modelo": modelo, "prompt": PROMPT})


def preparar(raiz: Path, vault: Path, datos: dict) -> dict:
    doc, n = datos["doc"], datos["pagina"]
    meta, fuente, calidades = cargar(raiz, vault, doc)
    q, _ = pagina(raiz, doc, n, meta, calidades)
    clave = clave_vision(meta, datos["modelo"])
    resultado = {"pagina": n, "sha256_fuente": meta["sha256"], "sha256_anterior": q.get("sha256_markdown"),
                 "clave_vision": clave, "cita": cita(meta["archivo"], n),
                 "cache": q.get("vision", {}).get("clave") == clave and not q.get("error_vision")
                 and q.get("vision", {}).get("umbral", 0.6) == datos["umbral"]}
    if resultado["cache"]:
        actualizar(raiz)
        return resultado
    nombre = f"{doc}/render/{n:04}.png"
    imagen = ruta_segura(raiz, nombre)
    registro = leer_json(raiz, f"{doc}/render/{n:04}.json")
    if imagen.exists() and registro:
        if registro["sha256_fuente"] != meta["sha256"] or sha256(imagen) != registro["sha256_imagen"]:
            raise Conflicto("El render existente cambió; se preservó y no se envió al modelo.")
    else:
        with pymupdf.open(fuente) as pdf:
            p = pdf[n - 1]
            escala = 1800 / max(p.rect.width, p.rect.height)
            png = p.get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=False).tobytes("png")
        if imagen.exists() and sha256(imagen) != hashlib.sha256(png).hexdigest():
            raise Conflicto("El render sin registro difiere del original; se preservó.")
        if not imagen.exists():
            atomico(raiz, nombre, png)
        guardar_json(raiz, f"{doc}/render/{n:04}.json", {"sha256_fuente": meta["sha256"],
                     "sha256_imagen": hashlib.sha256(png).hexdigest()})
    return {**resultado, "imagen": str(imagen), "sha256_imagen": sha256(imagen), "prompt": PROMPT}


def actualizar(raiz: Path) -> None:
    # shortcut: reconstruye derivados por página; agrupar si domina el tiempo en cursos grandes.
    construir_busqueda(raiz)
    informe(raiz)
    total = procesadas = pendientes = 0
    for carpeta in raiz.iterdir():
        if not carpeta.is_dir() or carpeta.is_symlink() or not (carpeta / "meta.json").exists():
            continue
        meta = leer_json(raiz, f"{carpeta.name}/meta.json")
        qs = leer_json(raiz, f"{carpeta.name}/calidad.json")["paginas"]
        total += len(meta["seleccion"])
        procesadas += sum(str(n) in qs for n in meta["seleccion"])
        pendientes += sum(qs.get(str(n), {}).get("ruta", "pendiente") == "pendiente" for n in meta["seleccion"])
    estado = leer_json(raiz, "estado-ingesta.json", {})
    estado.update(solicitadas=total, procesadas=procesadas, pendientes=pendientes, actualizado=ahora(),
                  estado="interrumpida" if procesadas < total else "completada_con_pendientes" if pendientes else "completada")
    guardar_json(raiz, "estado-ingesta.json", estado)


def guardar(raiz: Path, vault: Path, datos: dict, *, fallo: bool = False) -> dict:
    doc, n = datos["doc"], datos["pagina"]
    meta, _, calidades = cargar(raiz, vault, doc)
    previo, markdown = pagina(raiz, doc, n, meta, calidades)
    clave = clave_vision(meta, datos["modelo"])
    if (datos["sha256_fuente"] != meta["sha256"] or datos["sha256_anterior"] != previo.get("sha256_markdown")
            or datos["clave_vision"] != clave):
        raise Conflicto("Cambió el documento o la página mientras se transcribía; no se sobrescribió.")
    q = dict(previo)
    if fallo and previo.get("ruta") in {"digital", "ocr"} and previo.get("puntaje", 0) >= datos["umbral"]:
        # La transcripción base ya era buena: el fallo sólo habilita reintentar.
        q.update(error_vision=True)
    elif fallo:
        q.update(pendiente=True, ruta="pendiente", requiere_vision=True, error_vision=True,
                 avisos=["Falló o se canceló visión; se conserva el texto anterior como provisional."])
    else:
        texto = datos.get("texto")
        if not isinstance(texto, str) or not texto.strip() or len(texto) > 100000 or datos.get("completa") is not True:
            raise ValueError("La respuesta está vacía, incompleta o es demasiado grande; se conserva el texto anterior.")
        # La imagen mixta ya se envió al modelo; no repetir el aviso de extracción solo textual.
        q.update(calidad(texto, {**q["clasificacion"], "clase": "digital"}, datos["umbral"]))
        if re.search(r"\[ilegible\]", texto, re.I):
            q.update(puntaje=min(q["puntaje"], 0.4), pendiente=True)
            q["avisos"].append("Visión dejó contenido ilegible; requiere revisión del original.")
        q.update(motor="vision", identidad_motor={"motor": "vision", "modelo": datos["modelo"], "prompt_sha256": hashlib.sha256(PROMPT.encode()).hexdigest()},
                 ruta="pendiente" if q["pendiente"] else "vision", requiere_vision=False,
                 vision={"clave": clave, "modelo": datos["modelo"], "umbral": datos["umbral"], "fecha": ahora(), "uso": datos.get("uso"),
                         "revision_humana": "pendiente"})
        q.pop("error", None)
        q.pop("error_vision", None)
        markdown = f"<!-- p. PDF {n} · impresa {q.get('impresa') or 'desconocida'} · {cita(meta['archivo'], n)} -->\n\n{texto.strip()}\n"
        q["sha256_markdown"] = hashlib.sha256(markdown.encode()).hexdigest()
    guardar_json(raiz, f"{doc}/cache/{n:04}.json", {"calidad": q, "markdown": markdown,
                 "sha256_anterior": previo.get("sha256_markdown")})
    if markdown is not None:
        atomico(raiz, f"{doc}/paginas/{n:04}.md", markdown)
    calidades["paginas"][str(n)] = q
    guardar_json(raiz, f"{doc}/calidad.json", calidades)
    actualizar(raiz)
    return {"pagina": n, "pendiente": q["pendiente"], "ruta": q["ruta"], "cita": cita(meta["archivo"], n)}


def guardar_items(raiz: Path, vault: Path, datos: dict) -> dict:
    doc = datos["doc"]
    meta, _, calidades = cargar(raiz, vault, doc)
    if meta["tipo"] not in {"ejercicios", "evaluaciones", "soluciones"}:
        raise ValueError("Solo ejercicios, evaluaciones y soluciones tienen ítems.")
    items = datos.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("Se necesita al menos un ítem segmentado por el agente.")
    ids, hashes = set(), {}
    for item in items:
        if not isinstance(item, dict) or set(item) - {"id", "paginas", "enunciado", "solucion", "solucion_de", "puntos"}:
            raise ValueError("Formato de ítem inválido.")
        identificador, paginas = item.get("id"), item.get("paginas")
        if not isinstance(identificador, str) or not identificador.strip() or len(identificador) > 80 or re.search(r"[\x00-\x1f\x7f]", identificador) or identificador in ids:
            raise ValueError("Los ids deben conservar la numeración original y ser únicos.")
        ids.add(identificador)
        if not isinstance(item.get("enunciado"), str) or not item["enunciado"].strip() or len(item["enunciado"]) > 50000:
            raise ValueError("Cada ítem necesita un enunciado no vacío y acotado.")
        if "puntos" in item and not puntos_validos(item["puntos"]):
            raise ValueError("puntos debe ser un número ≥ 0 o un texto de hasta 40 caracteres.")
        if not isinstance(paginas, list) or not paginas or any(type(p) is not int for p in paginas) or len(paginas) != len(set(paginas)):
            raise ValueError("Cada ítem necesita páginas PDF únicas.")
        for n in paginas:
            q, _ = pagina(raiz, doc, n, meta, calidades)
            if not q.get("vision") or q.get("error_vision"):
                raise ValueError("Primero transcribí con visión todas las páginas del ítem.")
            hashes[str(n)] = q["sha256_markdown"]
        solucion = item.get("solucion")
        if solucion is not None:
            if not isinstance(solucion, dict) or set(solucion) != {"doc", "id"}:
                raise ValueError("La solución necesita doc e id.")
            smeta, _, _ = cargar(raiz, vault, solucion["doc"])
            destino = ruta_segura(raiz, f"{solucion['doc']}/items.yaml")
            try:
                vinculados = yaml.safe_load(destino.read_text()) if destino.exists() else {}
            except yaml.YAMLError:
                raise ValueError("El archivo de ítems de soluciones no es YAML válido; se preservó.") from None
            if not isinstance(vinculados, dict) or not isinstance(vinculados.get("items", []), list):
                raise ValueError("El archivo de ítems de soluciones no tiene el formato esperado.")
            if smeta["tipo"] != "soluciones" or not any(isinstance(i, dict) and i.get("id") == solucion["id"] for i in vinculados.get("items", [])):
                raise ValueError("La solución referida no existe en el documento de soluciones.")
    por_id = {i["id"]: i for i in items}
    for item in items:
        enunciado = por_id.get(item["solucion_de"]) if isinstance(item.get("solucion_de"), str) else None
        if "solucion_de" in item and (enunciado is None or "solucion_de" in enunciado):
            raise ValueError(f"{item['id']}: solucion_de debe nombrar un enunciado de este mismo documento (sin cadenas ni ciclos).")
    nombre = f"{doc}/items.yaml"
    destino = ruta_segura(raiz, nombre)
    registro = leer_json(raiz, f"{doc}/items-registro.json")
    actual = sha256(destino) if destino.exists() else None
    if actual is not None and (not registro or actual not in {registro["sha256"], registro.get("sha256_anterior")}):
        raise Conflicto("items.yaml tiene cambios ajenos; se preservaron.")
    contenido = yaml.safe_dump({"version": 1, "doc": doc, "sha256_fuente": meta["sha256"],
                               "sha256_paginas": hashes, "revision_humana": "pendiente", "items": items},
                              allow_unicode=True, sort_keys=False, width=100)
    guardar_json(raiz, f"{doc}/items-registro.json", {"sha256": hashlib.sha256(contenido.encode()).hexdigest(),
                 "sha256_anterior": actual})
    atomico(raiz, nombre, contenido)
    return {"doc": doc, "items": len(items), "ids": [i["id"] for i in items], "revision_humana": "pendiente"}


def main():
    accion = sys.argv[1]
    datos = json.load(sys.stdin)
    vault = Path(datos["vault"]).resolve()
    with bloquear(Path(datos["salida"]).absolute(), vault) as raiz:
        if accion == "preparar":
            return preparar(raiz, vault, datos)
        if accion in {"guardar", "fallar"}:
            return guardar(raiz, vault, datos, fallo=accion == "fallar")
        if accion == "items":
            return guardar_items(raiz, vault, datos)
        raise ValueError("Acción de visión desconocida.")


if __name__ == "__main__":
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f"No se completó la operación: {error}", file=sys.stderr)
        raise SystemExit(1)
