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
from cursos import validar_progreso
from progreso import contexto, falla, leer, registrar, usar

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

    def test_un_archivo_corrupto_no_llega_en_ingles(self):
        # Un .bak o un índice que no es UTF-8 daba «'utf-8' codec can't decode byte 0xff…».
        self.guardar()
        (self.raiz / 'progreso.yaml.bak').write_bytes(b'\xff\xfe basura')
        entrada = json.dumps({'vault': str(self.vault), 'curso': 'ejemplo', 'tema': 'derivacion', 'log': self.log, 'datos': {'resumen': 'otro registro'}})
        r = subprocess.run([sys.executable, str(SCRIPT), 'registrar'], input=entrada, capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertTrue(r.stderr.startswith('Progreso no guardado: '), r.stderr)
        self.assertNotRegex(r.stderr, r'codec|decode|byte|Traceback')

    def test_errores_internos_de_python_no_llegan_en_ingles(self):
        # Una fecha imposible que mande el modelo («2026-02-30») daba «day is out of range for month».
        for fecha in ['2026-02-30', '2026-13-01']:
            with self.assertRaisesRegex(ValueError, '^Fecha de evidencia inválida o futura.$'):
                self.guardar({'resumen': 'x', 'ejercicios': [{'doc': 'practico', 'item': '1', 'resultado': 'correcto', 'fecha': fecha}]})
        for e in [KeyError('doc'), TypeError("unhashable type: 'list'"), RecursionError('maximum recursion depth exceeded')]:
            texto = falla(e)
            self.assertTrue(texto.startswith('Progreso no guardado: '), texto)
            self.assertNotRegex(texto, r"'doc'|unhashable|recursion")


class ReservaTest(unittest.TestCase):
    """E3: el ítem reservado para /simulacro se fija en progreso.yaml y se marca usado al rendirlo."""
    def setUp(self):
        self.b = test_progreso.ProgresoTest()
        self.b.setUp()
        self.addCleanup(self.b.doCleanups)
        self.vault, self.raiz, self.log = self.b.vault, self.b.raiz, self.b.log
        indice = yaml.safe_load((self.raiz / 'indice.yaml').read_text())
        indice['documentos'].append({'id': 'parcial', 'tipo': 'evaluaciones'})
        (self.raiz / 'indice.yaml').write_text(yaml.safe_dump(indice))
        (self.raiz / '_procesado/parcial').mkdir()
        self.banco('1', '2')

    def banco(self, *ids):
        items = [{'id': i, 'enunciado': f'Pregunta {i}', 'puntos': 10} for i in ids] + [{'id': f'{i}-solucion', 'enunciado': 'Solución', 'solucion_de': i} for i in ids]
        (self.raiz / '_procesado/parcial/items.yaml').write_text(yaml.safe_dump({'items': items}))

    def guardar(self, datos=None, **kw):
        return registrar(self.vault, 'ejemplo', 'derivacion', self.log, datos or {'resumen': 'probe'}, **kw)

    def temas(self):
        return yaml.safe_load((self.raiz / 'progreso.yaml').read_text())['temas']

    def test_la_primera_reserva_queda_fija(self):
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1'}, 'limites': {'doc': 'parcial', 'id': '2'}})
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '2'}})
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '1'}])

    def test_un_tema_sin_estudiar_no_entra_en_progreso_y_la_curacion_puede_quitarlo(self):
        # Fijar la reserva de todos los temas los metía en progreso.yaml: quitar o renombrar uno sin estudiar chocaba en la curación.
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1'}, 'limites': {'doc': 'parcial', 'id': '2'}})
        self.assertNotIn('limites', self.temas())
        temas, documentos, items = contexto(self.raiz)
        del temas['limites']
        validar_progreso(yaml.safe_load((self.raiz / 'progreso.yaml').read_text()), temas, documentos, items)

    def test_un_intento_o_un_simulacro_lo_marcan_usado_y_despues_se_fija_otro(self):
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1'}})
        intento = {'resumen': 'simulacro', 'ejercicios': [{'doc': 'parcial', 'item': 'Pregunta 1(b)', 'resultado': 'parcial', 'puntaje': '≈ 6/10'}]}
        self.guardar(intento, reservas={'derivacion': {'doc': 'parcial', 'id': '1'}})
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '1', 'usado': True}])
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '2'}})
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '1', 'usado': True}, {'doc': 'parcial', 'id': '2'}])
        self.guardar(simulacro={'doc': 'parcial', 'id': '2'})
        self.assertTrue(self.temas()['derivacion']['reservado'][1]['usado'])

    def test_rendido_en_el_mismo_registro_en_que_se_fija_queda_usado(self):
        self.guardar(simulacro={'doc': 'parcial', 'id': '1'}, reservas={'derivacion': {'doc': 'parcial', 'id': '1'}})
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '1', 'usado': True}])

    def test_presentado_en_el_simulacro_queda_usado_sin_esperar_el_intento(self):
        # Visto es usado: si pi se corta antes de la entrega, no vuelve a reservarse ni a ocultarse.
        r = usar(self.vault, 'ejemplo', 'derivacion', 'parcial', '1')
        self.assertEqual(self.temas()['derivacion'], {'estado': 'sin_empezar', 'reservado': [{'doc': 'parcial', 'id': '1', 'usado': True}]})
        self.assertEqual(r['progreso']['historial'], [])
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '2'}})
        usar(self.vault, 'ejemplo', 'derivacion', 'parcial', '2')
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '1', 'usado': True}, {'doc': 'parcial', 'id': '2', 'usado': True}])
        # Una solución no se reserva ni se anota.
        self.assertTrue(usar(self.vault, 'ejemplo', 'limites', 'parcial', '1-solucion')['sin_cambios'])

    def test_si_el_reservado_desaparece_se_elige_otro(self):
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1'}})
        self.banco('2')
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '2'}})
        self.assertEqual(self.temas()['derivacion']['reservado'], [{'doc': 'parcial', 'id': '2'}])

    def test_nunca_reserva_una_solucion_ni_un_practico_ni_un_tema_ajeno(self):
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1-solucion'}, 'limites': {'doc': 'practico', 'id': '1'}, 'otro': {'doc': 'parcial', 'id': '1'}})
        self.assertNotIn('reservado', self.temas()['derivacion'])
        self.assertNotIn('limites', self.temas())
        self.assertNotIn('otro', self.temas())

    def test_una_reserva_fuera_del_esquema_invalida_el_progreso(self):
        self.guardar(reservas={'derivacion': {'doc': 'parcial', 'id': '1'}})
        p = yaml.safe_load((self.raiz / 'progreso.yaml').read_text())
        p['temas']['derivacion']['reservado'] = [{'doc': 'parcial', 'id': 1}]
        (self.raiz / 'progreso.yaml').write_text(yaml.safe_dump(p))
        self.assertNotIn('derivacion', leer(self.vault, 'ejemplo')['progreso']['temas'])


if __name__ == '__main__':
    unittest.main()
