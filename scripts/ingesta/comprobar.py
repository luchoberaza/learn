"""Comprueba solo lo necesario para la ingesta diaria, sin red ni extracción."""
from importlib.metadata import PackageNotFoundError, version
import json
from pathlib import Path
import subprocess
import sys

from pipeline import MOTORES

RECETA = "recrealo desde el vault: UV_PROJECT_ENVIRONMENT=.pi/.venv uv sync --project .pi/scripts/ingesta --python 3.13.13 --python-preference only-managed --locked"
chequeos = []


def verificar(ok, nombre, detalle):
    chequeos.append({"ok": bool(ok), "nombre": nombre, "detalle": detalle})


python_ok = sys.version_info[:3] == (3, 13, 13)
verificar(python_ok, "Python de ingesta", f"{sys.version.split()[0]}; entorno .pi/.venv" + ("" if python_ok else f"; se requiere 3.13.13 de uv, {RECETA}"))
for nombre, esperada in {"pymupdf": "1.28.2", "ocrmypdf": "17.13.0", "wordfreq": "3.1.1", "pyyaml": "6.0.3"}.items():
    try:
        encontrada = version(nombre)
    except PackageNotFoundError:
        encontrada = "ausente"
    verificar(encontrada == esperada, nombre, f"{encontrada}; se requiere {esperada}" + ("" if encontrada == esperada else f"; {RECETA}"))
config = json.loads((Path(__file__).resolve().parents[2] / "curso.config.json").read_text(encoding="utf-8"))
tesseract = Path(config.get("ruta_tesseract", "tesseract")).expanduser()
try:
    resultado = subprocess.run([tesseract, "--version"], capture_output=True, text=True, timeout=10, check=True)
    encontrada = next(iter(resultado.stdout.splitlines()), "sin versión")
    verificar(encontrada == "tesseract 5.5.2", "Tesseract", f"{encontrada}; versión existente 5.5.2")
    idiomas = subprocess.run([tesseract, "--list-langs"], capture_output=True, text=True, timeout=10, check=True).stdout.splitlines()
    verificar({"spa", "eng"}.issubset(set(idiomas)), "Idiomas OCR", "Se requieren spa y eng; ver SETUP.md")
except (OSError, subprocess.SubprocessError):
    verificar(False, "Tesseract / idiomas OCR", f"No disponible ({tesseract}); revisá ruta_tesseract en curso.config.json o la instalación en SETUP.md")
verificar(MOTORES == {"digital": "pymupdf", "escaneada": "ocrmypdf", "mixta": "pymupdf"},
          "Motores de ingesta", "PyMuPDF para digital/mixta; OCRmyPDF + Tesseract para escaneada; sin GPU ni servidores locales")
print(json.dumps({"chequeos": chequeos}, ensure_ascii=False))
