"""Preparación por tema y pedidos de visión/curación, con PDFs sintéticos y sin red ni LLM."""
from contextlib import ExitStack
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import unittest
from unittest.mock import patch

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
from almacen import Conflicto, bloquear
from cursos import bloquear_breve, publicar_informe
from pipeline import adoptar, ejecutar
import preparacion
import test_cursos
import test_vision
import vision


class VisionPedidosTest(unittest.TestCase):
    setUp, tearDown = test_vision.VisionTest.setUp, test_vision.VisionTest.tearDown
    preparar, guardar, items, q = test_vision.VisionTest.preparar, test_vision.VisionTest.guardar, test_vision.VisionTest.items, test_vision.VisionTest.q

    def adoptar(self, n, texto):
        (self.raiz / f"practico/paginas/{n:04}.md").write_text(texto)
        with bloquear(self.raiz, self.vault):
            adoptar(self.raiz, "practico", n)

    def test_pagina_adoptada_es_cache_no_se_pisa_y_sirve_para_items(self):
        en_vuelo = self.preparar()
        self.adoptar(1, "Ejercicio 1. Transcripción corregida a mano.\n")
        preparada = self.preparar()
        self.assertTrue(preparada["cache"])
        self.assertNotIn("imagen", preparada)
        for fallo in [False, True]:
            with self.assertRaisesRegex(Conflicto, "adoptada a mano"):
                with bloquear(self.raiz, self.vault):
                    vision.guardar(self.raiz, self.vault, {**en_vuelo, "texto": test_vision.TEXTO, "completa": True}, fallo=fallo)
        self.assertEqual(self.q()["ruta"], "manual")
        self.assertIn("corregida a mano", (self.raiz / "practico/paginas/0001.md").read_text())
        self.assertEqual(self.items([{"id": "1", "paginas": [1], "enunciado": "Ejercicio 1."}])["ids"], ["1"])

    def test_texto_de_vision_limpio_no_queda_pendiente_por_un_falso_positivo_de_matematica(self):
        calidades = json.loads((self.raiz / "practico/calidad.json").read_text())
        calidades["paginas"]["1"]["clasificacion"]["posible_matematica"] = True
        (self.raiz / "practico/calidad.json").write_text(json.dumps(calidades))
        (self.raiz / "practico/cache/0001.json").unlink(missing_ok=True)
        limpio = "Ejercicio 1. Un host envía paquetes por un enlace y el router los reenvía. " * 3
        salida = self.guardar(texto=limpio)
        self.assertEqual((salida["ruta"], salida["pendiente"]), ("vision", False))
        self.assertEqual(self.guardar(texto=limpio + " $x = ")["ruta"], "pendiente")

    def test_vision_espera_una_escritura_breve_en_vez_de_fallar(self):
        retenido = ExitStack()
        retenido.enter_context(bloquear(self.raiz, self.vault))
        threading.Timer(1, retenido.close).start()
        r = subprocess.run([sys.executable, str(Path(vision.__file__)), "preparar"], capture_output=True, text=True, timeout=30,
                           input=json.dumps({**self.datos, "vault": str(self.vault), "salida": str(self.raiz)}))
        self.assertEqual(r.returncode, 0, r.stderr)
        with patch("cursos.ESPERA", 0.3), bloquear(self.raiz, self.vault):
            with self.assertRaisesRegex(Conflicto, "Ya hay una ingesta"):
                with bloquear_breve(self.raiz, self.vault):
                    pass


class CursoPreparacion(unittest.TestCase):
    """Curso con libro, parcial y práctico ingeridos sin modelo, como lo deja `manifiesto --todo` + `iniciar`."""
    setUp_base, tearDown = test_cursos.CursosTest.setUp, test_cursos.CursosTest.tearDown
    crear, guardar_indice = test_cursos.CursosTest.crear, test_cursos.CursosTest.guardar_indice
    escribir = test_cursos.CursosTest.escribir

    def setUp(self):
        self.setUp_base()
        self.crear()
        self.indice = copy.deepcopy(self.indice)
        for doc, tipo in [("parcial", "evaluaciones"), ("practico", "ejercicios")]:
            destino = self.raiz / f"fuentes/{tipo}/{doc}.pdf"
            destino.parent.mkdir(parents=True)
            destino.write_bytes(self.fuente.read_bytes())
            self.indice["documentos"].append({"id": doc, "titulo": doc.capitalize(), "tipo": tipo, "archivo": f"fuentes/{tipo}/{doc}.pdf", "paginas": 3})
        otro = copy.deepcopy(self.indice["temas"][0])
        otro.update(id="integracion", nombre="Integración", alias=[], bibliografia=[{"doc": "libro", "seccion": "Aplicaciones", "paginas": [3, 3]}])
        self.indice["temas"].append(otro)
        self.guardar_indice(self.indice)
        ejecutar({"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
                  "documentos": [{"id": d["id"], "titulo": d["titulo"], "tipo": d["tipo"], "archivo": f"cursos/ejemplo/{d['archivo']}", "paginas": [1, 2, 3]}
                                 for d in self.indice["documentos"]]}, self.vault, self.raiz / "_procesado")

    def segmentar(self, doc, items, paginas=(1, 2, 3)):
        salida = self.raiz / "_procesado"
        for n in paginas:
            with bloquear(salida, self.vault):
                datos = {"doc": doc, "pagina": n, "modelo": "openai/gpt-6-luna", "umbral": 0.6}
                vision.guardar(salida, self.vault, {**datos, **vision.preparar(salida, self.vault, datos), "texto": test_vision.TEXTO, "completa": True})
        with bloquear(salida, self.vault):
            return vision.guardar_items(salida, self.vault, {"doc": doc, "items": items})


