"""Adaptadores acotados por página; ningún motor escribe el PDF de entrada."""
from __future__ import annotations

from functools import lru_cache
from importlib.metadata import version
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata

import pymupdf
from wordfreq import zipf_frequency

VERSION_ALGORITMO = 3
SIMBOLOS = r"[∑∏∫√∀∃∈∉≤≥±∞α-ωΑ-Ω]|\w\s*\^\s*\w"
# Restos de fórmulas tras el OCR: variables sueltas ('d d d d'), un operador junto a una letra ('o+d', 't =')
# o una línea aislada de subíndices ('nodal proc cola trans prop').
RESTOS_OCR = (r"(?<![\w.])[b-df-np-tv-xzA-Z](?:[^\w\n]{1,3}[b-df-np-tv-xzA-Z](?![\w.])){2,}"
              r"|(?<!\w)[^\W\d_][ \t]*[=+]|[=+][ \t]*[^\W\d_](?!\w)"
              r"|(?:^|\n)[ \t]*\n[ \t]*[a-z]{2,6}(?:[ \t—–’”'\",-]+[a-z]{1,6}){2,}[ \t]*(?=\n[ \t]*\n|\n?\Z)")


def normalizar(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")


def tokens(texto: str) -> list[str]:
    return re.findall(r"[a-z0-9]{2,64}", normalizar(texto))


def area_union(rectangulos: list[tuple]) -> float:
    """No sumar dos veces máscaras o imágenes superpuestas."""
    xs = sorted({r[i] for r in rectangulos for i in (0, 2)})
    area = 0.0
    for a, b in zip(xs, xs[1:]):
        intervalos = sorted((r[1], r[3]) for r in rectangulos if r[0] < b and r[2] > a)
        borde = -math.inf
        for arriba, abajo in intervalos:
            area += (b - a) * max(0, abajo - max(arriba, borde))
            borde = max(borde, abajo)
    return area


def clasificar(pagina: pymupdf.Page) -> dict:
    texto = pagina.get_text("text", sort=True)
    letras = sum(c.isalpha() for c in texto)
    basura = sum(c == "\ufffd" or unicodedata.category(c) in {"Co", "Cs", "Cn"} for c in texto)
    rectangulos = []
    for imagen in pagina.get_image_info():
        r = pymupdf.Rect(imagen["bbox"]) & pagina.rect
        if not r.is_empty:
            rectangulos.append(tuple(r))
    proporcion = min(1, area_union(rectangulos) / max(1, pagina.rect.get_area()))
    if proporcion >= 0.75 or (letras < 30 and proporcion > 0.05):
        clase = "escaneada"
    elif proporcion >= 0.05:
        clase = "mixta"
    else:
        clase = "digital"
    trazas = pagina.get_texttrace()
    # El código monoespaciado y las viñetas de OpenSymbol/StarSymbol no son matemática; '=' suelto tampoco.
    spans = [span for bloque in pagina.get_text("dict")["blocks"] for linea in bloque.get("lines", []) for span in linea["spans"]
             if not span["flags"] & 8 and not re.search(r"OpenSymbol|StarSymbol", span["font"])]
    fuentes = {span["font"] for span in spans if re.search(r"Math|Symbol|CMSY|CMMI|CMEX", span["font"], re.I)}
    sospecha_matematica = bool(fuentes) or bool(re.search(SIMBOLOS, " ".join(span["text"] for span in spans)))
    sospecha_matematica |= any(span["flags"] & 1 and re.fullmatch(r"\s*[-−–+]?\d[\d.,]*\s*", span["text"]) for span in spans)
    return {"clase": clase, "caracteres": len(texto.strip()), "letras": letras,
            "proporcion_basura": round(basura / max(1, len(texto)), 4),
            "area_imagen": round(proporcion, 4), "capa_ocr_probable": clase == "escaneada" and letras >= 30,
            "texto_invisible": any(s.get("type") == 3 for s in trazas),
            "posible_matematica": sospecha_matematica,
            # MathematicalPi codifica operadores como dígitos: PyMuPDF extrae '5' por '=', '1' por '+' y '2' por '−'.
            "operadores_cifrados": any(re.search(r"Math(?:ematical)?Pi", f) for f in fuentes),
            "dibujos_vectoriales": len(pagina.get_drawings())}


def matematica_ocr(texto: str) -> bool:
    return bool(re.search(f"{SIMBOLOS}|{RESTOS_OCR}", texto))


def etiqueta_impresa(pagina: pymupdf.Page) -> tuple[str | None, str]:
    etiqueta = pagina.get_label()
    if etiqueta:
        return etiqueta, "etiqueta_pdf"
    for bloque in pagina.get_text("blocks"):
        if bloque[1] < pagina.rect.height * 0.1 or bloque[3] > pagina.rect.height * 0.9:
            lineas = bloque[4].strip().splitlines()
            for linea in lineas:
                # No adivinar a partir del desplazamiento PDF/papel ni de una fórmula.
                coincidencia = re.fullmatch(r"\s*(?:[Pp](?:á|a)g(?:ina|\.)?\s*)?(\d{1,5}|[ivxlcdm]{1,8})\s*", linea)
                if coincidencia:
                    return coincidencia[1], "encabezado_o_pie"
    return None, "desconocida"


def encabezados(pagina: pymupdf.Page) -> list[str]:
    lineas = []
    for bloque in pagina.get_text("dict")["blocks"]:
        for linea in bloque.get("lines", []):
            spans = linea["spans"]
            texto = "".join(s["text"] for s in spans).strip()
            if texto and linea["bbox"][1] > pagina.rect.height * 0.1 and linea["bbox"][3] < pagina.rect.height * 0.9:
                lineas.append((texto, max(s["size"] for s in spans)))
    tamanos = sorted(t for _, t in lineas)
    cuerpo = tamanos[len(tamanos) // 2] if tamanos else 0
    return [texto for texto, tamano in lineas if 3 < len(texto) < 150 and
            (tamano > cuerpo * 1.25 or re.match(r"^\d+(?:\.\d+){1,4}\s+[A-ZÁÉÍÓÚÑ]", texto))]


def identidad_motor(motor: str, idiomas: list[str]) -> dict:
    if motor not in {"pymupdf", "ocrmypdf"}:
        raise ValueError(f"Motor no implementado: {motor}.")
    identidad = {"motor": motor, "version": version(motor), "algoritmo": VERSION_ALGORITMO,
                 "idiomas": idiomas, "wordfreq": version("wordfreq"), "pymupdf": version("pymupdf")}
    if motor == "ocrmypdf":
        try:
            resultado = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, timeout=10, check=True)
            lenguas = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10, check=True)
        except (OSError, subprocess.SubprocessError):
            raise ValueError("No se encontró tesseract; instalalo según SETUP.md o fijá ruta_tesseract en curso.config.json.") from None
        identidad["tesseract"] = resultado.stdout.splitlines()[0]
        if not set(idiomas).issubset(set(lenguas.stdout.splitlines())):
            raise ValueError("Faltan idiomas OCR en tesseract; instalá spa y eng según SETUP.md o fijá ruta_tesseract en curso.config.json.")
    return identidad


