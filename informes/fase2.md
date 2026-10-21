# Fase 2 — visión e ítems

**Estado: Fase 2 aprobada por el usuario**, mediante «Fase 2 aprobada, continuá», y cerrada mediante un único commit con los chequeos repetidos en verde. La aprobación acepta el checkpoint de problemas escaneados externos y sus límites declarados; no certifica individualmente cada transcripción ni convierte la muestra en un parcial manuscrito. Fase 1 cerrada en `352c249`. No se inició Fase 3.

## Implementado

- `transcribir_paginas(curso, doc, paginas)`: render PNG con caché, llamada aislada al modelo configurado y Markdown por página. No envía la conversación principal ni entrega la transcripción completa al contexto principal.
- La tanda superior al límite de `curso.config.json` —50 por defecto— requiere confirmación real mediante `ctx.ui.confirm`; sin UI se rechaza. No existe un argumento que permita al modelo autoaprobarla.
- Sin cambio automático de modelo ni reintentos. Respuestas truncadas, vacías, errores o cancelaciones conservan el texto previo y dejan la página pendiente; las otras páginas pueden continuar.
- La caché verifica fuente, prompt, modelo, umbral y Markdown. Repetir la ingesta base no degrada una transcripción vigente a OCR. Ediciones manuales o cambios durante la llamada se preservan.
- Se actualizan calidad, registro de recuperación, BM25 e informe. `[ilegible]` y LaTeX desbalanceado siguen pendientes. Un resultado de visión siempre conserva `revision_humana: pendiente`: el puntaje no certifica su fidelidad.
- `guardar_items`: persiste la segmentación elegida por el agente en `items.yaml`, con ids originales, páginas PDF, enunciado y referencia opcional `{doc, id}` a una solución existente. Valida tipo, rangos, duplicados, transcripción previa y referencias. No muestra soluciones en su respuesta ni pisa YAML editado manualmente.

No se agregó un segundo modelo para segmentar, una cola de trabajos, GPU, servicios locales ni comandos de estudio. Las tools requieren un curso preparado; crear cursos sigue en Fase 3. El piloto utiliza la misma lógica bajo `_procesado/fase2/`, sin crear un curso ficticio.

## Piloto real disponible

Fuente: [[_entrada/muestras/materiales/evaluaciones/practico1.pdf#page=1|Práctico 1, Redes, Curso 2026]], **PDF digital de tres páginas**.

- Modelo: `openai/gpt-6-luna`, autenticación existente.
- Primera ejecución: **3 páginas transcritas, 0 fallos, 0 pendientes heurísticos**. Revisión humana todavía pendiente.
- Segunda ejecución: **3 aciertos de caché, 0 llamadas nuevas**.
- Diez ejercicios segmentados, ids `1`–`10`. El ejercicio **7 abarca páginas 2 y 3**, conservando su apartado (e). No se inventaron soluciones.
- Se cotejaron las tres transcripciones con sus renders: notación de retardos/subíndices, potencias, numeración y figura de rutas. Se conservaron expresiones y separadores numéricos tal como aparecen, sin corregir supuestos errores del original. Esto no reemplaza la revisión del usuario ni una medición exhaustiva de exactitud.
- El PDF del piloto y los 18 PDFs del inventario mantienen sus SHA-256.

Evidencia local completa: `_procesado/fase2/piloto-practico1/`; resumen sin contenido de los enunciados: `.pi/informes/verificacion-fase2.json`.

## Prueba autónoma con papel escaneado real

Fuente: [Algebra elemental, Enrique G. Limric (1895)](https://archive.org/details/algebraelemental00limr), colección Library of Congress en Internet Archive. Se descargaron los JPEG de las páginas impresas **101 y 102**. Los índices BookReader se comprobaron visualmente; no coinciden directamente con `leafNum` de los metadatos.

- Las imágenes originales se guardan en `_entrada/muestras/externas/limric-1895/`, con URLs y SHA-256 en `origen.json`. Se insertaron **sin recomprimir** en un PDF de dos páginas sin capa de texto. No se rasterizó un PDF digital ni se mezcló esta muestra con Redes.
- La ingesta base clasificó ambas páginas como **escaneadas**, con cero caracteres iniciales y cobertura de imagen completa; el OCR dejó ambas pendientes.
- El primer ensayo con Luna detectó dos problemas reales: moneda sin escapar en Markdown y un falso `[ilegible]` donde el ejercicio 9 continúa en otra página. Se corrigieron las instrucciones compartidas del prompt y se añadió un test de regresión. No se retocaron manualmente las respuestas del modelo ni se añadió un reintento automático.
- Segundo ensayo con el prompt corregido: **2 transcritas, 0 fallos, 0 pendientes heurísticos**. Cotejo visual y asserts: **6/6 fracciones** y **8/8 importes** coinciden con las imágenes; los signos de moneda quedan escapados.
- **15 ítems**, ids `1`–`15`. El **9 abarca páginas PDF 1–2**, impresas 101–102, con el enunciado completo y sin soluciones inventadas.
- Repetición: **2 aciertos de caché, 0 llamadas nuevas**.
- Límite observado: una variable `C` de la continuación queda sin delimitadores LaTeX, aunque su texto se conserva. La muestra es papel impreso antiguo, **no manuscrito ni un parcial de Redes**. Se mantiene la revisión humana pendiente; estos controles puntuales no certifican fidelidad general.

Evidencia: `_procesado/fase2/piloto-escaneo/` y `informes/verificacion-escaneo-fase2.json` (sin enunciados). Comparación visible: [[informes/fase2/escaneo-real|Originales, transcripciones y 15 ítems]].

## Cómo revisar

En Obsidian:

1. [[informes/fase2/transcripciones|Transcripciones de las tres páginas]], con enlaces al original.
2. [[informes/fase2/items|Los diez ítems]], incluido el ejercicio 7 multipágina.
3. [[informes/fase2/informe-ingesta|Informe de ingesta actualizado]].
4. [[informes/fase2/escaneo-real|Prueba nueva con escaneos reales]], con las imágenes, las transcripciones y los 15 ítems.

Pruebas opcionales: `node .pi/scripts/probar-vision` (tres páginas digitales) y `node .pi/scripts/probar-vision --escaneo` (dos páginas escaneadas ya descargadas). La primera ejecución o una invalidación de caché —incluido el cambio de prompt descrito— puede volver a enviarlas a Luna; no ejecutar como test automático. La suite habitual no llama a modelos.

## Verificación automática

**28 tests Node en verde**, incluida una suite de **34 tests Python sin LLM**. `doctor` completo repetido en verde dentro de tmux tras el ensayo con escaneos reales. Se prueban permiso aceptado/rechazado, modo sin UI, imágenes y contexto aislado, suma de uso, deduplicación/caché, fallos por página, cancelación, ediciones manuales, corte entre escrituras, Markdown/ítems multipágina y referencias a soluciones. `doctor` comprueba las dos tools y PyYAML, además de la base y los pings/web reales.

## Cierre aprobado

El usuario aprobó la Fase 2 con «Fase 2 aprobada, continuá» y luego pidió retomarla. Se registra esa aprobación y se completa el commit de cierre, sin adelantar Fase 3. Los 28 tests Node, los 34 tests Python y el doctor completo dentro de tmux se repitieron en verde.

La aceptación corresponde al checkpoint de la fase con problemas de un libro escaneado real, no a un parcial manuscrito ni a una certificación general de fidelidad. Los indicadores `revision_humana: pendiente` de las páginas e ítems se conservan: la aprobación de la fase no equivale a aprobar cada salida individual. Fuentes, límites y resultados originales permanecen en la evidencia.
