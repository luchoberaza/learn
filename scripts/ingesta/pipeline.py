"""Pasos A–D, F y H. Sin llamadas a modelos y sin crear un curso curado."""
from __future__ import annotations

from collections import Counter
from contextlib import nullcontext
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from datetime import datetime, timezone
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import re
import shlex
import subprocess
import time

import pymupdf

from almacen import PYTHON_TEXTO, Conflicto, atomico, bloquear, guardar_json, leer_json, ruta_segura, salida_segura, sha256
from extraccion import calidad, clasificar, encabezados, etiqueta_impresa, extraer, identidad_motor, matematica_ocr, tokens
from transcripcion import (MODELO, MUESTREO, TRAMO, VERSION_ALGORITMO as VERSION_GRABACION, Transcriptor, cantidad_tramos, cortes, decodificar,
                           dudosos, duracion, es_grabacion, habla, hora, inicio_nominal, parrafos)

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
        grabacion = es_grabacion(fuente)
        if not fuente.is_relative_to(vault) or not fuente.is_file() or (fuente.suffix.lower() != ".pdf" and not grabacion) or fuente.is_relative_to(salida.resolve()):
            raise ValueError("El PDF o la grabación debe estar dentro del vault y fuera de la salida generada.")
        doc["archivo"] = fuente.relative_to(vault).as_posix()
        # Un enlace de Obsidian no puede representarse fielmente con estos caracteres sin escape adicional.
        if any(c in doc["archivo"] for c in "#[]|\n\r"):
            raise ValueError("El nombre del archivo contiene caracteres incompatibles con la cita de Obsidian.")
        if grabacion:
            # Las «páginas» de una grabación son sus tramos de cinco minutos (DA51); no hay ejercicios ni parciales grabados.
            if doc["tipo"] not in {"bibliografia", "otros"}:
                raise ValueError(f"{identificador}: una grabación sólo puede ser bibliografía u otros.")
            total = cantidad_tramos(duracion(fuente))
        else:
            with pymupdf.open(fuente) as pdf:
                if pdf.needs_pass:
                    raise ValueError("El PDF está protegido; no se intentó quitar su contraseña.")
                total = len(pdf)
        seleccion = doc.get("paginas")
        if seleccion == "todas":
            seleccion = list(range(1, total + 1))
        if not isinstance(seleccion, list) or not seleccion or any(type(p) is not int or not 1 <= p <= total for p in seleccion):
            raise ValueError("Declarar páginas PDF válidas (base 1), tramos de la grabación o la palabra todas.")
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
    """La cita de una página de PDF o, en una grabación, del comienzo nominal de su tramo (#t= en segundos, DA51)."""
    return f"[[{archivo}#t={inicio_nominal(pagina)}]]" if es_grabacion(archivo) else f"[[{archivo}#page={pagina}]]"


def contenido_pagina(texto: str) -> str:
    return texto.split("\n\n", 1)[1] if texto.startswith(("<!-- p. PDF ", "<!-- tramo ")) and "\n\n" in texto else texto


def editada(raiz: Path, doc: str, numero: int) -> Conflicto:
    return Conflicto(f"La página {doc}/{numero:04}.md fue editada fuera de la ingesta; se preservó y no se indexa. Para conservarla: "
                     f"{PYTHON_TEXTO} .pi/scripts/ingesta/ingestar.py adoptar --salida {shlex.quote(str(raiz))} --doc {doc} --pagina {numero}")


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
        # Una grabación (DA51) se cuenta en tramos de cinco minutos, con la hora en que empieza cada uno.
        audio = "grabacion" in meta
        lineas.extend([f"## {meta['titulo']}", "", f"- Documento: `{doc}` · tipo: `{meta['tipo']}`.",
                       (f"- Grabación completa: **{meta['paginas']} tramos de {TRAMO // 60} minutos**" if audio else f"- PDF completo: **{meta['paginas']} páginas**")
                       + f"; solicitad{'o' if audio else 'a'}s: **{len(solicitadas)}**; con registro: **{len(procesadas)}**.",
                       f"- Fuera de esta selección: {meta['paginas'] - len(solicitadas)}; no se declara procesado el documento completo.",
                       "- Rutas sobre la selección solicitada: " + ", ".join(f"{r}: {rutas[r]} ({100 * rutas[r] / len(solicitadas):.1f} %)"
                                                                             for r in (["transcripcion", "manual", "pendiente"] if audio else ["digital", "ocr", "vision", "manual", "pendiente"])) + ".",
                       f"- Clasificaciones observadas: {dict(clases)}.", "", "| Tramo | Desde | Motor | Puntaje | Estado | Avisos |" if audio
                       else "| Página PDF | Impresa | Motor | Puntaje | Estado | Avisos |", "|---|---|---|---:|---|---|"])
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


