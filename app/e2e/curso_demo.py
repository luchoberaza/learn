"""Curso de demostración para las pruebas de la app: PDFs sintéticos de Redes (programa, libro, práctico y parcial con
soluciones) que se curan e ingieren con las mismas herramientas de learn (cursos.py e ingestar.py), sin modelo.

Uso (desde cualquier carpeta): python curso_demo.py --vault <vault> [--slug redes-demo]
Crea _entrada/demo/*.pdf, la propuesta en _procesado/ y el curso en cursos/<slug>/, y procesa todas sus páginas.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pymupdf

PROGRAMA = [
    ("Programa de Redes de Computadoras (curso de demostración)",
     "Objetivos. O1.1: Calcular el retardo de transmisión, de propagación y de encolamiento de un paquete. "
     "O1.2: Calcular el retardo de extremo a extremo en una ruta de varios enlaces. "
     "O2.1: Describir el modelo cliente-servidor y el protocolo HTTP. "
     "O3.1: Explicar la multiplexación y el control de errores de la capa de transporte.\n\n"
     "Evaluación. Dos parciales escritos de 2 horas con 5 preguntas cada uno. Se aprueba con 60 puntos sobre 100. "
     "Los retardos aparecen en 3 de 4 parciales de los últimos años."),
]
LIBRO = [
    ("1.4 Retardos en las redes de conmutación de paquetes",
     "Un paquete que viaja de un nodo a otro sufre varios retardos. El retardo de procesamiento es el tiempo que el router "
     "tarda en examinar el encabezado. El retardo de encolamiento es el tiempo que el paquete espera en la cola del enlace."),
    ("1.4.1 Retardo de transmisión",
     "El retardo de transmisión es el tiempo necesario para empujar todos los bits del paquete al enlace. Si el paquete "
     "tiene L bits y la tasa del enlace es R bits por segundo, el retardo de transmisión es d_trans = L/R. "
     "No depende de la distancia entre los routers."),
    ("1.4.2 Retardo de propagación",
     "Una vez que un bit entra al enlace, tiene que propagarse hasta el router siguiente. El retardo de propagación es "
     "d_prop = d/s, donde d es la longitud del enlace y s la velocidad de propagación del medio, cercana a 2 x 10^8 m/s. "
     "No depende del tamaño del paquete."),
    ("1.4.3 Retardo de encolamiento e intensidad de tráfico",
     "Si a es la tasa media de llegada de paquetes, la intensidad de tráfico es La/R. Cuando La/R se acerca a 1, el retardo "
     "de encolamiento crece sin límite; si La/R es mayor que 1, la cola crece indefinidamente."),
    ("1.4.4 Retardo de extremo a extremo",
     "Con N enlaces iguales y sin congestión, el retardo de extremo a extremo es d_ee = N (d_proc + d_trans + d_prop)."),
    ("2.1 Principios de las aplicaciones de red",
     "En la arquitectura cliente-servidor, un servidor siempre encendido atiende los pedidos de muchos clientes. "
     "HTTP es el protocolo de la Web: el cliente envía un mensaje de pedido y el servidor responde con un mensaje de respuesta."),
    ("3.1 Servicios de la capa de transporte",
     "La capa de transporte ofrece comunicación lógica entre procesos. La multiplexación junta datos de varios sockets; "
     "la demultiplexación entrega cada segmento al socket correcto usando los números de puerto."),
]
PRACTICO = [
    ("Práctico 1: retardos",
     "Ejercicio 1. Un paquete de 1000 bytes se transmite por un enlace de 1 Mbps. Calcule el retardo de transmisión.\n\n"
     "Ejercicio 2. Un enlace mide 2500 km y la velocidad de propagación es 2,5 x 10^8 m/s. Calcule el retardo de propagación.\n\n"
     "Ejercicio 3. ¿Qué ocurre con el retardo de encolamiento cuando la intensidad de tráfico se acerca a 1? Justifique."),
]
PARCIAL = [
    ("Primer parcial 2025",
     "Pregunta 1 (20 puntos). Un archivo de 8 x 10^6 bits se envía por un enlace de 2 Mbps de 4000 km. "
     "Calcule el retardo de transmisión y el de propagación (s = 2 x 10^8 m/s).\n"
     "Solución: d_trans = 8 x 10^6 / 2 x 10^6 = 4 s; d_prop = 4 x 10^6 / 2 x 10^8 = 20 ms.\n\n"
     "Pregunta 2 (20 puntos). Explique por qué el retardo de propagación no depende del tamaño del paquete.\n"
     "Solución: porque cada bit viaja a la velocidad del medio; el tamaño sólo cambia el tiempo de transmisión."),
    ("Primer parcial 2025 (continuación)",
     "Pregunta 3 (20 puntos). Una ruta tiene 3 enlaces iguales de 1 Mbps y 1000 km. Calcule el retardo de extremo a extremo "
     "de un paquete de 1500 bytes sin congestión ni procesamiento.\n"
     "Solución: d_ee = 3 (12 ms + 5 ms) = 51 ms."),
]


def pdf(destino: Path, paginas: list[tuple[str, str]]) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    for titulo, cuerpo in paginas:
        p = doc.new_page(width=595, height=842)
        p.insert_text((56, 70), titulo, fontsize=15, fontname="helv")
        p.insert_textbox(pymupdf.Rect(56, 96, 540, 800), cuerpo, fontsize=11, fontname="helv")
    doc.save(destino)


def sha(f: Path) -> str:
    return hashlib.sha256(f.read_bytes()).hexdigest()


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("--vault", required=True, type=Path)
    a.add_argument("--slug", default="redes-demo")
    args = a.parse_args()
    vault, slug = args.vault.resolve(), args.slug
    if (vault / "cursos" / slug / "indice.yaml").exists():
        print(json.dumps({"curso": slug, "ya_existia": True}))
        return 0
    entrada = vault / "_entrada" / "demo"
    archivos = {"programa": ("programa", PROGRAMA), "kurose": ("bibliografia", LIBRO), "practico-1": ("ejercicios", PRACTICO), "parcial-2025": ("evaluaciones", PARCIAL)}
    for id_, (_, paginas) in archivos.items():
        pdf(entrada / f"{id_}.pdf", paginas)
    documentos = []
    for id_, (tipo, paginas) in archivos.items():
        d = {"id": id_, "titulo": {"programa": "Programa", "kurose": "Kurose y Ross (extracto de demostración)", "practico-1": "Práctico 1", "parcial-2025": "Primer parcial 2025"}[id_],
             "tipo": tipo, "archivo": f"fuentes/{tipo}/{id_}.pdf", "paginas": len(paginas)}
        if tipo == "bibliografia":
            d["prioridad"] = "principal"
        documentos.append(d)
    temas = [
        {"id": "retardos", "nombre": "Retardos y tasa de transferencia", "unidad": 1, "alias": ["retardo", "delay"], "prerequisitos": [], "objetivos": ["O1.1", "O1.2"],
         "bibliografia": [{"doc": "kurose", "seccion": "1.4 Retardos", "paginas": [1, 5]}], "ejercicios": [], "evaluaciones": []},
        {"id": "aplicacion", "nombre": "Capa de aplicación", "unidad": 2, "alias": ["http"], "prerequisitos": ["retardos"], "objetivos": ["O2.1"],
         "bibliografia": [{"doc": "kurose", "seccion": "2.1 Aplicaciones de red", "paginas": [6, 6]}], "ejercicios": [], "evaluaciones": []},
        {"id": "transporte", "nombre": "Capa de transporte", "unidad": 3, "alias": ["tcp", "udp"], "prerequisitos": ["aplicacion"], "objetivos": ["O3.1"],
         "bibliografia": [{"doc": "kurose", "seccion": "3.1 Servicios de transporte", "paginas": [7, 7]}], "ejercicios": [], "evaluaciones": []},
    ]
    import yaml
    indice = yaml.safe_dump({"version": 1, "documentos": documentos, "temas": temas}, allow_unicode=True, sort_keys=False)
    contrato = ("---\nnombre: Redes (demo)\nslug: " + slug + "\n---\n# Objetivos\n"
                "- O1.1: Calcular el retardo de transmisión, de propagación y de encolamiento de un paquete.\n"
                "- O1.2: Calcular el retardo de extremo a extremo en una ruta de varios enlaces.\n"
                "- O2.1: Describir el modelo cliente-servidor y el protocolo HTTP.\n"
                "- O3.1: Explicar la multiplexación y el control de errores de la capa de transporte.\n"
                "# Cómo se evalúa\nDos parciales escritos de 2 horas con 5 preguntas; se aprueba con 60/100 (programa, p. 1).\n"
                "Los retardos caen en 3 de 4 parciales.\n")
    origenes = {id_: {"archivo": f"_entrada/demo/{id_}.pdf", "sha256": sha(entrada / f"{id_}.pdf")} for id_ in archivos}
    propuesta = vault / "_procesado" / f"propuesta-{slug}.json"
    propuesta.parent.mkdir(parents=True, exist_ok=True)
    propuesta.write_text(json.dumps({"curso_md": contrato, "indice_yaml": indice, "origenes": origenes}, ensure_ascii=False), encoding="utf-8", newline="\n")
    scripts = Path(__file__).resolve().parents[2] / "scripts" / "ingesta"
    correr = lambda *c: json.loads(subprocess.run([sys.executable, *map(str, c)], cwd=vault, capture_output=True, text=True, encoding="utf-8", check=True).stdout)
    r = correr(scripts / "cursos.py", "revisar", "--vault", vault, "--curso", slug, "--propuesta", propuesta)
    correr(scripts / "cursos.py", "aplicar", "--vault", vault, "--curso", slug, "--propuesta", propuesta, "--base", r["base"], "--huella", r["huella"])
    correr(scripts / "cursos.py", "manifiesto", "--vault", vault, "--curso", slug, "--todo")
    subprocess.run([sys.executable, scripts / "ingestar.py", "procesar", "--manifiesto", vault / "_procesado" / f"manifiesto-{slug}.json",
                    "--vault", vault, "--salida", vault / "cursos" / slug / "_procesado"], cwd=vault, capture_output=True, text=True, encoding="utf-8", check=True)
    # Las páginas de ejercicios y evaluaciones esperan visión; acá se adoptan como transcripción revisada a mano
    # (ingestar.py adoptar, el camino sin modelo de learn), así se pueden guardar sus ítems.
    for doc, paginas in {"practico-1": [1], "parcial-2025": [1, 2]}.items():
        for p in paginas:
            subprocess.run([sys.executable, scripts / "ingestar.py", "adoptar", "--vault", vault, "--salida", vault / "cursos" / slug / "_procesado", "--doc", doc, "--pagina", str(p)],
                           cwd=vault, capture_output=True, text=True, encoding="utf-8", check=True)
    # Ítems del práctico y del parcial (con sus soluciones aparte), como los segmenta la preparación por tema.
    items = {
        "practico-1": [{"id": str(i), "paginas": [1], "enunciado": t} for i, t in enumerate(PRACTICO[0][1].split("\n\n"), 1)],
        "parcial-2025": [
            {"id": "1", "paginas": [1], "enunciado": PARCIAL[0][1].split("\nSolución:")[0], "puntos": 20},
            {"id": "1-solucion", "paginas": [1], "enunciado": "d_trans = 4 s; d_prop = 20 ms.", "solucion_de": "1"},
            {"id": "2", "paginas": [1], "enunciado": PARCIAL[0][1].split("\n\n")[1].split("\nSolución:")[0], "puntos": 20},
            {"id": "2-solucion", "paginas": [1], "enunciado": "Cada bit viaja a la velocidad del medio.", "solucion_de": "2"},
            {"id": "3", "paginas": [2], "enunciado": PARCIAL[1][1].split("\nSolución:")[0], "puntos": 20},
            {"id": "3-solucion", "paginas": [2], "enunciado": "d_ee = 51 ms.", "solucion_de": "3"},
        ],
    }
    for doc, lista in items.items():
        p = subprocess.run([sys.executable, scripts / "vision.py", "items"], input=json.dumps({"vault": str(vault), "salida": str(vault / "cursos" / slug / "_procesado"), "doc": doc, "items": lista}),
                           cwd=vault, capture_output=True, text=True, encoding="utf-8")
        if p.returncode:
            print(p.stderr, file=sys.stderr)
    # Asignación de los ítems al tema retardos en el índice (el índice manda, como la curación).
    texto = (vault / "cursos" / slug / "indice.yaml").read_text(encoding="utf-8")
    datos = yaml.safe_load(texto)
    datos["temas"][0]["ejercicios"] = [{"doc": "practico-1", "items": ["1", "2", "3"]}]
    datos["temas"][0]["evaluaciones"] = [{"doc": "parcial-2025", "items": ["1", "2", "3"]}]
    (vault / "cursos" / slug / "indice.yaml").write_text(yaml.safe_dump(datos, allow_unicode=True, sort_keys=False), encoding="utf-8", newline="\n")
    print(json.dumps({"curso": slug, "documentos": len(documentos), "temas": len(temas)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
