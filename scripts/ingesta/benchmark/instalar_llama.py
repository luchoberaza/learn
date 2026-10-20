"""Instalación local e idempotente del binario oficial; sin scripts remotos ni sudo."""
import hashlib
import json
from pathlib import Path
import tarfile
import urllib.request

base = Path(__file__).resolve().parent
pi = base.parents[2]
config = json.loads((pi / "config/benchmark-ml.json").read_text())["llama_cpp"]
cache = base / ".cache"
cache.mkdir(exist_ok=True)
archivo = cache / f"llama-{config['version']}.tar.gz"
if not archivo.exists():
    with urllib.request.urlopen(config["url"], timeout=60) as respuesta, archivo.open("xb") as salida:
        while bloque := respuesta.read(1024 * 1024):
            salida.write(bloque)
with archivo.open("rb") as entrada:
    if hashlib.file_digest(entrada, "sha256").hexdigest() != config["sha256"]:
        raise RuntimeError("El SHA-256 del archivo descargado no coincide; no se ejecutó ni extrajo.")
destino = base / "bin"
destino.mkdir(exist_ok=True)
with tarfile.open(archivo) as paquete:
    falta = False
    for miembro in paquete.getmembers():
        ruta = destino / miembro.name
        if not ruta.resolve().is_relative_to(destino.resolve()):
            raise RuntimeError("Ruta insegura dentro del archivo; no se extrajo.")
        if miembro.isfile() and ruta.exists():
            with paquete.extractfile(miembro) as original, ruta.open("rb") as existente:
                if hashlib.file_digest(original, "sha256").digest() != hashlib.file_digest(existente, "sha256").digest():
                    raise RuntimeError("Un binario existente difiere; no se sobrescribió.")
        elif miembro.issym() and ruta.is_symlink():
            if ruta.readlink() != Path(miembro.linkname):
                raise RuntimeError("Un enlace existente difiere; no se sobrescribió.")
        elif not ruta.exists():
            falta = True
    if falta:
        paquete.extractall(destino, filter="data")
print(f"llama.cpp {config['version']} verificado; binarios locales en {destino}.")
