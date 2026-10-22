"""Regresiones de la auditoría sobre la ingesta, sin LLM. Las pruebas con PDFs reales se omiten si falta el curso."""
from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))

import pymupdf
from almacen import bloquear
import ingestar
import extraccion
from extraccion import clasificar
from pipeline import construir_busqueda, ejecutar
import vision

CURSO = Path(__file__).resolve().parents[3] / "cursos/redes"
KUROSE = CURSO / "fuentes/bibliografia/Redes_de_computadoras_Un_enfoque_descend.pdf"
PROGRAMA = CURSO / "fuentes/programa/Programa de Unidad Curricular Redes de Computadoras - 20191022.pdf"
PROSA = "Los paquetes viajan por la red de un router a otro y la velocidad de transmisión determina cuánto tarda cada envío. " * 4


class Base(unittest.TestCase):
    def setUp(self):
        temporal = tempfile.TemporaryDirectory(prefix="pi-auditoria-")
        self.addCleanup(temporal.cleanup)
        self.vault = Path(temporal.name)
        self.salida = self.vault / "_procesado/prueba"

    def pdf(self, nombre: str, textos: list[str], fuente: str = "helv") -> None:
        with pymupdf.open() as pdf:
            for texto in textos:
                pdf.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 60, 455, 660), texto, fontsize=11, fontname=fuente)
            pdf.save(self.vault / nombre)

    def doc(self, ident: str, tipo: str = "bibliografia", paginas="todas") -> dict:
        return {"id": ident, "titulo": ident, "tipo": tipo, "archivo": f"{ident}.pdf", "paginas": paginas}

    def ejecutar(self, *documentos, **kwargs) -> dict:
        manifiesto = {"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]}, "documentos": list(documentos)}
        return ejecutar(manifiesto, self.vault, self.salida, **kwargs)

    def q(self, doc: str, pagina: int = 1) -> dict:
        return json.loads((self.salida / f"{doc}/calidad.json").read_text())["paginas"][str(pagina)]

    def transcribir(self, doc: str, texto: str, pagina: int = 1) -> dict:
        datos = {"doc": doc, "pagina": pagina, "modelo": "openai/gpt-6-luna", "umbral": 0.6}
        with bloquear(self.salida, self.vault) as raiz:
            datos.update(vision.preparar(raiz, self.vault, datos))
            return vision.guardar(raiz, self.vault, {**datos, "texto": texto, "completa": True})


class MatematicaDigitalTest(Base):
    def test_codigo_y_asignaciones_en_prosa_no_son_matematica(self):
        self.pdf("codigo.pdf", ["x = 1\nhost = sistema"], fuente="cour")
        self.pdf("prosa.pdf", ["Es decir, host = sistema terminal. Juan toma la I-95 Sur. Cada circuito es (1,536 Mbps)/24 = 64 kbps."], fuente="tiro")
        for nombre in ("codigo.pdf", "prosa.pdf"):
            with pymupdf.open(self.vault / nombre) as pdf:
                self.assertFalse(clasificar(pdf[0])["posible_matematica"], nombre)

    @unittest.skipUnless(KUROSE.exists() and PROGRAMA.exists(), "faltan los PDFs reales de cursos/redes")
    def test_paginas_reales(self):
        with pymupdf.open(KUROSE) as kurose, pymupdf.open(PROGRAMA) as programa:
            # PDF 33 'host =', 47 'I-95', 50 '24 =' y las viñetas OpenSymbol del programa eran falsos positivos.
            for nombre, pagina in [("K33", kurose[32]), ("K47", kurose[46]), ("K50", kurose[49]), ("P1", programa[0])]:
                self.assertFalse(clasificar(pagina)["posible_matematica"], nombre)
            for numero in (88, 203):
                clase = clasificar(kurose[numero - 1])
                self.assertTrue(clase["posible_matematica"] and clase["operadores_cifrados"], numero)

    @unittest.skipUnless(KUROSE.exists(), "falta el PDF real de Kurose")
    def test_operadores_cifrados_avisan_y_piden_vision(self):
        with pymupdf.open(KUROSE) as kurose, pymupdf.open() as una:
            una.insert_pdf(kurose, from_page=87, to_page=87)
            una.save(self.vault / "k88.pdf")
        self.ejecutar(self.doc("k88"))
        q = self.q("k88")
        self.assertTrue(q["requiere_vision"])
        self.assertEqual(q["ruta"], "pendiente")
        self.assertIn("En esta página «5» puede ser «=», «1» «+» y «2» «−»: verificá con la imagen.", q["avisos"])

    def test_nuevo_algoritmo_conserva_vision_y_desatasca_falsos_positivos(self):
        self.pdf("libro.pdf", [PROSA])
        viejo = lambda pagina: {**clasificar(pagina), "posible_matematica": True}
        with patch("pipeline.clasificar", side_effect=viejo):
            self.ejecutar(self.doc("libro"))
        texto = "Transcripción de visión: " + PROSA.strip()
        self.transcribir("libro", texto)
        self.assertEqual(self.q("libro")["ruta"], "pendiente")  # el tope de matemática sin LaTeX la dejaba trabada
        with patch("extraccion.VERSION_ALGORITMO", 99):
            self.ejecutar(self.doc("libro"))
        q = self.q("libro")
        self.assertEqual((q["ruta"], q["motor"], q["pendiente"]), ("vision", "vision", False))
        self.assertFalse(q["clasificacion"]["posible_matematica"])
        self.assertIn(texto, (self.salida / "libro/paginas/0001.md").read_text())


class MatematicaOcrTest(Base):
    def test_restos_de_formulas_de_tesseract(self):
        # Salidas reales de tesseract sobre Kurose escaneado y sobre una fórmula con subíndices.
        for texto in ["Sean d d d d los retardos de procesamiento, de cola, de transmisión y de",
                      "d do o+d +d,  +d", "t = RTT/ + L/R = 15,008 milisegundos.",
                      "parte del tiempo total.\n\nnodal proc cola trans prop", "dado por:\n\nnodal — proc cola trans prop\n\nLas"]:
            self.assertTrue(extraccion.matematica_ocr(texto), texto)
        self.assertFalse(extraccion.matematica_ocr("Los paquetes viajan por la red de un router a otro. El router recibe los datos\n"
                                                   "por un enlace y los transmite por el siguiente, y a la vez se\nforman colas.\n\n"
                                                   "Si una imagen vale más que mil palabras, A y B se comunican."))

    def test_formula_escaneada_queda_pendiente_y_la_prosa_no(self):
        with pymupdf.open() as digital, pymupdf.open() as escaneado:
            formula = digital.new_page(width=500, height=700)
            formula.insert_textbox(pymupdf.Rect(45, 60, 450, 250), PROSA, fontsize=12)
            x = 60
            for base, sub, op in [("d", "nodal", " = "), ("d", "proc", " + "), ("d", "cola", " + "), ("d", "trans", " + "), ("d", "prop", "")]:
                formula.insert_text((x, 300), base, fontsize=16, fontname="tiit")
                formula.insert_text((x + 9, 305), sub, fontsize=9, fontname="tiit")
                x += 9 + pymupdf.get_text_length(sub, "tiit", 9)
                formula.insert_text((x, 300), op, fontsize=16)
                x += pymupdf.get_text_length(op, "helv", 16)
            digital.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 60, 450, 400), PROSA, fontsize=12)
            for pagina in digital:
                escaneado.new_page(width=500, height=700).insert_image(pymupdf.Rect(0, 0, 500, 700), stream=pagina.get_pixmap(dpi=200).tobytes("png"))
            escaneado.save(self.vault / "escaneado.pdf")
        ejecutar({"version": 1, "documentos": [self.doc("escaneado")]}, self.vault, self.salida)
        formula, prosa = self.q("escaneado", 1), self.q("escaneado", 2)
        self.assertEqual((formula["motor"], formula["ruta"]), ("ocrmypdf", "pendiente"))
        self.assertTrue(formula["requiere_vision"] and formula["clasificacion"]["posible_matematica"])
        self.assertTrue(any("matemática" in aviso for aviso in formula["avisos"]))
        self.assertEqual((prosa["ruta"], prosa["requiere_vision"]), ("ocr", False))



