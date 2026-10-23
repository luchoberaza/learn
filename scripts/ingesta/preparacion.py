"""Preparación por tema, sin red: qué falta transcribir, segmentar y clasificar, y el registro de lo hecho."""
from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import sys

from almacen import guardar_json, leer_json, ruta_segura, sha256
from cursos import carpeta, cargar_yaml, texto
from pipeline import ahora

BANCOS = ("evaluaciones", "ejercicios")


def huella(enunciado: str) -> str:
    return hashlib.sha256(enunciado.encode()).hexdigest()


def entrada(*partes) -> str:
    """Huella de lo que recibe el modelo: si no cambia, un fallo se repetiría."""
    return hashlib.sha256(json.dumps(partes, ensure_ascii=False).encode()).hexdigest()


def leer(raiz: Path, nombre: str) -> dict:
    # Un registro automático ilegible se rehace: nunca traba la preparación.
    try:
        valor = leer_json(raiz, nombre, {})
    except ValueError:
        return {}
    return valor if isinstance(valor, dict) else {}


def banco(raiz: Path, doc: str) -> list | None:
    nombre = f"_procesado/{doc}/items.yaml"
    return cargar_yaml(texto(raiz, nombre)).get("items", []) if ruta_segura(raiz, nombre).exists() else None


def editado(raiz: Path, doc: str) -> bool:
    """Un items.yaml con cambios ajenos a su registro lo curó una persona: vision.py no lo pisa."""
    registro = leer(raiz, f"_procesado/{doc}/items-registro.json")
    return sha256(ruta_segura(raiz, f"_procesado/{doc}/items.yaml")) not in {registro.get("sha256"), registro.get("sha256_anterior")}


def trabajo(vault: Path, curso: str, tema: str, maximo: int) -> dict:
    """Páginas a transcribir en orden de prioridad (bibliografía del tema, parciales, prácticos), documentos a segmentar e ítems a clasificar."""
    raiz = carpeta(vault, curso)
    indice = cargar_yaml(texto(raiz, "indice.yaml"))
    t = next((t for t in indice["temas"] if t.get("id") == tema), None)
    if t is None:
        raise ValueError("El tema ya no está en el índice.")
    estado = leer(raiz, "_procesado/preparacion.json")
    hechos, fallos = estado.get("documentos", {}), estado.get("fallos", {})
    indice_sha = sha256(ruta_segura(raiz, "indice.yaml"))

    def en_espera(clave, huella_entrada):
        # Una segmentación o clasificación que falló con estas mismas entradas no se reintenta hasta el día siguiente.
        f = fallos.get(clave) if isinstance(fallos, dict) else None
        try:
            return f["entrada"] == huella_entrada and datetime.fromisoformat(ahora()) - datetime.fromisoformat(f["fecha"]) < timedelta(days=1)
        except (TypeError, KeyError, ValueError):
            return False

    sin_base = set()
    def faltan(doc, paginas, todas):
        qs = leer(raiz, f"_procesado/{doc}/calidad.json").get("paginas", {})
        # Sin registro base no hay qué transcribir todavía: la espera a la ingesta base deja el tema incompleto.
        sin_base.update((doc, p) for p in paginas if str(p) not in qs)
        def falta(q):
            # Una página manual o con visión ya está.
            if not q or q.get("motor") == "manual" or (q.get("vision") and not q.get("error_vision")):
                return False
            return bool(todas or q.get("error_vision") or q.get("requiere_vision") or q.get("ruta") == "pendiente")
        return [p for p in paginas if falta(qs.get(str(p)))]

    cola, segmentar, bancos = [], [], {}
    for r in t.get("bibliografia", []):
        cola.append((r["doc"], faltan(r["doc"], range(r["paginas"][0], r["paginas"][1] + 1), False)))
    en_indice = {(r["doc"], i) for x in indice["temas"] for c in BANCOS for r in x.get(c, []) for i in r.get("items", [])}
    for tipo in BANCOS:
        for d in indice["documentos"]:
            if d["tipo"] != tipo:
                continue
            items = banco(raiz, d["id"])
            bancos[d["id"]] = items or []
            # Un parcial segmentado antes de H18 no separa sus soluciones integradas: se segmenta otra vez, una sola, si nadie lo editó a mano.
            if items is None or (tipo == "evaluaciones" and not hechos.get(d["id"], {}).get("segmentado") and not any("solucion_de" in i for i in items)
                                 and not editado(raiz, d["id"])):
                pendientes = faltan(d["id"], range(1, d["paginas"] + 1), True)
                cola.append((d["id"], pendientes))
                requeridos = sorted(i for doc, i in en_indice if doc == d["id"])
                listo = not pendientes and not any(doc == d["id"] for doc, _ in sin_base)
                textos = [ruta_segura(raiz, f"_procesado/{d['id']}/paginas/{p:04}.md") for p in range(1, d["paginas"] + 1)] if listo else []
                huella_entrada = entrada(tipo, d["titulo"], requeridos, [sha256(t) if t.exists() else None for t in textos])
                espera = listo and en_espera(f"segmentar/{d['id']}", huella_entrada)
                segmentar.append({"doc": d["id"], "tipo": tipo, "titulo": d["titulo"], "paginas": d["paginas"], "requeridos": requeridos,
                                  "listo": listo and not espera, "en_espera": espera, "entrada": huella_entrada})
    paginas, vistas, restantes = [], set(), len(sin_base)
    for doc, numeros in cola:
        nuevas = [p for p in numeros if (doc, p) not in vistas]
        vistas.update((doc, p) for p in nuevas)
        lugar = max(0, maximo - sum(len(x["paginas"]) for x in paginas))
        if nuevas[:lugar]:
            paginas.append({"doc": doc, "paginas": nuevas[:lugar]})
        restantes += len(nuevas[lugar:])
    previas = {(a.get("doc"), a.get("id")): a.get("huella") for a in leer(raiz, "_procesado/asignaciones.json").get("items", []) if isinstance(a, dict)}
    por_segmentar = {s["doc"] for s in segmentar}
    todos = [{"doc": doc, "id": i["id"], "enunciado": i["enunciado"], "huella": huella(i["enunciado"]), "entrada": entrada(indice_sha, huella(i["enunciado"]))}
             for doc, items in bancos.items() if doc not in por_segmentar for i in items
             if "solucion_de" not in i and (doc, i["id"]) not in en_indice and previas.get((doc, i["id"])) != huella(i["enunciado"])]
    clasificar = [c for c in todos if not en_espera(f"clasificar/{c['doc']}/{c['id']}", c["entrada"])]
    return {"tema": tema, "indice": indice_sha, "paginas": paginas, "restantes": restantes, "segmentar": segmentar, "clasificar": clasificar,
            "en_espera": sum(s["en_espera"] for s in segmentar) + len(todos) - len(clasificar)}