def extraer(documento: pymupdf.Document, numero: int, motor: str, idiomas: list[str]) -> str:
    pagina = documento[numero - 1]
    if motor == "pymupdf":
        texto = pagina.get_text("text", sort=True).strip()
        for titulo in encabezados(pagina):
            texto = re.sub(rf"(?m)^\s*{re.escape(titulo)}\s*$", lambda m: "## " + titulo, texto)
        return texto
    if motor != "ocrmypdf":
        raise ValueError("Motor desconocido.")
    with tempfile.TemporaryDirectory(prefix="pi-ingesta-ocr-") as temporal:
        directorio = Path(temporal)
        entrada, salida, lateral = (directorio / n for n in ("entrada.pdf", "salida.pdf", "texto.txt"))
        with pymupdf.open() as copia:
            copia.insert_pdf(documento, from_page=numero - 1, to_page=numero - 1)
            copia.save(entrada)
        entorno = {**os.environ, "OMP_THREAD_LIMIT": "2"}
        resultado = subprocess.run(
            [sys.executable, "-m", "ocrmypdf", "--force-ocr", "--output-type", "pdf", "--optimize", "0",
             "--jobs", "1", "--language", "+".join(idiomas), "--sidecar", str(lateral),
             "--tesseract-timeout", "90", str(entrada), str(salida)],
            capture_output=True, text=True, timeout=120, env=entorno)
        if resultado.returncode != 0:
            raise RuntimeError(f"OCRmyPDF terminó con código {resultado.returncode}; la página queda pendiente.")
        if not lateral.exists():
            raise RuntimeError("OCRmyPDF no produjo texto lateral.")
        return lateral.read_text(encoding="utf-8").replace("\f", "").strip()


