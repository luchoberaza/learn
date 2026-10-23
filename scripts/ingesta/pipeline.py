"""Pasos A–D, F y H. Sin llamadas a modelos y sin crear un curso curado."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time

import pymupdf

from almacen import Conflicto, atomico, bloquear, guardar_json, leer_json, ruta_segura, salida_segura, sha256
from extraccion import calidad, clasificar, encabezados, etiqueta_impresa, extraer, identidad_motor, matematica_ocr, tokens

TIPOS = {"programa", "bibliografia", "ejercicios", "evaluaciones", "soluciones", "otros"}
MOTORES = {"digital": "pymupdf", "escaneada": "ocrmypdf", "mixta": "pymupdf"}
# Encabezado con mayúscula: un renglón cortado de la solución («pregunta 2 …») no reabre el enunciado.
PREGUNTA = re.compile(r"[\s#>*_]*(?:Pregunta|PREGUNTA|Ejercicio|EJERCICIO|Problema|PROBLEMA)\s+\d")
SOLUCION = re.compile(r"[\s#>*_]*(?:soluci[oó]n|resoluci[oó]n|rta\.?\s*:)|[\s#>]*(?:[*_]+\s*respuesta|respuestas?\s*(?::|$))", re.I)


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def firma(datos: object) -> str:
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def validar_manifiesto(manifiesto: dict, vault: Path, salida: Path) -> list[dict]:
    if manifiesto.get("version") != 1 or not isinstance(manifiesto.get("documentos"), list) or not manifiesto["documentos"]:
        raise ValueError("El manifiesto necesita version: 1 y documentos no vacíos.")
    motores = manifiesto.get("motores", MOTORES)
    if set(motores) != {"digital", "escaneada", "mixta"} or any(m not in {"pymupdf", "ocrmypdf"} for m in motores.values()):
        raise ValueError("Los motores deben cubrir digital, escaneada y mixta con pymupdf u ocrmypdf.")
    documentos = []
    ids = set()
    for original in manifiesto["documentos"]:
        doc = dict(original)
        identificador = doc.get("id", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identificador) or identificador in ids:
            raise ValueError("Cada documento necesita un id slug único y sin tildes.")
        ids.add(identificador)
        if doc.get("tipo") not in TIPOS or not isinstance(doc.get("titulo"), str) or not doc["titulo"].strip():
            raise ValueError("Cada documento necesita tipo válido y título.")
        fuente = (vault / doc.get("archivo", "")).resolve(strict=True)
        if not fuente.is_relative_to(vault) or not fuente.is_file() or fuente.suffix.lower() != ".pdf" or fuente.is_relative_to(salida.resolve()):
            raise ValueError("El PDF debe estar dentro del vault y fuera de la salida generada.")
        doc["archivo"] = fuente.relative_to(vault).as_posix()
        # Un enlace de Obsidian no puede representarse fielmente con estos caracteres sin escape adicional.
        if any(c in doc["archivo"] for c in "#[]|\n\r"):
            raise ValueError("El nombre del PDF contiene caracteres incompatibles con la cita de Obsidian.")
        with pymupdf.open(fuente) as pdf:
            if pdf.needs_pass:
                raise ValueError("El PDF está protegido; no se intentó quitar su contraseña.")
            seleccion = doc.get("paginas")
            if seleccion == "todas":
                seleccion = list(range(1, len(pdf) + 1))
            if not isinstance(seleccion, list) or not seleccion or any(type(p) is not int or not 1 <= p <= len(pdf) for p in seleccion):
                raise ValueError("Declarar páginas PDF válidas (base 1) o la palabra todas.")
            doc["paginas"] = sorted(set(seleccion))
        documentos.append(doc)
    return documentos


def estructura(pdf: pymupdf.Document, titulos: dict[int, list[str]]) -> dict:
    outline = [fila for fila in pdf.get_toc() if 1 <= fila[2] <= len(pdf)]
    entradas = []
    if outline:
        for i, (nivel, titulo, pagina) in enumerate(outline):
            siguientes = [fila[2] for fila in outline[i + 1:] if fila[0] <= nivel and fila[2] > pagina]
            fin = min(siguientes) - 1 if siguientes else len(pdf)
            entradas.append({"nivel": nivel, "titulo": titulo, "paginas": [pagina, max(pagina, fin)]})
        metodo = "outline_pdf"
    else:
        detectadas = [(p, t) for p, ts in sorted(titulos.items()) for t in ts]
        for i, (pagina, titulo) in enumerate(detectadas):
            siguientes = [p for p, _ in detectadas[i + 1:] if p > pagina]
            fin = siguientes[0] - 1 if siguientes else len(pdf)
            entradas.append({"nivel": 1, "titulo": titulo, "paginas": [pagina, max(pagina, fin)]})
        metodo = "encabezados" if entradas else "pendiente_revision_indice"
    return {"version": 1, "metodo": metodo, "alcance": "outline completo; encabezados solo de páginas procesadas",
            "secciones": entradas, "pendiente_revision": not bool(outline)}


def cita(archivo: str, pagina: int) -> str:
    return f"[[{archivo}#page={pagina}]]"


def contenido_pagina(texto: str) -> str:
    return texto.split("\n\n", 1)[1] if texto.startswith("<!-- p. PDF ") and "\n\n" in texto else texto


def editada(raiz: Path, doc: str, numero: int) -> Conflicto:
    return Conflicto(f"La página {doc}/{numero:04}.md fue editada fuera de la ingesta; se preservó y no se indexa. Para conservarla: "
                     f".pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py adoptar --salida {shlex.quote(str(raiz))} --doc {doc} --pagina {numero}")


def pagina_verificada(raiz: Path, id_doc: str, numero: int, entrada: dict) -> str | None:
    pagina = ruta_segura(raiz, f"{id_doc}/paginas/{numero:04}.md")
    if not pagina.exists():
        return None
    if not entrada.get("sha256_markdown") or sha256(pagina) != entrada["sha256_markdown"]:
        raise editada(raiz, id_doc, numero)
    return pagina.read_text(encoding="utf-8")


def recuperar_registro(raiz: Path, doc: str, numero: int, previo: dict) -> dict:
    """Un registro atómico es la fuente de verdad tras un corte entre archivos."""
    registro = leer_json(raiz, f"{doc}/cache/{numero:04}.json")
    if registro is None:
        return previo
    entrada, markdown = registro["calidad"], registro["markdown"]
    archivo = ruta_segura(raiz, f"{doc}/paginas/{numero:04}.md")
    if markdown is not None:
        actual = sha256(archivo) if archivo.exists() else None
        esperado = entrada["sha256_markdown"]
        if actual not in {None, esperado, registro.get("sha256_anterior")}:
            raise editada(raiz, doc, numero)
        if actual != esperado:
            atomico(raiz, f"{doc}/paginas/{numero:04}.md", markdown)
    elif archivo.exists():
        raise editada(raiz, doc, numero)
    return entrada


def adoptar(raiz: Path, doc: str, numero: int) -> dict:
    """Registra la edición humana de una página como su transcripción; la ingesta ya no la regenera."""
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", doc) or not leer_json(raiz, f"{doc}/meta.json"):
        raise ValueError("Documento inválido: usá el id de un documento ya ingerido.")
    calidades = leer_json(raiz, f"{doc}/calidad.json", {"paginas": {}})
    previo = (leer_json(raiz, f"{doc}/cache/{numero:04}.json") or {}).get("calidad") or calidades["paginas"].get(str(numero))
    archivo = ruta_segura(raiz, f"{doc}/paginas/{numero:04}.md")
    if not previo or not archivo.exists():
        raise ValueError("Esa página no tiene registro ni transcripción; procesala primero con la ingesta.")
    q = {k: v for k, v in previo.items() if k not in {"error", "error_vision"}}
    q.update(ruta="manual", motor="manual", pendiente=False, requiere_vision=False, revision_humana="hecha",
             sha256_markdown=sha256(archivo), avisos=["Edición humana adoptada: la ingesta no la regenera."])
    guardar_json(raiz, f"{doc}/cache/{numero:04}.json", {"calidad": q, "markdown": archivo.read_bytes().decode("utf-8"),
                                                         "sha256_anterior": previo.get("sha256_markdown")})
    calidades["paginas"][str(numero)] = q
    guardar_json(raiz, f"{doc}/calidad.json", calidades)
    return {"doc": doc, "pagina": numero, "ruta": "manual", "revision_humana": "hecha"}


def enunciados(texto: str, en_solucion: bool) -> tuple[str, bool]:
    """Sin el texto desde cada marcador de solución hasta la próxima pregunta; el estado sigue en la página siguiente."""
    lineas = []
    for linea in texto.splitlines():
        if PREGUNTA.match(linea):
            en_solucion = False
        elif SOLUCION.match(linea):
            en_solucion = True
        if not en_solucion:
            lineas.append(linea)
    return "\n".join(lineas), en_solucion


def construir_busqueda(raiz: Path) -> dict:
    fragmentos, editadas = [], []
    for carpeta in sorted(raiz.iterdir()):
        if not carpeta.is_dir() or carpeta.is_symlink() or not (carpeta / "meta.json").exists():
            continue
        doc = carpeta.name
        meta = leer_json(raiz, f"{doc}/meta.json")
        calidades = leer_json(raiz, f"{doc}/calidad.json", {"paginas": {}})["paginas"]
        secciones = leer_json(raiz, f"{doc}/estructura.json", {"secciones": []})["secciones"]
        en_solucion, siguiente = False, 1
        for p, cal in sorted(calidades.items(), key=lambda par: int(par[0])):
            try:
                markdown = pagina_verificada(raiz, doc, int(p), cal)
            except Conflicto as error:
                editadas.append(str(error))
                continue
            # Las soluciones no se buscan: llegan con leer_items después del intento.
            if markdown is None or meta["tipo"] == "soluciones":
                continue
            texto = contenido_pagina(markdown)
            if meta["tipo"] in {"evaluaciones", "ejercicios"}:
                # Tras una página faltante puede seguir una solución: no se indexa hasta la próxima pregunta.
                texto, en_solucion = enunciados(texto, en_solucion or int(p) != siguiente)
                siguiente = int(p) + 1
            if not texto.strip():
                continue
            posibles = [s for s in secciones if s["paginas"][0] <= int(p) <= s["paginas"][1]]
            seccion = max(posibles, key=lambda s: s["nivel"])["titulo"] if posibles else None
            # ~1000–1500 tokens: tope de 4000 caracteres, corte por palabras; sin mezclar páginas.
            partes = re.findall(r".{1,4000}(?:\s+|$)|\S{4000}", texto.replace("\n", " "))
            for parte in partes:
                terminos = tokens(parte)
                if not terminos:
                    continue
                fragmentos.append({"doc": doc, "titulo": meta["titulo"], "tipo": meta["tipo"], "pagina": int(p),
                                   "seccion": seccion, "texto": parte.strip(), "cita": cita(meta["archivo"], int(p)),
                                   "calidad": cal["puntaje"], "pendiente": cal["ruta"] == "pendiente",
                                   "largo": len(terminos), "frecuencias": dict(Counter(terminos))})
    df = Counter(termino for f in fragmentos for termino in f["frecuencias"])
    resultado = {"version": 1, "normalizacion": "NFD-sin-tildes-v1", "k1": 1.2, "b": 0.75,
                 "cantidad": len(fragmentos), "largo_promedio": sum(f["largo"] for f in fragmentos) / max(1, len(fragmentos)),
                 "df": dict(df), "fragmentos": fragmentos, "editadas": editadas}
    guardar_json(raiz, "busqueda.json", resultado)
    estado = leer_json(raiz, "estado-ingesta.json")
    if estado is not None and estado.get("editadas", []) != editadas:
        guardar_json(raiz, "estado-ingesta.json", {**estado, "editadas": editadas})
    return resultado


def informe(raiz: Path) -> None:
    lineas = ["# Informe de ingesta base", "", "> Preparación técnica: no es un curso curado ni una validación de ítems.",
              "", "Las páginas son las del PDF (base 1). Los enlaces abren los originales sin modificarlos.",
              "Los puntajes son heurísticos: no prueban fidelidad matemática. La matemática no recuperada en LaTeX se señala para revisión.", ""]
    for carpeta in sorted(raiz.iterdir()):
        if not carpeta.is_dir() or carpeta.is_symlink() or not (carpeta / "meta.json").exists():
            continue
        doc = carpeta.name
        meta = leer_json(raiz, f"{doc}/meta.json")
        calidades = leer_json(raiz, f"{doc}/calidad.json", {"paginas": {}})["paginas"]
        solicitadas = meta["seleccion"]
        procesadas = {p: q for p, q in calidades.items() if int(p) in solicitadas}
        rutas = Counter(q["ruta"] for q in procesadas.values())
        clases = Counter(q.get("clasificacion", {}).get("clase", "desconocida") for q in procesadas.values())
        lineas.extend([f"## {meta['titulo']}", "", f"- Documento: `{doc}` · tipo: `{meta['tipo']}`.",
                       f"- PDF completo: **{meta['paginas']} páginas**; solicitadas: **{len(solicitadas)}**; con registro: **{len(procesadas)}**.",
                       f"- Fuera de esta selección: {meta['paginas'] - len(solicitadas)}; no se declara procesado el documento completo.",
                       "- Rutas sobre la selección solicitada: " + ", ".join(f"{r}: {rutas[r]} ({100 * rutas[r] / len(solicitadas):.1f} %)" for r in ["digital", "ocr", "vision", "manual", "pendiente"]) + ".",
                       f"- Clasificaciones observadas: {dict(clases)}.", "", "| Página PDF | Impresa | Motor | Puntaje | Estado | Avisos |",
                       "|---|---|---|---:|---|---|"])
        for numero in solicitadas:
            q = calidades.get(str(numero))
            if q is None:
                lineas.append(f"| {cita(meta['archivo'], numero)} | — | — | — | pendiente | No procesada todavía |")
                continue
            ruta, avisos = q["ruta"], q["avisos"]
            try:
                pagina_verificada(raiz, doc, numero, q)
            except Conflicto as error:
                ruta, avisos = "editada", [str(error)]
            avisos = "; ".join(avisos).replace("|", "\\|").replace("\n", " ") or "—"
            lineas.append(f"| {cita(meta['archivo'], numero)} | {q.get('impresa') or '—'} | {q.get('motor') or '—'} | {q['puntaje']:.2f} | {ruta} | {avisos} |")
        lineas.append("")
    lineas.extend(["## Mapeo e ítems", "", "- Tabla tema → material: **pendiente de la curación de Fase 3**; no se inventó a partir de BM25.",
                   "- Temas sin material: todavía no evaluables sin un índice curado.",
                   "- Ítems sin asignar: todavía no evaluables sin un índice curado; la segmentación se guarda por documento en items.yaml.", ""])
    atomico(raiz, "informe-ingesta.md", "\n".join(lineas))


def ejecutar(manifiesto: dict, vault: Path, salida: Path, *, limite_paginas: int | None = None, extractor=extraer) -> dict:
    vault = vault.resolve()
    salida = salida_segura(salida, vault)
    documentos = validar_manifiesto(manifiesto, vault, salida)
    umbral = manifiesto.get("umbral_calidad", 0.6)
    idiomas = manifiesto.get("idiomas_ocr", ["spa", "eng"])
    if not isinstance(umbral, (int, float)) or not 0 <= umbral <= 1 or not isinstance(idiomas, list) or not idiomas or any(not re.fullmatch(r"[a-z]{3}", i) for i in idiomas):
        raise ValueError("Umbral o idiomas OCR inválidos.")
    if limite_paginas is not None and limite_paginas < 1:
        raise ValueError("El límite de páginas debe ser positivo.")
    motores = manifiesto.get("motores", MOTORES)
    identidades = {"pymupdf": identidad_motor("pymupdf", idiomas)}

    def identidad(motor: str) -> dict:
        # La de ocrmypdf exige tesseract con los idiomas: sólo se calcula si hay páginas escaneadas.
        if motor not in identidades:
            identidades[motor] = identidad_motor(motor, idiomas)
        return identidades[motor]
    estado = {"version": 1, "estado": "en_curso", "pid": os.getpid(), "iniciado": ahora(), "actualizado": ahora(),
              "solicitadas": sum(len(d["paginas"]) for d in documentos), "procesadas": 0, "cache": 0, "pendientes": 0,
              "documento": None, "pagina": None}
    nuevas = 0
    with bloquear(salida, vault) as raiz:
        def progreso():
            estado["actualizado"] = ahora()
            guardar_json(raiz, "estado-ingesta.json", estado)
        progreso()
        try:
            for doc in documentos:
                identificador = doc["id"]
                fuente = vault / doc["archivo"]
                huella = sha256(fuente)
                anterior = leer_json(raiz, f"{identificador}/meta.json")
                if anterior and anterior["sha256"] != huella:
                    raise Conflicto(f"Cambió el PDF de {identificador}; usá una salida nueva para no sobrescribir resultados.")
                with pymupdf.open(fuente) as pdf:
                    calidades = leer_json(raiz, f"{identificador}/calidad.json", {"version": 1, "paginas": {}})
                    titulos = {int(p): q.get("encabezados", []) for p, q in calidades["paginas"].items()}
                    seleccion = sorted(set(doc["paginas"]) | set(anterior["seleccion"] if anterior else []))
                    editadas_doc = set()
                    for n in seleccion:
                        try:
                            recuperado = recuperar_registro(raiz, identificador, n, calidades["paginas"].get(str(n), {}))
                            if recuperado:
                                calidades["paginas"][str(n)] = recuperado
                            pagina_verificada(raiz, identificador, n, calidades["paginas"].get(str(n), {}))
                        except Conflicto:
                            editadas_doc.add(n)  # se preserva y se avisa; no frena el resto de la ingesta
                    guardar_json(raiz, f"{identificador}/calidad.json", calidades)
                    meta = {"version": 1, "id": identificador, "sha256": huella, "paginas": len(pdf), "titulo": doc["titulo"],
                            "tipo": doc["tipo"], "archivo": doc["archivo"], "seleccion": seleccion,
                            "outline": pdf.get_toc(), "reglas_etiquetas_pdf": pdf.get_page_labels(), "motores": identidades}
                    guardar_json(raiz, f"{identificador}/meta.json", meta)
                    for numero in doc["paginas"]:
                        estado.update(documento=identificador, pagina=numero)
                        previo = calidades["paginas"].get(str(numero), {})
                        if numero in editadas_doc:
                            estado["procesadas"] += 1
                            estado["pendientes"] += 1
                            progreso()
                            continue
                        almacenado = pagina_verificada(raiz, identificador, numero, previo)
                        clase_previa = previo.get("clasificacion", {}).get("clase")
                        motor = motores.get(clase_previa)
                        try:
                            vigente = identidad(motor) if motor else None
                        except (OSError, ValueError, subprocess.SubprocessError):
                            vigente = previo.get("identidad_motor")  # sin tesseract no se descarta lo ya extraído
                        clave = firma({"sha256": huella, "pagina": numero, "motor": vigente, "umbral": umbral,
                                       "archivo": doc["archivo"], "tipo": doc["tipo"]})
                        # Visión y ediciones humanas no se regeneran desde el PDF mientras no cambien el archivo ni el tipo.
                        ajena = (almacenado is not None and previo.get("motor") in {"vision", "manual"} and anterior is not None
                                 and (anterior["archivo"], anterior["tipo"]) == (doc["archivo"], doc["tipo"]))
                        # Un fallo de visión sobre texto de la ingesta se recupera reextrayendo la página.
                        if (previo.get("clave") == clave and almacenado is not None and not previo.get("error")
                                and (ajena or not previo.get("error_vision"))):
                            estado["cache"] += 1
                            estado["procesadas"] += 1
                            estado["pendientes"] += previo["ruta"] == "pendiente"
                            progreso()
                            continue
                        if limite_paginas is not None and nuevas >= limite_paginas:
                            estado["estado"] = "interrumpida"
                            estado["editadas"] = construir_busqueda(raiz)["editadas"]
                            informe(raiz)
                            progreso()
                            return estado
                        progreso()
                        inicio = time.perf_counter()
                        resultado = {"clave": clave, "clasificacion": {"clase": "desconocida"}, "motor": None,
                                     "impresa": None, "encabezados": []}
                        try:
                            pagina = pdf[numero - 1]
                            clase = clasificar(pagina)
                            motor = motores[clase["clase"]]
                            clave = firma({"sha256": huella, "pagina": numero, "motor": identidad(motor), "umbral": umbral,
                                           "archivo": doc["archivo"], "tipo": doc["tipo"]})
                            if ajena:
                                # Sólo se actualiza la clasificación; la calidad de visión se recalcula como en vision.guardar.
                                resultado = {**previo, "clave": clave, "clasificacion": clase}
                                texto = contenido_pagina(almacenado)
                                if previo["motor"] == "vision" and not previo.get("error_vision"):
                                    resultado.update(calidad(texto, {**clase, "clase": "digital"}, umbral))
                                    if re.search(r"\[ilegible\]", texto, re.I):
                                        resultado.update(puntaje=min(resultado["puntaje"], 0.4), pendiente=True)
                                        resultado["avisos"].append("Visión dejó contenido ilegible; requiere revisión del original.")
                                    resultado["ruta"] = "pendiente" if resultado["pendiente"] else "vision"
                                markdown = almacenado
                            else:
                                impresa, metodo_etiqueta = etiqueta_impresa(pagina)
                                titulos[numero] = encabezados(pagina)
                                resultado.update(clave=clave, clasificacion=clase, motor=motor, identidad_motor=identidad(motor),
                                                 impresa=impresa, metodo_etiqueta=metodo_etiqueta, encabezados=titulos[numero])
                                # La capa OCR que ya trae el escaneo se usa siempre: Tesseract no arregla lo que la deja
                                # pendiente (fórmulas sin LaTeX) y cuesta 10–40 s por página. El tutor la ve marcada como OCR.
                                capa = motor == "ocrmypdf" and clase["capa_ocr_probable"]
                                if capa:
                                    resultado.update(motor="pymupdf", identidad_motor=identidad("pymupdf"), capa_ocr_previa=True)
                                texto = extractor(pdf, numero, "pymupdf" if capa else motor, idiomas)
                                if motor == "ocrmypdf":
                                    clase["posible_matematica"] |= matematica_ocr(texto)
                                resultado.update(calidad(texto, clase, umbral))
                                if clase["operadores_cifrados"]:
                                    resultado["avisos"].append("En esta página «5» puede ser «=», «1» «+» y «2» «−»: verificá con la imagen.")
                                resultado["requiere_vision"] = (resultado["pendiente"] or clase["posible_matematica"]
                                                                or doc["tipo"] in {"ejercicios", "evaluaciones", "soluciones"})
                                if doc["tipo"] in {"ejercicios", "evaluaciones", "soluciones"}:
                                    resultado["pendiente"] = True
                                    resultado["avisos"].append("Transcripción con visión obligatoria en Fase 2; este texto es provisional.")
                                ruta = "ocr" if motor == "ocrmypdf" or clase["clase"] == "escaneada" else "digital"
                                resultado["ruta"] = "pendiente" if resultado["pendiente"] else ruta
                                markdown = f"<!-- p. PDF {numero} · impresa {impresa or 'desconocida'} · {cita(doc['archivo'], numero)} -->\n\n{texto}\n"
                                resultado["sha256_markdown"] = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
                        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
                            if isinstance(error, Conflicto):
                                raise
                            markdown = almacenado
                            if ajena:
                                # Sin reclasificar (p. ej., sin tesseract) la visión o la edición humana sigue intacta.
                                resultado = dict(previo)
                            else:
                                resultado.update(puntaje=0, pendiente=True, ruta="pendiente", error=type(error).__name__,
                                                 avisos=[f"Falló la extracción ({type(error).__name__}: {error}); se continúa con las otras páginas."])
                                # Conservar un resultado previo como provisional si falló un reprocesamiento.
                                if almacenado is not None:
                                    resultado["sha256_markdown"] = previo["sha256_markdown"]
                                    resultado["avisos"].append("Se conserva el texto anterior como provisional.")
                        resultado["segundos"] = round(time.perf_counter() - inicio, 4)
                        guardar_json(raiz, f"{identificador}/cache/{numero:04}.json",
                                     {"calidad": resultado, "markdown": markdown, "sha256_anterior": previo.get("sha256_markdown")})
                        if markdown is not None:
                            atomico(raiz, f"{identificador}/paginas/{numero:04}.md", markdown)
                        calidades["paginas"][str(numero)] = resultado
                        guardar_json(raiz, f"{identificador}/calidad.json", calidades)
                        guardar_json(raiz, f"{identificador}/estructura.json", estructura(pdf, titulos))
                        nuevas += 1
                        estado["procesadas"] += 1
                        estado["pendientes"] += resultado["ruta"] == "pendiente"
                        progreso()
                        with ruta_segura(raiz, "ingesta.log").open("a", encoding="utf-8") as log:
                            log.write(json.dumps({"fecha": ahora(), "doc": identificador, "pagina": numero,
                                                  "motor": resultado["motor"], "ruta": resultado["ruta"], "segundos": resultado["segundos"]}, ensure_ascii=False) + "\n")
                    guardar_json(raiz, f"{identificador}/estructura.json", estructura(pdf, titulos))
            estado["editadas"] = construir_busqueda(raiz)["editadas"]
            informe(raiz)
            estado["estado"] = "completada_con_pendientes" if estado["pendientes"] else "completada"
        except (KeyboardInterrupt, SystemExit):
            estado["estado"] = "interrumpida"
            raise
        except Exception as error:
            estado.update(estado="error", error=str(error))
            raise
        finally:
            progreso()
    return estado