def trabajadores_de_la_maquina() -> tuple[int, int]:
    """Páginas que se leen a la vez y escaneadas que pasan por OCR a la vez: la mitad de los hilos de la máquina.

    Cada OCR usa dos hilos (OMP_THREAD_LIMIT en extraer), por eso van la mitad de escaneadas. Windows no admite más de 61
    procesos en un ProcessPoolExecutor.
    """
    hilos = (getattr(os, "process_cpu_count", None) or os.cpu_count)() or 1
    return min(61, max(1, hilos // 2)), max(1, hilos // 4)


def analizar_pagina(pdf: pymupdf.Document, numero: int, doc: dict, previo: dict, almacenado: str | None, ajena: bool, clave: str,
                    huella: str, motores: dict, umbral: float, idiomas: list[str], identidad, extractor) -> tuple[dict, str | None, list | None]:
    """Clasifica, extrae y puntúa una página sin escribir nada: el registro, el Markdown y los encabezados, si los recalculó."""
    inicio = time.perf_counter()
    titulos = None
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
            titulos = encabezados(pagina)
            resultado.update(clave=clave, clasificacion=clase, motor=motor, identidad_motor=identidad(motor),
                             impresa=impresa, metodo_etiqueta=metodo_etiqueta, encabezados=titulos)
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
    return resultado, markdown, titulos


def estructura_grabacion() -> dict:
    return {"version": 1, "metodo": "tramos", "alcance": f"tramos de {TRAMO // 60} minutos", "secciones": [], "pendiente_revision": False}


def preparar_grabacion(raiz: Path, identificador: str, fuente: Path, huella: str, transcriptor) -> dict:
    """El audio entero, dónde se corta cada tramo y el idioma. Cortes e idioma se guardan en grabacion.json: al reanudar
    no se recalculan y los tramos quedan iguales."""
    tramos = cantidad_tramos(duracion(fuente))
    audio = decodificar(fuente)
    total = len(audio) / MUESTREO
    guardada = leer_json(raiz, f"{identificador}/grabacion.json")
    if not (guardada and guardada.get("version") == VERSION_GRABACION and guardada.get("sha256") == huella and guardada.get("tramos") == tramos):
        voz = habla(audio)
        # Sin voz no hay idioma que detectar: se asume el del curso. Si el modelo no carga, no se guarda nada y se reintenta.
        idioma = transcriptor.idioma(audio) if voz else "es"
        guardada = {"version": VERSION_GRABACION, "sha256": huella, "tramos": tramos, "duracion": round(total, 2),
                    "cortes": cortes(voz, total, tramos), "idioma": idioma}
        guardar_json(raiz, f"{identificador}/grabacion.json", guardada)
    return {"audio": audio, "tramos": tramos, "duracion": total, "cortes": guardada["cortes"], "idioma": guardada["idioma"]}


def analizar_tramo(grabacion: dict, numero: int, doc: dict, previo: dict, almacenado: str | None, ajena: bool, clave: str,
                   umbral: float, transcriptor) -> tuple[dict, str | None, None]:
    """Transcribe un tramo sin escribir nada: el registro y el Markdown, con un párrafo por minuto como mucho y su hora."""
    inicio = time.perf_counter()
    if ajena:
        # Una transcripción corregida a mano (adoptar) no se regenera.
        return {**previo, "clave": clave}, almacenado, None
    if "error" in grabacion:
        # No se pudo preparar la grabación (sin memoria para el modelo, por ejemplo): el tramo queda en sus minutos nominales.
        n, desde, hasta = None, float(inicio_nominal(numero)), float(inicio_nominal(numero + 1))
    else:
        n = grabacion["tramos"]
        desde = 0.0 if numero == 1 else grabacion["cortes"][numero - 2][0]
        hasta = grabacion["cortes"][numero - 1][0] if numero < n else grabacion["duracion"]
    resultado = {"clave": clave, "clasificacion": {"clase": "grabacion"}, "motor": "faster-whisper", "identidad_motor": transcriptor.identidad(),
                 "impresa": hora(desde), "metodo_etiqueta": "tiempo", "encabezados": [], "inicio": round(desde, 2), "fin": round(hasta, 2),
                 "idioma": grabacion.get("idioma")}
    try:
        if "error" in grabacion:
            raise grabacion["error"]
        audio = grabacion["audio"][int(desde * MUESTREO):int(hasta * MUESTREO)]
        segmentos = transcriptor.transcribir(audio, desde, grabacion["idioma"]) if len(audio) else []
        texto = parrafos(segmentos)
        resultado.update(calidad(texto, {"clase": "digital"}, umbral))
        avisos = [a for a in resultado["avisos"] if a != "Página aparentemente en blanco."]
        if not texto:
            avisos.append("Tramo sin voz detectada.")
        if malos := dudosos(segmentos):
            avisos.append(f"Audio dudoso cerca de {', '.join(malos[:5])}{' y en otros momentos' if len(malos) > 5 else ''}: escuchá la grabación antes de citarlo textual.")
        if numero > 1 and not grabacion["cortes"][numero - 2][1]:
            avisos.append(f"El tramo empieza sin una pausa cerca de {hora(desde)}: la primera frase puede estar cortada.")
        # Una transcripción no pasa por visión: lo dudoso queda avisado y lo resuelve escuchar la grabación.
        resultado.update(avisos=avisos, pendiente=False, requiere_vision=False, ruta="transcripcion", dispositivo=transcriptor.dispositivo)
        markdown = f"<!-- tramo {numero} de {n} · {hora(desde)}–{hora(hasta)} · {cita(doc['archivo'], numero)} -->\n\n{texto}\n"
        resultado["sha256_markdown"] = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    except (OSError, RuntimeError, ValueError) as error:
        markdown = almacenado
        # Sin memoria para el modelo (mkl_malloc, CUDA out of memory) no hay nada que corregir en la grabación.
        motivo = ("no hubo memoria para el modelo de transcripción: cerrá otros programas y reanudá la ingesta" if re.search(r"alloc|memory", str(error), re.I)
                  else f"{type(error).__name__}: {str(error)[:300]}")
        resultado.update(puntaje=0, pendiente=True, ruta="pendiente", requiere_vision=False, error=type(error).__name__,
                         avisos=[f"Falló la transcripción ({motivo}); se continúa con los otros tramos."])
        if almacenado is not None:
            resultado["sha256_markdown"] = previo["sha256_markdown"]
            resultado["avisos"].append("Se conserva el texto anterior como provisional.")
    resultado["segundos"] = round(time.perf_counter() - inicio, 4)
    return resultado, markdown, None


# Cada proceso del grupo guarda su turno de OCR, el PDF que tiene abierto y las identidades de los motores.
_TRABAJADOR: dict = {}


def _iniciar_trabajador(turno_ocr) -> None:
    _TRABAJADOR.update(turno_ocr=turno_ocr, identidades={}, ruta=None, pdf=None)


def _extraer_con_turno(pdf: pymupdf.Document, numero: int, motor: str, idiomas: list[str]) -> str:
    """El OCR espera turno: aunque todas las páginas sean escaneadas, queda libre la mitad de la máquina."""
    if motor != "ocrmypdf":
        return extraer(pdf, numero, motor, idiomas)
    with _TRABAJADOR["turno_ocr"]:
        return extraer(pdf, numero, motor, idiomas)


def _analizar_en_trabajador(fuente: str, numero: int, doc: dict, previo: dict, almacenado: str | None, ajena: bool, clave: str,
                            huella: str, motores: dict, umbral: float, idiomas: list[str]) -> tuple[dict, str | None, list | None]:
    if _TRABAJADOR["ruta"] != fuente:
        if _TRABAJADOR["pdf"] is not None:
            _TRABAJADOR["pdf"].close()
        _TRABAJADOR.update(ruta=None, pdf=None)
        # El proceso abre el PDF por su cuenta: si lo reemplazaron después de calcular la huella, no se mezcla.
        if sha256(Path(fuente)) != huella:
            raise Conflicto(f"Cambió el PDF de {doc['id']} durante la ingesta; usá una salida nueva para no sobrescribir resultados.")
        _TRABAJADOR.update(ruta=fuente, pdf=pymupdf.open(fuente))
    identidades = _TRABAJADOR["identidades"]

    def identidad(motor: str) -> dict:
        if motor not in identidades:
            identidades[motor] = identidad_motor(motor, idiomas)
        return identidades[motor]
    return analizar_pagina(_TRABAJADOR["pdf"], numero, doc, previo, almacenado, ajena, clave, huella, motores, umbral, idiomas,
                           identidad, _extraer_con_turno)


def ejecutar(manifiesto: dict, vault: Path, salida: Path, *, limite_paginas: int | None = None, extractor=extraer,
             trabajadores: tuple[int, int] = (1, 1), transcriptor=None) -> dict:
    """Ingesta base. `trabajadores` son las páginas que se procesan a la vez y las escaneadas que pasan por OCR a la vez
    (ingestar.py usa trabajadores_de_la_maquina); el resultado es el mismo que de a una. Las grabaciones (DA51) se
    transcriben de a un tramo con `transcriptor` (por defecto faster-whisper con tantos hilos como procesos)."""
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
    procesos, ocr_a_la_vez = trabajadores
    grupo = None  # los procesos se lanzan con el primer documento que tenga más de una página para procesar
    with bloquear(salida, vault) as raiz:
        ultimo_progreso = [0.0]

        def progreso(forzar: bool = False):
            # Uno por segundo como mucho: la barra lo lee cada 2 s y cada guardado sincroniza el disco.
            if not forzar and time.monotonic() - ultimo_progreso[0] < 1:
                return
            ultimo_progreso[0] = time.monotonic()
            estado["actualizado"] = ahora()
            guardar_json(raiz, "estado-ingesta.json", estado)
        progreso(True)

        def avisar(texto: str):
            # Lo que tarda y no es una página: bajar el modelo, transcribir un tramo. La barra lo muestra (ingesta-fondo.ts).
            estado["detalle"] = texto
            progreso(True)
        if transcriptor is None:
            transcriptor = Transcriptor(manifiesto.get("modelo_transcripcion", MODELO), hilos=procesos, avisar=avisar, carpeta=manifiesto.get("carpeta_modelos"))
        try:
            for doc in documentos:
                identificador = doc["id"]
                fuente = vault / doc["archivo"]
                huella = sha256(fuente)
                es_audio = es_grabacion(fuente)
                anterior = leer_json(raiz, f"{identificador}/meta.json")
                if anterior and anterior["sha256"] != huella:
                    raise Conflicto(f"Cambió {'la grabación' if es_audio else 'el PDF'} de {identificador}; usá una salida nueva para no sobrescribir resultados.")
                grabacion = None  # el audio, los cortes y el idioma, con el primer tramo que haya que transcribir
                with nullcontext() if es_audio else pymupdf.open(fuente) as pdf:
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
                    meta = {"version": 1, "id": identificador, "sha256": huella, "paginas": cantidad_tramos(duracion(fuente)) if es_audio else len(pdf),
                            "titulo": doc["titulo"], "tipo": doc["tipo"], "archivo": doc["archivo"], "seleccion": seleccion,
                            "outline": [] if es_audio else pdf.get_toc(), "reglas_etiquetas_pdf": [] if es_audio else pdf.get_page_labels(),
                            "motores": identidades, **({"grabacion": {"tramo": TRAMO}} if es_audio else {})}
                    guardar_json(raiz, f"{identificador}/meta.json", meta)

                    def revisar(numero: int) -> tuple:
                        """«editada», «cache» o «nueva», con lo que hace falta para procesarla."""
                        previo = calidades["paginas"].get(str(numero), {})
                        if numero in editadas_doc:
                            return ("editada", previo)
                        almacenado = pagina_verificada(raiz, identificador, numero, previo)
                        clase_previa = previo.get("clasificacion", {}).get("clase")
                        motor = motores.get(clase_previa)
                        try:
                            vigente = transcriptor.identidad() if es_audio else identidad(motor) if motor else None
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
                            return ("cache", previo)
                        return ("nueva", previo, almacenado, ajena, clave)
                    decisiones = {numero: revisar(numero) for numero in doc["paginas"]}
                    a_procesar = [n for n, d in decisiones.items() if d[0] == "nueva"]
                    if limite_paginas is not None:
                        a_procesar = a_procesar[:max(0, limite_paginas - nuevas)]
                    # Varias páginas a la vez en procesos aparte; acá se guardan en orden, igual que de a una. Un extractor
                    # inyectado (los tests) no viaja a otro proceso: va de a una.
                    futuros = {}
                    if not es_audio and procesos > 1 and extractor is extraer and len(a_procesar) > 1:
                        if grupo is None:
                            contexto = multiprocessing.get_context("spawn")
                            grupo = ProcessPoolExecutor(procesos, mp_context=contexto, initializer=_iniciar_trabajador,
                                                        initargs=(contexto.BoundedSemaphore(ocr_a_la_vez),))
                        try:
                            futuros = {n: grupo.submit(_analizar_en_trabajador, str(fuente), n, doc, *decisiones[n][1:], huella, motores,
                                                       umbral, idiomas) for n in a_procesar}
                        except BrokenProcessPool:
                            futuros = {}  # un proceso del grupo murió en un documento anterior: éste va de a una
                    volcado = {"pendiente": False, "momento": time.monotonic()}

                    def volcar(forzar: bool = False):
                        # calidad.json y estructura.json, uno por segundo como mucho: reescribirlos en cada página era la mitad
                        # del tiempo de un PDF digital. Tras un corte manda el registro de cada página en cache/ (recuperar_registro).
                        if not forzar and time.monotonic() - volcado["momento"] < 1:
                            return
                        if volcado["pendiente"]:
                            guardar_json(raiz, f"{identificador}/calidad.json", calidades)
                        guardar_json(raiz, f"{identificador}/estructura.json", estructura_grabacion() if es_audio else estructura(pdf, titulos))
                        volcado.update(pendiente=False, momento=time.monotonic())
                    try:
                        for numero in doc["paginas"]:
                            estado.update(documento=identificador, pagina=numero)
                            decision = decisiones[numero]
                            if decision[0] == "editada":
                                estado["procesadas"] += 1
                                estado["pendientes"] += 1
                                progreso()
                                continue
                            if decision[0] == "cache":
                                estado["cache"] += 1
                                estado["procesadas"] += 1
                                estado["pendientes"] += decision[1]["ruta"] == "pendiente"
                                progreso()
                                continue
                            _, previo, almacenado, ajena, clave = decision
                            if limite_paginas is not None and nuevas >= limite_paginas:
                                volcar(True)
                                estado["estado"] = "interrumpida"
                                estado["editadas"] = construir_busqueda(raiz)["editadas"]
                                informe(raiz)
                                progreso(True)
                                return estado
                            progreso()
                            analisis = None
                            if (futuro := futuros.pop(numero, None)) is not None:
                                try:
                                    analisis = futuro.result()
                                except BrokenProcessPool:
                                    pass  # murió un proceso del grupo: esta página se procesa acá
                                else:
                                    # La identidad del motor queda registrada como si la página se hubiera procesado acá (meta.json).
                                    try:
                                        if motor := motores.get(analisis[0]["clasificacion"].get("clase")):
                                            identidad(motor)
                                    except (OSError, ValueError, subprocess.SubprocessError):
                                        pass
                            if es_audio:
                                if grabacion is None and not ajena:
                                    avisar(f"Preparando la grabación {identificador}…")
                                    try:
                                        grabacion = preparar_grabacion(raiz, identificador, fuente, huella, transcriptor)
                                    except (OSError, RuntimeError, ValueError) as error:
                                        grabacion = {"error": error}  # cada tramo lo anota y la próxima corrida lo reintenta
                                avisar(f"Transcribiendo {identificador}: tramo {numero} de {meta['paginas']} (desde {hora(inicio_nominal(numero))})")
                                analisis = analizar_tramo(grabacion or {}, numero, doc, previo, almacenado, ajena, clave, umbral, transcriptor)
                            elif analisis is None:
                                analisis = analizar_pagina(pdf, numero, doc, previo, almacenado, ajena, clave, huella, motores, umbral,
                                                           idiomas, identidad, extractor)
                            resultado, markdown, titulos_pagina = analisis
                            if titulos_pagina is not None:
                                titulos[numero] = titulos_pagina
                            guardar_json(raiz, f"{identificador}/cache/{numero:04}.json",
                                         {"calidad": resultado, "markdown": markdown, "sha256_anterior": previo.get("sha256_markdown")})
                            if markdown is not None:
                                atomico(raiz, f"{identificador}/paginas/{numero:04}.md", markdown)
                            calidades["paginas"][str(numero)] = resultado
                            volcado["pendiente"] = True
                            volcar()
                            nuevas += 1
                            estado["procesadas"] += 1
                            estado["pendientes"] += resultado["ruta"] == "pendiente"
                            progreso()
                            with ruta_segura(raiz, "ingesta.log").open("a", encoding="utf-8") as log:
                                log.write(json.dumps({"fecha": ahora(), "doc": identificador, "pagina": numero,
                                                      "motor": resultado["motor"], "ruta": resultado["ruta"], "segundos": resultado["segundos"]}, ensure_ascii=False) + "\n")
                    finally:
                        for futuro in futuros.values():
                            futuro.cancel()
                        volcar(True)
                        estado.pop("detalle", None)
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
            if grupo is not None:
                # Cortada, no espera las páginas en curso: los procesos no escriben nada y terminan solos.
                grupo.shutdown(wait=estado["estado"] not in {"interrumpida", "error"}, cancel_futures=True)
            progreso(True)
    return estado
