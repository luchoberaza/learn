"""Archivos derivados propios: escritura atómica, exclusión y caché verificable."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ESPERA = 5
WINDOWS = os.name == "nt"
# La extensión habla con estos scripts en UTF-8 (JSON por stdin y stdout). En Windows Python usa la página de códigos del
# sistema cuando los flujos son tuberías: las tildes llegarían rotas y un «→» o «≈» cortaría la salida con UnicodeEncodeError.
for _flujo in (sys.stdin, sys.stdout, sys.stderr):
    if _flujo is not None and hasattr(_flujo, "reconfigure") and (_flujo.encoding or "").replace("-", "").lower() != "utf8":
        _flujo.reconfigure(encoding="utf-8")
# Cómo se escribe el Python del venv en los comandos que se sugieren desde la raíz del vault (con / anda en Git Bash y PowerShell).
PYTHON_TEXTO = ".pi/.venv/Scripts/python.exe" if WINDOWS else ".pi/.venv/bin/python"
# Windows no tiene O_NOFOLLOW: ahí el rechazo de enlaces lo hace ruta_segura o _sin_enlace antes de abrir.
SIN_SEGUIR = getattr(os, "O_NOFOLLOW", 0)

if WINDOWS:
    import msvcrt

    def tomar_bloqueo(fd: int) -> None:
        """Bloqueo exclusivo sin espera de 1 byte; Windows lo suelta al cerrar el descriptor."""
        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        except OSError:
            raise BlockingIOError("bloqueado") from None
else:
    import fcntl

    def tomar_bloqueo(fd: int) -> None:
        """Bloqueo exclusivo sin espera; BlockingIOError si otro proceso lo retiene."""
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)


class Conflicto(RuntimeError):
    """Se necesita intervención: nunca sobrescribir un archivo ajeno o editado."""


# Lo que una máquina puede pisar sin tocar el curso.config.json versionado (mismas claves que leerConfig de pi-sdk.mjs).
CLAVES_LOCALES = ("vault", "ruta_tesseract", "modelo_vision", "modelo_researcher", "modelo_transcripcion", "carpeta_modelos")


def cargar_config(recursos: Path | None = None) -> dict:
    """curso.config.json más curso.config.local.json (ignorado por git), que sólo pisa CLAVES_LOCALES."""
    recursos = recursos or Path(__file__).resolve().parents[2]
    config = json.loads((recursos / "curso.config.json").read_text(encoding="utf-8"))
    try:
        local = json.loads((recursos / "curso.config.local.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return config
    if isinstance(local, dict):
        config.update({k: v for k, v in local.items() if k in CLAVES_LOCALES and isinstance(v, str) and v.strip()})
    return config


def usar_tesseract(config: dict) -> None:
    """Fija el tesseract de ruta_tesseract para OCRmyPDF y las comprobaciones: su carpeta va primero en el PATH.

    Un tesseract de conda en Windows no trae compilada la ubicación de sus idiomas (busca en «./»): si al lado está
    ../share/tessdata y nadie fijó TESSDATA_PREFIX, se lo apunta ahí. En Linux esa carpeta coincide con la compilada.
    """
    if not config.get("ruta_tesseract"):
        return
    carpeta = Path(config["ruta_tesseract"]).expanduser().parent
    os.environ["PATH"] = str(carpeta) + os.pathsep + os.environ.get("PATH", "")
    idiomas = carpeta.parent / "share" / "tessdata"
    if not os.environ.get("TESSDATA_PREFIX") and idiomas.is_dir():
        os.environ["TESSDATA_PREFIX"] = str(idiomas)


def _sin_enlace(archivo: Path) -> None:
    if not SIN_SEGUIR and archivo.is_symlink():
        raise Conflicto("Se rechazó un enlace simbólico en la salida.")


def abrir_bloqueo(archivo: Path) -> int:
    """Abre (o crea) un archivo de bloqueo sin seguir enlaces simbólicos."""
    _sin_enlace(archivo)
    return os.open(archivo, os.O_CREAT | os.O_RDWR | SIN_SEGUIR, 0o600)


def bloqueo_libre(archivo: Path) -> bool:
    """True si nadie retiene el bloqueo: lo toma un instante y lo suelta al cerrar."""
    fd = abrir_bloqueo(archivo)
    try:
        tomar_bloqueo(fd)
        return True
    except BlockingIOError:
        return False
    finally:
        os.close(fd)


def proceso_vivo(pid: object) -> bool:
    """Si el proceso existe. En Windows no se usa os.kill(pid, 0): ahí termina el proceso."""
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return False
    if WINDOWS:
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        manejador = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not manejador:
            return ctypes.get_last_error() == 5  # ERROR_ACCESS_DENIED: existe, pero es de otro usuario
        try:
            codigo = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(manejador, ctypes.byref(codigo)):
                return True
            return codigo.value == 259  # STILL_ACTIVE
        finally:
            kernel32.CloseHandle(manejador)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    return True


def bajar_prioridad() -> None:
    """La ingesta cede el procesador a lo que se está usando. Sus procesos y el OCR heredan la prioridad (en Windows,
    un hijo de un proceso BELOW_NORMAL nace BELOW_NORMAL). Si el sistema no lo permite, sigue con la de siempre."""
    if WINDOWS:
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.SetPriorityClass.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel32.SetPriorityClass(kernel32.GetCurrentProcess(), 0x4000)  # BELOW_NORMAL_PRIORITY_CLASS
        return
    try:
        os.nice(10)
    except OSError:
        pass


def opciones_desacoplado() -> dict:
    """Popen de un hijo que sobrevive al padre: sesión propia en POSIX, proceso desacoplado en Windows."""
    if WINDOWS:
        return {"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def _reemplazar(origen: str, destino: Path) -> None:
    """os.replace; en Windows reintenta un momento si un lector (Obsidian, antivirus, indexador) tiene abierto el destino."""
    for intento in range(20 if WINDOWS else 1):
        try:
            os.replace(origen, destino)
            return
        except PermissionError:
            if not WINDOWS or intento == 19:
                raise
            time.sleep(0.05)


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
        # newline="\n": en Windows el modo texto escribiría \r\n y las extensiones comparan textos y huellas con \n.
        binario = isinstance(contenido, bytes)
        with os.fdopen(fd, "wb" if binario else "w", encoding=None if binario else "utf-8", newline=None if binario else "\n") as archivo:
            archivo.write(contenido)
            archivo.flush()
            os.fsync(archivo.fileno())
        _reemplazar(nombre, destino)
        # Windows no abre ni sincroniza directorios: ahí el reemplazo ya queda registrado por el sistema de archivos.
        if not WINDOWS:
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
    fd = abrir_bloqueo(bloqueo)
    try:
        try:
            tomar_bloqueo(fd)
        except BlockingIOError:
            raise Conflicto("Ya hay una ingesta escribiendo en esta salida.") from None
        marca = leer_json(salida, "control.json")
        if marca is None:
            ajenos = sorted(p.name for p in salida.iterdir() if p.name != ".ingesta.lock")
            if ajenos:
                lista = ", ".join(ajenos[:5]) + (" …" if len(ajenos) > 5 else "")
                if all(n.endswith(".json") for n in ajenos):
                    raise Conflicto(f"La salida no está vacía: mové {lista} a _procesado/ de la raíz del vault.")
                raise Conflicto(f"La salida no está vacía y no pertenece a la ingesta: mové {lista} fuera de {salida.relative_to(vault)}/.")
            guardar_json(salida, "control.json", {"generador": "pi-learning-ingesta", "version": 1})
        elif marca != {"generador": "pi-learning-ingesta", "version": 1}:
            raise Conflicto("La salida pertenece a otra herramienta o versión.")
        yield salida
    finally:
        os.close(fd)


@contextmanager
def esperar(archivo: Path):
    """Exclusión breve entre procesos: reintenta cada 100 ms hasta ESPERA segundos."""
    fd = abrir_bloqueo(archivo)
    try:
        limite = time.monotonic() + ESPERA
        while True:
            try:
                tomar_bloqueo(fd)
                break
            except BlockingIOError:
                if time.monotonic() >= limite:
                    raise Conflicto("Otro proceso está guardando; reintentá.") from None
                time.sleep(0.1)
        yield
    finally:
        os.close(fd)
