"""Pruebas locales sin LLM. Los PDFs artificiales NO sustituyen muestras reales del benchmark."""
from __future__ import annotations

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))

import pymupdf
from almacen import Conflicto, bloquear, sha256
from extraccion import area_union, calidad, clasificar, etiqueta_impresa, extraer
import ingestar
import pipeline
from pipeline import ejecutar


def crear_pdf(destino: Path) -> None:
    with pymupdf.open() as digital:
        for titulo, texto in [
            ("Derivación", "La derivada expresa la razón de cambio de una función. La derivación permite estudiar cómo cambia una cantidad cuando cambia otra. La regla de la cadena permite derivar una composición de funciones."),
            ("Regla de la cadena", "La regla de la cadena permite calcular la derivada de una composición de funciones. Primero se identifica la función interna y después la función externa. El resultado multiplica sus derivadas."),
            ("Redes de computadoras", "Los paquetes viajan por la red. El router recibe y transmite los datos por un enlace. La velocidad de transmisión determina cuánto tarda el envío de cada paquete. Los retardos forman parte del tiempo total.")]:
            pagina = digital.new_page(width=500, height=700)
            pagina.insert_text((45, 100), titulo, fontsize=19)
            pagina.insert_textbox(pymupdf.Rect(45, 140, 450, 430), texto, fontsize=12)
            pagina.insert_text((245, 670), str(len(digital)), fontsize=10)
        digital[0].insert_text((45, 470), "f(x) = x^2", fontsize=12)
        png = digital[1].get_pixmap(dpi=160).tobytes("png")
        with pymupdf.open() as salida:
            salida.insert_pdf(digital, from_page=0, to_page=0)
            pagina = salida.new_page(width=500, height=700)
            pagina.insert_image(pagina.rect, stream=png)
            salida.insert_pdf(digital, from_page=2, to_page=2)
            salida.set_toc([[1, "Derivación", 1], [1, "Regla de la cadena", 2], [2, "Aplicaciones", 3]])
            salida.save(destino)


