"""Visión/persistencia sin LLM: las muestras artificiales no reemplazan el parcial real."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
import yaml
from almacen import Conflicto, bloquear, sha256
from pipeline import ejecutar
from test_ingesta import crear_pdf
import vision

TEXTO = "El ejercicio solicita calcular la derivada de una función y justificar el procedimiento. " * 3 + "La función es $f(x)=x^2$."


class VisionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.vault = Path(self.tmp.name)
        crear_pdf(self.vault / "muestra.pdf")
        self.raiz = self.vault / "_procesado/prueba"
        self.manifiesto = {"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
                           "documentos": [{"id": "practico", "titulo": "Práctico de prueba", "tipo": "ejercicios",
                                            "archivo": "muestra.pdf", "paginas": [1, 2, 3]}]}
        ejecutar(self.manifiesto, self.vault, self.raiz)
        self.datos = {"doc": "practico", "modelo": "openai/gpt-6-luna", "pagina": 1, "umbral": 0.6}

    def tearDown(self):
        self.tmp.cleanup()

    def preparar(self, **kwargs):
        datos = {**self.datos, **kwargs}
        with bloquear(self.raiz, self.vault):
            return {**datos, **vision.preparar(self.raiz, self.vault, datos)}

    def guardar(self, datos=None, **kwargs):
        datos = {**(datos or self.preparar()), "texto": TEXTO, "completa": True, **kwargs}
        with bloquear(self.raiz, self.vault):
            return vision.guardar(self.raiz, self.vault, datos)

    def items(self, items):
        with bloquear(self.raiz, self.vault):
            return vision.guardar_items(self.raiz, self.vault, {"doc": "practico", "items": items})

    def q(self):
        return json.loads((self.raiz / "practico/calidad.json").read_text(encoding="utf-8"))["paginas"]["1"]

    def test_render_cache_y_fuente_intacta(self):
        fuente = self.vault / "muestra.pdf"
        antes = sha256(fuente)
        preparada = self.preparar()
        imagen = Path(preparada["imagen"])
        self.assertEqual(imagen.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
        fecha = imagen.stat().st_mtime_ns
        self.preparar()
        self.assertEqual(imagen.stat().st_mtime_ns, fecha)
        self.assertEqual(sha256(fuente), antes)

    def test_render_recupera_corte_antes_del_registro_sin_pisar_imagen_editada(self):
        preparada = self.preparar()
        registro = self.raiz / "practico/render/0001.json"
        registro.unlink()
        self.preparar()
        self.assertTrue(registro.exists())
        Path(preparada["imagen"]).write_bytes(b"Imagen personal")
        with self.assertRaises(Conflicto):
            self.preparar()

    def test_guarda_latex_busqueda_informe_y_cita(self):
        salida = self.guardar()
        self.assertEqual(salida["ruta"], "vision")
        self.assertFalse(salida["pendiente"])
        self.assertEqual(self.q()["vision"]["revision_humana"], "pendiente")
        markdown = (self.raiz / "practico/paginas/0001.md").read_text(encoding="utf-8")
        self.assertIn("$f(x)=x^2$", markdown)
        self.assertIn("[[muestra.pdf#page=1]]", markdown)
        self.assertIn("justificar", (self.raiz / "busqueda.json").read_text(encoding="utf-8"))
        self.assertIn("| vision |", (self.raiz / "informe-ingesta.md").read_text(encoding="utf-8"))

    def test_repetir_no_gasta_y_base_no_degrada_vision(self):
        self.guardar()
        self.assertTrue(self.preparar()["cache"])
        self.assertEqual(ejecutar(self.manifiesto, self.vault, self.raiz)["cache"], 3)
        self.assertEqual(self.q()["ruta"], "vision")
        self.assertFalse(self.preparar(modelo="otro/modelo")["cache"])
        self.assertFalse(self.preparar(umbral=0.7)["cache"])
        with patch("vision.PROMPT", "Un prompt distinto"):
            self.assertFalse(self.preparar()["cache"])

    def test_moneda_y_continuacion_no_se_confunden_con_latex_ni_ilegibles(self):
        preparada = self.preparar()
        self.assertIn(r"\$", preparada["prompt"])
        self.assertIn("un salto de página no es ilegible", preparada["prompt"])
        texto = TEXTO + r" 9. Si $B$ da á $C$ \$5, tendrá \$6 menos que $C$; pero si $C$"
        self.guardar(preparada, texto=texto)
        self.assertFalse(self.q()["pendiente"])
        self.assertIn(texto, (self.raiz / "practico/paginas/0001.md").read_text(encoding="utf-8"))

    def test_ilegible_y_latex_roto_no_se_aprueban(self):
        self.guardar(texto=TEXTO + " [ilegible]")
        self.assertTrue(self.q()["pendiente"])
        self.guardar(self.preparar(), texto=TEXTO + " $sin cerrar")
        self.assertTrue(self.q()["pendiente"])

    def test_respuesta_incompleta_no_reemplaza_ocr(self):
        antes = sha256(self.raiz / "practico/paginas/0001.md")
        with self.assertRaises(ValueError):
            self.guardar(completa=False)
        self.assertEqual(sha256(self.raiz / "practico/paginas/0001.md"), antes)

    def test_error_conserva_texto_y_queda_pendiente(self):
        datos = self.preparar()
        antes = datos["sha256_anterior"]
        with bloquear(self.raiz, self.vault):
            vision.guardar(self.raiz, self.vault, datos, fallo=True)
        self.assertEqual(sha256(self.raiz / "practico/paginas/0001.md"), antes)
        self.assertTrue(self.q()["error_vision"])
        self.assertEqual(self.q()["ruta"], "pendiente")

    def test_ediciones_y_cambios_durante_la_llamada_se_preservan(self):
        datos = self.preparar()
        self.guardar(datos)
        with self.assertRaises(Conflicto):
            self.guardar(datos, texto="Respuesta de otra llamada")
        archivo = self.raiz / "practico/paginas/0001.md"
        archivo.write_text("Mis anotaciones", encoding="utf-8", newline="\n")
        with self.assertRaises(Conflicto):
            self.preparar()
        self.assertEqual(archivo.read_text(encoding="utf-8"), "Mis anotaciones")

    def test_reanuda_corte_entre_registro_y_markdown(self):
        datos = self.preparar()
        original = vision.atomico
        def cortar(raiz, relativa, texto):
            if relativa.endswith("/paginas/0001.md"):
                raise KeyboardInterrupt()
            return original(raiz, relativa, texto)
        with patch("vision.atomico", side_effect=cortar):
            with self.assertRaises(KeyboardInterrupt):
                self.guardar(datos)
        self.assertTrue(self.preparar()["cache"])
        self.assertEqual(self.q()["ruta"], "vision")
        self.assertIn("justificar", (self.raiz / "busqueda.json").read_text(encoding="utf-8"))

    def test_rechaza_rutas_paginas_y_fuentes_cambiadas(self):
        for datos in [{"doc": "../escape"}, {"pagina": 0}, {"pagina": True}, {"pagina": 4}]:
            with self.assertRaises(ValueError):
                self.preparar(**datos)
        with (self.vault / "muestra.pdf").open("ab") as f:
            f.write(b"Cambio")
        with self.assertRaises(Conflicto):
            self.preparar()

    def test_items_exigen_vision_y_conservan_ids_y_multipagina(self):
        item = {"id": "3b", "paginas": [1, 3], "enunciado": TEXTO}
        with self.assertRaises(ValueError):
            self.items([item])
        self.guardar()
        self.guardar(self.preparar(pagina=3))
        resultado = self.items([item])
        self.assertEqual(resultado["ids"], ["3b"])
        datos = yaml.safe_load((self.raiz / "practico/items.yaml").read_text(encoding="utf-8"))
        self.assertEqual(datos["items"][0]["paginas"], [1, 3])
        self.assertEqual(set(datos["sha256_paginas"]), {"1", "3"})

    def test_items_vinculan_una_solucion_existente_y_rechazan_yaml_invalido(self):
        self.guardar()
        self.manifiesto["documentos"].append({"id": "solucionario", "titulo": "Soluciones de prueba",
            "tipo": "soluciones", "archivo": "muestra.pdf", "paginas": [1]})
        ejecutar(self.manifiesto, self.vault, self.raiz)
        self.guardar(self.preparar(doc="solucionario"))
        with bloquear(self.raiz, self.vault):
            vision.guardar_items(self.raiz, self.vault, {"doc": "solucionario", "items": [
                {"id": "S1", "paginas": [1], "enunciado": "Solución artificial de prueba"}]})
        item = {"id": "1", "paginas": [1], "enunciado": TEXTO, "solucion": {"doc": "solucionario", "id": "S1"}}
        self.assertEqual(self.items([item])["items"], 1)
        (self.raiz / "solucionario/items.yaml").write_text("items: [YAML roto", encoding="utf-8", newline="\n")
        with self.assertRaisesRegex(ValueError, "YAML válido"):
            self.items([item])

    def test_items_validan_duplicados_rangos_soluciones_y_ediciones(self):
        self.guardar()
        item = {"id": "P2", "paginas": [1], "enunciado": TEXTO}
        for items in [[item, item], [{**item, "id": "P2\x1b"}], [{**item, "paginas": [0]}], [{**item, "paginas": [True]}],
                      [{**item, "solucion": {"doc": "ausente", "id": "P2"}}]]:
            with self.assertRaises(ValueError):
                self.items(items)
        self.items([item])
        archivo = self.raiz / "practico/items.yaml"
        archivo.write_text("Mis ítems curados", encoding="utf-8", newline="\n")
        with self.assertRaises(Conflicto):
            self.items([item])
        self.assertEqual(archivo.read_text(encoding="utf-8"), "Mis ítems curados")


if __name__ == "__main__":
    unittest.main()
