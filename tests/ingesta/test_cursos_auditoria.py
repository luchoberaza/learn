"""Regresiones de la auditoría en curación y visión, con PDFs sintéticos y sin red ni LLM."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
import test_cursos
from cursos import revisar


class CursosAuditoriaTest(unittest.TestCase):
    setUp, tearDown = test_cursos.CursosTest.setUp, test_cursos.CursosTest.tearDown
    escribir, crear, guardar_indice = test_cursos.CursosTest.escribir, test_cursos.CursosTest.crear, test_cursos.CursosTest.guardar_indice

    def test_h40_propuesta_dentro_del_curso_pide_la_raiz_del_vault(self):
        dentro = self.raiz / "_procesado/propuesta.json"
        dentro.parent.mkdir(parents=True)
        dentro.write_text(self.propuesta.read_text())
        with self.assertRaisesRegex(ValueError, "raíz del vault"):
            revisar(self.vault, "ejemplo", dentro)


if __name__ == "__main__":
    unittest.main()
