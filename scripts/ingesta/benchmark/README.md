# Ensayos del benchmark — no son dependencias de uso diario

La ingesta diaria está en el directorio superior y solo necesita `.pi/.venv` y Tesseract. Estos ensayos se conservan para reproducir lo ya medido, no para seguir agregando motores. `doctor` no los exige. Resultado y límites: [`../../../informes/fase1.md`](../../../informes/fase1.md).

## Versiones

- Base: Python `3.13.13`, PyMuPDF `1.28.2`, OCRmyPDF `17.13.0`, wordfreq `3.1.1`.
- Docling: `docling-slim==2.140.0` con enriquecimiento de fórmulas; `opencv-python-headless==4.11.0.86` explícito porque el primer ensayo falló por falta de `cv2`.
- Marker: `marker-pdf==2.0.0`, Surya `0.22.1`, modo `fast`, matemática inline, sin API LLM.
- Ambos entornos: Torch `2.9.1+cpu`, torchvision `0.24.1+cpu`; índices CPU explícitos y transitivas en sus `uv.lock`. Sin CUDA.
- llama.cpp oficial `b11741`: URL y SHA-256 en `.pi/config/benchmark-ml.json`; el instalador verifica el archivo antes de extraerlo.
- Pesos fijados por commit en ese mismo JSON. Cuatro hilos CPU; timeout docling de 120 s por entrada de una página.

## Reproducción opcional

Desde la raíz del vault. **No correr para estudiar:** restaura varios GiB y puede descargar pesos. Usar salidas nuevas para no alterar las mediciones anteriores.

```bash
uv sync --project .pi/scripts/ingesta/benchmark/docling --python 3.13.13 --locked
uv sync --project .pi/scripts/ingesta/benchmark/marker --python 3.13.13 --locked
.pi/.venv/bin/python .pi/scripts/ingesta/benchmark/instalar_llama.py

.pi/.venv/bin/python .pi/scripts/ingesta/benchmark/benchmark_base.py --manifiesto .pi/config/muestras-fase1.json --salida _procesado/ensayo-base-nuevo
.pi/.venv/bin/python .pi/scripts/ingesta/benchmark/preparar_ml.py --salida _procesado/ensayo-ml-entradas

# Guardar también stderr: allí quedan los tracebacks de errores por página.
timeout --signal=TERM --kill-after=15s 600s .pi/scripts/ingesta/benchmark/docling/.venv/bin/python .pi/scripts/ingesta/benchmark/trabajador_docling.py --entradas _procesado/ensayo-ml-entradas/entradas.json --salida _procesado/ensayo-docling-nuevo > /tmp/pi-learning-docling-nuevo.log 2>&1
timeout --signal=TERM --kill-after=15s 900s .pi/scripts/ingesta/benchmark/marker/.venv/bin/python .pi/scripts/ingesta/benchmark/trabajador_marker.py --entradas _procesado/ensayo-ml-entradas/entradas.json --salida _procesado/ensayo-marker-nuevo > /tmp/pi-learning-marker-nuevo.log 2>&1
```

Las copias conservan el PDF original de cada página; **no se rasterizan para fingir una muestra escaneada**. El trabajador de marker usa HOME/XDG privados y termina solo sus propios servidores descendientes al finalizar normalmente.

### Referencia con visión: envía páginas a Luna

Opcional, con consumo de la cuenta; no repetir automáticamente. La configuración actual contiene tres páginas. El ejecutable rechaza tandas superiores al límite y salidas ya registradas; ante una interrupción exige una salida nueva, no borra el bloqueo ni reintenta a ciegas.

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/benchmark/renderizar_referencia.py --entradas _procesado/ensayo-ml-entradas/entradas.json --salida _procesado/ensayo-vision-nuevo
node .pi/scripts/ingesta/benchmark/referencia-vision.mjs _procesado/ensayo-vision-nuevo
```

Esto usa `session.modelRuntime.getModel/completeSimple` del SDK instalado de pi `1.3.0`; no implementa la herramienta de Fase 2. La salida de un modelo de visión **no es verdad de terreno**.

Los estados globales históricos `completado` solo indican que terminó la tanda: revisar cada página. En la medición conservada, docling produjo una página vacía con `PARTIAL_SUCCESS`, y marker falló dos páginas. Ni el nombre del estado ni tener Markdown prueban su fidelidad.
