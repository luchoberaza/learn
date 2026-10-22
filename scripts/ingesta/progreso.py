"""Progreso por curso: validación, fusión y recuperación con respaldo, sin abrir PDFs."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

import yaml
from almacen import Conflicto, atomico, esperar, ruta_segura
from cursos import SLUG, carpeta, cargar_yaml, texto, validar_progreso


def contexto(raiz):
    indice = cargar_yaml(texto(raiz, "indice.yaml"))
    temas = {t["id"]: t for t in indice["temas"]}
    documentos = {d["id"]: d for d in indice["documentos"]}
    items = {}
    for identificador, d in documentos.items():
        if not re.fullmatch(SLUG, identificador):
            raise ValueError("Documento inválido en el índice.")
        if d.get("tipo") not in {"ejercicios", "evaluaciones"}:
            continue
        f = ruta_segura(raiz, f"_procesado/{identificador}/items.yaml")
        if f.exists():
            items[identificador] = {i["id"]: i for i in cargar_yaml(texto(raiz, str(f.relative_to(raiz))))["items"]}
    return temas, documentos, items


def comprobar(p, ctx):
    validar_progreso(p, *ctx)
    return p


def crudo(raiz, nombre):
    f = ruta_segura(raiz, nombre)
    if f.stat().st_size > 2_000_000:
        raise ValueError("Archivo de progreso demasiado grande.")
    return f.read_bytes()


def bloqueo(raiz):
    # Propio del progreso: la ingesta retiene el de _procesado/ durante toda la corrida.
    return esperar(ruta_segura(raiz, ".progreso.lock"))


def cargar(raiz, ctx):
    """Restaurar escribe: se llama bajo bloqueo(raiz). Preserva el inválido antes de restaurar."""
    try:
        raw = crudo(raiz, "progreso.yaml")
        return comprobar(cargar_yaml(raw.decode("utf-8")), ctx), raw, []
    except (OSError, ValueError, TypeError, KeyError) as error:
        try:
            respaldo = crudo(raiz, "progreso.yaml.bak")
            p = comprobar(cargar_yaml(respaldo.decode("utf-8")), ctx)
        except (OSError, ValueError, TypeError, KeyError):
            raise ValueError("Progreso inválido y sin .bak válido; se preservó. Seguimos sin registrar progreso hasta repararlo.") from error
        actual = ruta_segura(raiz, "progreso.yaml")
        if actual.exists():
            raw = crudo(raiz, "progreso.yaml")
            nombre = f"_procesado/progreso-invalido-{hashlib.sha256(raw).hexdigest()}.yaml"
            f = ruta_segura(raiz, nombre)
            if not f.exists():
                atomico(raiz, nombre, raw)
            elif f.read_bytes() != raw:
                raise Conflicto("El archivo de recuperación ya existe con otros bytes; se preservó todo.")
        atomico(raiz, "progreso.yaml", respaldo)
        return p, respaldo, ["Progreso inválido restaurado desde .bak; el contenido inválido se conservó en _procesado/."]


def leer(vault: Path, curso: str):
    raiz = carpeta(vault, curso)
    if not raiz.is_dir():
        raise ValueError("El curso no existe; no se creó automáticamente.")
    ctx = contexto(raiz)
    try:
        try:
            # progreso.yaml se publica atómico: leerlo no necesita bloqueo.
            p, avisos = comprobar(cargar_yaml(crudo(raiz, "progreso.yaml").decode("utf-8")), ctx), []
        except (OSError, ValueError, TypeError, KeyError):
            with bloqueo(raiz):
                p, _, avisos = cargar(raiz, ctx)
        return {"progreso": p, "avisos": avisos + validar_progreso(p, *ctx), "disponible": True}
    except ValueError as e:
        return {"progreso": {"version": 1, "temas": {}, "historial": []}, "avisos": [str(e)], "disponible": False}


def unicos(valores):
    resultado, vistos = [], set()
    for v in valores:
        clave = json.dumps(v, sort_keys=True, ensure_ascii=False, default=str)
        if clave not in vistos:
            vistos.add(clave)
            resultado.append(v)
    return resultado


def fusionar(anterior, nuevo):
    if anterior.get("estado", "sin_empezar") != "sin_empezar" and nuevo["estado"] == "sin_empezar":
        raise ValueError("Ya hay evidencia del tema: conservá su estado previo o usá repasar, no sin_empezar.")
    r = {**deepcopy(anterior), **deepcopy(nuevo)}
    for k in ["conceptos_firmes", "ejercicios", "discrepancias"]:
        r[k] = unicos(anterior.get(k, []) + nuevo[k])
    r["borde"] = {
        "domina": [s for s in unicos(anterior.get("borde", {}).get("domina", []) + nuevo["borde"]["domina"]) if s not in nuevo["borde"]["falla"]],
        "falla": [s for s in unicos(anterior.get("borde", {}).get("falla", []) + nuevo["borde"]["falla"]) if s not in nuevo["borde"]["domina"]],
    }
    errores = {e["descripcion"]: deepcopy(e) for e in anterior.get("errores_de_concepto", [])}
    for e in nuevo["errores_de_concepto"]:
        errores[e["descripcion"]] = {**e, "detectado": errores.get(e["descripcion"], e)["detectado"]}
    r["errores_de_concepto"] = list(errores.values())
    return r


ETIQUETA = re.compile(r"^(?:ejercicio|problema|pregunta|[ií]tem|ej)\.?\s*", re.I)


def item_base(item, ids):
    """'2', 'Ejercicio 2', '2(a–c)' o '2g' → ('2', inciso) si el banco tiene '2'; None si no coincide."""
    if item in ids:
        return item, ""
    limpio = ETIQUETA.sub("", item.strip())
    for i in sorted(ids, key=len, reverse=True):
        resto = limpio[len(i):]
        if limpio.startswith(i) and not (resto[:1].isdigit() and i[-1].isdigit()):
            return i, resto.strip(" .-:")
    return None


def rango(ids):
    ids = list(ids)
    if ids and all(i.isdigit() for i in ids) and [int(i) for i in ids] == list(range(int(ids[0]), int(ids[0]) + len(ids))):
        return f"{ids[0]}–{ids[-1]}"
    return ", ".join(ids[:30]) + (" …" if len(ids) > 30 else "")


def validar_datos(datos, tema, ctx):
    campos = {"estado", "borde", "conceptos_firmes", "errores_de_concepto", "ejercicios", "discrepancias", "proximo_paso", "resumen"}
    if not isinstance(datos, dict) or set(datos) != campos:
        raise ValueError("Registro incompleto o con campos ajenos al esquema de progreso.")
    def cadena(s, maximo=2000):
        if not isinstance(s, str) or not s.strip() or len(s) > maximo:
            raise ValueError("El progreso necesita textos no vacíos y acotados.")
    for k in ["resumen", "proximo_paso"]:
        cadena(datos[k])
    if not isinstance(datos["borde"], dict) or set(datos["borde"]) != {"domina", "falla"}:
        raise ValueError("El borde necesita domina y falla.")
    for valores in [datos["borde"]["domina"], datos["borde"]["falla"], *[datos[k] for k in ["conceptos_firmes", "discrepancias", "errores_de_concepto", "ejercicios"]]]:
        if not isinstance(valores, list) or len(valores) > 100:
            raise ValueError("Las listas de progreso admiten hasta 100 entradas por registro.")
    for valores in [datos["borde"]["domina"], datos["borde"]["falla"], datos["conceptos_firmes"], datos["discrepancias"]]:
        for s in valores:
            cadena(s)
    if set(datos["borde"]["domina"]) & set(datos["borde"]["falla"]):
        raise ValueError("Un mismo concepto no puede dominarse y fallar en el mismo registro.")
    hoy = datetime.now(timezone.utc).date()
    for e in datos["errores_de_concepto"]:
        if not isinstance(e, dict) or set(e) != {"descripcion", "detectado", "resuelto"}:
            raise ValueError("Error de concepto fuera del esquema.")
        cadena(e["descripcion"])
    ejercicios, avisos = [], []
    for e in datos["ejercicios"]:
        if not isinstance(e, dict) or set(e) - {"doc", "item", "fecha", "resultado", "puntaje", "notas"} or not {"doc", "item", "fecha", "resultado"} <= set(e):
            raise ValueError("Ejercicio fuera del esquema.")
        cadena(e["item"])
        e = deepcopy(e)
        # Un ítem mal identificado no descarta el resto del registro: se omite y se avisa.
        if ctx[1].get(e["doc"], {}).get("tipo") not in {"ejercicios", "evaluaciones"}:
            avisos.append(f"'{e['doc']}' no es un práctico ni una evaluación del curso; se omitió el ejercicio '{e['item']}' y se guardó el resto.")
            continue
        if e["doc"] not in ctx[2]:
            e.update(item=ETIQUETA.sub("", e["item"].strip()) or e["item"], sin_segmentar=True)
        elif (base := item_base(e["item"], ctx[2][e["doc"]])) is None:
            avisos.append(f"item '{e['item']}' no existe en {e['doc']}; ids válidos: {rango(ctx[2][e['doc']])}. Se guardó el resto.")
            continue
        elif base[1]:
            e.update(item=base[0], notas=f"Inciso {base[1]}" + (f". {e['notas']}" if e.get("notas") else ""))
        else:
            e["item"] = base[0]
        ejercicios.append(e)
    for f in [e.get("detectado") for e in datos["errores_de_concepto"]] + [e.get("fecha") for e in datos["ejercicios"]]:
        if not isinstance(f, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", f) or date.fromisoformat(f) > hoy:
            raise ValueError("Fecha de evidencia inválida o futura.")
    t = {k: deepcopy(v) for k, v in datos.items() if k != "resumen"}
    t.update(ejercicios=ejercicios, actualizado=hoy.isoformat())
    comprobar({"version": 1, "temas": {tema: t}, "historial": []}, ctx)
    return t, avisos


def registrar(vault: Path, curso: str, tema: str, log: str, datos: dict, cierre=False, reconstruido=False, huella_log=None):
    raiz = carpeta(vault, curso)
    if not re.fullmatch(SLUG, tema) or type(cierre) is not bool or type(reconstruido) is not bool:
        raise ValueError("Tema o flags de progreso inválidos.")
    # El nombre ata el historial al tema sin admitir adjuntos, subdirectorios ni otros cursos.
    if not isinstance(log, str) or not re.fullmatch(rf"sesiones/\d{{4}}-\d{{2}}-\d{{2}}-{re.escape(tema)}(?:-\d+)?\.md", log):
        raise ValueError("Log fuera del tema o de sesiones/.")
    archivo_log = ruta_segura(raiz, log)
    if not archivo_log.is_file():
        raise ValueError("El log de evidencia no existe.")
    with bloqueo(raiz):
        ctx = contexto(raiz)
        nuevo, observaciones = validar_datos(datos, tema, ctx)
        if reconstruido and (not isinstance(huella_log, str) or hashlib.sha256(archivo_log.read_bytes()).hexdigest() != huella_log):
            raise Conflicto("El log cambió desde su lectura; releelo antes de reconstruir.")
        indice = texto(raiz, "indice.yaml")
        p, raw, avisos = cargar(raiz, ctx)
        avisos += observaciones
        p["temas"][tema] = fusionar(p["temas"].get(tema, {}), nuevo)
        historia = {"fecha": log.split("/")[1][:10], "tema": tema, "log": log, "resumen": datos["resumen"], "cierre": cierre}
        if reconstruido:
            historia["reconstruido"] = True
        anterior = next((h for h in p["historial"] if h["log"] == log and h["tema"] == tema), {})
        historia["cierre"] = cierre or anterior.get("cierre", False)
        p["historial"] = [h for h in p["historial"] if (h["log"], h["tema"]) != (log, tema)] + [{**anterior, **historia}]
        comprobar(p, ctx)
        contenido = yaml.safe_dump(p, allow_unicode=True, sort_keys=False)
        if len(contenido.encode()) > 2_000_000:
            raise ValueError("Progreso demasiado grande; se preservó la versión previa.")
        if cargar_yaml(contenido) == cargar_yaml(raw.decode("utf-8")):
            return {"progreso": p, "avisos": avisos, "sin_cambios": True}
        bak = ruta_segura(raiz, "progreso.yaml.bak")
        if bak.exists():
            comprobar(cargar_yaml(crudo(raiz, "progreso.yaml.bak").decode("utf-8")), ctx)
        if crudo(raiz, "progreso.yaml") != raw or texto(raiz, "indice.yaml") != indice:
            raise Conflicto("El curso o el progreso cambió durante la fusión; se preservó.")
        atomico(raiz, "progreso.yaml.bak", raw)
        if crudo(raiz, "progreso.yaml") != raw:
            raise Conflicto("El progreso cambió al respaldarlo; no se reemplazó.")
        atomico(raiz, "progreso.yaml", contenido)
        return {"progreso": p, "avisos": avisos, "sin_cambios": False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("accion", choices=["leer", "registrar"])
    a = p.parse_args()
    entrada = sys.stdin.read(100_001)
    if len(entrada.encode()) > 100_000:
        raise ValueError("Registro de progreso demasiado grande.")
    datos = json.loads(entrada)
    vault, curso = Path(datos.pop("vault")).resolve(), datos.pop("curso")
    r = leer(vault, curso) if a.accion == "leer" else registrar(vault, curso, **datos)
    print(json.dumps(r, ensure_ascii=False, default=str))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, RecursionError) as e:
        print(f"Progreso no guardado: {e}", file=sys.stderr)
        raise SystemExit(1)
