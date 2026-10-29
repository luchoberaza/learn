"""Lectura de sesiones y render local sin red ni modelos."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
import test_cursos
from almacen import Conflicto, sha256
from sesion import cargar, renderizar


class SesionTest(unittest.TestCase):
    def setUp(self):
        self.base = test_cursos.CursosTest()
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.base.crear()

    def test_carga_yaml_y_valida_sin_tocar_progreso(self):
        p = self.base.raiz / "progreso.yaml"
        antes = sha256(p)
        d = cargar(self.base.vault, "ejemplo", True)
        self.assertTrue(d["validacion"]["ok"])
        self.assertEqual(d["temas"][0]["id"], "derivacion")
        self.assertEqual(sha256(p), antes)

    def test_yaml_invalido_no_impide_cargar_material_disponible(self):
        p = self.base.raiz / "progreso.yaml"
        p.write_text("[inválido", encoding="utf-8", newline="\n")
        d = cargar(self.base.vault, "ejemplo", True)
        self.assertEqual(d["progreso"]["temas"], {})
        self.assertTrue(d["avisos"])
        self.assertEqual(p.read_text(encoding="utf-8"), "[inválido")
        (self.base.raiz / "indice.yaml").write_text("[inválido", encoding="utf-8", newline="\n")
        self.assertEqual(cargar(self.base.vault, "ejemplo")["temas"], [])

    def test_renderiza_pagina_sin_ingesta_y_reutiliza_cache(self):
        fuente = self.base.raiz / "fuentes/bibliografia/libro.pdf"
        antes = sha256(fuente)
        self.assertFalse(renderizar(self.base.vault, "ejemplo", "libro", 3)["cache"])
        p = self.base.raiz / "_procesado/libro/render/0003.png"
        self.assertEqual(p.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
        self.assertTrue(renderizar(self.base.vault, "ejemplo", "libro", 3)["cache"])
        self.assertEqual(sha256(fuente), antes)
        p.write_bytes("Edición manual".encode())
        with self.assertRaises(Conflicto):
            renderizar(self.base.vault, "ejemplo", "libro", 3)
        self.assertEqual(p.read_bytes(), "Edición manual".encode())

    def test_no_permite_escapar_del_curso_ni_pagina_inexistente(self):
        for doc, pagina in [("../otro", 1), ("libro", 0), ("libro", 4)]:
            with self.assertRaises(ValueError):
                renderizar(self.base.vault, "ejemplo", doc, pagina)
        with self.assertRaises(ValueError):
            cargar(self.base.vault, "../otro")
