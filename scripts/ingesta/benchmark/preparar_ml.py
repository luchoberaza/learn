"""Copias de una página, identificadas por su ancla original; jamás tocar fuentes."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pymupdf

from almacen import Conflicto, bloquear, guardar_json, leer_json, ruta_segura, sha256

parser = argparse.ArgumentParser(description="Preparar entradas pequeñas del benchmark ML sin alterar PDFs fuente.")
parser.add_argument("--salida", type=Path, required=True)
parser.add_argument("--vault", type=Path, default=Path.cwd())
args = parser.parse_args()
vault = args.vault.resolve()
base = json.loads((vault / ".pi/config/muestras-fase1.json").read_text())
ml = json.loads((vault / ".pi/config/benchmark-ml.json").read_text())
fuentes = {d["id"]: d for d in base["documentos"]}
with bloquear(args.salida.absolute(), vault) as raiz:
    anterior = leer_json(raiz, "entradas.json", {"paginas": []})
    por_nombre = {p["nombre"]: p for p in anterior["paginas"]}
    entradas = []
    for muestra in ml["muestras"]:
        doc, n = muestra["doc"], muestra["pagina"]
        fuente = vault / fuentes[doc]["archivo"]
        huella = sha256(fuente)
        nombre = f"{doc}-p{n:04}.pdf"
        archivo = ruta_segura(raiz, nombre)
        if archivo.exists():
            previo = por_nombre.get(nombre, {})
            if previo.get("sha256_fuente") != huella or previo.get("sha256_copia") != sha256(archivo):
                raise Conflicto("La copia existente o su fuente cambió; no se sobrescribió.")
        else:
            with pymupdf.open(fuente) as pdf, pymupdf.open() as copia:
                copia.insert_pdf(pdf, from_page=n - 1, to_page=n - 1)
                copia.save(archivo)
        entradas.append({**muestra, "nombre": nombre, "archivo": str(archivo), "fuente": fuentes[doc]["archivo"],
                         "sha256_fuente": huella, "sha256_copia": sha256(archivo)})
        # Persistir cada copia para que una interrupción no deje copias sin registro.
        guardar_json(raiz, "entradas.json", {"version": 1, "paginas": entradas})
    print(json.dumps({"paginas": len(entradas), "entrada": str(raiz / "entradas.json")}, ensure_ascii=False))