@lru_cache(maxsize=20000)
def palabra_valida(palabra: str) -> bool:
    return max(zipf_frequency(palabra, "es"), zipf_frequency(palabra, "en")) >= 1.5


def calidad(texto: str, clasificacion: dict, umbral: float) -> dict:
    sin_latex = re.sub(r"(?s)\$\$.*?\$\$|(?<!\\)\$[^$]*?(?<!\\)\$|\\\[.*?\\\]|\\\(.*?\\\)", " ", texto)
    palabras = re.findall(r"[^\W\d_]+", sin_latex, re.UNICODE)
    largas = [p for p in palabras if len(p) > 2]
    validas = sum(palabra_valida(p.lower()) for p in largas) / max(1, len(largas))
    basura = sum(c == "\ufffd" or unicodedata.category(c) in {"Co", "Cs", "Cn"} or
                 (unicodedata.category(c) == "Cc" and c not in "\n\t\r") for c in texto) / max(1, len(texto))
    solitarias = sum(len(p) == 1 for p in palabras) / max(1, len(palabras))
    delimitadores = re.findall(r"(?<!\\)\$\$?", texto)
    pila = []
    for delimitador in delimitadores:
        if pila and pila[-1] == delimitador:
            pila.pop()
        else:
            pila.append(delimitador)
    latex_roto = bool(pila) or texto.count(r"\[") != texto.count(r"\]") or texto.count(r"\(") != texto.count(r"\)")
    avisos = []
    puntaje = 0.5 * validas + 0.2 * (1 - min(1, basura * 10)) + 0.1 * (1 - solitarias) + 0.2 * min(1, len(texto.strip()) / 150)
    if validas < 0.45:
        avisos.append("Pocas palabras reconocibles en español o inglés.")
        puntaje = min(puntaje, 0.5)
    if basura > 0.02:
        avisos.append("Caracteres de reemplazo o basura.")
        puntaje = min(puntaje, 0.3)
    if latex_roto:
        avisos.append("Delimitadores de LaTeX desbalanceados.")
        puntaje = min(puntaje, 0.4)
    if clasificacion.get("posible_matematica") and not delimitadores and r"\(" not in texto and r"\[" not in texto:
        avisos.append("Posible matemática sin LaTeX: revisar el original; no se reconstruyó ni inventó.")
        puntaje = min(puntaje, 0.55)
    if clasificacion.get("clase") == "mixta":
        avisos.append("Figuras o tablas rasterizadas: la estructura visual no fue transcrita.")
        puntaje = min(puntaje, 0.55)
    if len(texto.strip()) < 30:
        if clasificacion.get("area_imagen", 0) > 0.05 or clasificacion.get("dibujos_vectoriales", 0) > 0:
            avisos.append("Página casi vacía en texto pero con contenido visual.")
            puntaje = min(puntaje, 0.1)
        elif not texto.strip():
            puntaje = 1.0
            avisos = ["Página aparentemente en blanco."]
    puntaje = round(max(0, min(1, puntaje)), 4)
    return {"puntaje": puntaje, "pendiente": puntaje < umbral, "avisos": avisos,
            "metricas": {"palabras_validas": round(validas, 4), "basura": round(basura, 4),
                         "tokens_una_letra": round(solitarias, 4), "latex_desbalanceado": latex_roto}}
