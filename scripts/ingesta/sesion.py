"""Lectura de YAML para sesiones y render local; nunca ejecuta OCR ni modifica curación."""
from __future__ import annotations

import argparse
import errno
import hashlib
import json
from pathlib import Path
import re
import sys

import pymupdf

from almacen import Conflicto, atomico, bloquear, esperar, guardar_json, leer_json, ruta_segura, salida_segura, sha256
from cursos import carpeta, cargar_yaml, texto, validar
from progreso import leer as leer_progreso


def cargar(vault: Path, curso: str, comprobar=False):
    raiz = carpeta(vault, curso)
    if not raiz.is_dir():
        raise ValueError("El curso no existe; preparalo con /curso-nuevo.")
    avisos = []
    def yaml(nombre, defecto):
        try:
            return cargar_yaml(texto(raiz, nombre))
        except (OSError, ValueError) as e:
            avisos.append(f"{nombre} no disponible: {e}")
            return defecto
    indice = yaml("indice.yaml", {})
    if not isinstance(indice, dict):
        indice = {}
        avisos.append("Índice inválido; se usará sólo el material identificable.")
    documentos = [d for d in indice.get("documentos", []) if isinstance(d, dict) and isinstance(d.get("id"), str)] if isinstance(indice.get("documentos", []), list) else []
    temas = [t for t in indice.get("temas", []) if isinstance(t, dict) and isinstance(t.get("id"), str) and isinstance(t.get("nombre"), str)] if isinstance(indice.get("temas", []), list) else []
    documentos = [d for d in documentos if isinstance(d.get("archivo"), str) and isinstance(d.get("tipo"), str) and type(d.get("paginas")) is int and d["paginas"] > 0]
    temas = [t for t in temas if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", t["id"])]
    for t in temas:
        for campo in ["alias", "prerequisitos", "objetivos"]:
            valores = t.get(campo, [])
            t[campo] = [s for s in valores if isinstance(s, str)] if isinstance(valores, list) else []
        t["unidad"] = t.get("unidad") if type(t.get("unidad")) is int else 1
        for campo in ["bibliografia", "ejercicios", "evaluaciones"]:
            valores = t.get(campo, [])
            t[campo] = [r for r in valores if isinstance(r, dict) and isinstance(r.get("doc"), str)] if isinstance(valores, list) else []
            if campo != "bibliografia":
                t[campo] = [r for r in t[campo] if isinstance(r.get("items"), list) and all(isinstance(i, str) for i in r["items"])]
    bancos = {}
    for d in documentos:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", d["id"]):
            continue
        nombre = f"_procesado/{d['id']}/items.yaml"
        if ruta_segura(raiz, nombre).exists():
            banco = yaml(nombre, {})
            if isinstance(banco, dict) and isinstance(banco.get("items"), list):
                bancos[d["id"]] = [i for i in banco["items"] if isinstance(i, dict) and isinstance(i.get("id"), str) and isinstance(i.get("enunciado"), str) and isinstance(i.get("paginas"), list) and all(type(p) is int and 1 <= p <= d["paginas"] for p in i["paginas"])]
    try:
        contrato = texto(raiz, "curso.md")
    except (OSError, ValueError):
        contrato = "Contrato no disponible: no inferir rúbrica ni objetivos."
        avisos.append(contrato)
    try:
        registro = leer_progreso(vault, curso)
        progreso = registro["progreso"]
        avisos.extend(registro["avisos"])
    except (OSError, ValueError, RuntimeError, TypeError, KeyError) as e:
        progreso = {"version": 1, "temas": {}, "historial": []}
        avisos.append(f"Progreso no disponible: {e}; se sigue con el material.")
    nombre = re.search(r"(?m)^nombre:\s*(.+)$", contrato)
    return {"curso": curso, "nombre": nombre[1].strip("\"'") if nombre else curso, "contrato": contrato, "documentos": documentos, "temas": temas,
            "items": bancos, "progreso": progreso, "avisos": avisos,
            "validacion": validar(raiz, curso) if comprobar else None}


def renderizar(vault: Path, curso: str, doc: str, numero: int):
    datos = cargar(vault, curso)
    d = next((d for d in datos["documentos"] if d["id"] == doc), None)
    if not isinstance(doc, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", doc) or not d or type(numero) is not int or not 1 <= numero <= d["paginas"]:
        raise ValueError("Documento o página PDF fuera del curso.")
    raiz = carpeta(vault, curso)
    fuente = ruta_segura(raiz, d["archivo"])
    if Path(d["archivo"]).parts[:2] != ("fuentes", d["tipo"]):
        raise ValueError("Fuente fuera de fuentes/<tipo>/.")
    huella = sha256(fuente)
    salida = salida_segura(raiz / "_procesado", vault)
    nombre = f"{doc}/render/{numero:04}.png"
    imagen = ruta_segura(salida, nombre)
    registro = leer_json(salida, f"{doc}/render/{numero:04}.json")
    if imagen.exists() and registro:
        if registro.get("sha256_fuente") != huella or registro.get("sha256_imagen") != sha256(imagen):
            raise Conflicto("El PDF o su render cambió; se preservó. Revisá la preparación.")
        return {"cache": True}
    if not ruta_segura(salida, "control.json").exists():
        with bloquear(salida, vault):  # marca la salida como de la ingesta, igual que antes
            pass
    imagen.parent.mkdir(parents=True, exist_ok=True)
    with esperar(ruta_segura(salida, f"{doc}/render/.render.lock")):
        with pymupdf.open(fuente) as pdf:
            p = pdf[numero - 1]
            png = p.get_pixmap(matrix=pymupdf.Matrix(1800 / max(p.rect.width, p.rect.height), 1800 / max(p.rect.width, p.rect.height)), alpha=False).tobytes("png")
        digest = hashlib.sha256(png).hexdigest()
        if imagen.exists() and sha256(imagen) != digest:
            raise Conflicto("Render sin registro con cambios: se preservó.")
        if not imagen.exists():
            atomico(salida, nombre, png)
        guardar_json(salida, f"{doc}/render/{numero:04}.json", {"sha256_fuente": huella, "sha256_imagen": digest})
        return {"cache": False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("accion", choices=["cargar", "renderizar"])
    p.add_argument("--vault", type=Path, default=Path.cwd())
    p.add_argument("--curso", required=True)
    p.add_argument("--validar", action="store_true")
    p.add_argument("--doc")
    p.add_argument("--pagina", type=int)
    a = p.parse_args()
    r = cargar(a.vault.resolve(), a.curso, a.validar) if a.accion == "cargar" else renderizar(a.vault.resolve(), a.curso, a.doc, a.pagina)
    print(json.dumps(r, ensure_ascii=False, default=str))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, IndexError) as e:
        lleno = isinstance(e, OSError) and e.errno == errno.ENOSPC
        print("Disco lleno: no se pudo preparar el material; liberá espacio y reintentá." if lleno else f"Material no disponible: {e}", file=sys.stderr)
        raise SystemExit(1)
