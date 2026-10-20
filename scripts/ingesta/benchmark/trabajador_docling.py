"""Ensayo aislado de docling con enriquecimiento de fórmulas, solo CPU y pesos fijados."""
from __future__ import annotations

import argparse
from importlib.metadata import version
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import time
import traceback

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from almacen import Conflicto, atomico, bloquear, guardar_json, leer_json


def main():
    parser = argparse.ArgumentParser(description="Medir docling local con fórmulas; nunca envía PDFs a servicios externos.")
    parser.add_argument("--entradas", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--vault", type=Path, default=Path.cwd())
    args = parser.parse_args()
    vault = args.vault.resolve()
    def interrumpir(*_):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrumpir)
    config = json.loads((vault / ".pi/config/benchmark-ml.json").read_text())
    entradas = json.loads(args.entradas.read_text())["paginas"]
    cache = vault / ".pi/scripts/ingesta/benchmark/.cache"
    cache.mkdir(exist_ok=True)
    os.environ.update({"HF_HOME": str(cache / "hf"), "HF_HUB_DISABLE_TELEMETRY": "1", "HF_HUB_DISABLE_IMPLICIT_TOKEN": "1",
                       "OMP_NUM_THREADS": str(config["hilos_cpu"]), "MKL_NUM_THREADS": str(config["hilos_cpu"]), "CUDA_VISIBLE_DEVICES": ""})
    with bloquear(args.salida.absolute(), vault) as raiz:
        anterior = leer_json(raiz, "resultados.json")
        if anterior and anterior.get("estado") == "completado":
            print("Docling ya tiene resultados; usá una salida nueva para repetir tiempos sin sobrescribirlos.")
            return
        estado = {"version": 1, "candidato": "docling", "version_paquete": version("docling-slim"), "estado": "descargando_modelos",
                  "cpu_hilos": config["hilos_cpu"], "formula_enrichment": True, "paginas": [], "modelos": config["modelos_docling"]}
        guardar_json(raiz, "resultados.json", estado)
        try:
            if shutil.disk_usage(cache).free < 4 * 2**30:
                raise RuntimeError("No hay margen suficiente de disco para los pesos y archivos temporales.")
            from huggingface_hub import snapshot_download
            artefactos = cache / "docling"
            inicio = time.perf_counter()
            for modelo in config["modelos_docling"]:
                snapshot_download(repo_id=modelo["repo"], revision=modelo["revision"],
                                  local_dir=artefactos / modelo["repo"].replace("/", "--"),
                                  allow_patterns=modelo.get("patrones"), token=False, max_workers=2)
            estado["segundos_descarga"] = round(time.perf_counter() - inicio, 3)
            from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
            from docling.document_converter import DocumentConverter, PdfFormatOption
            opciones = PdfPipelineOptions(
                artifacts_path=artefactos, do_formula_enrichment=True, do_ocr=True,
                ocr_options=TesseractCliOcrOptions(lang=["spa", "eng"]),
                accelerator_options=AcceleratorOptions(device=AcceleratorDevice.CPU, num_threads=config["hilos_cpu"]),
                enable_remote_services=False, allow_external_plugins=False,
                document_timeout=config["segundos_por_documento_docling"],
            )
            # La resolución de artefactos locales evita que un 'main' mutable cambie los pesos fijados.
            opciones.layout_options.model_spec.revision = config["modelos_docling"][0]["revision"]
            opciones.code_formula_options.model_spec.revision = config["modelos_docling"][1]["revision"]
            conversor = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opciones)})
            estado["estado"] = "convirtiendo"
            guardar_json(raiz, "resultados.json", estado)
            for entrada in entradas:
                inicio = time.perf_counter()
                resultado = {"doc": entrada["doc"], "pagina": entrada["pagina"], "sha256_fuente": entrada["sha256_fuente"]}
                try:
                    convertido = conversor.convert(Path(entrada["archivo"]), raises_on_error=False, max_num_pages=1)
                    texto = convertido.document.export_to_markdown()
                    nombre = f"{entrada['doc']}-p{entrada['pagina']:04}.md"
                    if (raiz / nombre).exists():
                        raise Conflicto("Ya existe un resultado para esa página; no se sobrescribió.")
                    atomico(raiz, nombre, texto + "\n")
                    resultado.update(archivo=nombre, estado=str(convertido.status), caracteres=len(texto))
                except Conflicto:
                    raise
                except Exception as error:
                    resultado.update(error=type(error).__name__, modulo=getattr(error, "name", None), aviso="Falló esta página; no se infiere su calidad.")
                    traceback.print_exc()
                resultado["segundos"] = round(time.perf_counter() - inicio, 3)
                estado["paginas"].append(resultado)
                guardar_json(raiz, "resultados.json", estado)
            estado["estado"] = "completado_con_errores" if any("error" in p for p in estado["paginas"]) else "completado"
        except BaseException as error:
            estado.update(estado="error", error=type(error).__name__, aviso="No se completó el ensayo de docling; ver proceso.log. No se eligió otro motor automáticamente.")
            raise
        finally:
            guardar_json(raiz, "resultados.json", estado)
        print(json.dumps({"estado": estado["estado"], "paginas": len(estado["paginas"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
