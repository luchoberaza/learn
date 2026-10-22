#!/usr/bin/env python3
"""Interfaz local de preparación; los comandos de pi llegan en fases posteriores."""
from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

from almacen import bloquear, guardar_json, leer_json, ruta_segura
from pipeline import adoptar, ahora, ejecutar

CONFIG = Path(__file__).resolve().parents[2] / "curso.config.json"


def argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingesta base local: nunca modifica los PDFs originales.")
    parser.add_argument("comando", choices=["procesar", "iniciar", "estado", "adoptar"],
                        help="procesar en esta terminal, iniciar en segundo plano, consultar estado o adoptar una página editada a mano")
    parser.add_argument("--manifiesto", type=Path, help="JSON con documentos y páginas a procesar")
    parser.add_argument("--salida", required=True, type=Path, help="Directorio derivado dentro de _procesado/")
    parser.add_argument("--vault", type=Path, default=Path.cwd(), help="Raíz del vault (predeterminada: carpeta actual)")
    parser.add_argument("--limite-paginas", type=int, help="Pausar tras esta cantidad de páginas nuevas; permite reanudar")
    parser.add_argument("--doc", help="adoptar: id del documento")
    parser.add_argument("--pagina", type=int, help="adoptar: página PDF (base 1)")
    args = parser.parse_args()
    if args.comando in {"procesar", "iniciar"} and not args.manifiesto:
        parser.error("procesar e iniciar requieren --manifiesto")
    if args.comando == "adoptar" and (not args.doc or args.pagina is None):
        parser.error("adoptar requiere --doc y --pagina")
    return args


def ultima_linea(salida: Path) -> str:
    log = ruta_segura(salida, "proceso.log")
    lineas = log.read_text(encoding="utf-8", errors="replace").splitlines() if log.exists() else []
    return next((linea.strip() for linea in reversed(lineas) if linea.strip()), "proceso.log no tiene mensajes.")


def vivo(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    return True


def main() -> int:
    args = argumentos()
    vault = args.vault.resolve()
    salida = args.salida.absolute()
    if args.comando == "estado":
        estado = leer_json(salida, "estado-ingesta.json")
        if estado is None:
            print("No hay una ingesta registrada en esa salida.")
            return 1
        if estado["estado"] == "iniciando" and not vivo(estado["pid"]):
            estado = {**estado, "estado": "error", "error": f"El proceso terminó al arrancar: {ultima_linea(salida)}"}
        if estado["estado"] == "en_curso":
            bloqueo = ruta_segura(salida, ".ingesta.lock")
            with bloqueo.open("rb") as archivo:
                try:
                    fcntl.flock(archivo, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    estado = {**estado, "estado": "interrumpida", "aviso": "El proceso ya no mantiene el bloqueo; podés reanudar con el mismo manifiesto. "
                              f"Última línea de proceso.log: {ultima_linea(salida)}"}
                except BlockingIOError:
                    pass
        print(json.dumps(estado, ensure_ascii=False, indent=2))
        return 0
    if args.comando == "adoptar":
        from vision import actualizar
        with bloquear(salida, vault) as raiz:
            resultado = adoptar(raiz, args.doc, args.pagina)
            actualizar(raiz)
        print(json.dumps(resultado, ensure_ascii=False))
        return 0
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    if config.get("ruta_tesseract"):
        # ocrmypdf y la comprobación de idiomas usan el tesseract fijado, no el primero del PATH.
        os.environ["PATH"] = str(Path(config["ruta_tesseract"]).expanduser().parent) + os.pathsep + os.environ.get("PATH", "")
    manifiesto = {"umbral_calidad": config["umbral_calidad_pagina"], "idiomas_ocr": config["idioma_ocr"],
                  **json.loads(args.manifiesto.read_text(encoding="utf-8"))}
    if args.comando == "iniciar":
        # Validar la salida y marcar su propiedad antes de crear el log del proceso.
        with bloquear(salida, vault):
            from pipeline import validar_manifiesto
            documentos = validar_manifiesto(manifiesto, vault, salida)
        # El hijo toma el mismo bloqueo: lanzarlo después de liberarlo evita una carrera de arranque.
        log = ruta_segura(salida, "proceso.log")
        with log.open("wb") as archivo:
            comando = [sys.executable, str(Path(__file__).resolve()), "procesar", "--manifiesto", str(args.manifiesto.resolve()),
                       "--vault", str(vault), "--salida", str(salida)]
            if args.limite_paginas is not None:
                comando.extend(["--limite-paginas", str(args.limite_paginas)])
            proceso = subprocess.Popen(comando, stdout=archivo, stderr=archivo, stdin=subprocess.DEVNULL, start_new_session=True)
        # El hijo tarda en importar antes de escribir su estado: desde acá nunca se ve la corrida anterior como actual.
        guardar_json(salida, "estado-ingesta.json", {"version": 1, "estado": "iniciando", "pid": proceso.pid, "iniciado": ahora(),
                     "actualizado": ahora(), "solicitadas": sum(len(d["paginas"]) for d in documentos), "procesadas": 0,
                     "cache": 0, "pendientes": 0, "documento": None, "pagina": None})
        # ~2 s para detectar una muerte temprana y, después, hasta que el hijo registre su propio estado.
        inicio = time.monotonic()
        while proceso.poll() is None and time.monotonic() - inicio < 30:
            if time.monotonic() - inicio >= 2 and leer_json(salida, "estado-ingesta.json")["estado"] != "iniciando":
                break
            time.sleep(0.1)
        if proceso.returncode is None:
            print(f"Proceso lanzado en segundo plano (PID {proceso.pid}). Consultá estado; los errores quedan en {log}.")
            return 0
        if proceso.returncode:
            print(ultima_linea(salida), file=sys.stderr)
            return 1
        print(json.dumps(leer_json(salida, "estado-ingesta.json"), ensure_ascii=False, indent=2))
        return 0
    def interrumpir(*_):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrumpir)
    estado = ejecutar(manifiesto, vault, salida, limite_paginas=args.limite_paginas)
    print(json.dumps(estado, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Ingesta interrumpida; reanudá con el mismo manifiesto.", file=sys.stderr)
        raise SystemExit(130)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"No se completó la ingesta: {error}", file=sys.stderr)
        raise SystemExit(1)