class FalloVisionTest(Base):
    def test_reingerir_recupera_pagina_digital_tras_fallo_de_vision(self):
        self.pdf("libro.pdf", [PROSA])
        self.ejecutar(self.doc("libro"))
        datos = {"doc": "libro", "pagina": 1, "modelo": "openai/gpt-6-luna", "umbral": 0.6}
        with bloquear(self.salida, self.vault) as raiz:
            datos.update(vision.preparar(raiz, self.vault, datos))
            vision.guardar(raiz, self.vault, datos, fallo=True)
        self.assertEqual(self.q("libro")["ruta"], "pendiente")
        self.assertEqual(self.ejecutar(self.doc("libro"))["cache"], 0)
        q = self.q("libro")
        self.assertEqual((q["ruta"], q["pendiente"]), ("digital", False))
        self.assertNotIn("error_vision", q)


class SolucionesFueraDelIndiceTest(Base):
    def indexado(self, doc: str) -> str:
        return " ".join(f["texto"] for f in json.loads((self.salida / "busqueda.json").read_text())["fragmentos"] if f["doc"] == doc)

    def test_evaluaciones_indexan_solo_enunciados_y_soluciones_nada(self):
        self.pdf("parcial.pdf", ["Pregunta 1 (10 puntos)\nCalcule enunciadouno.\nSolución\nsecretouno",
                                 "secretodos sigue la solución.\n**_Pregunta 2 (8 puntos)_**\nExplique enunciadodos.\nSolución: secretotres",
                                 "secretocuatro\nEjercicio 3 Considere enunciadotres.\n**Respuesta** secretocinco\nPregunta 4\nenunciadocuatro\nRespuesta: secretoseis"])
        self.pdf("resueltos.pdf", ["Ejercicio 1\nsecretosiete"])
        self.ejecutar(self.doc("parcial", "evaluaciones"), self.doc("resueltos", "soluciones"))
        texto = self.indexado("parcial")
        for palabra in ["enunciadouno", "enunciadodos", "enunciadotres", "enunciadocuatro"]:
            self.assertIn(palabra, texto)
        self.assertNotIn("secreto", texto)
        self.assertEqual(self.indexado("resueltos"), "")
        indice = json.loads((self.salida / "busqueda.json").read_text())
        self.assertEqual({f["tipo"] for f in indice["fragmentos"]}, {"evaluaciones"})

    def test_pagina_faltante_no_deja_pasar_una_solucion_que_continua(self):
        self.pdf("parcial.pdf", ["Pregunta 1 (10 puntos)\nenunciadouno", "Solución\nsecretouno", "secretodos continúa.\nPregunta 2\nenunciadodos"])
        self.ejecutar(self.doc("parcial", "evaluaciones", [1, 3]))
        texto = self.indexado("parcial")
        self.assertIn("enunciadodos", texto)
        self.assertNotIn("secreto", texto)

    @unittest.skipUnless((CURSO / "_procesado/sol-prc20240926/meta.json").exists(), "falta el parcial procesado de cursos/redes")
    def test_parcial_real_con_solucion_integrada(self):
        shutil.copytree(CURSO / "_procesado/sol-prc20240926", self.salida / "sol-prc20240926", ignore=shutil.ignore_patterns("render", "cache"))
        construir_busqueda(self.salida)
        texto = self.indexado("sol-prc20240926")
        for enunciado in ["Deseo comprar cables", "GET condicional", "RDT 2.2", "Go-Back-N"]:
            self.assertIn(enunciado, texto)
        for solucion in ["registro MX", "RCPT TO", "Content-type", "ventaja concreta", "temporizadores", "Son 16 paquetes"]:
            self.assertNotIn(solucion, texto)


