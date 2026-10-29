"""Grabaciones de clase (DA51): duración, tramos de cinco minutos cortados en silencios y transcripción local con faster-whisper.

Cada tramo es la «página» de una grabación: el índice, leer_paginas, la búsqueda y las citas lo usan igual que una página
de PDF. El tramo k empieza en el primer silencio a partir del minuto 5·(k−1), así que su cita (#t= del inicio nominal)
nunca cae después de lo que dice. Ningún motor escribe la grabación original.
"""
from __future__ import annotations

from importlib.metadata import version
from math import ceil
from pathlib import Path

EXTENSIONES = {".mp4", ".mkv", ".webm", ".mov", ".m4v", ".mp3", ".m4a", ".wav", ".ogg", ".opus", ".flac", ".aac"}
TRAMO = 300  # segundos de una «página»
MARGEN = 60  # el corte va al primer silencio dentro del minuto que sigue al inicio nominal
MUESTREO = 16000
VERSION_ALGORITMO = 1
MODELO = "large-v3-turbo"
# Un segmento con estas señales de Whisper suele ser una mala escucha o una repetición inventada (los umbrales de faster-whisper).
LOGPROB_DUDOSO = -1.0
COMPRESION_DUDOSA = 2.4


def es_grabacion(archivo: str | Path) -> bool:
    return Path(archivo).suffix.lower() in EXTENSIONES


def duracion(archivo: Path) -> float:
    """Segundos de audio según el contenedor, sin decodificar; la cantidad de tramos sale de acá (validar e ingesta)."""
    import av
    try:
        with av.open(str(archivo)) as contenedor:
            audio = [s for s in contenedor.streams if s.type == "audio"]
            if not audio:
                raise ValueError("La grabación no tiene pista de audio.")
            if audio[0].duration and audio[0].time_base:
                return float(audio[0].duration * audio[0].time_base)
            if contenedor.duration:
                return contenedor.duration / av.time_base
    except av.FFmpegError as error:
        raise ValueError(f"No se pudo leer la grabación: {error}") from None
    raise ValueError("La grabación no informa su duración.")


def cantidad_tramos(segundos: float) -> int:
    """Uno cada cinco minutos; un resto de menos de un minuto se suma al último en vez de quedar solo."""
    n = max(1, ceil(segundos / TRAMO))
    return n - 1 if n > 1 and segundos - (n - 1) * TRAMO < MARGEN else n


def inicio_nominal(tramo: int) -> int:
    return (tramo - 1) * TRAMO


