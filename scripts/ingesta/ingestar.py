#!/usr/bin/env python3
"""Interfaz local de preparación; los comandos de pi llegan en fases posteriores."""
from __future__ import annotations

import argparse
import fcntl
import json
from pathlib import Path
import signal
import subprocess
import sys

from almacen import bloquear, leer_json, ruta_segura
from pipeline import ejecutar


def argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingesta base local: nunca modifica los PDFs originales.")
    parser.add_argument("comando", choices=["procesar", "iniciar", "estado"], help="procesar en esta terminal, iniciar en segundo plano o consultar estado")
    parser.add_argument("--manifiesto", type=Path, help="JSON con documentos y páginas a procesar")
    parser.add_argument("--salida", required=True, type=Path, help="Directorio derivado dentro de _procesado/")
    parser.add_argument("--vault", type=Path, default=Path.cwd(), help="Raíz del vault (predeterminada: carpeta actual)")
    parser.add_argument("--limite-paginas", type=int, help="Pausar tras esta cantidad de páginas nuevas; permite reanudar")
    args = parser.parse_args()
    if args.comando != "estado" and not args.manifiesto:
        parser.error("procesar e iniciar requieren --manifiesto")
    return args


def main() -> int:
    args = argumentos()
    vault = args.vault.resolve()
    salida = args.salida.absolute()
    if args.comando == "estado":
        estado = leer_json(salida, "estado-ingesta.json")
        if estado is None:
            print("No hay una ingesta registrada en esa salida.")
            return 1
        if estado["estado"] == "en_curso":
            bloqueo = ruta_segura(salida, ".ingesta.lock")
            with bloqueo.open("rb") as archivo:
                try:
                    fcntl.flock(archivo, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    estado = {**estado, "estado": "interrumpida", "aviso": "El proceso ya no mantiene el bloqueo; podés reanudar con el mismo manifiesto."}
                except BlockingIOError:
                    pass
        print(json.dumps(estado, ensure_ascii=False, indent=2))
        return 0
    config = json.loads((Path(__file__).resolve().parents[2] / "curso.config.json").read_text(encoding="utf-8"))
    manifiesto = {"umbral_calidad": config["umbral_calidad_pagina"], "idiomas_ocr": config["idioma_ocr"],
                  **json.loads(args.manifiesto.read_text(encoding="utf-8"))}
    if args.comando == "iniciar":
        # Validar la salida y marcar su propiedad antes de crear el log del proceso.
        with bloquear(salida, vault):
            from pipeline import validar_manifiesto
            validar_manifiesto(manifiesto, vault, salida)
        # El hijo toma el mismo bloqueo: lanzarlo después de liberarlo evita una carrera de arranque.
        log = ruta_segura(salida, "proceso.log")
        with log.open("ab") as archivo:
            comando = [sys.executable, str(Path(__file__).resolve()), "procesar", "--manifiesto", str(args.manifiesto.resolve()),
                       "--vault", str(vault), "--salida", str(salida)]
            if args.limite_paginas is not None:
                comando.extend(["--limite-paginas", str(args.limite_paginas)])
            proceso = subprocess.Popen(comando, stdout=archivo, stderr=archivo, stdin=subprocess.DEVNULL, start_new_session=True)
        print(f"Proceso lanzado en segundo plano (PID {proceso.pid}). Consultá estado; los errores de arranque quedan en {log}.")
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