class EdicionManualTest(Base):
    def setUp(self):
        super().setUp()
        self.pdf("a.pdf", ["Primer documento con texto sobre enrutamiento y tablas de reenvío. " * 4] * 2)
        self.pdf("b.pdf", ["Segundo documento con texto sobre congestión y control de flujo. " * 4])
        self.ejecutar(self.doc("a"), self.doc("b"))
        self.editada = self.salida / "a/paginas/0001.md"
        self.editada.write_text("Mi resumen corregido sobre enrutamiento", encoding="utf-8")

    def busqueda(self) -> dict:
        return json.loads((self.salida / "busqueda.json").read_text())

    def adoptar(self, doc: str = "a", pagina: int = 1) -> int:
        args = SimpleNamespace(comando="adoptar", vault=self.vault, salida=self.salida, doc=doc, pagina=pagina, manifiesto=None, limite_paginas=None)
        with patch("ingestar.argumentos", return_value=args), redirect_stdout(io.StringIO()):
            return ingestar.main()

    def test_una_pagina_editada_no_traba_otros_documentos_ni_vision(self):
        estado = self.ejecutar(self.doc("b"))
        self.assertEqual(estado["estado"], "completada")
        self.assertIn("ingestar.py adoptar", estado["editadas"][0])
        self.assertIn("--doc a --pagina 1", estado["editadas"][0])
        self.assertEqual({(f["doc"], f["pagina"]) for f in self.busqueda()["fragmentos"]}, {("a", 2), ("b", 1)})
        self.assertIn("| editada |", (self.salida / "informe-ingesta.md").read_text())
        self.assertEqual(self.transcribir("b", "Transcripción de visión: " + PROSA)["ruta"], "vision")
        estado = self.ejecutar(self.doc("a"), self.doc("b"))
        self.assertEqual(estado["estado"], "completada_con_pendientes")
        self.assertEqual(self.editada.read_text(encoding="utf-8"), "Mi resumen corregido sobre enrutamiento")

    def test_adoptar_registra_la_edicion_y_la_ingesta_la_conserva(self):
        self.assertEqual(self.adoptar(), 0)
        q = self.q("a")
        self.assertEqual((q["ruta"], q["revision_humana"], q["pendiente"]), ("manual", "hecha", False))
        self.assertIn("Mi resumen corregido", " ".join(f["texto"] for f in self.busqueda()["fragmentos"]))
        self.assertEqual(json.loads((self.salida / "estado-ingesta.json").read_text())["editadas"], [])
        with patch("extraccion.VERSION_ALGORITMO", 99):
            estado = self.ejecutar(self.doc("a"), self.doc("b"))
        self.assertEqual((estado["estado"], estado["editadas"]), ("completada", []))
        self.assertEqual(self.editada.read_text(encoding="utf-8"), "Mi resumen corregido sobre enrutamiento")
        self.assertEqual(self.q("a")["ruta"], "manual")


