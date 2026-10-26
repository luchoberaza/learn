"""DA50: varias páginas a la vez según los hilos de la máquina, con los mismos archivos que de a una."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

INGESTA = Path(__file__).resolve().parents[2] / "scripts/ingesta"
sys.path.insert(0, str(INGESTA))

import pymupdf
import pipeline
from extraccion import extraer
from pipeline import ejecutar, trabajadores_de_la_maquina

PROSA = ("El retardo nodal se compone del procesamiento, la cola, la transmisión y la propagación. Cuando la intensidad "
         "de tráfico se acerca a uno, la cola crece y los paquetes empiezan a perderse en el router.")
# Lo que cambia entre dos corridas aunque el resultado sea el mismo: la hora, el pid y lo que tardó cada página.
VARIABLES = {"estado-ingesta.json", "ingesta.log", "proceso.log", ".ingesta.lock"}


def crear_libro(destino: Path, paginas: int, escaneadas: frozenset[int] = frozenset()) -> None:
    """Páginas digitales con título y, cada tres, una fórmula; las de `escaneadas` van como imagen, sin capa de texto."""
    with pymupdf.open() as digital, pymupdf.open() as libro:
        for n in range(1, paginas + 1):
            pagina = digital.new_page(width=500, height=700)
            pagina.insert_text((45, 80), f"{n}. Retardos en una red de paquetes", fontsize=18)
            pagina.insert_textbox(pymupdf.Rect(45, 110, 450, 500), PROSA, fontsize=12)
            if n % 3 == 0:
                pagina.insert_text((45, 540), "d = L/R + x^2", fontsize=12)
            pagina.insert_text((245, 670), str(n), fontsize=10)
        for n in range(1, paginas + 1):
            if n in escaneadas:
                imagen = digital[n - 1].get_pixmap(dpi=150, colorspace=pymupdf.csGRAY).tobytes("png")
                pagina = libro.new_page(width=500, height=700)
                pagina.insert_image(pagina.rect, stream=imagen)
            else:
                libro.insert_pdf(digital, from_page=n - 1, to_page=n - 1)
        libro.set_toc([[1, "Retardos", 1], [1, "Colas", min(4, paginas)]])
        libro.save(destino)


def sin_segundos(datos):
    if isinstance(datos, dict):
        return {k: sin_segundos(v) for k, v in datos.items() if k != "segundos"}
    if isinstance(datos, list):
        return [sin_segundos(v) for v in datos]
    return datos


def contenido(raiz: Path) -> dict[str, str]:
    """Cada archivo de la salida como texto comparable; en los JSON, en el mismo orden de claves y sin los segundos."""
    archivos = {}
    for archivo in sorted(raiz.rglob("*")):
        if archivo.is_file() and archivo.name not in VARIABLES:
            texto = archivo.read_text(encoding="utf-8")
            if archivo.suffix == ".json":
                texto = json.dumps(sin_segundos(json.loads(texto)), ensure_ascii=False, indent=2)
            archivos[archivo.relative_to(raiz).as_posix()] = texto
    return archivos


class ParaleloTest(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory(prefix="pi-ingesta-paralelo-")
        self.vault = Path(self.temporal.name)

    def tearDown(self):
        self.temporal.cleanup()

    def manifiesto(self, *documentos, motores=None) -> dict:
        manifiesto = {"version": 1, "documentos": [{"id": d, "titulo": d.capitalize(), "tipo": tipo, "archivo": f"{d}.pdf", "paginas": "todas"}
                                                   for d, tipo in documentos]}
        if motores:
            manifiesto["motores"] = motores
        return manifiesto

    def test_varias_a_la_vez_dejan_los_mismos_archivos_que_de_a_una(self):
        # Con una página escaneada que pasa por el OCR real, como en un libro de verdad.
        crear_libro(self.vault / "libro.pdf", 10, frozenset({4}))
        crear_libro(self.vault / "parcial.pdf", 3)
        manifiesto = self.manifiesto(("libro", "bibliografia"), ("parcial", "evaluaciones"))
        de_a_una = ejecutar(manifiesto, self.vault, self.vault / "_procesado/de-a-una")
        a_la_vez = ejecutar(manifiesto, self.vault, self.vault / "_procesado/a-la-vez", trabajadores=(3, 1))
        self.assertEqual({k: v for k, v in a_la_vez.items() if k not in {"pid", "iniciado", "actualizado"}},
                         {k: v for k, v in de_a_una.items() if k not in {"pid", "iniciado", "actualizado"}})
        self.assertEqual(a_la_vez["procesadas"], 13)
        esperado, obtenido = contenido(self.vault / "_procesado/de-a-una"), contenido(self.vault / "_procesado/a-la-vez")
        self.assertEqual(sorted(obtenido), sorted(esperado))
        for nombre in esperado:
            self.assertEqual(obtenido[nombre], esperado[nombre], nombre)
        self.assertEqual(json.loads((self.vault / "_procesado/a-la-vez/libro/calidad.json").read_text(encoding="utf-8"))["paginas"]["4"]["ruta"], "ocr")

    def test_una_pausa_a_la_vez_no_procesa_de_mas_y_se_reanuda_igual(self):
        crear_libro(self.vault / "libro.pdf", 10)
        manifiesto = self.manifiesto(("libro", "bibliografia"))
        salida = self.vault / "_procesado/a-la-vez"
        primera = ejecutar(manifiesto, self.vault, salida, limite_paginas=4, trabajadores=(3, 1))
        self.assertEqual((primera["estado"], primera["procesadas"]), ("interrumpida", 4))
        self.assertEqual(len(list((salida / "libro/cache").glob("*.json"))), 4)
        segunda = ejecutar(manifiesto, self.vault, salida, trabajadores=(3, 1))
        self.assertEqual((segunda["cache"], segunda["procesadas"]), (4, 10))
        ejecutar(manifiesto, self.vault, self.vault / "_procesado/de-a-una")
        self.assertEqual(contenido(salida), contenido(self.vault / "_procesado/de-a-una"))

    def test_calidad_se_guarda_una_vez_por_segundo_y_entera_al_cortar(self):
        crear_libro(self.vault / "libro.pdf", 10)
        manifiesto = self.manifiesto(("libro", "bibliografia"), motores={c: "pymupdf" for c in ["digital", "escaneada", "mixta"]})
        salida = self.vault / "_procesado/prueba"
        original, escrituras = pipeline.guardar_json, []

        def contar(raiz, relativa, datos):
            if relativa.endswith("calidad.json"):
                escrituras.append(relativa)
            return original(raiz, relativa, datos)

        def cortar(pdf, n, motor, idiomas):
            if n == 6:
                raise KeyboardInterrupt()
            return extraer(pdf, n, motor, idiomas)
        inicio = time.monotonic()
        with patch("pipeline.guardar_json", side_effect=contar), self.assertRaises(KeyboardInterrupt):
            ejecutar(manifiesto, self.vault, salida, extractor=cortar)
        # Antes eran 1 + una por página; ahora la del arranque, una por segundo como mucho y la del corte.
        self.assertLessEqual(len(escrituras), 2 + int(time.monotonic() - inicio))
        paginas = json.loads((salida / "libro/calidad.json").read_text(encoding="utf-8"))["paginas"]
        self.assertEqual(sorted(paginas, key=int), ["1", "2", "3", "4", "5"])
        self.assertTrue((salida / "libro/estructura.json").exists())
        self.assertEqual(json.loads((salida / "estado-ingesta.json").read_text(encoding="utf-8"))["estado"], "interrumpida")
        self.assertEqual(ejecutar(manifiesto, self.vault, salida)["cache"], 5)

    def test_la_mitad_de_los_hilos_y_la_mitad_de_eso_para_el_ocr(self):
        for hilos, esperado in [(12, (6, 3)), (16, (8, 4)), (4, (2, 1)), (2, (1, 1)), (1, (1, 1)), (None, (1, 1)), (256, (61, 64))]:
            with patch("pipeline.os.process_cpu_count", return_value=hilos):
                self.assertEqual(trabajadores_de_la_maquina(), esperado, hilos)

    def test_la_ingesta_baja_su_prioridad_y_la_heredan_sus_procesos(self):
        if os.name == "nt":
            prioridad = ("import ctypes; k = ctypes.WinDLL('kernel32'); k.GetCurrentProcess.restype = ctypes.c_void_p; "
                         "k.GetPriorityClass.argtypes = [ctypes.c_void_p]; print(k.GetPriorityClass(k.GetCurrentProcess()))")
            esperado = str(0x4000)  # BELOW_NORMAL_PRIORITY_CLASS
        else:
            prioridad = "import os; print(os.nice(0))"
            esperado = str(min(19, os.nice(0) + 10))
        codigo = (f"import subprocess, sys; sys.path.insert(0, sys.argv[1]); import almacen; almacen.bajar_prioridad(); {prioridad}; "
                  f"print(subprocess.run([sys.executable, '-c', {prioridad!r}], capture_output=True, text=True).stdout.strip())")
        salida = subprocess.run([sys.executable, "-c", codigo, str(INGESTA)], capture_output=True, text=True, timeout=60)
        self.assertEqual(salida.returncode, 0, salida.stderr)
        self.assertEqual(salida.stdout.split(), [esperado, esperado])


if __name__ == "__main__":
    unittest.main(verbosity=2)
