"""Regresiones de la auditoría de progreso, con datos sintéticos y sin modelos."""
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import unittest
from unittest.mock import Mock, patch

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

    def test_h40_salida_ajena_nombra_archivos_y_no_bloquea_progreso(self):
        salida = self.vault / 'cursos/nuevo/_procesado'
        salida.mkdir(parents=True)
        (salida / 'manifiesto.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, r'mové manifiesto\.json a _procesado/ de la raíz del vault'):
            with bloquear(salida, self.vault): pass
        (salida / 'apuntes.md').write_text('x')
        with self.assertRaisesRegex(RuntimeError, r'apuntes\.md, manifiesto\.json'):
            with bloquear(salida, self.vault): pass
        (self.raiz / '_procesado/control.json').unlink()
        (self.raiz / '_procesado/manifiesto.json').write_text('{}')
        self.assertTrue(leer(self.vault, 'ejemplo')['disponible'])
        self.guardar()

    def test_h31_item_resegmentado_queda_huerfano_sin_invalidar_progreso(self):
        self.guardar()
        self.guardar({**self.datos, 'resumen': 'Segundo guardado', 'ejercicios': []})
        (self.raiz / '_procesado/practico/items.yaml').write_text('items:\n- {id: "1a", enunciado: Derivar}\n')
        antes = (self.raiz / 'progreso.yaml').read_bytes()
        r = leer(self.vault, 'ejemplo')
        self.assertTrue(r['disponible'])
        self.assertTrue(any('huérfano' in a and 'practico/1' in a for a in r['avisos']), r['avisos'])
        self.assertEqual((self.raiz / 'progreso.yaml').read_bytes(), antes)
        self.guardar({**self.datos, 'resumen': 'Tercer guardado', 'ejercicios': [], 'proximo_paso': 'Seguir'})
        t = self.tema()
        self.assertEqual(t['proximo_paso'], 'Seguir')
        self.assertEqual(t['ejercicios'][0]['item'], '1')

    def test_h13_ids_tolerantes_guardan_el_resto_y_avisan(self):
        (self.raiz / 'indice.yaml').write_text(yaml.safe_dump({'documentos': [{'id': 'practico', 'tipo': 'ejercicios'}, {'id': 'practico-2', 'tipo': 'ejercicios'}, {'id': 'libro', 'tipo': 'bibliografia'}], 'temas': [{'id': 'derivacion'}, {'id': 'limites'}]}))
        (self.raiz / '_procesado/practico/items.yaml').write_text(yaml.safe_dump({'items': [{'id': str(n), 'enunciado': 'x'} for n in range(1, 11)]}))
        ej = lambda doc, item: {'doc': doc, 'item': item, 'fecha': self.b.hoy, 'resultado': 'parcial'}
        datos = {**self.datos, 'ejercicios': [ej('practico', '2(a–c)'), ej('practico', 'Ejercicio 3'), {**ej('practico', '4g'), 'notas': 'Sin unidades'}, ej('practico', '10'), ej('practico', '99'), ej('practico-2', 'Ejercicio 5'), ej('libro', '1')]}
        r = self.guardar(datos)
        guardados = {(e['doc'], e['item']): e for e in self.tema()['ejercicios']}
        self.assertEqual(set(guardados), {('practico', '2'), ('practico', '3'), ('practico', '4'), ('practico', '10'), ('practico-2', '5')})
        self.assertIn('(a–c)', guardados[('practico', '2')]['notas'])
        self.assertIn('Sin unidades', guardados[('practico', '4')]['notas'])
        self.assertTrue(guardados[('practico-2', '5')]['sin_segmentar'])
        self.assertIn("item '99' no existe en practico; ids válidos: 1–10", ' '.join(r['avisos']))
        self.assertIn('libro', ' '.join(r['avisos']))
        self.assertEqual(self.tema()['borde']['domina'], ['derivar un polinomio'])
        self.assertFalse([a for a in leer(self.vault, 'ejemplo')['avisos'] if 'huérfano' in a])

    def test_h53_fechas_locales_y_completadas_por_el_backend(self):
        # 22:30 en Montevideo es 01:30 UTC del día siguiente.
        instante = datetime(2026, 10, 23, 1, 30, tzinfo=timezone.utc).timestamp()
        reloj = Mock(wraps=datetime)
        reloj.now = lambda tz=None: datetime.fromtimestamp(instante, tz)
        datos = {**self.datos, 'errores_de_concepto': [{'descripcion': 'confunde la interna', 'resuelto': False}], 'ejercicios': [{'doc': 'practico', 'item': '1', 'resultado': 'correcto'}]}
        try:
            with patch.dict(os.environ, {'TZ': 'America/Montevideo'}), patch('progreso.datetime', reloj):
                time.tzset()
                self.guardar(datos)
        finally:
            time.tzset()
        t = self.tema()
        self.assertEqual(str(t['actualizado']), '2026-10-22')
        self.assertEqual(str(t['errores_de_concepto'][-1]['detectado']), '2026-10-22')
        self.assertEqual(str(t['ejercicios'][-1]['fecha']), '2026-10-22')

    def test_h10_delta_con_solo_lo_nuevo_conserva_lo_previo(self):
        self.guardar()
        antes = self.tema()
        self.guardar({'resumen': 'Delta', 'borde': {'domina': ['regla de la cadena']}})
        t = self.tema()
        self.assertEqual(t['borde'], {'domina': ['derivar un polinomio', 'regla de la cadena'], 'falla': ['composición']})
        for k in ['estado', 'proximo_paso', 'conceptos_firmes', 'errores_de_concepto', 'ejercicios', 'discrepancias']:
            self.assertEqual(t[k], antes[k], k)
        self.guardar({'resumen': 'Delta 2', 'errores_de_concepto': [{'descripcion': 'confunde la función interna', 'resuelto': True}]})
        self.assertEqual(self.tema()['errores_de_concepto'], [{**antes['errores_de_concepto'][0], 'resuelto': True}])
        log = f'sesiones/{self.b.hoy}-limites.md'
        (self.raiz / log).write_text('x')
        registrar(self.vault, 'ejemplo', 'limites', log, {'resumen': 'Sólo resumen', 'errores_de_concepto': [{'descripcion': 'nuevo error'}]})
        t = yaml.safe_load((self.raiz / 'progreso.yaml').read_text())['temas']['limites']
        self.assertEqual((t['estado'], t['errores_de_concepto'][0]['resuelto']), ('en_curso', False))
        with self.assertRaises(ValueError):
            self.guardar({'borde': {'domina': ['sin resumen']}})

    def test_h10_el_estado_omitido_sigue_a_la_evidencia(self):
        self.guardar({'resumen': 'Cierre sin respuestas'})
        self.assertEqual(self.tema()['estado'], 'sin_empezar')
        self.guardar({'resumen': 'Probe', 'borde': {'domina': ['derivar un polinomio']}})
        self.assertEqual(self.tema()['estado'], 'en_curso')

    def test_h27_falla_resuelta_y_falla_nueva_sacan_lo_contradicho(self):
        self.guardar()
        r = self.guardar({'resumen': 'Supera la falla', 'falla_resuelta': ['composición', 'algo que no estaba']})
        self.assertEqual(self.tema()['borde']['falla'], [])
        self.assertIn("'algo que no estaba'", ' '.join(r['avisos']))
        self.guardar({'resumen': 'Vuelve a fallar', 'borde': {'falla': ['tasa de cambio']}})
        t = self.tema()
        self.assertNotIn('tasa de cambio', t['conceptos_firmes'])
        self.assertEqual(t['borde']['falla'], ['tasa de cambio'])
        r = self.guardar({'resumen': 'Dominado', 'estado': 'dominado'})
        self.assertIn("'dominado' con fallas", ' '.join(r['avisos']))

    def test_h29_reconstruir_una_sesion_vieja_no_pisa_lo_actual(self):
        actual = {**self.datos, 'borde': {'domina': ['d_trans = L/R'], 'falla': ['composición']}, 'proximo_paso': 'Seguir con propagación',
                  'errores_de_concepto': [{'descripcion': 'invierte L/R', 'resuelto': True}]}
        self.guardar(actual)
        viejo = 'sesiones/2026-01-01-derivacion.md'
        (self.raiz / viejo).write_text('Log de una sesión anterior sin cierre.')
        huella = hashlib.sha256((self.raiz / viejo).read_bytes()).hexdigest()
        reconstruir = lambda datos: registrar(self.vault, 'ejemplo', 'derivacion', viejo, datos, cierre=True, reconstruido=True, huella_log=huella)
        reconstruir({'resumen': 'Sesión vieja', 'estado': 'repasar', 'proximo_paso': 'Repasar desde cero', 'conceptos_firmes': ['otra cosa'],
                     'borde': {'domina': ['composición'], 'falla': ['d_trans = L/R', 'unidades']}, 'errores_de_concepto': [{'descripcion': 'invierte L/R', 'resuelto': False}]})
        t = self.tema()
        self.assertEqual((t['estado'], t['proximo_paso']), ('en_curso', 'Seguir con propagación'))
        self.assertEqual(t['borde'], {'domina': ['d_trans = L/R'], 'falla': ['composición', 'unidades']})
        self.assertIn('otra cosa', t['conceptos_firmes'])
        self.assertEqual(t['errores_de_concepto'], [{'descripcion': 'invierte L/R', 'resuelto': True, 'detectado': t['errores_de_concepto'][0]['detectado']}])
        reconstruir({'resumen': 'Sin respuestas', 'estado': 'sin_empezar'})
        self.assertEqual(self.tema()['estado'], 'en_curso')

    def test_h53_una_reconstruccion_fecha_la_evidencia_con_el_dia_del_log(self):
        manana = (datetime.now() + timedelta(days=1)).date().isoformat()
        for log, dia in [('sesiones/2026-01-01-derivacion.md', '2026-01-01'), (f'sesiones/{manana}-derivacion.md', self.b.hoy)]:
            (self.raiz / log).write_text(f'Log {log} sin cierre.')
            huella = hashlib.sha256((self.raiz / log).read_bytes()).hexdigest()
            registrar(self.vault, 'ejemplo', 'derivacion', log, {'resumen': 'Sesión anterior', 'ejercicios': [{'doc': 'practico', 'item': '1', 'resultado': 'correcto'}],
                      'errores_de_concepto': [{'descripcion': f'error de {log}'}]}, cierre=True, reconstruido=True, huella_log=huella)
            t = self.tema()
            self.assertEqual((str(t['ejercicios'][-1]['fecha']), str(t['errores_de_concepto'][-1]['detectado'])), (dia, dia))

    def test_h04_log_renombrado_no_impide_guardar(self):
        (self.raiz / self.log).rename(self.raiz / 'sesiones/Clase (renombrada).md')
        r = self.guardar(cierre=True)
        self.assertIn(self.log, ' '.join(r['avisos']))
        self.assertEqual(r['progreso']['historial'][-1]['log'], self.log)
        self.assertEqual(self.tema()['estado'], 'en_curso')
        with self.assertRaises(ValueError):
            self.guardar(reconstruido=True, huella_log='0' * 64)

    def test_x01_disco_lleno_da_una_linea_en_espanol_y_conserva_el_progreso(self):
        antes = (self.raiz / 'progreso.yaml').read_bytes()
        codigo = ("import errno, runpy, sys; from unittest.mock import patch\n"
                  "sys.path.insert(0, sys.argv[1].rsplit('/', 1)[0]); sys.argv = [sys.argv[1], 'registrar']\n"
                  "with patch('os.fsync', side_effect=OSError(errno.ENOSPC, 'No space left on device')):\n"
                  "    runpy.run_path(sys.argv[0], run_name='__main__')")
        entrada = json.dumps({'vault': str(self.vault), 'curso': 'ejemplo', 'tema': 'derivacion', 'log': self.log, 'datos': self.datos})
        r = subprocess.run([sys.executable, '-c', codigo, str(SCRIPT)], input=entrada, capture_output=True, text=True, timeout=30)
        self.assertEqual((r.returncode, r.stderr), (1, 'Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin.\n'))
        self.assertEqual((self.raiz / 'progreso.yaml').read_bytes(), antes)
        self.assertFalse(list(self.raiz.glob('.ingesta-*')))


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
