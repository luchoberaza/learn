"""Ensayo aislado de marker 2: CPU, llama.cpp local y limpieza de sus servidores."""
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
    parser = argparse.ArgumentParser(description="Medir marker local; sin API LLM ni servidores persistentes del usuario.")
    parser.add_argument("--entradas", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--vault", type=Path, default=Path.cwd())
    parser.add_argument("--doc", help="Limitar un diagnóstico a un documento del conjunto")
    args = parser.parse_args()
    vault = args.vault.resolve()
    config = json.loads((vault / ".pi/config/benchmark-ml.json").read_text())
    entradas = json.loads(args.entradas.read_text())["paginas"]
    if args.doc:
        entradas = [e for e in entradas if e["doc"] == args.doc]
        if not entradas:
            raise ValueError("El documento pedido no pertenece al conjunto de muestras.")
    cache = vault / ".pi/scripts/ingesta/benchmark/.cache"
    hogar = cache / "marker-home"
    hogar.mkdir(parents=True, exist_ok=True)
    def interrumpir(*_):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrumpir)
    os.environ.update({"HOME": str(hogar), "XDG_CACHE_HOME": str(hogar / ".cache"), "HF_HOME": str(cache / "hf"),
                       "HF_HUB_DISABLE_TELEMETRY": "1", "HF_HUB_DISABLE_IMPLICIT_TOKEN": "1",
                       "OMP_NUM_THREADS": str(config["hilos_cpu"]), "MKL_NUM_THREADS": str(config["hilos_cpu"]),
                       "CUDA_VISIBLE_DEVICES": "", "TORCH_DEVICE": "cpu", "FAST_DETECTOR_DEVICE": "cpu",
                       "FAST_LAYOUT_NUM_THREADS": str(config["hilos_cpu"]), "MODEL_CACHE_DIR": str(cache / "surya"),
                       "SURYA_INFERENCE_BACKEND": "llamacpp", "SURYA_INFERENCE_KEEP_ALIVE": "false",
                       "LLAMA_CPP_BINARY": str(vault / ".pi/scripts/ingesta/benchmark/bin/llama-b11741/llama-server"),
                       "LLAMA_CPP_NGL": "0", "LLAMA_CPP_EXTRA_ARGS": "--threads 4 --threads-batch 4",
                       "SURYA_MAX_TOKENS_FULL_PAGE": "4096", "SURYA_MAX_TOKENS_BLOCK_CEILING": "4096",
                       "SURYA_INFERENCE_PARALLEL": "1", "SURYA_INFERENCE_TIMEOUT_SECONDS": "180"})
    import psutil
    with bloquear(args.salida.absolute(), vault) as raiz:
        anterior = leer_json(raiz, "resultados.json")
        if anterior and anterior.get("estado") == "completado":
            print("Marker ya tiene resultados; usá una salida nueva para repetir tiempos sin sobrescribirlos.")
            return
        estado = {"version": 1, "candidato": "marker", "version_paquete": version("marker-pdf"), "estado": "descargando_modelos",
                  "cpu_hilos": config["hilos_cpu"], "modo": "fast", "ocr_inline_math": True, "use_llm": False,
                  "max_tokens_ocr": 4096, "paginas": [], "modelo_ocr": config["modelo_ocr_marker"],
                  "modelo_layout": config["modelo_layout_marker"], "llama_cpp": config["llama_cpp"]}
        guardar_json(raiz, "resultados.json", estado)
        try:
            if shutil.disk_usage(cache).free < 4 * 2**30:
                raise RuntimeError("No hay margen suficiente de disco para los pesos y temporales.")
            if not Path(os.environ["LLAMA_CPP_BINARY"]).is_file():
                raise RuntimeError("Falta el binario fijado de llama.cpp; ver SETUP.md.")
            from huggingface_hub import snapshot_download
            inicio = time.perf_counter()
            ocr = config["modelo_ocr_marker"]
            pesos = Path(snapshot_download(repo_id=ocr["repo"], revision=ocr["revision"], allow_patterns=["*.gguf"], token=False, max_workers=2))
            layout = config["modelo_layout_marker"]
            ruta_layout = snapshot_download(repo_id=layout["repo"], revision=layout["revision"], allow_patterns=["config.json", "rfdetr_layout.pth"], token=False, max_workers=2)
            os.environ.update({"SURYA_GGUF_LOCAL_MODEL_PATH": str(pesos / "surya-2.gguf"),
                               "SURYA_GGUF_LOCAL_MMPROJ_PATH": str(pesos / "surya-2-mmproj.gguf"),
                               "FAST_LAYOUT_MODEL_CHECKPOINT": str(ruta_layout)})
            estado["segundos_descarga"] = round(time.perf_counter() - inicio, 3)
            from marker.converters.pdf import PdfConverter
            from marker.models import create_model_dict
            from marker.output import text_from_rendered
            conversor = PdfConverter(artifact_dict=create_model_dict(device="cpu"), config={
                "mode": "fast", "ocr_inline_math": True, "strip_existing_ocr": True,
                "disable_image_extraction": True, "use_llm": False,
            })
            estado["estado"] = "convirtiendo"
            guardar_json(raiz, "resultados.json", estado)
            for entrada in entradas:
                inicio = time.perf_counter()
                resultado = {"doc": entrada["doc"], "pagina": entrada["pagina"], "sha256_fuente": entrada["sha256_fuente"]}
                try:
                    convertido = conversor(entrada["archivo"])
                    texto, _, _ = text_from_rendered(convertido)
                    nombre = f"{entrada['doc']}-p{entrada['pagina']:04}.md"
                    if (raiz / nombre).exists():
                        raise Conflicto("Ya existe un resultado para esa página; no se sobrescribió.")
                    atomico(raiz, nombre, texto + "\n")
                    resultado.update(archivo=nombre, caracteres=len(texto), estado="convertida")
                except Conflicto:
                    raise
                except Exception as error:
                    resultado.update(error=type(error).__name__, aviso="Falló esta página; no se infiere su calidad.")
                    traceback.print_exc()
                resultado["segundos"] = round(time.perf_counter() - inicio, 3)
                estado["paginas"].append(resultado)
                guardar_json(raiz, "resultados.json", estado)
            estado["estado"] = "completado_con_errores" if any("error" in p for p in estado["paginas"]) else "completado"
        except BaseException as error:
            estado.update(estado="error", error=type(error).__name__, aviso="No se completó el ensayo de marker. No se eligió otro motor automáticamente.")
            raise
        finally:
            # Surya 0.22.1 mantiene los servidores de layout/OCR-error vivos por defecto.
            # HOME es privado para no adjuntar servicios del usuario; solo se terminan descendientes de este trabajador.
            hijos = psutil.Process().children(recursive=True)
            for hijo in reversed(hijos):
                try:
                    hijo.terminate()
                except psutil.NoSuchProcess:
                    pass
            _, vivos = psutil.wait_procs(hijos, timeout=5)
            for hijo in vivos:
                try:
                    hijo.kill()
                except psutil.NoSuchProcess:
                    pass
            estado["servidores_propios_detenidos"] = True
            guardar_json(raiz, "resultados.json", estado)
        print(json.dumps({"estado": estado["estado"], "paginas": len(estado["paginas"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