class ValidarPedidosTest(CursoPreparacion):
    def test_avisos_dicen_que_la_preparacion_es_automatica_y_cuentan_las_asignaciones(self):
        avisos = "\n".join(self.guardar_indice(self.indice)["avisos"])
        self.assertIn("Documento parcial (evaluaciones) sin segmentar: se transcribe y segmenta solo la primera vez que se estudia un tema del curso.", avisos)
        self.assertIn("Tema integracion sin preguntas de evaluaciones: se asignan solas la primera vez que se estudia el tema.", avisos)
        self.assertNotIn("/curso-agregar", avisos)
        self.segmentar("parcial", [{"id": "1", "paginas": [1], "enunciado": "Derive.", "puntos": 8},
                                   {"id": "1-solucion", "paginas": [2], "enunciado": "Respuesta.", "solucion_de": "1"}])
        asignaciones = self.raiz / "_procesado/asignaciones.json"
        asignaciones.write_text(json.dumps({"version": 1, "items": [{"doc": "parcial", "id": "1", "tema": "integracion"}, {"doc": "parcial", "id": "1-solucion", "tema": "derivacion"}]}))
        r = self.guardar_indice(self.indice)
        self.assertNotIn("Tema integracion sin preguntas", "\n".join(r["avisos"]))
        self.assertIn("Tema derivacion sin preguntas", "\n".join(r["avisos"]))
        self.assertNotIn({"doc": "parcial", "id": "1"}, r["items_sin_asignar"])
        asignaciones.write_text("{roto")
        self.assertIn("asignaciones.json ilegible", "\n".join(self.guardar_indice(self.indice)["avisos"]))

    def test_un_documento_de_soluciones_no_promete_prepararse_solo(self):
        destino = self.raiz / "fuentes/soluciones/soluciones.pdf"
        destino.parent.mkdir(parents=True)
        destino.write_bytes(self.fuente.read_bytes())
        self.indice["documentos"].append({"id": "soluciones", "titulo": "Soluciones", "tipo": "soluciones", "archivo": "fuentes/soluciones/soluciones.pdf", "paginas": 3})
        self.assertIn("Documento soluciones (soluciones) sin segmentar: transcribilo y segmentalo con /curso-agregar.", self.guardar_indice(self.indice)["avisos"])

    def test_edicion_cita_adoptar_e_informe_cuenta_la_ruta_manual(self):
        pagina = self.raiz / "_procesado/libro/paginas/0003.md"
        pagina.write_text(pagina.read_text() + "\nCorrección a mano.\n")
        errores = " ".join(self.guardar_indice(self.indice)["errores"])
        self.assertIn("ingestar.py adoptar --salida cursos/ejemplo/_procesado --doc libro --pagina 3", errores)
        with bloquear(self.raiz / "_procesado", self.vault):
            adoptar(self.raiz / "_procesado", "libro", 3)
        publicar_informe(self.vault, "ejemplo")
        self.assertIn("manual: 1 (33.3 %)", (self.raiz / "informe-ingesta.md").read_text())


