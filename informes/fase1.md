# Fase 1 — ingesta base simplificada

**Estado: base aprobada por el usuario con «aprobado, sigamos».** Se cierra Fase 1 con las limitaciones de este informe y queda autorizado iniciar Fase 2. El parcial escaneado real sigue sin evaluarse; no se declara cumplido ese caso. Se mantiene el plan y se recorta la instalación de uso diario, no la protección de los originales.

## Qué funciona

- Inventario por SHA-256, clasificación digital/escaneada/mixta, texto por página, calidad, outline/encabezados y búsqueda BM25 sin tildes.
- Inicio en segundo plano, consulta de estado y reanudación por página. Los fallos no frenan las otras páginas.
- Escritura atómica y rechazo de salidas ajenas, symlinks, PDFs cambiados o Markdown editado por el usuario.
- **9/9 páginas reales procesadas; 7 quedan pendientes.** Los 18 PDFs del inventario conservan sus hashes originales. No se procesaron sus 2031 páginas completas.
- **18 tests Node aprobados**, incluida una suite de **20 tests Python sin LLM**. `doctor` completo en verde dentro de tmux, con pings Luna de texto/imagen y web reales.

## Recorte aplicado

| Clase | Motor base | Límite explícito |
|---|---|---|
| Digital | PyMuPDF | Las fórmulas no recuperadas en LaTeX quedan para revisión/visión. |
| Escaneada | OCRmyPDF + Tesseract `spa+eng` | Texto provisional; no se supone que haya recuperado símbolos y figuras. |
| Mixta | PyMuPDF | Conserva el texto digital; marca pendiente el contenido rasterizado. |

Estos son los valores predeterminados de la base técnica, **no una aprobación humana de fidelidad**. No hay GPU, Torch ni servidores locales en el camino diario. Los overrides de motor son para comparar candidatos, no un paso obligatorio para el usuario.

Se sacaron la configuración separada de “motor aprobado”, su falso fallo en `doctor`, PyYAML —todavía no usado— y el publicador genérico de informes. Los ejecutables auxiliares de ensayos quedaron en `scripts/ingesta/benchmark/`. Los archivos experimentales ya descargados se conservaron, sin volver a ejecutar marker/docling ni tocar servicios del usuario.

## Benchmark: mismas tres páginas para comparar tiempos

| Candidato | Redes PDF 56 | GRIMALDI PDF 522 | Parcial PDF 4 | Observación de calidad |
|---|---:|---:|---:|---|
| PyMuPDF | 0.540 s | 0.257 s | 0.378 s | Texto digital útil; no convierte por sí solo la matemática a LaTeX ni transcribe la tabla rasterizada. Leer la capa OCR previa de GRIMALDI no valida ese OCR. |
| OCRmyPDF + Tesseract | 15.841 s | 8.205 s | 5.631 s | Recupera prosa, pero GRIMALDI pierde subíndices y mezcla llaves/paréntesis; la tabla no queda estructurada. |
| docling, fórmulas activadas | 108.143 s | 14.671 s | timeout 120.428 s | En GRIMALDI deja expresiones sin LaTeX y degrada la notación; la tabla produjo 0 caracteres con `PARTIAL_SUCCESS`. |
| marker | 164.284 s | `AttributeError` | `AttributeError` | Buen aspecto del texto de Redes, pero deja parte de las potencias en HTML/texto en lugar de LaTeX. No se atribuye calidad a las páginas fallidas. |
| Luna, referencia automática | 19.674 s | 14.488 s | 29.961 s | Mejora la notación, pero la tabla separa el contador 1 del paquete 1 en filas distintas: requiere cotejo, no aprobación automática. |

Tiempos observados, no garantías; incluyen distinto costo de inicialización según el candidato y el orden. La base se midió sobre nueve páginas, los ensayos ML/visión sobre tres: aquí se usan solo las tres coincidentes, no promedios de conjuntos distintos. Las mediciones históricas preceden al último ajuste conservador de detección matemática; no se repitieron para embellecer el resultado. Datos sin texto de los libros: `benchmark-fase1.json`.

### Peso observado

- Entorno diario: **266 MiB** en esta máquina, sin contar el Tesseract existente de Conda ni Ghostscript.
- Entornos de ensayo: aproximadamente **1.5 GiB docling** y **1.4 GiB marker**, más pesos/cachés. El directorio experimental completo ocupa **5692 MiB**, contando sus hardlinks internos una sola vez. No se instala al restaurar el entorno diario.
- Son mediciones locales con `du`, no tamaños universales; no sumar tamaños de directorios compartidos como si fueran independientes.
- Visión usa la cuenta existente y no descarga pesos locales. El registro conserva tokens; los costos estimados del catálogo no se presentan como facturación real.

## Calidad: qué se comprobó y qué falta

Revisión puntual de texto español, fórmulas y tabla contra los renders; **no** una evaluación completa carácter por carácter ni una tasa WER/CER. El puntaje léxico puede ser alto aunque una fórmula esté mal: GRIMALDI 522 había obtenido 0.97 al leer su OCR previo. No se elevó arbitrariamente el umbral para ocultar ese falso positivo: se amplió la detección de expresiones como `$n+2$` y se mantiene el umbral 0.6 como señal de revisión, no como certificado.

Todos los ejercicios, evaluaciones y soluciones quedan pendientes de visión, incluso con prosa legible. La transcripción fiel en LaTeX y la segmentación en ítems siguen en Fase 2. No se intentó reconstruir fórmulas inventando texto.

**Falta la tercera muestra exigida por el plan:** parcial/práctico escaneado real, idealmente manuscrito. Los parciales disponibles tienen tablas/diagramas como imágenes dentro de PDFs digitales; no sustituyen ese caso. No se rasterizó un parcial para simularlo. GRIMALDI es solo una muestra del benchmark, no se incorporó al curso Redes.

Marker sigue con un error por página sin causa raíz establecida; no se invirtió otra tanda pesada en depurarlo. Los logs transitorios del diagnóstico ya no estaban disponibles al retomar, pero los errores por página quedaron registrados. No se concluye por eso que el motor falle en cualquier equipo.

## Cómo revisar en Obsidian

1. Abrir [[informes/fase1/ingesta-base|el informe de las nueve páginas]], con enlaces a cada original.
2. Abrir [[informes/fase1/comparacion-muestras|las transcripciones de los cinco candidatos]], agrupadas por las tres páginas coincidentes.
3. Aprobar o señalar fallos concretos; el verde de `doctor` solo confirma que la instalación funciona.

Comandos de uso diario y restauración: `.pi/SETUP.md`. Ensayos opcionales: `.pi/scripts/ingesta/benchmark/README.md`.
