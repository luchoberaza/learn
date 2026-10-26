"""DA51: grabaciones de clase en tramos de cinco minutos, con un WAV sintético y un transcriptor falso; sin red ni modelo.

El test con faster-whisper de verdad corre sólo si el modelo ya está descargado y LEARN_GRABACION_REAL apunta a una
grabación con voz en español.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

INGESTA = Path(__file__).resolve().parents[2] / "scripts/ingesta"
sys.path.insert(0, str(INGESTA))

import yaml
from almacen import cargar_config, sha256
from cursos import aplicar, inventario, revisar, validar
from pipeline import contenido_pagina, ejecutar, trabajadores_de_la_maquina
from test_ingesta import crear_pdf
import transcripcion
from transcripcion import cantidad_tramos, cortes, hora, parrafos
import vision

# Voz simulada para 700 s: pausas en 305,5–306,2 y 640–640,5; la de 298–299 queda antes del primer corte nominal.
VOZ = [(0.0, 298.0), (299.0, 305.5), (306.2, 640.0), (640.5, 700.0)]


def crear_wav(destino: Path, segundos: float, muestreo: int = 8000) -> None:
    """Silencio PCM de 8 bits: alcanza para la duración, la decodificación y los cortes (la voz se simula)."""
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(muestreo)
        w.writeframes(bytes([128]) * int(segundos * muestreo))


class TranscriptorFalso:
    """Dos frases por tramo, la segunda con poca confianza; `fallar` son los inicios de tramo (en segundos) que fallan."""
    dispositivo = "cpu"

    def __init__(self, fallar=()):
        self.llamadas, self.idiomas, self.fallar = [], 0, set(fallar)

    def identidad(self):
        return {"motor": "falso", "modelo": "prueba", "tramo": transcripcion.TRAMO}

    def idioma(self, audio):
        self.idiomas += 1
        return "es"

    def transcribir(self, audio, desde, idioma):
        self.llamadas.append(round(desde))
        if round(desde) in self.fallar:
            raise RuntimeError("Fallo simulado")
        return [{"inicio": desde + 1, "fin": desde + 20, "texto": f"El retardo de cola crece con la intensidad de tráfico ({idioma}).", "logprob": -0.2, "compresion": 1.3},
                {"inicio": desde + 25, "fin": desde + 50, "texto": "Repetimos el cálculo con otro enlace.", "logprob": -1.4, "compresion": 1.2}]


class PartesTest(unittest.TestCase):
    def test_tramos_de_cinco_minutos_y_horas(self):
        # Un resto de menos de un minuto se suma al último tramo.
        for segundos, tramos in [(0.5, 1), (300, 1), (359, 1), (360, 2), (659, 2), (660, 3), (2487.25, 9)]:
            self.assertEqual(cantidad_tramos(segundos), tramos, segundos)
        self.assertEqual([hora(5), hora(754), hora(3725)], ["0:05", "12:34", "1:02:05"])

    def test_cada_corte_cae_en_la_primera_pausa_desde_el_inicio_nominal(self):
        self.assertEqual(cortes(VOZ, 700, 3), [(305.85, True), (640.25, True)])
        # Si el silencio ya había empezado, el corte va en el nominal; sin pausa en el minuto siguiente, también, avisado.
        self.assertEqual(cortes([(0, 290), (310, 700)], 700, 2), [(300.0, True)])
        self.assertEqual(cortes([(0, 700)], 700, 3), [(300.0, False), (600.0, False)])
        self.assertEqual(cortes([], 700, 3), [(300.0, True), (600.0, True)])

    def test_parrafos_de_hasta_un_minuto_cortados_en_las_pausas(self):
        s = lambda a, b, t: {"inicio": a, "fin": b, "texto": t}
        # Tres sigue a una pausa de 2 s con 23 s de párrafo; Cinco seguiría sin pausa, pero el párrafo ya pasaría el minuto.
        texto = parrafos([s(0, 8, "Uno."), s(9, 21, "Dos."), s(23, 30, "Tres."), s(31, 59, "Cuatro."), s(60, 70, "Casi."), s(84, 90, "Cinco."), s(91, 95, "")])
        self.assertEqual(texto, "[0:00] Uno. Dos.\n\n[0:23] Tres. Cuatro. Casi.\n\n[1:24] Cinco.")


class IngestaGrabacionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="pi-grabacion-")
        self.vault = Path(self.tmp.name)
        (self.vault / "fuentes").mkdir()
        crear_wav(self.vault / "fuentes/clase.wav", 700)
        self.salida = self.vault / "_procesado/prueba"
        self.manifiesto = {"version": 1, "documentos": [{"id": "clase", "titulo": "Clase 3", "tipo": "bibliografia", "archivo": "fuentes/clase.wav", "paginas": "todas"}]}

    def tearDown(self):
        self.tmp.cleanup()

    def leer(self, nombre):
        return json.loads((self.salida / nombre).read_text(encoding="utf-8"))

    def ejecutar(self, transcriptor, **kwargs):
        with patch("pipeline.habla", return_value=VOZ):
            return ejecutar(self.manifiesto, self.vault, self.salida, transcriptor=transcriptor, **kwargs)

    def test_una_grabacion_se_ingiere_en_tramos_con_su_hora_y_su_cita(self):
        falso = TranscriptorFalso()
        estado = self.ejecutar(falso)
        self.assertEqual((estado["estado"], estado["procesadas"], estado["pendientes"]), ("completada", 3, 0))
        self.assertNotIn("detalle", self.leer("estado-ingesta.json"))
        self.assertEqual(falso.llamadas, [0, 306, 640])
        self.assertEqual(falso.idiomas, 1)
        meta = self.leer("clase/meta.json")
        self.assertEqual((meta["paginas"], meta["grabacion"], meta["outline"]), (3, {"tramo": 300}, []))
        q = self.leer("clase/calidad.json")["paginas"]["2"]
        self.assertEqual({k: q[k] for k in ["ruta", "pendiente", "requiere_vision", "inicio", "fin", "impresa", "idioma", "motor"]},
                         {"ruta": "transcripcion", "pendiente": False, "requiere_vision": False, "inicio": 305.85, "fin": 640.25, "impresa": "5:05",
                          "idioma": "es", "motor": "faster-whisper"})
        self.assertIn("Audio dudoso cerca de 5:30: escuchá la grabación antes de citarlo textual.", q["avisos"])
        md = (self.salida / "clase/paginas/0002.md").read_text(encoding="utf-8")
        self.assertTrue(md.startswith("<!-- tramo 2 de 3 · 5:05–10:40 · [[fuentes/clase.wav#t=300]] -->\n\n"))
        self.assertEqual(contenido_pagina(md), "[5:06] El retardo de cola crece con la intensidad de tráfico (es).\n\n[5:30] Repetimos el cálculo con otro enlace.\n")
        self.assertEqual(self.leer("clase/estructura.json")["metodo"], "tramos")
        citas = {f["pagina"]: f["cita"] for f in self.leer("busqueda.json")["fragmentos"]}
        self.assertEqual(citas, {1: "[[fuentes/clase.wav#t=0]]", 2: "[[fuentes/clase.wav#t=300]]", 3: "[[fuentes/clase.wav#t=600]]"})
        self.assertEqual(self.leer("clase/grabacion.json")["cortes"], [[305.85, True], [640.25, True]])
        informe = (self.salida / "informe-ingesta.md").read_text(encoding="utf-8")
        self.assertIn("Grabación completa: **3 tramos de 5 minutos**", informe)
        self.assertIn("| Tramo | Desde |", informe)
        # Otra corrida no transcribe nada.
        otro = TranscriptorFalso()
        self.assertEqual(self.ejecutar(otro)["cache"], 3)
        self.assertEqual(otro.llamadas, [])

    def test_una_pausa_se_reanuda_sin_retranscribir_ni_recalcular_los_cortes(self):
        primera = self.ejecutar(TranscriptorFalso(), limite_paginas=1)
        self.assertEqual((primera["estado"], primera["procesadas"]), ("interrumpida", 1))
        falso = TranscriptorFalso()
        with patch("pipeline.habla", side_effect=AssertionError("Los cortes salen de grabacion.json")):
            segunda = ejecutar(self.manifiesto, self.vault, self.salida, transcriptor=falso)
        self.assertEqual((segunda["cache"], segunda["procesadas"]), (1, 3))
        self.assertEqual((falso.llamadas, falso.idiomas), ([306, 640], 0))

    def test_un_tramo_que_falla_queda_pendiente_y_la_proxima_corrida_lo_reintenta(self):
        estado = self.ejecutar(TranscriptorFalso(fallar={306}))
        self.assertEqual(estado["pendientes"], 1)
        q = self.leer("clase/calidad.json")["paginas"]["2"]
        self.assertEqual((q["ruta"], q["error"], q["requiere_vision"]), ("pendiente", "RuntimeError", False))
        self.assertFalse((self.salida / "clase/paginas/0002.md").exists())
        falso = TranscriptorFalso()
        self.assertEqual(self.ejecutar(falso)["pendientes"], 0)
        self.assertEqual(falso.llamadas, [306])

    def test_sin_memoria_para_el_modelo_los_tramos_quedan_pendientes_sin_inventar_el_idioma(self):
        class SinMemoria(TranscriptorFalso):
            def idioma(self, audio):
                raise RuntimeError("mkl_malloc: failed to allocate memory")
        estado = self.ejecutar(SinMemoria())
        self.assertEqual((estado["estado"], estado["pendientes"]), ("completada_con_pendientes", 3))
        q = self.leer("clase/calidad.json")["paginas"]["2"]
        self.assertEqual((q["ruta"], q["inicio"], q["fin"]), ("pendiente", 300.0, 600.0))
        self.assertIn("no hubo memoria para el modelo de transcripción: cerrá otros programas y reanudá la ingesta", q["avisos"][0])
        self.assertFalse((self.salida / "clase/grabacion.json").exists(), "sin modelo no se guarda un idioma inventado")
        self.assertEqual(self.ejecutar(TranscriptorFalso())["pendientes"], 0)

    def test_una_grabacion_no_es_ejercicio_ni_pasa_por_vision(self):
        self.manifiesto["documentos"][0]["tipo"] = "ejercicios"
        with self.assertRaisesRegex(ValueError, "sólo puede ser bibliografía u otros"):
            self.ejecutar(TranscriptorFalso())
        self.manifiesto["documentos"][0]["tipo"] = "bibliografia"
        self.ejecutar(TranscriptorFalso())
        with self.assertRaisesRegex(ValueError, "es una grabación"):
            vision.cargar(self.salida, self.vault, "clase")


class CursoConGrabacionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="pi-grabacion-curso-")
        self.vault = Path(self.tmp.name)
        (self.vault / "_entrada").mkdir()
        crear_pdf(self.vault / "_entrada/libro.pdf")
        crear_wav(self.vault / "_entrada/clase-3.wav", 700)
        (self.vault / "_entrada/notas.txt").write_text("no es material", encoding="utf-8")
        self.propuesta = self.vault / "_procesado/propuesta.json"
        self.propuesta.parent.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def test_el_inventario_da_paginas_y_tramos_y_el_curso_valida_los_tramos(self):
        inv = inventario(self.vault)
        self.assertEqual([(a["archivo"], a["clase"], a["paginas"], a.get("duracion")) for a in inv["archivos"]],
                         [("_entrada/clase-3.wav", "grabacion", 3, "11:40"), ("_entrada/libro.pdf", "pdf", 3, None)])
        documentos = [{"id": "libro", "titulo": "Libro", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/libro.pdf", "paginas": 3, "prioridad": "principal"},
                      {"id": "clase-3", "titulo": "Clase 3 grabada", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/clase-3.wav", "paginas": 3, "prioridad": "complementaria"}]
        indice = {"version": 1, "documentos": documentos, "temas": [{"id": "retardos", "nombre": "Retardos", "unidad": 1, "alias": [], "prerequisitos": [], "objetivos": ["O1.1"],
                  "bibliografia": [{"doc": "libro", "seccion": "Cap. 1", "paginas": [1, 2]}, {"doc": "clase-3", "seccion": "Retardo de cola", "paginas": [2, 3]}]}]}
        contrato = "---\nnombre: Redes\nslug: redes\n---\n# Objetivos\n- O1.1: Calcular retardos.\n"
        origenes = {a["archivo"].split("/")[1].rsplit(".", 1)[0]: {"archivo": a["archivo"], "sha256": a["sha256"]} for a in inv["archivos"]}
        escribir = lambda i: self.propuesta.write_text(json.dumps({"indice_yaml": yaml.safe_dump(i, allow_unicode=True, sort_keys=False), "curso_md": contrato,
                                                                   "origenes": origenes}, ensure_ascii=False), encoding="utf-8", newline="\n")
        documentos[1]["paginas"] = 12
        escribir(indice)
        with self.assertRaisesRegex(ValueError, "cantidad de tramos de 5 minutos"):
            revisar(self.vault, "redes", self.propuesta)
        documentos[1]["paginas"] = 3
        escribir(indice)
        r, _ = revisar(self.vault, "redes", self.propuesta)
        resultado = aplicar(self.vault, "redes", self.propuesta, r["base"], r["huella"])
        self.assertTrue(resultado["validacion"]["ok"], resultado["validacion"]["errores"])
        self.assertEqual(sha256(self.vault / "cursos/redes/fuentes/bibliografia/clase-3.wav"), origenes["clase-3"]["sha256"])
        self.assertEqual(validar(self.vault / "cursos/redes", "redes")["errores"], [])


@unittest.skipUnless(os.environ.get("LEARN_GRABACION_REAL") and Path(os.environ["LEARN_GRABACION_REAL"]).is_file(),
                     "LEARN_GRABACION_REAL no apunta a una grabación con voz en español")
class TranscripcionRealTest(unittest.TestCase):
    def test_faster_whisper_transcribe_el_primer_tramo_en_espanol(self):
        # El modelo, donde lo guarda esta máquina (carpeta_modelos de curso.config.local.json, si la tiene).
        carpeta = cargar_config().get("carpeta_modelos")
        carpeta = str(Path(carpeta).expanduser()) if carpeta else None
        try:
            from faster_whisper.utils import download_model
            download_model(transcripcion.MODELO, local_files_only=True, cache_dir=carpeta)
        except Exception:
            self.skipTest(f"falta descargar el modelo {transcripcion.MODELO}")
        with tempfile.TemporaryDirectory(prefix="pi-grabacion-real-") as tmp:
            vault = Path(tmp)
            destino = vault / "fuentes" / ("real" + Path(os.environ["LEARN_GRABACION_REAL"]).suffix)
            destino.parent.mkdir()
            destino.write_bytes(Path(os.environ["LEARN_GRABACION_REAL"]).read_bytes())
            manifiesto = {"version": 1, "carpeta_modelos": carpeta,
                          "documentos": [{"id": "real", "titulo": "Real", "tipo": "bibliografia", "archivo": destino.relative_to(vault).as_posix(), "paginas": [1]}]}
            estado = ejecutar(manifiesto, vault, vault / "_procesado/real", trabajadores=trabajadores_de_la_maquina())
            q = json.loads((vault / "_procesado/real/real/calidad.json").read_text(encoding="utf-8"))["paginas"]["1"]
            texto = contenido_pagina((vault / "_procesado/real/real/paginas/0001.md").read_text(encoding="utf-8"))
            self.assertEqual((estado["estado"], q["ruta"], q["idioma"]), ("completada", "transcripcion", "es"))
            self.assertRegex(texto, r"^\[0:\d\d\] \S")


if __name__ == "__main__":
    unittest.main(verbosity=2)