class TrabajoTest(CursoPreparacion):
    def trabajo(self, tema="derivacion", maximo=150):
        return preparacion.trabajo(self.vault, "ejemplo", tema, maximo)

    def test_prioriza_el_tema_luego_parciales_y_practicos_con_tope(self):
        t = self.trabajo()
        self.assertEqual([(x["doc"], x["paginas"]) for x in t["paginas"]], [("libro", [1, 2]), ("parcial", [1, 2, 3]), ("practico", [1, 2, 3])])
        self.assertEqual([(s["doc"], s["listo"]) for s in t["segmentar"]], [("parcial", False), ("practico", False)])
        t = self.trabajo(maximo=4)
        self.assertEqual([(x["doc"], x["paginas"]) for x in t["paginas"]], [("libro", [1, 2]), ("parcial", [1, 2])])
        self.assertEqual(t["restantes"], 4)
        self.assertEqual(self.trabajo("integracion")["paginas"][0]["doc"], "parcial")  # la página 3 del libro ya es digital buena

    def test_un_documento_sin_ingesta_base_no_se_segmenta_y_deja_el_tema_incompleto(self):
        shutil.rmtree(self.raiz / "_procesado/parcial")
        t = self.trabajo()
        self.assertEqual([x["doc"] for x in t["paginas"]], ["libro", "practico"])
        self.assertEqual([(s["doc"], s["listo"]) for s in t["segmentar"]], [("parcial", False), ("practico", False)])
        self.assertEqual(t["restantes"], 3)

    def test_parcial_sin_soluciones_se_segmenta_otra_vez_y_se_clasifica_lo_que_el_indice_no_asigna(self):
        self.segmentar("parcial", [{"id": "1", "paginas": [1], "enunciado": "Derive."}])
        practico = [{"id": "1", "paginas": [1], "enunciado": "Integre."}, {"id": "2", "paginas": [2], "enunciado": "Grafique."}]
        self.segmentar("practico", practico)
        self.indice["temas"][0]["evaluaciones"] = [{"doc": "parcial", "items": ["1"]}]
        self.indice["temas"][0]["ejercicios"] = [{"doc": "practico", "items": ["1"]}]
        self.guardar_indice(self.indice)
        t = self.trabajo()
        self.assertEqual(t["paginas"], [{"doc": "libro", "paginas": [1, 2]}])
        self.assertEqual([(s["doc"], s["listo"], s["requeridos"]) for s in t["segmentar"]], [("parcial", True, ["1"])])
        self.assertEqual([(c["doc"], c["id"]) for c in t["clasificar"]], [("practico", "2")])
        preparacion.registrar(self.vault, "ejemplo", {"documento": {"id": "parcial", "segmentado": True, "items": 1}})
        preparacion.asignar(self.vault, "ejemplo", [{"doc": "practico", "id": "2", "tema": None}])
        t = self.trabajo()
        self.assertEqual((t["segmentar"], t["clasificar"]), ([], []))
        self.segmentar("practico", [practico[0], {**practico[1], "enunciado": "Grafique la derivada."}])
        self.assertEqual([(c["doc"], c["id"]) for c in self.trabajo()["clasificar"]], [("practico", "2")])

    def test_un_parcial_editado_a_mano_no_se_vuelve_a_segmentar(self):
        self.segmentar("parcial", [{"id": "1", "paginas": [1], "enunciado": "Derive."}])
        items = self.raiz / "_procesado/parcial/items.yaml"
        items.write_text(items.read_text() + "# Revisado por la cátedra.\n")
        t = self.trabajo()
        self.assertEqual([s["doc"] for s in t["segmentar"]], ["practico"])
        self.assertEqual([(c["doc"], c["id"]) for c in t["clasificar"]], [("parcial", "1")])

    def test_asignar_valida_y_nunca_toca_el_indice(self):
        self.segmentar("parcial", [{"id": "1", "paginas": [1], "enunciado": "Derive."}, {"id": "1-solucion", "paginas": [2], "enunciado": "R.", "solucion_de": "1"}])
        antes = (self.raiz / "indice.yaml").read_bytes()
        for mala in [{"doc": "parcial", "id": "1-solucion", "tema": "derivacion"}, {"doc": "parcial", "id": "1", "tema": "inexistente"},
                     {"doc": "libro", "id": "1", "tema": None}, {"doc": "parcial", "id": "9", "tema": None}]:
            with self.subTest(mala=mala), self.assertRaises(ValueError):
                preparacion.asignar(self.vault, "ejemplo", [mala])
        archivo = self.raiz / "_procesado/asignaciones.json"
        archivo.write_text("{roto")
        preparacion.asignar(self.vault, "ejemplo", [{"doc": "parcial", "id": "1", "tema": "integracion"}])
        datos = json.loads(archivo.read_text())
        self.assertEqual((datos["version"], datos["automatico"]), (1, True))
        self.assertEqual([(a["doc"], a["id"], a["tema"], len(a["huella"])) for a in datos["items"]], [("parcial", "1", "integracion", 64)])
        self.assertEqual((self.raiz / "indice.yaml").read_bytes(), antes)
        preparacion.registrar(self.vault, "ejemplo", {"tema": {"id": "derivacion", "estado": "incompleta", "pendientes": 2}})
        estado = preparacion.registrar(self.vault, "ejemplo", {"documento": {"id": "parcial", "segmentado": True}})
        self.assertEqual((estado["temas"]["derivacion"]["estado"], estado["documentos"]["parcial"]["segmentado"]), ("incompleta", True))


if __name__ == "__main__":
    unittest.main()
