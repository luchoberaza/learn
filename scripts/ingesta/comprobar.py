"""Comprueba solo lo necesario para la ingesta diaria, sin red ni extracción."""
from importlib.metadata import PackageNotFoundError, version
import json
import subprocess
import sys

from pipeline import MOTORES

chequeos = []


def verificar(ok, nombre, detalle):
    chequeos.append({"ok": bool(ok), "nombre": nombre, "detalle": detalle})


verificar(sys.version_info[:3] == (3, 13, 13), "Python de ingesta", f"{sys.version.split()[0]}; entorno .pi/.venv, creación en SETUP.md")
for nombre, esperada in {"pymupdf": "1.28.2", "ocrmypdf": "17.13.0", "wordfreq": "3.1.1"}.items():
    try:
        encontrada = version(nombre)
    except PackageNotFoundError:
        encontrada = "ausente"
    verificar(encontrada == esperada, nombre, f"{encontrada}; se requiere {esperada}; uv sync según SETUP.md")
try:
    resultado = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, timeout=10, check=True)
    encontrada = next(iter(resultado.stdout.splitlines()), "sin versión")
    verificar(encontrada == "tesseract 5.5.2", "Tesseract", f"{encontrada}; versión existente 5.5.2")
    idiomas = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10, check=True).stdout.splitlines()
    verificar({"spa", "eng"}.issubset(set(idiomas)), "Idiomas OCR", "Se requieren spa y eng; ver SETUP.md")
except (OSError, subprocess.SubprocessError):
    verificar(False, "Tesseract / idiomas OCR", "No disponible; instalación en SETUP.md")
verificar(MOTORES == {"digital": "pymupdf", "escaneada": "ocrmypdf", "mixta": "pymupdf"},
          "Motores de ingesta", "PyMuPDF para digital/mixta; OCRmyPDF + Tesseract para escaneada; sin GPU ni servidores locales")
print(json.dumps({"chequeos": chequeos}, ensure_ascii=False))
