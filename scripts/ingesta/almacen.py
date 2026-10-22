"""Archivos derivados propios: escritura atómica, exclusión y caché verificable."""
from __future__ import annotations

from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time

ESPERA = 5


class Conflicto(RuntimeError):
    """Se necesita intervención: nunca sobrescribir un archivo ajeno o editado."""


def sha256(archivo: Path) -> str:
    with archivo.open("rb") as entrada:
        return hashlib.file_digest(entrada, "sha256").hexdigest()


def ruta_segura(raiz: Path, relativa: str) -> Path:
    ruta = raiz / relativa
    if Path(relativa).is_absolute() or ".." in Path(relativa).parts:
        raise Conflicto("La ruta de salida debe permanecer dentro del directorio generado.")
    actual = raiz
    for parte in Path(relativa).parts:
        actual = actual / parte
        if actual.is_symlink():
            raise Conflicto("Se rechazó un enlace simbólico en la salida.")
    if not ruta.resolve().is_relative_to(raiz.resolve()):
        raise Conflicto("La salida apunta fuera del directorio generado.")
    return ruta


def atomico(raiz: Path, relativa: str, contenido: str | bytes) -> None:
    destino = ruta_segura(raiz, relativa)
    destino.parent.mkdir(parents=True, exist_ok=True)
    fd, nombre = tempfile.mkstemp(prefix=".ingesta-", dir=destino.parent)
    try:
        with os.fdopen(fd, "wb" if isinstance(contenido, bytes) else "w", encoding=None if isinstance(contenido, bytes) else "utf-8") as archivo:
            archivo.write(contenido)
            archivo.flush()
            os.fsync(archivo.fileno())
        os.replace(nombre, destino)
        directorio = os.open(destino.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directorio)
        finally:
            os.close(directorio)
    finally:
        if os.path.exists(nombre):
            os.unlink(nombre)


def guardar_json(raiz: Path, relativa: str, datos: object) -> None:
    atomico(raiz, relativa, json.dumps(datos, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def leer_json(raiz: Path, relativa: str, defecto=None):
    archivo = ruta_segura(raiz, relativa)
    return json.loads(archivo.read_text(encoding="utf-8")) if archivo.exists() else defecto


def salida_segura(salida: Path, vault: Path) -> Path:
    try:
        relativa = salida.absolute().relative_to(vault.resolve())
    except ValueError:
        raise Conflicto("La salida debe permanecer dentro del vault.") from None
    if "_procesado" not in relativa.parts or any(p in relativa.parts for p in ["_entrada", "fuentes"]):
        raise Conflicto("Usá una salida dentro de _procesado/; nunca en _entrada/ ni fuentes/.")
    return ruta_segura(vault, str(relativa))


@contextmanager
def bloquear(salida: Path, vault: Path):
    salida = salida_segura(salida, vault)
    salida.mkdir(parents=True, exist_ok=True)
    bloqueo = ruta_segura(salida, ".ingesta.lock")
    fd = os.open(bloqueo, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Conflicto("Ya hay una ingesta escribiendo en esta salida.") from None
        marca = leer_json(salida, "control.json")
        if marca is None:
            ajenos = [p.name for p in salida.iterdir() if p.name != ".ingesta.lock"]
            if ajenos:
                raise Conflicto("La salida no está vacía y no pertenece a la ingesta; no se sobrescribió.")
            guardar_json(salida, "control.json", {"generador": "pi-learning-ingesta", "version": 1})
        elif marca != {"generador": "pi-learning-ingesta", "version": 1}:
            raise Conflicto("La salida pertenece a otra herramienta o versión.")
        yield salida
    finally:
        os.close(fd)


@contextmanager
def esperar(archivo: Path):
    """Exclusión breve entre procesos: reintenta cada 100 ms hasta ESPERA segundos."""
    fd = os.open(archivo, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        limite = time.monotonic() + ESPERA
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= limite:
                    raise Conflicto("Otro proceso está guardando; reintentá.") from None
                time.sleep(0.1)
        yield
    finally:
        os.close(fd)