def hora(segundos: float) -> str:
    """12:05 o 1:02:05."""
    s = int(segundos)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def habla(audio) -> list[tuple[float, float]]:
    """Los tramos con voz, en segundos (el filtro Silero de faster-whisper, con pausas desde medio segundo)."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    return [(s["start"] / MUESTREO, s["end"] / MUESTREO)
            for s in get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=500, speech_pad_ms=100), sampling_rate=MUESTREO)]


def cortes(voz: list[tuple[float, float]], total: float, tramos: int) -> list[tuple[float, bool]]:
    """Dónde termina cada tramo menos el último, y si cayó en una pausa: el primer silencio desde el inicio nominal del
    siguiente, como mucho un minuto después. Sin pausa en ese minuto, el inicio nominal, que el tramo avisa."""
    huecos = [(0.0, voz[0][0])] if voz else [(0.0, total)]
    huecos += [(a[1], b[0]) for a, b in zip(voz, voz[1:])]
    if voz:
        huecos.append((voz[-1][1], total))
    resultado = []
    for k in range(1, tramos):
        nominal = k * TRAMO
        hueco = next(((a, b) for a, b in huecos if b > nominal and a < nominal + MARGEN), None)
        if hueco is None:
            resultado.append((float(nominal), False))
        else:
            # Si el silencio ya empezó, se corta en el nominal; si empieza después, en su mitad.
            resultado.append((float(nominal) if hueco[0] <= nominal else round(min((hueco[0] + hueco[1]) / 2, nominal + MARGEN), 2), True))
    return resultado


def parrafos(segmentos: list[dict]) -> str:
    """Párrafos de hasta un minuto, cortados en las pausas, cada uno con la hora en que empieza: «[12:05] …»."""
    bloques: list[list[dict]] = []
    for s in segmentos:
        if not s["texto"]:
            continue
        actual = bloques[-1] if bloques else None
        if actual and s["inicio"] - actual[0]["inicio"] < 60 and not (s["inicio"] - actual[-1]["fin"] >= 1.5 and s["inicio"] - actual[0]["inicio"] >= 20):
            actual.append(s)
        else:
            bloques.append([s])
    return "\n\n".join(f"[{hora(b[0]['inicio'])}] " + " ".join(s["texto"] for s in b) for b in bloques)


def dudosos(segmentos: list[dict]) -> list[str]:
    return [hora(s["inicio"]) for s in segmentos if s["texto"] and (s["logprob"] < LOGPROB_DUDOSO or s["compresion"] > COMPRESION_DUDOSA)]


class Transcriptor:
    """faster-whisper con el modelo de la configuración, cargado una vez. Usa la placa NVIDIA si anda (CUDA 12 y cuDNN 9
    instalados) y si no, el procesador con `hilos` hilos. Precisión int8: en turbo da el mismo error que float16 (DA51)."""

    def __init__(self, modelo: str = MODELO, hilos: int = 1, avisar=lambda texto: None, carpeta: str | None = None):
        # carpeta: dónde se guarda el modelo (carpeta_modelos de curso.config.local.json); sin ella, la caché de Hugging Face.
        self.modelo, self.hilos, self.avisar, self.carpeta = modelo, max(1, hilos), avisar, carpeta
        self._whisper = self._tandas = self._ruta = None
        self.dispositivo = None

    def identidad(self) -> dict:
        # El dispositivo no entra: cambiar de placa a procesador no invalida lo ya transcripto.
        return {"motor": "faster-whisper", "version": version("faster-whisper"), "modelo": self.modelo, "precision": "int8",
                "algoritmo": VERSION_ALGORITMO, "tramo": TRAMO}

    def _cargar(self):
        if self._whisper is not None:
            return
        import ctranslate2
        import numpy as np
        from faster_whisper import BatchedInferencePipeline, WhisperModel
        from faster_whisper.utils import download_model
        try:
            ruta = download_model(self.modelo, local_files_only=True, cache_dir=self.carpeta)
        except Exception:
            self.avisar(f"Descargando el modelo de transcripción {self.modelo} (unos 1,6 GB, una sola vez)…")
            ruta = download_model(self.modelo, cache_dir=self.carpeta)
        self._ruta = ruta
        if ctranslate2.get_cuda_device_count() > 0:
            try:
                modelo = WhisperModel(ruta, device="cuda", compute_type="int8")
                # Sin las bibliotecas de CUDA el error aparece recién al transcribir: se prueba con un segundo de silencio.
                list(modelo.transcribe(np.zeros(MUESTREO, dtype=np.float32), language="es")[0])
                self._whisper, self.dispositivo = modelo, "cuda"
            except Exception:
                self._whisper = None
        if self._whisper is None:
            self._whisper, self.dispositivo = WhisperModel(ruta, device="cpu", compute_type="int8", cpu_threads=self.hilos), "cpu"
        self._tandas = BatchedInferencePipeline(self._whisper)

    def idioma(self, audio) -> str:
        """El idioma de la grabación, detectado una vez con varios fragmentos de voz."""
        self._cargar()
        return self._whisper.detect_language(audio, vad_filter=True, language_detection_segments=4)[0]

    def transcribir(self, audio, desde: float, idioma: str) -> list[dict]:
        """Los segmentos de un tramo, con horas absolutas. Por tandas: el audio se reparte en fragmentos de voz que se
        procesan juntos, y los silencios y la música no llegan al modelo (filtro de voz)."""
        self._cargar()
        try:
            segmentos, _ = self._tandas.transcribe(audio, language=idioma, batch_size=8)
            segmentos = list(segmentos)
        except RuntimeError as error:
            if self.dispositivo != "cuda":
                raise
            # La placa se quedó sin memoria (3 GB alcanzan justo): el resto va por el procesador.
            self.avisar(f"La placa de video no alcanzó ({str(error)[:80]}); sigo con el procesador.")
            from faster_whisper import BatchedInferencePipeline, WhisperModel
            self._whisper = WhisperModel(self._ruta, device="cpu", compute_type="int8", cpu_threads=self.hilos)
            self._tandas, self.dispositivo = BatchedInferencePipeline(self._whisper), "cpu"
            segmentos = list(self._tandas.transcribe(audio, language=idioma, batch_size=8)[0])
        return [{"inicio": round(desde + s.start, 2), "fin": round(desde + s.end, 2), "texto": s.text.strip(),
                 "logprob": s.avg_logprob, "compresion": s.compression_ratio} for s in segmentos]


def decodificar(archivo: Path):
    """Todo el audio a 16 kHz mono (float32: unos 230 MB por hora). PyAV trae FFmpeg: no hace falta instalarlo."""
    from faster_whisper import decode_audio
    return decode_audio(str(archivo), sampling_rate=MUESTREO)
