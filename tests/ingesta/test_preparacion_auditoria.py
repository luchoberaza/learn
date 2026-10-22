"""Preparación por tema y pedidos de visión/curación, con PDFs sintéticos y sin red ni LLM."""
from contextlib import ExitStack
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
from almacen import Conflicto, bloquear
from cursos import bloquear_breve
from pipeline import adoptar
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


if __name__ == "__main__":
    unittest.main()
