"""Regresiones de la auditoría en curación y visión, con PDFs sintéticos y sin red ni LLM."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
from almacen import Conflicto, sha256
import test_cursos
from test_ingesta import crear_pdf
import test_vision
from test_vision import TEXTO
from cursos import revisar, validar


def cortar(entrada, salida):
    salida.write(entrada.read(100))
    raise OSError("Disco lleno simulado")


class CursosAuditoriaTest(unittest.TestCase):
    setUp, tearDown = test_cursos.CursosTest.setUp, test_cursos.CursosTest.tearDown
    escribir, crear, guardar_indice = test_cursos.CursosTest.escribir, test_cursos.CursosTest.crear, test_cursos.CursosTest.guardar_indice

    def test_h40_propuesta_dentro_del_curso_pide_la_raiz_del_vault(self):
        dentro = self.raiz / "_procesado/propuesta.json"
        dentro.parent.mkdir(parents=True)
        dentro.write_text(self.propuesta.read_text())
        with self.assertRaisesRegex(ValueError, "raíz del vault"):
            revisar(self.vault, "ejemplo", dentro)

    def ampliar(self):
        nuevo = self.vault / "_entrada/otro.pdf"
        crear_pdf(nuevo)
        i = copy.deepcopy(self.indice)
        i["documentos"].append({**i["documentos"][0], "id": "otro", "archivo": "fuentes/bibliografia/otro.pdf"})
        self.escribir(i)
        paquete = json.loads(self.propuesta.read_text())
        paquete["origenes"] = {"otro": {"archivo": "_entrada/otro.pdf", "sha256": sha256(nuevo)}}
        self.propuesta.write_text(json.dumps(paquete))
        return nuevo, self.raiz / "fuentes/bibliografia/otro.pdf"

    def test_h38_curso_nuevo_cortado_no_aparece_y_se_puede_repetir(self):
        with patch("cursos.shutil.copyfileobj", side_effect=cortar):
            with self.assertRaises(OSError):
                self.crear()
        self.assertFalse(self.raiz.exists())
        self.assertTrue(self.crear()["validacion"]["ok"])
        self.assertEqual([p.name for p in (self.vault / "cursos").iterdir()], ["ejemplo"])

    def test_h38_ampliacion_cortada_o_matada_no_deja_pdf_parcial_con_el_nombre_final(self):
        self.crear()
        nuevo, destino = self.ampliar()
        with patch("cursos.shutil.copyfileobj", side_effect=cortar):
            with self.assertRaises(OSError):
                self.crear()
        self.assertEqual(list(destino.parent.iterdir()), [self.raiz / "fuentes/bibliografia/libro.pdf"])
        muerto = subprocess.Popen(["true"]); muerto.wait()
        huerfano = destino.with_name(f".otro.pdf.parcial-{muerto.pid}")
        huerfano.write_bytes(b"copia de un aplicar matado")
        self.assertEqual(self.crear()["copiados"], 1)
        self.assertFalse(huerfano.exists())
        self.assertEqual(sha256(destino), sha256(nuevo))

    def test_h38_copia_completa_y_curso_editado_se_puede_reintentar(self):
        self.crear()
        _, destino = self.ampliar()
        def interferir(entrada, salida):
            salida.write(entrada.read())
            (self.raiz / "curso.md").write_text(self.contrato + "\nEdición durante la copia\n")
        with patch("cursos.shutil.copyfileobj", side_effect=interferir):
            with self.assertRaises(Conflicto):
                self.crear()
        self.assertTrue(destino.exists())
        self.assertTrue(self.crear()["validacion"]["ok"])

    def test_h38_carpeta_incompleta_no_es_un_curso_existente(self):
        pdf = self.raiz / "fuentes/bibliografia/libro.pdf"
        pdf.parent.mkdir(parents=True)
        pdf.write_bytes(b"%PDF cortado")
        with self.assertRaisesRegex(OSError, "sin indice.yaml"):
            revisar(self.vault, "ejemplo", self.propuesta)

    def evaluacion(self, items, refs):
        if not self.raiz.exists():
            self.crear()
        i = copy.deepcopy(self.indice)
        i["documentos"][0].update(tipo="evaluaciones", archivo="fuentes/evaluaciones/libro.pdf")
        i["documentos"][0].pop("prioridad")
        destino = self.raiz / "fuentes/evaluaciones/libro.pdf"
        destino.parent.mkdir(exist_ok=True)
        destino.write_bytes(self.fuente.read_bytes())
        i["temas"][0].update(bibliografia=[], evaluaciones=[{"doc": "libro", "items": refs}])
        carpeta = self.raiz / "_procesado/libro"
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "items.yaml").write_text(yaml.safe_dump({"doc": "libro", "items": items}))
        return self.guardar_indice(i)

    def test_h18_validar_acepta_la_solucion_integrada_sin_documento_de_soluciones(self):
        enunciado = {"id": "5", "paginas": [1], "enunciado": "¿Cuántos paquetes transmite A?"}
        solucion = {"id": "5-solucion", "paginas": [1], "enunciado": "Son 16 paquetes.", "solucion_de": "5"}
        r = self.evaluacion([enunciado, solucion], ["5"])
        self.assertEqual(r["errores"], [])
        self.assertEqual(r["items_sin_asignar"], [])
        self.assertIn("es una solución", " ".join(self.evaluacion([enunciado, solucion], ["5-solucion"])["errores"]))
        for malos in [[enunciado, {**solucion, "solucion_de": "9"}], [{**enunciado, "solucion_de": "5-solucion"}, solucion],
                      [enunciado, {**solucion, "solucion_de": ["5"]}]]:
            with self.subTest(items=malos):
                self.assertIn("Solución integrada inválida", " ".join(self.evaluacion(malos, ["5"])["errores"]))

    def test_h72_validar_acepta_puntos_oficiales_y_rechaza_invalidos(self):
        item = {"id": "5", "paginas": [1], "enunciado": "¿Cuántos paquetes transmite A?", "puntos": 12}
        self.assertEqual(self.evaluacion([item], ["5"])["errores"], [])
        for puntos in [-1, True, "", "x" * 41, [12]]:
            with self.subTest(puntos=puntos):
                self.assertIn("Puntaje inválido", " ".join(self.evaluacion([{**item, "puntos": puntos}], ["5"])["errores"]))

    def test_h19_avisa_por_tema_sin_evaluaciones_y_por_documento_sin_segmentar(self):
        self.crear()
        i = copy.deepcopy(self.indice)
        for doc, tipo in [("parcial", "evaluaciones"), ("practico", "ejercicios")]:
            destino = self.raiz / f"fuentes/{tipo}/{doc}.pdf"
            destino.parent.mkdir(parents=True)
            destino.write_bytes(self.fuente.read_bytes())
            i["documentos"].append({"id": doc, "titulo": doc, "tipo": tipo, "archivo": f"fuentes/{tipo}/{doc}.pdf", "paginas": 3})
        otro = copy.deepcopy(i["temas"][0])
        otro.update(id="integracion", nombre="Integración")
        i["temas"][0]["evaluaciones"] = [{"doc": "parcial", "items": ["1"]}]
        i["temas"].append(otro)
        carpeta = self.raiz / "_procesado/parcial"
        carpeta.mkdir(parents=True)
        (carpeta / "items.yaml").write_text(yaml.safe_dump({"doc": "parcial", "items": [{"id": "1", "paginas": [1], "enunciado": "Derive."}]}))
        r = self.guardar_indice(i)
        avisos = "\n".join(r["avisos"])
        self.assertIn("Tema integracion sin preguntas de evaluaciones", avisos)
        self.assertNotIn("Tema derivacion sin preguntas", avisos)
        self.assertRegex(avisos, "Documento practico .*sin segmentar")
        self.assertNotIn("Documento parcial", avisos)
        self.assertFalse(r["listo_estudio"])


class VisionAuditoriaTest(unittest.TestCase):
    setUp, tearDown = test_vision.VisionTest.setUp, test_vision.VisionTest.tearDown
    preparar, guardar, items, q = test_vision.VisionTest.preparar, test_vision.VisionTest.guardar, test_vision.VisionTest.items, test_vision.VisionTest.q

    def test_h18_guardar_items_acepta_solucion_del_mismo_documento_sin_ciclos(self):
        self.guardar()
        enunciado = {"id": "5", "paginas": [1], "enunciado": TEXTO}
        solucion = {"id": "5-solucion", "paginas": [1], "enunciado": "Son 16 paquetes.", "solucion_de": "5"}
        self.assertEqual(self.items([enunciado, solucion])["ids"], ["5", "5-solucion"])
        self.assertEqual(yaml.safe_load((self.raiz / "practico/items.yaml").read_text())["items"][1]["solucion_de"], "5")
        for malos in [[enunciado, {**solucion, "solucion_de": "9"}], [enunciado, {**solucion, "solucion_de": "5-solucion"}],
                      [{**enunciado, "solucion_de": "5-solucion"}, solucion], [enunciado, {**solucion, "solucion_de": ["5"]}]]:
            with self.subTest(items=malos), self.assertRaisesRegex(ValueError, "solucion_de"):
                self.items(malos)

    def test_h72_guardar_items_conserva_puntos_validos(self):
        self.guardar()
        items = [{"id": "1", "paginas": [1], "enunciado": TEXTO, "puntos": 12},
                 {"id": "2", "paginas": [1], "enunciado": TEXTO, "puntos": 7.5},
                 {"id": "3", "paginas": [1], "enunciado": TEXTO, "puntos": "10 (a: 4, b: 6)"}]
        self.items(items)
        self.assertEqual([i["puntos"] for i in yaml.safe_load((self.raiz / "practico/items.yaml").read_text())["items"]], [12, 7.5, "10 (a: 4, b: 6)"])
        for puntos in [-1, True, "", "x" * 41, [12], float("inf")]:
            with self.subTest(puntos=puntos), self.assertRaisesRegex(ValueError, "puntos"):
                self.items([{**items[0], "puntos": puntos}])


if __name__ == "__main__":
    unittest.main()
