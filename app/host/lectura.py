"""Copia para leer de un PDF del curso, para la ventana de PDF de la app (DA47): cada página vedada (trae un ítem
reservado para /simulacro, su solución o una casi copia) se cambia por una hoja en blanco del mismo tamaño que lo
avisa. Las demás se copian tal cual y la numeración no cambia: una cita a la página N sigue cayendo en la N.

Uso: python lectura.py --origen <pdf> --destino <pdf> --vedadas 3,8
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import pymupdf

AVISO = "Esta página trae un ejercicio guardado para el simulacro."
DETALLE = "Se ve después de rendirlo."
GRIS = (0.42, 0.44, 0.52)


def hoja_vedada(salida: pymupdf.Document, ancho: float, alto: float) -> None:
    hoja = salida.new_page(width=ancho, height=alto)
    # El aviso en una sola línea: se achica la letra hasta que entra en el 80 % del ancho.
    letra = max(9.0, ancho / 40)
    while letra > 6 and pymupdf.get_text_length(AVISO, fontname="helv", fontsize=letra) > ancho * 0.8:
        letra -= 0.5
    y = alto * 0.45
    for texto, tamano, desde in ((AVISO, letra, y), (DETALLE, letra * 0.8, y + letra * 1.9)):
        hoja.insert_textbox(pymupdf.Rect(ancho * 0.1, desde, ancho * 0.9, desde + tamano * 2.2), texto,
                            fontsize=tamano, fontname="helv", color=GRIS, align=pymupdf.TEXT_ALIGN_CENTER)


def copiar(origen: Path, destino: Path, vedadas: set[int]) -> dict:
    temporal = destino.with_name(f"{destino.name}.{os.getpid()}.tmp")
    with pymupdf.open(origen) as fuente, pymupdf.open() as salida:
        total = fuente.page_count
        if any(not 1 <= p <= total for p in vedadas):
            raise ValueError("Página vedada fuera del PDF.")
        p = 1
        while p <= total:
            if p in vedadas:
                r = fuente[p - 1].rect
                hoja_vedada(salida, r.width, r.height)
                p += 1
                continue
            # Los tramos sin vedadas van de una vez: insert_pdf por página es lento en un libro de cientos.
            hasta = p
            while hasta < total and hasta + 1 not in vedadas:
                hasta += 1
            salida.insert_pdf(fuente, from_page=p - 1, to_page=hasta - 1)
            p = hasta + 1
        try:
            salida.set_toc(fuente.get_toc(simple=True))
        except Exception:  # un índice mal formado no impide leer
            pass
        salida.save(temporal, garbage=3, deflate=True)
    os.replace(temporal, destino)
    return {"paginas": total, "vedadas": sorted(vedadas)}


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("--origen", required=True, type=Path)
    a.add_argument("--destino", required=True, type=Path)
    a.add_argument("--vedadas", default="")
    args = a.parse_args()
    vedadas = {int(x) for x in args.vedadas.split(",") if x.strip()}
    print(json.dumps(copiar(args.origen, args.destino, vedadas)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