class ArranqueTest(Base):
    def setUp(self):
        super().setUp()
        self.pdf("libro.pdf", [PROSA])
        self.manifiesto = self.vault / "manifiesto.json"
        self.manifiesto.write_text(json.dumps({"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
                                               "documentos": [self.doc("libro")]}))
        self.config = {k: v for k, v in json.loads(ingestar.CONFIG.read_text()).items() if k != "ruta_tesseract"}
        # Como /usr/bin/tesseract: sin 'spa'.
        binarios = self.vault / "bin"
        binarios.mkdir()
        falso = binarios / "tesseract"
        falso.write_text("#!/bin/sh\nif [ \"$1\" = --list-langs ]; then printf 'List of available languages (2):\\neng\\nosd\\n'; else echo 'tesseract 5.5.3'; fi\n")
        falso.chmod(0o755)
        for parche in [patch("ingestar.CONFIG", self.vault / "curso.config.json"),
                       patch.dict(os.environ, {"PATH": f"{binarios}{os.pathsep}{os.environ['PATH']}"})]:
            parche.start()
            self.addCleanup(parche.stop)
        (self.vault / "curso.config.json").write_text(json.dumps(self.config))

    def cli(self, comando: str) -> tuple[int, str, str]:
        args = SimpleNamespace(comando=comando, vault=self.vault, salida=self.salida, manifiesto=self.manifiesto, limite_paginas=None, doc=None, pagina=None)
        salida, error = io.StringIO(), io.StringIO()
        with patch("ingestar.argumentos", return_value=args), redirect_stdout(salida), redirect_stderr(error):
            return ingestar.main(), salida.getvalue(), error.getvalue()

    def test_pdf_digital_no_exige_tesseract_con_spa(self):
        estado = ejecutar({"version": 1, "documentos": [self.doc("libro")]}, self.vault, self.salida)
        self.assertEqual(estado["estado"], "completada")

    def test_iniciar_informa_si_el_hijo_muere_y_estado_no_muestra_la_corrida_anterior(self):
        self.assertEqual(self.cli("procesar")[0], 0)
        real = subprocess.Popen
        muere = [sys.executable, "-c", "import sys; print('No se completó la ingesta: Faltan idiomas OCR', file=sys.stderr); sys.exit(1)"]
        with patch("ingestar.subprocess.Popen", side_effect=lambda comando, **kw: real(muere, **kw)):
            codigo, _, error = self.cli("iniciar")
        self.assertEqual((codigo, error.strip()), (1, "No se completó la ingesta: Faltan idiomas OCR"))
        estado = json.loads(self.cli("estado")[1])
        self.assertEqual(estado["estado"], "error")
        self.assertIn("Faltan idiomas OCR", estado["error"])

    def test_estado_durante_el_arranque_no_es_la_corrida_anterior(self):
        self.assertEqual(self.cli("procesar")[0], 0)
        real, hijos, vistos = subprocess.Popen, [], []
        def lanzar(comando, **kw):
            hijos.append(real([sys.executable, "-c", "import time; time.sleep(60)"], **kw))
            return hijos[-1]
        def consultar():
            # Popen está parcheado en todo el módulo subprocess: la consulta usa el real.
            consulta = real([sys.executable, ingestar.__file__, "estado", "--salida", str(self.salida)], stdout=subprocess.PIPE, text=True)
            vistos.append(json.loads(consulta.communicate()[0])["estado"])
            hijos[0].kill()
        temporizador = threading.Timer(0.5, consultar)
        with patch("ingestar.subprocess.Popen", side_effect=lanzar):
            temporizador.start()
            self.cli("iniciar")
        temporizador.join()
        self.assertEqual(vistos, ["iniciando"])

    def test_estado_con_el_proceso_muerto_muestra_la_ultima_linea_del_log(self):
        self.assertEqual(self.cli("procesar")[0], 0)
        estado = json.loads((self.salida / "estado-ingesta.json").read_text())
        (self.salida / "estado-ingesta.json").write_text(json.dumps({**estado, "estado": "en_curso"}))
        (self.salida / "proceso.log").write_text("Traceback (most recent call last):\nMemoryError\n")
        estado = json.loads(self.cli("estado")[1])
        self.assertEqual(estado["estado"], "interrumpida")
        self.assertIn("MemoryError", estado["aviso"])

    def test_sin_tesseract_no_se_pierde_la_vision_de_una_pagina_escaneada(self):
        with pymupdf.open() as digital, pymupdf.open() as escaneado:
            digital.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 60, 450, 400), PROSA, fontsize=12)
            escaneado.new_page(width=500, height=700).insert_image(pymupdf.Rect(0, 0, 500, 700), stream=digital[0].get_pixmap(dpi=100).tobytes("png"))
            escaneado.save(self.vault / "escaneado.pdf")
        real = extraccion.identidad_motor
        def con_spa(motor, idiomas):
            return real(motor, idiomas) if motor == "pymupdf" else {"motor": motor, "tesseract": "tesseract 5.5.2"}
        def sin_spa(motor, idiomas):
            if motor == "pymupdf":
                return real(motor, idiomas)
            raise ValueError("Faltan idiomas OCR en tesseract")
        manifiesto = {"version": 1, "documentos": [self.doc("escaneado")]}
        with patch("pipeline.identidad_motor", side_effect=con_spa):
            ejecutar(manifiesto, self.vault, self.salida, extractor=lambda *_: PROSA)
        self.transcribir("escaneado", "Transcripción de visión: " + PROSA)
        with patch("pipeline.identidad_motor", side_effect=sin_spa):
            ejecutar(manifiesto, self.vault, self.salida, extractor=lambda *_: self.fail("No reextraer"))
        with patch("pipeline.identidad_motor", side_effect=con_spa):
            ejecutar(manifiesto, self.vault, self.salida, extractor=lambda *_: "Texto del OCR " + PROSA)
        q = self.q("escaneado")
        self.assertEqual((q["motor"], q["ruta"]), ("vision", "vision"))
        self.assertIn("Transcripción de visión", (self.salida / "escaneado/paginas/0001.md").read_text())

    def test_ruta_tesseract_va_primero_en_el_path(self):
        (self.vault / "curso.config.json").write_text(json.dumps({**self.config, "ruta_tesseract": str(self.vault / "otro/tesseract")}))
        caminos = []
        with patch("ingestar.ejecutar", side_effect=lambda *a, **k: caminos.append(os.environ["PATH"]) or {}):
            self.cli("procesar")
        self.assertTrue(caminos[0].startswith(str(self.vault / "otro") + os.pathsep))

if __name__ == "__main__":
    unittest.main(verbosity=2)
