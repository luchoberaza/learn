"""Render pequeño del benchmark, con control de propiedad y hashes; no transcribe."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pymupdf

from almacen import Conflicto, bloquear, guardar_json, ruta_segura, sha256

parser = argparse.ArgumentParser(description="Renderizar las páginas de referencia sin modificar fuentes.")
parser.add_argument("--entradas", required=True, type=Path)
parser.add_argument("--salida", required=True, type=Path)
parser.add_argument("--vault", type=Path, default=Path.cwd())
args = parser.parse_args()
entradas = json.loads(args.entradas.read_text())["paginas"]
with bloquear(args.salida.absolute(), args.vault.resolve()) as raiz:
    imagenes = []
    for entrada in entradas:
        archivo = Path(entrada["archivo"])
        if sha256(archivo) != entrada["sha256_copia"]:
            raise Conflicto("La copia del benchmark cambió; no se renderizó.")
        with pymupdf.open(archivo) as pdf:
            escala = 1800 / max(pdf[0].rect.width, pdf[0].rect.height)
            png = pdf[0].get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=False).tobytes("png")
        nombre = f"{entrada['doc']}-p{entrada['pagina']:04}.png"
        destino = ruta_segura(raiz, nombre)
        esperado = hashlib.sha256(png).hexdigest()
        if destino.exists():
            if sha256(destino) != esperado:
                raise Conflicto("La imagen existente es distinta; no se sobrescribió.")
        else:
            with destino.open("xb") as archivo:
                archivo.write(png)
        imagenes.append({**entrada, "imagen": str(destino), "sha256_imagen": esperado})
    guardar_json(raiz, "imagenes.json", {"version": 1, "paginas": imagenes})
    print(json.dumps({"imagenes": len(imagenes)}, ensure_ascii=False))
