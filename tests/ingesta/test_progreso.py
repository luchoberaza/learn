"""Persistencia con datos sintéticos: no escribe progreso del usuario ni usa modelos."""
import copy
from datetime import date
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ingesta'))
from almacen import Conflicto, atomico, bloquear
from progreso import registrar, leer


class ProgresoTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.vault = Path(self.tmp.name)
        self.raiz = self.vault / 'cursos/ejemplo'
        (self.raiz / 'sesiones').mkdir(parents=True)
        (self.raiz / '_procesado/practico').mkdir(parents=True)
        # El control existente es el mismo que crea la ingesta real.
        (self.raiz / '_procesado/control.json').write_text('{"generador":"pi-learning-ingesta","version":1}')
        (self.raiz / 'indice.yaml').write_text(yaml.safe_dump({'documentos': [{'id': 'practico', 'tipo': 'ejercicios'}], 'temas': [{'id': 'derivacion'}, {'id': 'limites'}]}))
        (self.raiz / '_procesado/practico/items.yaml').write_text('items:\n- {id: "1", enunciado: Derivar}\n')
        self.archivo = self.raiz / 'progreso.yaml'
        self.vacio = b'version: 1\r\ntemas: {}\r\nhistorial: []\r\n'
        self.archivo.write_bytes(self.vacio)
        self.hoy = date.today().isoformat()
        self.log = f'sesiones/{self.hoy}-derivacion.md'
        (self.raiz / self.log).write_text('Intento sintético explícito, no respuesta del usuario.\n')
        self.datos = {'estado': 'en_curso', 'borde': {'domina': ['derivar un polinomio'], 'falla': ['composición']}, 'conceptos_firmes': ['tasa de cambio'], 'errores_de_concepto': [{'descripcion': 'confunde la función interna', 'detectado': self.hoy, 'resuelto': False}], 'ejercicios': [{'doc': 'practico', 'item': '1', 'fecha': self.hoy, 'resultado': 'parcial', 'notas': 'Falta justificar'}], 'discrepancias': [], 'proximo_paso': 'Identificar la interna', 'resumen': 'Borde observado en un intento sintético.'}
        self.addCleanup(self.tmp.cleanup)

    def guardar(self, **kw):
        return registrar(self.vault, 'ejemplo', 'derivacion', self.log, self.datos, **kw)

    def test_respaldo_byte_exacto_e_idempotencia(self):
        self.guardar()
        self.assertEqual((self.raiz / 'progreso.yaml.bak').read_bytes(), self.vacio)
        antes = self.archivo.read_bytes()
        r = self.guardar()
        self.assertTrue(r['sin_cambios'])
        self.assertEqual(self.archivo.read_bytes(), antes)
        self.assertEqual((self.raiz / 'progreso.yaml.bak').read_bytes(), self.vacio)
        self.assertEqual(len(r['progreso']['historial']), 1)

    def test_fusion_resuelve_borde_y_preserva_otro_tema(self):
        self.guardar()
        p = yaml.safe_load(self.archivo.read_text())
        p['temas']['limites'] = {'estado': 'dominado', 'conceptos_firmes': ['otro tema']}
        self.archivo.write_text(yaml.safe_dump(p))
        self.datos['borde'] = {'domina': ['composición'], 'falla': []}
        self.datos['errores_de_concepto'][0]['resuelto'] = True
        self.datos['ejercicios'].append({**self.datos['ejercicios'][0], 'resultado': 'correcto'})
        r = self.guardar(cierre=True)['progreso']
        t = r['temas']['derivacion']
        self.assertEqual(t['borde']['falla'], [])
        self.assertEqual(len(t['conceptos_firmes']), 1)
        self.assertTrue(t['errores_de_concepto'][0]['resuelto'])
        self.assertEqual(len(t['ejercicios']), 2)
        self.assertEqual(r['temas']['limites'], p['temas']['limites'])
        self.assertTrue(r['historial'][0]['cierre'])
        self.assertEqual(len(r['historial']), 1)

    def test_un_cierre_sin_respuestas_no_borra_estado_observado(self):
        self.guardar()
        antes = self.archivo.read_bytes()
        self.datos['estado'] = 'sin_empezar'
        with self.assertRaisesRegex(ValueError, 'Ya hay evidencia'):
            self.guardar(cierre=True)
        self.assertEqual(self.archivo.read_bytes(), antes)

    def test_recupera_backup_y_preserva_invalido_incluso_bytes_no_utf8(self):
        self.guardar()
        self.archivo.write_bytes(b'\xff archivo da\xf1ado')
        r = leer(self.vault, 'ejemplo')
        self.assertTrue(r['disponible'])
        self.assertEqual(self.archivo.read_bytes(), self.vacio)
        preservado = list((self.raiz / '_procesado').glob('progreso-invalido-*.yaml'))
        self.assertEqual(preservado[0].read_bytes(), b'\xff archivo da\xf1ado')
        self.assertIn('restaurado', r['avisos'][0])

    def test_invalido_sin_backup_sigue_sin_escribir(self):
        self.archivo.write_text('version: incorrecta')
        r = leer(self.vault, 'ejemplo')
        self.assertFalse(r['disponible'])
        with self.assertRaises(ValueError):
            self.guardar()
        self.assertEqual(self.archivo.read_text(), 'version: incorrecta')
        self.assertFalse((self.raiz / 'progreso.yaml.bak').exists())

    def test_backup_invalido_no_se_sobrescribe_aunque_el_progreso_sea_valido(self):
        bak = self.raiz / 'progreso.yaml.bak'
        bak.write_bytes(b'RESPALDO A REVISAR')
        with self.assertRaises(ValueError):
            self.guardar()
        self.assertEqual(self.archivo.read_bytes(), self.vacio)
        self.assertEqual(bak.read_bytes(), b'RESPALDO A REVISAR')

    def test_rechaza_esquema_fechas_items_rutas_y_estados(self):
        for campo, valor in [('estado', 'aprobado'), ('ejercicios', [{'doc': 'practico', 'item': 'inventado', 'fecha': self.hoy, 'resultado': 'correcto'}]), ('errores_de_concepto', [{'descripcion': 'x', 'detectado': '2999-01-01', 'resuelto': False}]), ('borde', {'domina': ['x'], 'falla': ['x']})]:
            datos = {**self.datos, campo: valor}
            with self.assertRaises((ValueError, TypeError)):
                registrar(self.vault, 'ejemplo', 'derivacion', self.log, datos)
            self.assertEqual(self.archivo.read_bytes(), self.vacio)
        for log in ['../ajeno.md', 'sesiones/adjuntos/foto.md', f'sesiones/{self.hoy}-limites.md']:
            with self.assertRaises(ValueError):
                registrar(self.vault, 'ejemplo', 'derivacion', log, self.datos)

    def test_symlinks_no_se_siguen(self):
        ajeno = self.vault / 'ajeno'; ajeno.write_text('NO TOCAR')
        for nombre in ['progreso.yaml', 'progreso.yaml.bak']:
            f = self.raiz / nombre
            if f.exists(): f.unlink()
            f.symlink_to(ajeno)
            with self.assertRaises((Conflicto, ValueError)):
                self.guardar()
            self.assertEqual(ajeno.read_text(), 'NO TOCAR')
            f.unlink()
            self.archivo.write_bytes(self.vacio)

    def test_corte_antes_de_publicar_conserva_version_previa_y_backup(self):
        def cortar(raiz, nombre, contenido):
            if nombre == 'progreso.yaml': raise OSError('Corte simulado')
            atomico(raiz, nombre, contenido)
        with patch('progreso.atomico', side_effect=cortar):
            with self.assertRaises(OSError): self.guardar()
        self.assertEqual(self.archivo.read_bytes(), self.vacio)
        self.assertEqual((self.raiz / 'progreso.yaml.bak').read_bytes(), self.vacio)

    def test_no_pisa_edicion_concurrente_y_respeta_bloqueo(self):
        def editar(raiz, nombre, contenido):
            atomico(raiz, nombre, contenido)
            if nombre == 'progreso.yaml.bak': self.archivo.write_text('EDICION CONCURRENTE')
        with patch('progreso.atomico', side_effect=editar):
            with self.assertRaises(Conflicto): self.guardar()
        self.assertEqual(self.archivo.read_text(), 'EDICION CONCURRENTE')
        with bloquear(self.raiz / '_procesado', self.vault):
            with self.assertRaises(Conflicto): self.guardar()

    def test_reconstruccion_exige_huella_y_no_modifica_log(self):
        raw = (self.raiz / self.log).read_bytes()
        with self.assertRaises(Conflicto): self.guardar(reconstruido=True, huella_log='0'*64)
        r = self.guardar(reconstruido=True, cierre=True, huella_log=hashlib.sha256(raw).hexdigest())
        self.assertTrue(r['progreso']['historial'][0]['reconstruido'])
        self.assertEqual((self.raiz / self.log).read_bytes(), raw)


if __name__ == '__main__': unittest.main()
