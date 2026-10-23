"""Progreso por curso: validación, fusión y recuperación con respaldo, sin abrir PDFs."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date, datetime
import errno
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
    for t in p["temas"].values():
        reservado = t.get("reservado", [])
        if any(not isinstance(t.get(k, ""), str) for k in ["objetivo", "plan"]) or not isinstance(reservado, list) or any(
                not isinstance(r, dict) or not isinstance(r.get("doc"), str) or not isinstance(r.get("id"), str) or not isinstance(r.get("usado", False), bool) for r in reservado):
            raise ValueError("progreso.yaml: objetivo, plan o reservado fuera del esquema.")
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


def fusionar(anterior, nuevo, previo=False):
    falla, domina = anterior.get("borde", {}).get("falla", []), anterior.get("borde", {}).get("domina", [])
    if previo:
        # Evidencia más vieja que la guardada: suma sólo lo que no contradice y conserva estado y próximo paso.
        conocidos = {e["descripcion"] for e in anterior.get("errores_de_concepto", [])}
        nuevo = {**{k: v for k, v in nuevo.items() if k not in {"estado", "proximo_paso", "objetivo", "plan"}}, "falla_resuelta": [],
                 "borde": {"domina": [s for s in nuevo["borde"]["domina"] if s not in falla],
                           "falla": [s for s in nuevo["borde"]["falla"] if s not in domina + anterior.get("conceptos_firmes", [])]},
                 "conceptos_firmes": [s for s in nuevo["conceptos_firmes"] if s not in falla],
                 "errores_de_concepto": [e for e in nuevo["errores_de_concepto"] if e["descripcion"] not in conocidos]}
    if anterior.get("estado", "sin_empezar") != "sin_empezar" and nuevo.get("estado") == "sin_empezar":
        raise ValueError("Ya hay evidencia del tema: conservá su estado previo o usá repasar, no sin_empezar.")
    avisos = [f"falla_resuelta '{s}' no coincide con ninguna falla del borde; textos exactos: " + ("; ".join(f"'{x}'" for x in falla) or "ninguno") + "."
              for s in nuevo["falla_resuelta"] if s not in falla]
    r = {"estado": "sin_empezar", **deepcopy(anterior), **deepcopy({k: v for k, v in nuevo.items() if k != "falla_resuelta"})}
    # Sin estado explícito, un tema sigue sin_empezar hasta que llega evidencia del alumno.
    if r["estado"] == "sin_empezar" and "estado" not in nuevo and any([*nuevo["borde"].values(), nuevo["conceptos_firmes"], nuevo["errores_de_concepto"], nuevo["ejercicios"]]):
        r["estado"] = "en_curso"
    for k in ["conceptos_firmes", "ejercicios", "discrepancias"]:
        r[k] = unicos(anterior.get(k, []) + nuevo[k])
    r["conceptos_firmes"] = [s for s in r["conceptos_firmes"] if s not in nuevo["borde"]["falla"]]
    r["borde"] = {
        "domina": [s for s in unicos(domina + nuevo["borde"]["domina"]) if s not in nuevo["borde"]["falla"]],
        "falla": [s for s in unicos(falla + nuevo["borde"]["falla"]) if s not in nuevo["borde"]["domina"] and s not in nuevo["falla_resuelta"]],
    }
    errores = {e["descripcion"]: deepcopy(e) for e in anterior.get("errores_de_concepto", [])}
    for e in nuevo["errores_de_concepto"]:
        antes = errores.get(e["descripcion"], {"resuelto": False})
        errores[e["descripcion"]] = {**antes, **e, "detectado": antes.get("detectado", e["detectado"])}
    r["errores_de_concepto"] = list(errores.values())
    if r["estado"] == "dominado" and r["borde"]["falla"]:
        avisos.append(f"Estado 'dominado' con fallas en el borde ({'; '.join(r['borde']['falla'])}): quitá las superadas con falla_resuelta o usá en_curso.")
    return r, avisos


def reservar(p, ctx, propuestas, usados):
    """E3: el primer reservado vigente de cada tema queda fijo; un intento registrado o un simulacro lo marcan usado."""
    temas, documentos, items = ctx
    def vigente(r):
        item = items.get(r.get("doc"), {}).get(r.get("id")) if isinstance(r, dict) else None
        return isinstance(item, dict) and "solucion_de" not in item and documentos[r["doc"]].get("tipo") == "evaluaciones" and not r.get("usado")
    tomados = {(r["doc"], r["id"]) for t in p["temas"].values() for r in t.get("reservado", [])}
    for tema, r in (propuestas if isinstance(propuestas, dict) else {}).items():
        t = p["temas"].get(tema, {})
        previas = [x for x in t.get("reservado", []) if x.get("usado") or vigente(x)]
        if tema in temas and vigente(r) and (r["doc"], r["id"]) not in tomados and not any(vigente(x) for x in previas):
            p["temas"][tema] = {"estado": "sin_empezar", **t, "reservado": previas + [{"doc": r["doc"], "id": r["id"]}]}
            tomados.add((r["doc"], r["id"]))
    # Después de fijar: un reservado que se rinde en el mismo registro en que se fija también queda usado.
    for t in p["temas"].values():
        for r in t.get("reservado", []):
            if not r.get("usado") and (r["doc"], r["id"]) in usados:
                r["usado"] = True


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


def validar_datos(datos, ctx, dia=None):
    # Delta: sólo resumen es obligatorio; lo omitido se conserva al fusionar.
    listas = ["conceptos_firmes", "errores_de_concepto", "ejercicios", "discrepancias", "falla_resuelta"]
    # objetivo y plan (H56) reemplazan los guardados sólo cuando vienen.
    topes = {"resumen": 2000, "proximo_paso": 2000, "objetivo": 300, "plan": 1500}
    if not isinstance(datos, dict) or set(datos) - {"estado", "borde", *topes, *listas} or "resumen" not in datos:
        raise ValueError("Registro sin resumen o con campos ajenos al esquema de progreso.")
    def cadena(s, maximo=2000):
        if not isinstance(s, str) or not s.strip() or len(s) > maximo:
            raise ValueError("El progreso necesita textos no vacíos y acotados.")
    for k, maximo in topes.items():
        if k in datos:
            cadena(datos[k], maximo)
    if datos.get("estado", "en_curso") not in {"sin_empezar", "en_curso", "dominado", "repasar"}:
        raise ValueError("Estado de progreso inválido.")
    if not isinstance(datos.get("borde", {}), dict) or set(datos.get("borde", {})) - {"domina", "falla"}:
        raise ValueError("El borde admite sólo domina y falla.")
    datos = {**{k: [] for k in listas}, **datos, "borde": {"domina": [], "falla": [], **datos.get("borde", {})}}
    for valores in [datos["borde"]["domina"], datos["borde"]["falla"], *[datos[k] for k in listas]]:
        if not isinstance(valores, list) or len(valores) > 100:
            raise ValueError("Las listas de progreso admiten hasta 100 entradas por registro.")
    for valores in [datos["borde"]["domina"], datos["borde"]["falla"], datos["conceptos_firmes"], datos["discrepancias"], datos["falla_resuelta"]]:
        for s in valores:
            cadena(s)
    if set(datos["borde"]["domina"]) & set(datos["borde"]["falla"]):
        raise ValueError("Un mismo concepto no puede dominarse y fallar en el mismo registro.")
    hoy = datetime.now().date()
    for e in datos["errores_de_concepto"]:
        if not isinstance(e, dict) or set(e) - {"descripcion", "detectado", "resuelto"} or "descripcion" not in e:
            raise ValueError("Error de concepto fuera del esquema.")
        cadena(e["descripcion"])
    ejercicios, avisos = [], []
    for e in datos["ejercicios"]:
        if not isinstance(e, dict) or set(e) - {"doc", "item", "fecha", "resultado", "puntaje", "notas"} or not {"doc", "item", "resultado"} <= set(e):
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
    t = {k: deepcopy(v) for k, v in datos.items() if k != "resumen"}
    t.update(ejercicios=ejercicios, actualizado=hoy.isoformat())
    for e, campo in [(e, "detectado") for e in t["errores_de_concepto"]] + [(e, "fecha") for e in t["ejercicios"]]:
        f = e.setdefault(campo, min(dia or hoy, hoy).isoformat())
        try:
            valida = isinstance(f, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", f) and date.fromisoformat(f) <= hoy
        except ValueError:  # «2026-02-30»: el texto de Python viene en inglés
            valida = False
        if not valida:
            raise ValueError("Fecha de evidencia inválida o futura.")
    return t, avisos


def orden(log, tema):
    """sesiones/AAAA-MM-DD-<tema>[-N].md → (fecha, N); None si el nombre no es de ese tema."""
    m = isinstance(log, str) and re.fullmatch(rf"sesiones/(\d{{4}}-\d{{2}}-\d{{2}})-{re.escape(tema)}(?:-(\d+))?\.md", log)
    return (m[1], int(m[2] or 1)) if m else None


def registrar(vault: Path, curso: str, tema: str, log: str, datos: dict, cierre=False, reconstruido=False, huella_log=None, reservas=None, simulacro=None, nota=None):
    raiz = carpeta(vault, curso)
    if not re.fullmatch(SLUG, tema) or type(cierre) is not bool or type(reconstruido) is not bool:
        raise ValueError("Tema o flags de progreso inválidos.")
    # El nombre ata el historial al tema sin admitir adjuntos, subdirectorios ni otros cursos.
    if not orden(log, tema):
        raise ValueError("Log fuera del tema o de sesiones/.")
    # nota: dónde está hoy la nota de la clase, que Obsidian puede renombrar; sin nota no se avisa (el alumno ya lo sabe).
    if nota is not None and not (isinstance(nota, str) and nota.startswith("sesiones/") and nota.endswith(".md")):
        raise ValueError("Nota fuera de sesiones/.")
    archivo_log, archivo_nota = ruta_segura(raiz, log), nota and ruta_segura(raiz, nota)
    # Sólo la reconstrucción necesita el log; renombrarlo en Obsidian no debe impedir guardar.
    if reconstruido and not archivo_log.is_file():
        raise ValueError("El log de evidencia no existe.")
    with bloqueo(raiz):
        ctx = contexto(raiz)
        # Una reconstrucción fecha su evidencia con el día del log, no con el de hoy.
        nuevo, observaciones = validar_datos(datos, ctx, date.fromisoformat(orden(log, tema)[0]) if reconstruido else None)
        if reconstruido and (not isinstance(huella_log, str) or hashlib.sha256(archivo_log.read_bytes()).hexdigest() != huella_log):
            raise Conflicto("El log cambió desde su lectura; releelo antes de reconstruir.")
        indice = texto(raiz, "indice.yaml")
        p, raw, avisos = cargar(raiz, ctx)
        avisos += observaciones + ([] if not archivo_nota or archivo_nota.is_file() else [f"El log {log} no está (¿se renombró o movió en Obsidian?); el progreso se guardó igual con esa ruta."])
        actual = p["temas"].get(tema, {})
        if reconstruido and nuevo.get("estado") == "sin_empezar" and "estado" in actual:
            del nuevo["estado"]  # una sesión sin respuestas no cambia el estado
        posterior = reconstruido and any(orden(h["log"], tema) > orden(log, tema) for h in p["historial"] if h["tema"] == tema and orden(h["log"], tema))
        p["temas"][tema], fusion = fusionar(actual, nuevo, posterior)
        avisos += fusion
        rendido = {(simulacro.get("doc"), simulacro.get("id"))} if isinstance(simulacro, dict) else set()
        # Sólo se fija la del tema que se guarda: uno sin estudiar no entra en progreso.yaml, así la curación puede quitarlo o renombrarlo.
        propia = {tema: reservas[tema]} if isinstance(reservas, dict) and tema in reservas else {}
        reservar(p, ctx, propia, {(e["doc"], e["item"]) for e in nuevo["ejercicios"]} | rendido)
        historia = {"fecha": log.split("/")[1][:10], "tema": tema, "log": log, "resumen": datos["resumen"], "cierre": cierre}
        if reconstruido:
            historia["reconstruido"] = True
        anterior = next((h for h in p["historial"] if h["log"] == log and h["tema"] == tema), {})
        historia["cierre"] = cierre or anterior.get("cierre", False)
        p["historial"] = [h for h in p["historial"] if (h["log"], h["tema"]) != (log, tema)] + [{**anterior, **historia}]
        return publicar(raiz, p, raw, indice, ctx, avisos)


def usar(vault: Path, curso: str, tema: str, doc: str, item: str):
    """E9: el reservado queda usado al presentarse en /simulacro, aunque la sesión se corte antes de la entrega."""
    raiz = carpeta(vault, curso)
    with bloqueo(raiz):
        ctx = contexto(raiz)
        indice = texto(raiz, "indice.yaml")
        p, raw, avisos = cargar(raiz, ctx)
        reservar(p, ctx, {tema: {"doc": doc, "id": item}}, {(doc, item)})
        return publicar(raiz, p, raw, indice, ctx, avisos)


def publicar(raiz, p, raw, indice, ctx, avisos):
    """Bajo bloqueo(raiz): valida y reemplaza progreso.yaml con .bak, salvo que nada haya cambiado."""
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
    p.add_argument("accion", choices=["leer", "registrar", "usar"])
    a = p.parse_args()
    entrada = sys.stdin.read(100_001)
    if len(entrada.encode()) > 100_000:
        raise ValueError("Registro de progreso demasiado grande.")
    datos = json.loads(entrada)
    vault, curso = Path(datos.pop("vault")).resolve(), datos.pop("curso")
    r = leer(vault, curso) if a.accion == "leer" else {"registrar": registrar, "usar": usar}[a.accion](vault, curso, **datos)
    print(json.dumps(r, ensure_ascii=False, default=str))


def falla(e):
    """Una línea para el alumno: el texto de un OSError o de un error interno de Python viene en inglés y no se muestra."""
    if isinstance(e, (TypeError, KeyError, RecursionError)):
        return "Progreso no guardado: un dato del registro no tiene el formato esperado; reintentá y, si sigue, corré .pi/scripts/doctor."
    if isinstance(e, UnicodeError):
        return "Progreso no guardado: un archivo del curso está dañado (no es texto); revisá progreso.yaml, su .bak e indice.yaml del curso."
    if not isinstance(e, OSError):
        return f"Progreso no guardado: {e}"
    if e.errno == errno.ENOSPC:
        return "Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin."
    if e.errno in {errno.EACCES, errno.EPERM, errno.EROFS}:
        curso = re.search(r"/cursos/([a-z0-9-]+)/", str(e.filename or ""))
        return f"Progreso no guardado: no hay permiso para escribir el progreso; revisá los permisos de cursos/{curso[1] if curso else '<curso>'}/."
    return "Progreso no guardado: falló la escritura del archivo de progreso; reintentá y, si sigue, corré .pi/scripts/doctor."


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, RecursionError) as e:
        print(falla(e), file=sys.stderr)
        raise SystemExit(1)
