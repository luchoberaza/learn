#!/usr/bin/env python3
"""Mediciones reales de PyMuPDF y OCRmyPDF. No elige un ganador ni llama a LLMs."""
from __future__ import annotations

import argparse
import copy
from importlib.metadata import distribution
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from almacen import atomico, bloquear, guardar_json, leer_json, sha256
from pipeline import ejecutar


def peso_distribucion(nombre: str) -> int:
    dist = distribution(nombre)
    archivos = {dist.locate_file(f).resolve() for f in dist.files or []}
    return sum(f.stat().st_size for f in archivos if f.is_file())


def main():
    parser = argparse.ArgumentParser(description="Comparar los dos motores base con páginas reales y sin modelos.")
    parser.add_argument("--manifiesto", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--vault", type=Path, default=Path.cwd())
    args = parser.parse_args()
    vault = args.vault.resolve()
    base = json.loads(args.manifiesto.read_text())
    cantidad = sum(len(d["paginas"]) for d in base["documentos"])
    firmas = {d["archivo"]: sha256(vault / d["archivo"]) for d in base["documentos"]}
    with bloquear(args.salida.absolute(), vault) as raiz:
        resultados = {"version": 1, "estado": "en_curso", "criterio": "Medición parcial; falta revisión humana y el parcial escaneado real.",
                      "muestras": base["documentos"], "sha256_fuentes": firmas, "candidatos": {}}
        guardar_json(raiz, "benchmark-base.json", resultados)
        for motor in ["pymupdf", "ocrmypdf"]:
            manifiesto = copy.deepcopy(base)
            manifiesto["motores"] = {clase: motor for clase in ["digital", "escaneada", "mixta"]}
            inicio = time.perf_counter()
            estado = ejecutar(manifiesto, vault, raiz / motor)
            paginas = []
            for doc in base["documentos"]:
                calidad = leer_json(raiz, f"{motor}/{doc['id']}/calidad.json")["paginas"]
                for numero in doc["paginas"]:
                    paginas.append({"doc": doc["id"], "pagina": numero, **calidad[str(numero)]})
            resultados["candidatos"][motor] = {
                "segundos_totales": round(time.perf_counter() - inicio, 4),
                "segundos_pagina": round(sum(p["segundos"] for p in paginas) / len(paginas), 4),
                "peso_modulo_bytes": peso_distribucion(motor),
                "nota_peso": "Módulo propio, sin sumar dependencias; comparten el venv base. Medir también el venv con du.",
                "cache": estado["cache"], "paginas": paginas,
            }
            guardar_json(raiz, "benchmark-base.json", resultados)
        resultados["fuentes_intactas"] = all(sha256(vault / ruta) == huella for ruta, huella in firmas.items())
        resultados["estado"] = "medicion_base_completada" if resultados["fuentes_intactas"] else "error_fuente_cambiada"
        guardar_json(raiz, "benchmark-base.json", resultados)
        lineas = ["# Benchmark base — mediciones parciales", "", "> No hay elección de motor. Faltan marker, docling, visión de referencia, revisión humana y la muestra de parcial escaneado real.",
                  "", f"Se compararon las mismas {cantidad} páginas reales por candidato. Los puntajes son heurísticos, no exactitud de transcripción ni equivalentes a una revisión visual.", "",
                  "| Motor | Tiempo medio por página (s) | Módulo propio (MiB, sin dependencias) | Páginas marcadas pendientes | Errores de extracción |",
                  "|---|---:|---:|---:|---:|"]
        for motor, r in resultados["candidatos"].items():
            lineas.append(f"| {motor} | {r['segundos_pagina']:.3f} | {r['peso_modulo_bytes'] / 2**20:.1f} | {sum(p['ruta'] == 'pendiente' for p in r['paginas'])}/{cantidad} | {sum('error' in p for p in r['paginas'])} |")
        lineas.extend(["", "El tiempo por página incluye extracción y heurísticas de calidad, pero no importaciones/inventario iniciales. El JSON guarda también el tiempo total. Si se reutilizó caché, los tiempos por página pertenecen a la extracción original.",
                       "", "## Informes para revisar", "", f"- [[{raiz.relative_to(vault).as_posix()}/pymupdf/informe-ingesta|PyMuPDF]]",
                       f"- [[{raiz.relative_to(vault).as_posix()}/ocrmypdf/informe-ingesta|OCRmyPDF + tesseract spa+eng]]", "",
                       "Los originales conservan sus SHA-256." if resultados["fuentes_intactas"] else "ATENCIÓN: se detectó un cambio externo en una fuente.", ""])
        atomico(raiz, "informe-benchmark-base.md", "\n".join(lineas))
        print(json.dumps({"estado": resultados["estado"], "fuentes_intactas": resultados["fuentes_intactas"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
