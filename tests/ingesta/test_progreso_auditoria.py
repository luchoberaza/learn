"""Regresiones de la auditoría de progreso, con datos sintéticos y sin modelos."""
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import unittest
from unittest.mock import patch

import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ingesta'))
import test_cursos
import test_progreso
from almacen import bloquear, esperar
from progreso import leer, registrar
from sesion import cargar, renderizar

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/ingesta/progreso.py'


class ProgresoAuditoriaTest(unittest.TestCase):
    def setUp(self):
        self.b = test_progreso.ProgresoTest()
        self.b.setUp()
        self.addCleanup(self.b.doCleanups)
        self.vault, self.raiz, self.datos, self.log = self.b.vault, self.b.raiz, self.b.datos, self.b.log

    def guardar(self, datos=None, **kw):
        return registrar(self.vault, 'ejemplo', 'derivacion', self.log, datos or self.datos, **kw)

    def tema(self):
        return yaml.safe_load((self.raiz / 'progreso.yaml').read_text())['temas']['derivacion']

    def test_h06_leer_y_registrar_no_usan_el_bloqueo_de_la_ingesta(self):
        with bloquear(self.raiz / '_procesado', self.vault):
            self.assertTrue(leer(self.vault, 'ejemplo')['disponible'])
            self.guardar()
        self.assertEqual(self.tema()['estado'], 'en_curso')

    def test_h06_registrar_espera_el_bloqueo_de_progreso(self):
        listo = threading.Event()
        def retener():
            fd = os.open(self.raiz / '.progreso.lock', os.O_CREAT | os.O_RDWR, 0o600)
            fcntl.flock(fd, fcntl.LOCK_EX)
            listo.set()
            time.sleep(1)
            os.close(fd)
        hilo = threading.Thread(target=retener)
        hilo.start()
        listo.wait()
        inicio = time.monotonic()
        self.guardar()
        espera = time.monotonic() - inicio
        hilo.join()
        self.assertGreaterEqual(espera, 0.8)
        self.assertEqual(self.tema()['estado'], 'en_curso')
        with patch('almacen.ESPERA', 0.2), esperar(self.raiz / '.progreso.lock'):
            with self.assertRaisesRegex(RuntimeError, 'Otro proceso está guardando; reintentá'):
                self.guardar()

    def test_h06_dos_registros_simultaneos_guardan_ambas_evidencias(self):
        procesos = []
        for concepto in ['primera evidencia', 'segunda evidencia']:
            datos = {**self.datos, 'borde': {'domina': [concepto], 'falla': []}}
            entrada = json.dumps({'vault': str(self.vault), 'curso': 'ejemplo', 'tema': 'derivacion', 'log': self.log, 'datos': datos})
            p = subprocess.Popen([sys.executable, str(SCRIPT), 'registrar'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            procesos.append((p, entrada))
        for p, entrada in procesos:
            p.stdin.write(entrada)
            p.stdin.close()
        for p, _ in procesos:
            self.assertEqual(p.wait(30), 0, p.stderr.read())
        self.assertEqual(set(self.tema()['borde']['domina']), {'primera evidencia', 'segunda evidencia'})


class SesionAuditoriaTest(unittest.TestCase):
    def setUp(self):
        self.base = test_cursos.CursosTest()
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.base.crear()

    def test_h06_cargar_y_render_cacheado_no_esperan_a_la_ingesta(self):
        vault = self.base.vault
        self.assertFalse(renderizar(vault, 'ejemplo', 'libro', 1)['cache'])
        with bloquear(self.base.raiz / '_procesado', vault):
            d = cargar(vault, 'ejemplo')
            self.assertFalse([a for a in d['avisos'] if a.startswith('Progreso')])
            self.assertTrue(renderizar(vault, 'ejemplo', 'libro', 1)['cache'])
            self.assertFalse(renderizar(vault, 'ejemplo', 'libro', 2)['cache'])


if __name__ == '__main__': unittest.main()
