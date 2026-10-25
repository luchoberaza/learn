"""Portabilidad de la ingesta entre Linux y Windows (DA39), con datos sintéticos y sin modelos."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ingesta'))
from almacen import (WINDOWS, Conflicto, PYTHON_TEXTO, abrir_bloqueo, atomico, bloquear, bloqueo_libre, cargar_config,
                     opciones_desacoplado, proceso_vivo, tomar_bloqueo)

# Un hijo que retiene el bloqueo de la salida hasta que el padre le cierra la entrada.
RETENER = """
import sys
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from almacen import bloquear
with bloquear(Path(sys.argv[2]), Path(sys.argv[3])):
    print("tomado", flush=True)
    sys.stdin.read()
"""


class PortabilidadTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.vault = Path(self.tmp.name)

    def test_proceso_vivo_consulta_sin_terminar_el_proceso(self):
        # En Windows os.kill(pid, 0) termina el proceso: proceso_vivo no puede usarlo.
        hijo = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        self.addCleanup(hijo.kill)
        for _ in range(3):
            self.assertTrue(proceso_vivo(hijo.pid))
        time.sleep(0.3)
        self.assertIsNone(hijo.poll(), "consultar no terminó al proceso")
        hijo.kill()
        hijo.wait()
        self.assertFalse(proceso_vivo(hijo.pid))

    def test_pid_invalido_o_muerto_es_falso(self):
        for pid in (0, -1, True, "123", None, 3.5):
            self.assertFalse(proceso_vivo(pid))

    def test_bloqueo_exclusivo_entre_procesos(self):
        salida = self.vault / "_procesado" / "prueba"
        hijo = subprocess.Popen([sys.executable, "-c", RETENER, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"), str(salida), str(self.vault)],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8")
        self.addCleanup(hijo.stdout.close)
        self.addCleanup(hijo.kill)
        self.assertEqual(hijo.stdout.readline().strip(), "tomado")
        with self.assertRaisesRegex(Conflicto, "Ya hay una ingesta escribiendo"):
            with bloquear(salida, self.vault):
                pass
        self.assertFalse(bloqueo_libre(salida / ".ingesta.lock"))
        hijo.stdin.close()
        hijo.wait(timeout=10)
        # Al terminar el otro proceso el bloqueo queda libre (en Windows lo suelta el cierre del descriptor).
        self.assertTrue(bloqueo_libre(salida / ".ingesta.lock"))
        with bloquear(salida, self.vault) as s:
            self.assertEqual(json.loads((s / "control.json").read_text(encoding="utf-8"))["generador"], "pi-learning-ingesta")

    def test_un_mismo_proceso_no_toma_dos_veces_el_bloqueo(self):
        archivo = self.vault / "x.lock"
        a, b = abrir_bloqueo(archivo), abrir_bloqueo(archivo)
        try:
            tomar_bloqueo(a)
            with self.assertRaises(BlockingIOError):
                tomar_bloqueo(b)
        finally:
            os.close(a)
            os.close(b)

    def test_enlace_simbolico_rechazado(self):
        destino = self.vault / "real.lock"
        destino.write_text("", encoding="utf-8")
        enlace = self.vault / "enlace.lock"
        try:
            enlace.symlink_to(destino)
        except (OSError, NotImplementedError):
            self.skipTest("este sistema no deja crear enlaces simbólicos (Windows sin modo desarrollador)")
        with self.assertRaises((Conflicto, OSError)):
            os.close(abrir_bloqueo(enlace))

    def test_atomico_escribe_saltos_de_linea_lf(self):
        atomico(self.vault, "a/nota.md", "uno\ndos\n")
        self.assertEqual((self.vault / "a/nota.md").read_bytes(), b"uno\ndos\n")
        atomico(self.vault, "a/nota.md", "tres\n")
        self.assertEqual((self.vault / "a/nota.md").read_bytes(), b"tres\n")

    def test_python_del_venv_y_arranque_desacoplado_segun_la_plataforma(self):
        if WINDOWS:
            self.assertEqual(PYTHON_TEXTO, ".pi/.venv/Scripts/python.exe")
            self.assertEqual(opciones_desacoplado(), {"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP})
        else:
            self.assertEqual(PYTHON_TEXTO, ".pi/.venv/bin/python")
            self.assertEqual(opciones_desacoplado(), {"start_new_session": True})

    def test_la_configuracion_local_pisa_solo_sus_claves(self):
        recursos = self.vault / ".pi"
        recursos.mkdir()
        (recursos / "curso.config.json").write_text(json.dumps({"vault": "~/Projects/pi-learning", "ruta_tesseract": "/usr/bin/tesseract", "modelo_vision": "a/b", "umbral_calidad_pagina": 0.6}), encoding="utf-8")
        (recursos / "curso.config.local.json").write_text(json.dumps({"ruta_tesseract": "C:/ocr/tesseract.exe", "umbral_calidad_pagina": 0.1}), encoding="utf-8")
        config = cargar_config(recursos)
        self.assertEqual(config["ruta_tesseract"], "C:/ocr/tesseract.exe")
        self.assertEqual(config["modelo_vision"], "a/b")
        self.assertEqual(config["umbral_calidad_pagina"], 0.6, "una clave que no es de la máquina no se pisa")


if __name__ == "__main__":
    unittest.main()