def asignar(vault: Path, curso: str, asignaciones: list) -> dict:
    """Guarda la clasificación automática; indice.yaml (curado) no se toca y manda sobre este archivo."""
    raiz = carpeta(vault, curso)
    indice = cargar_yaml(texto(raiz, "indice.yaml"))
    temas, tipos = {t["id"] for t in indice["temas"]}, {d["id"]: d["tipo"] for d in indice["documentos"]}
    actuales = {(a.get("doc"), a.get("id")): a for a in leer(raiz, "_procesado/asignaciones.json").get("items", []) if isinstance(a, dict)}
    bancos = {}
    for a in asignaciones:
        doc, ident, tema = a.get("doc"), a.get("id"), a.get("tema")
        if tipos.get(doc) not in BANCOS:
            raise ValueError(f"Asignación inválida: {doc} no es un banco de ejercicios o evaluaciones.")
        bancos.setdefault(doc, {i["id"]: i for i in banco(raiz, doc) or []})
        item = bancos[doc].get(ident)
        if item is None or "solucion_de" in item or (tema is not None and tema not in temas):
            raise ValueError(f"Asignación inválida: {doc}/{ident} → {tema}.")
        actuales[doc, ident] = {"doc": doc, "id": ident, "tema": tema, "huella": huella(item["enunciado"]), "fecha": ahora()}
    guardar_json(raiz, "_procesado/asignaciones.json", {
        "version": 1, "automatico": True,
        "nota": "Asignación automática de los ítems que indice.yaml no asigna; el índice curado manda y este archivo se rehace solo.",
        "items": sorted(actuales.values(), key=lambda a: (str(a["doc"]), str(a["id"])))})
    return {"asignadas": len(asignaciones)}


def registrar(vault: Path, curso: str, datos: dict) -> dict:
    raiz = carpeta(vault, curso)
    estado = leer(raiz, "_procesado/preparacion.json")
    estado["version"] = 1
    for clave, valor in [("temas", datos.get("tema")), ("documentos", datos.get("documento"))]:
        if isinstance(valor, dict):
            grupo = estado.get(clave) if isinstance(estado.get(clave), dict) else {}
            grupo[valor["id"]] = {**{k: v for k, v in valor.items() if k != "id"}, "fecha": ahora()}
            estado[clave] = grupo
    if isinstance(datos.get("fallos"), dict):
        fallos = estado.get("fallos") if isinstance(estado.get("fallos"), dict) else {}
        estado["fallos"] = {**fallos, **{clave: {"entrada": e, "fecha": ahora()} for clave, e in datos["fallos"].items()}}
    guardar_json(raiz, "_procesado/preparacion.json", estado)
    return estado


def main():
    accion = sys.argv[1]
    datos = json.load(sys.stdin)
    vault = Path(datos["vault"]).resolve()
    if accion == "trabajo":
        return trabajo(vault, datos["curso"], datos["tema"], datos["maximo"])
    if accion == "asignar":
        return asignar(vault, datos["curso"], datos["asignaciones"])
    if accion == "registrar":
        return registrar(vault, datos["curso"], datos)
    if accion == "bancos":
        from sesion import cargar
        return cargar(vault, datos["curso"])["items"]
    raise ValueError("Acción de preparación desconocida.")


if __name__ == "__main__":
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        print(f"No se completó la preparación: {error}", file=sys.stderr)
        raise SystemExit(1)
