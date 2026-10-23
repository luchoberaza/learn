"""Regresiones de la auditoría pedagógica (progreso), con datos sintéticos y sin modelos."""
import errno
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ingesta'))
import test_progreso
from progreso import falla, leer, registrar

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/ingesta/progreso.py'


class PedagogiaAuditoriaTest(unittest.TestCase):
    def setUp(self):
        self.b = test_progreso.ProgresoTest()
        self.b.setUp()
        self.addCleanup(self.b.doCleanups)
        self.vault, self.raiz, self.datos, self.log = self.b.vault, self.b.raiz, self.b.datos, self.b.log

    def guardar(self, datos=None, **kw):
        return registrar(self.vault, 'ejemplo', 'derivacion', self.log, datos or self.datos, **kw)

    def tema(self):
        return yaml.safe_load((self.raiz / 'progreso.yaml').read_text())['temas']['derivacion']

    def test_h56_objetivo_y_plan_se_guardan_por_tema_como_delta(self):
        self.guardar({**self.datos, 'objetivo': 'Derivar composiciones como en el parcial', 'plan': '1. Regla de la cadena (libro PDF 3) → 2. Composición (PDF 4)'})
        self.guardar({'resumen': 'Sin objetivo ni plan: se conservan.'})
        self.assertEqual(self.tema()['objetivo'], 'Derivar composiciones como en el parcial')
        self.assertEqual(self.tema()['plan'], '1. Regla de la cadena (libro PDF 3) → 2. Composición (PDF 4)')
        self.guardar({'resumen': 'Plan ajustado.', 'plan': '1. Composición (PDF 4)'})
        self.assertEqual(self.tema()['plan'], '1. Composición (PDF 4)')
        self.assertEqual(self.tema()['objetivo'], 'Derivar composiciones como en el parcial')

    def test_h56_objetivo_y_plan_acotados(self):
        for campo, largo in [('objetivo', 301), ('plan', 1501)]:
            with self.assertRaisesRegex(ValueError, 'textos no vacíos y acotados'):
                self.guardar({'resumen': 'x', campo: 'a' * largo})

    def test_h56_una_reconstruccion_vieja_no_pisa_objetivo_ni_plan(self):
        viejo = 'sesiones/2000-01-01-derivacion.md'
        (self.raiz / viejo).write_text('log viejo')
        self.guardar({**self.datos, 'objetivo': 'Actual', 'plan': 'Plan actual'})
        huella = hashlib.sha256((self.raiz / viejo).read_bytes()).hexdigest()
        registrar(self.vault, 'ejemplo', 'derivacion', viejo, {'resumen': 'viejo', 'objetivo': 'Viejo', 'plan': 'Plan viejo'}, reconstruido=True, huella_log=huella)
        self.assertEqual((self.tema()['objetivo'], self.tema()['plan']), ('Actual', 'Plan actual'))

    def test_h56_un_plan_que_no_es_texto_invalida_el_progreso(self):
        self.guardar()
        p = yaml.safe_load((self.raiz / 'progreso.yaml').read_text())
        p['temas']['derivacion']['plan'] = ['no', 'texto']
        (self.raiz / 'progreso.yaml').write_text(yaml.safe_dump(p))
        r = leer(self.vault, 'ejemplo')
        self.assertNotIn('plan', r['progreso']['temas'].get('derivacion', {}))

    def test_permiso_denegado_es_una_linea_en_espanol(self):
        os.chmod(self.raiz, 0o555)
        self.addCleanup(os.chmod, self.raiz, 0o755)
        entrada = json.dumps({'vault': str(self.vault), 'curso': 'ejemplo', 'tema': 'derivacion', 'log': self.log, 'datos': self.datos})
        r = subprocess.run([sys.executable, str(SCRIPT), 'registrar'], input=entrada, capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stderr.strip(), 'Progreso no guardado: no hay permiso para escribir el progreso; revisá los permisos de cursos/ejemplo/.')

    def test_otro_error_de_archivo_no_muestra_el_texto_en_ingles(self):
        for codigo in [errno.EROFS, errno.EPERM]:
            self.assertIn('revisá los permisos de cursos/redes/', falla(OSError(codigo, os.strerror(codigo), '/v/cursos/redes/progreso.yaml')))
        texto = falla(OSError(errno.EIO, 'Input/output error', '/v/cursos/redes/progreso.yaml'))
        self.assertTrue(texto.startswith('Progreso no guardado: '), texto)
        self.assertNotIn('Input/output', texto)
        self.assertNotIn('Errno', texto)
        self.assertEqual(falla(OSError(errno.ENOSPC, 'No space left on device')), 'Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin.')
        self.assertEqual(falla(ValueError('Estado de progreso inválido.')), 'Progreso no guardado: Estado de progreso inválido.')


if __name__ == '__main__':
    unittest.main()