class IngestaTest(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory(prefix="pi-ingesta-test-")
        self.vault = Path(self.temporal.name)
        self.fuente = self.vault / "muestra.pdf"
        crear_pdf(self.fuente)
        self.salida = self.vault / "_procesado/prueba"
        self.manifiesto = {"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
                           "documentos": [{"id": "muestra", "titulo": "Curso de prueba", "tipo": "bibliografia", "archivo": "muestra.pdf", "paginas": [1, 2, 3]}]}

    def tearDown(self):
        self.temporal.cleanup()

    def leer(self, nombre):
        return json.loads((self.salida / nombre).read_text())

    def ejecutar(self, **kwargs):
        return ejecutar(self.manifiesto, self.vault, self.salida, **kwargs)

    def test_clasificacion_y_ocr_previo(self):
        with pymupdf.open(self.fuente) as pdf:
            self.assertEqual(clasificar(pdf[0])["clase"], "digital")
            self.assertEqual(clasificar(pdf[1])["clase"], "escaneada")
            self.assertGreater(clasificar(pdf[1])["area_imagen"], 0.99)
            self.assertEqual(etiqueta_impresa(pdf[0]), ("1", "encabezado_o_pie"))
            self.assertTrue(clasificar(pdf[0])["posible_matematica"])
            pdf[2].insert_text((45, 470), "Un polígono de n + 2 lados tiene n - 1 diagonales.")
            clase = clasificar(pdf[2])
            self.assertFalse(clase["posible_matematica"])
            self.assertFalse(calidad(pdf[2].get_text(), clase, 0.6)["pendiente"])

    def test_no_suma_imagenes_superpuestas(self):
        self.assertEqual(area_union([(0, 0, 10, 10), (0, 0, 10, 10), (5, 0, 15, 10)]), 150)

    def test_calidad_basura_y_latex(self):
        self.assertLess(calidad("\ufffd" * 300 + " qzxv qzxv qzxv", {}, 0.6)["puntaje"], 0.6)
        self.assertLess(calidad("La derivada de la función está dada por $x+1", {}, 0.6)["puntaje"], 0.6)
        self.assertLess(calidad("", {"area_imagen": 1}, 0.6)["puntaje"], 0.6)
        self.assertEqual(calidad("", {"area_imagen": 0}, 0.6)["puntaje"], 1)

    def test_no_da_por_recuperada_matematica_sin_latex(self):
        q = calidad("La derivada de una función se obtiene como una razón de cambio. " * 5, {"posible_matematica": True}, 0.6)
        self.assertTrue(q["pendiente"])
        self.assertTrue(any("LaTeX" in a for a in q["avisos"]))

    def test_metadatos_outline_busqueda_y_original_intacto(self):
        huella = sha256(self.fuente)
        estado = self.ejecutar()
        self.assertEqual(estado["procesadas"], 3)
        self.assertEqual(sha256(self.fuente), huella)
        meta = self.leer("muestra/meta.json")
        self.assertEqual(meta["paginas"], 3)
        self.assertEqual(meta["sha256"], huella)
        estructura = self.leer("muestra/estructura.json")
        self.assertEqual(estructura["metodo"], "outline_pdf")
        self.assertEqual(estructura["secciones"][1]["paginas"], [2, 3])
        indice = self.leer("busqueda.json")
        self.assertTrue(any("derivacion" in f["frecuencias"] for f in indice["fragmentos"]))
        self.assertIn("[[muestra.pdf#page=1]]", (self.salida / "informe-ingesta.md").read_text())
        self.assertNotIn("<!--", "".join(f["texto"] for f in indice["fragmentos"]))

    def test_pausa_y_reanudacion_sin_extraer_dos_veces(self):
        primera = self.ejecutar(limite_paginas=1)
        self.assertEqual(primera["estado"], "interrumpida")
        archivo = self.salida / "muestra/paginas/0001.md"
        fecha = archivo.stat().st_mtime_ns
        llamadas = []
        def contar(pdf, n, motor, idiomas):
            llamadas.append(n)
            return extraer(pdf, n, motor, idiomas)
        segunda = self.ejecutar(extractor=contar)
        self.assertEqual(segunda["cache"], 1)
        self.assertEqual(llamadas, [2, 3])
        self.assertEqual(archivo.stat().st_mtime_ns, fecha)
        with patch("pipeline.clasificar", side_effect=AssertionError("No reclasificar páginas sin cambios")):
            tercera = self.ejecutar(extractor=lambda *_: self.fail("No extraer de nuevo"))
        self.assertEqual(tercera["cache"], 3)

    def test_reanuda_si_se_corta_entre_registro_y_markdown(self):
        original = pipeline.atomico
        def cortar(raiz, relativa, texto):
            if relativa.endswith("/paginas/0001.md"):
                raise KeyboardInterrupt()
            return original(raiz, relativa, texto)
        with patch("pipeline.atomico", side_effect=cortar):
            with self.assertRaises(KeyboardInterrupt):
                self.ejecutar()
        self.assertTrue((self.salida / "muestra/cache/0001.json").exists())
        self.assertFalse((self.salida / "muestra/paginas/0001.md").exists())
        resultado = self.ejecutar()
        self.assertEqual(resultado["cache"], 1)
        self.assertTrue((self.salida / "muestra/paginas/0001.md").exists())

    def test_error_de_pagina_no_frena_documento(self):
        def fallar(pdf, n, motor, idiomas):
            if n == 1:
                raise RuntimeError("Fallo simulado")
            return extraer(pdf, n, motor, idiomas)
        self.ejecutar(extractor=fallar)
        paginas = self.leer("muestra/calidad.json")["paginas"]
        self.assertEqual(paginas["1"]["ruta"], "pendiente")
        self.assertIn("error", paginas["1"])
        self.assertNotIn("error", paginas["3"])
        self.assertEqual(self.leer("estado-ingesta.json")["procesadas"], 3)

    def test_error_de_clasificacion_tambien_es_por_pagina(self):
        def fallar(pagina):
            if pagina.number == 0:
                raise ValueError("Página dañada simulada")
            return clasificar(pagina)
        with patch("pipeline.clasificar", side_effect=fallar):
            self.ejecutar()
        paginas = self.leer("muestra/calidad.json")["paginas"]
        self.assertIn("error", paginas["1"])
        self.assertNotIn("error", paginas["3"])

    def test_cache_invalida_si_cambia_umbral(self):
        self.ejecutar()
        self.manifiesto["umbral_calidad"] = 0.7
        self.assertEqual(self.ejecutar()["cache"], 0)

    def test_rechaza_markdown_editado(self):
        self.ejecutar()
        pagina = self.salida / "muestra/paginas/0001.md"
        pagina.write_text("Mis anotaciones personales")
        self.assertIn("adoptar", " ".join(self.ejecutar()["editadas"]))
        self.assertEqual(pagina.read_text(), "Mis anotaciones personales")

    def test_rechaza_pdf_cambiado_sin_borrar_resultados(self):
        self.ejecutar()
        with pymupdf.open(self.fuente) as pdf:
            pdf[0].insert_text((45, 600), "Cambio en la fuente")
            nuevo = pdf.tobytes()
        self.fuente.write_bytes(nuevo)
        with self.assertRaises(Conflicto):
            self.ejecutar()
        self.assertTrue((self.salida / "muestra/paginas/0001.md").exists())

    def test_rechaza_salida_ajena_enlaces_y_traversal(self):
        self.salida.mkdir(parents=True)
        nota = self.salida / "nota.md"
        nota.write_text("No sobrescribir")
        with self.assertRaises(Conflicto):
            self.ejecutar()
        self.assertEqual(nota.read_text(), "No sobrescribir")
        salida_enlace = self.vault / "_procesado/enlace"
        salida_enlace.symlink_to(self.vault, target_is_directory=True)
        with self.assertRaises(Conflicto):
            ejecutar(self.manifiesto, self.vault, salida_enlace)
        self.manifiesto["documentos"][0]["id"] = "../escape"
        with self.assertRaises(ValueError):
            self.ejecutar()

    def test_un_solo_escritor(self):
        with bloquear(self.salida, self.vault):
            with self.assertRaises(Conflicto):
                self.ejecutar()

    def test_rango_base_uno_y_muestra_no_es_documento_completo(self):
        self.manifiesto["documentos"][0]["paginas"] = [3]
        self.ejecutar()
        reporte = (self.salida / "informe-ingesta.md").read_text()
        self.assertIn("Fuera de esta selección: 2", reporte)
        self.assertEqual(set(self.leer("muestra/calidad.json")["paginas"]), {"3"})
        self.manifiesto["documentos"][0]["paginas"] = [0]
        with self.assertRaises(ValueError):
            self.ejecutar()

    def test_iniciar_libera_el_bloqueo_antes_de_lanzar_el_hijo(self):
        manifiesto = self.vault / "manifiesto.json"
        manifiesto.write_text(json.dumps(self.manifiesto))
        args = SimpleNamespace(comando="iniciar", vault=self.vault, salida=self.salida,
                               manifiesto=manifiesto, limite_paginas=None)
        def lanzar(*_, **__):
            with bloquear(self.salida, self.vault):
                return SimpleNamespace(pid=1234, poll=lambda: 0, returncode=0)
        with patch("ingestar.argumentos", return_value=args), patch("ingestar.subprocess.Popen", side_effect=lanzar):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(ingestar.main(), 0)

    def test_motores_predeterminados_sin_configuracion_extra(self):
        del self.manifiesto["motores"]
        llamadas = []
        def extraer_prueba(pdf, numero, motor, idiomas):
            llamadas.append((numero, motor))
            return "La página contiene texto de prueba en español. " * 8
        self.ejecutar(extractor=extraer_prueba)
        self.assertEqual(llamadas, [(1, "pymupdf"), (2, "ocrmypdf"), (3, "pymupdf")])

    def test_evaluaciones_quedan_pendientes_de_vision_aunque_el_texto_sea_bueno(self):
        self.manifiesto["documentos"][0]["paginas"] = [3]
        self.ejecutar()
        self.manifiesto["documentos"][0]["tipo"] = "evaluaciones"
        self.assertEqual(self.ejecutar()["cache"], 0)
        pagina = self.leer("muestra/calidad.json")["paginas"]["3"]
        self.assertGreater(pagina["puntaje"], 0.6)
        self.assertTrue(pagina["requiere_vision"])
        self.assertEqual(pagina["ruta"], "pendiente")

    def test_cambiar_ruta_actualiza_cita_aunque_el_pdf_sea_identico(self):
        self.manifiesto["documentos"][0]["paginas"] = [3]
        self.ejecutar()
        (self.vault / "alias.pdf").write_bytes(self.fuente.read_bytes())
        self.manifiesto["documentos"][0]["archivo"] = "alias.pdf"
        self.ejecutar()
        self.assertIn("[[alias.pdf#page=3]]", (self.salida / "muestra/paginas/0003.md").read_text())

    def test_ocr_real_local_sin_llm(self):
        with pymupdf.open(self.fuente) as pdf:
            texto = extraer(pdf, 2, "ocrmypdf", ["spa", "eng"])
        self.assertIn("cadena", texto.lower())
        self.assertIn("derivada", texto.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
