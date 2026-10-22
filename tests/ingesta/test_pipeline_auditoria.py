"""Regresiones de la auditoría sobre la ingesta, sin LLM. Las pruebas con PDFs reales se omiten si falta el curso."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))

import pymupdf
from almacen import bloquear
import extraccion
from extraccion import clasificar
from pipeline import ejecutar
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
