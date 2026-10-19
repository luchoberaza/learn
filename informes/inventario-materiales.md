# Inventario preliminar de las muestras

Origen: `_entrada/muestras/materiales/`. **18 PDFs, 2031 páginas, aproximadamente 120 MiB.**

Se inspeccionaron los metadatos y el texto de las páginas 1, 2 y central de cada documento (sin repetir páginas). También se listaron las imágenes de los prácticos/parciales y se renderizaron dos páginas con imágenes grandes para distinguir diagramas de escaneos. No se ejecutó OCR, ingesta, benchmark ni transcripción con un modelo; no se modificaron, movieron ni borraron originales.

Herramientas ya instaladas: Poppler `26.08.0` (paquete `26.08.0-1.1`): `pdfinfo`, `pdftotext`, `pdfimages`, `pdftoppm`; Python estándar. Metadatos y SHA-256 en `inventario-materiales.json`.

## Archivos

Rutas relativas a `materiales/`:

| Archivo | Páginas | Observación preliminar |
|---|---:|---|
| `bibliografia/Capitulo3-CapaTransporte.pdf` | 108 | Material de Redes con texto extraíble |
| `bibliografia/Capitulo4-CapaRed-Datos.pdf` | 67 | Material de Redes con texto extraíble |
| `bibliografia/Capitulo5-CapaRed-Control.pdf` | 58 | Material de Redes con texto extraíble |
| `bibliografia/GRIMALDI.pdf` | 1044 | Matemáticas discretas y combinatoria; escaneo con capa OCR existente en la página inspeccionada |
| `bibliografia/Redes_de_computadoras_Un_enfoque_descend.pdf` | 699 | Libro de Redes; texto digital en la página interior inspeccionada |
| `evaluaciones/practico1.pdf` | 3 | Práctico digital, con fórmulas y numeración de ejercicios |
| `evaluaciones/practico2.pdf` | 3 | Práctico con texto extraíble |
| `evaluaciones/practico3.pdf` | 5 | Práctico con texto extraíble e imágenes |
| `evaluaciones/practico4.pdf` | 3 | Práctico con texto extraíble |
| `evaluaciones/practico5.pdf` | 4 | Práctico con texto extraíble e imágenes |
| `evaluaciones/practico6.pdf` | 6 | Práctico con texto extraíble e imágenes |
| `evaluaciones/practico7.pdf` | 5 | Práctico con texto extraíble e imágenes |
| `evaluaciones/sol_prc20230918.pdf` | 3 | Parcial con soluciones incluidas, texto digital |
| `evaluaciones/sol_prc20240926.pdf` | 4 | Parcial con soluciones; imagen grande de tabla en p. PDF 4, no escaneo de la hoja |
| `evaluaciones/sol_prc2024123.pdf` | 4 | Parcial con soluciones; imágenes de diagramas TCP en p. PDF 1, no escaneo de la hoja |
| `evaluaciones/sol_prc20250924.pdf` | 4 | Parcial con soluciones, texto extraíble |
| `evaluaciones/sol_prc20251126.pdf` | 5 | Parcial con soluciones, texto extraíble |
| `programa/Programa de Unidad Curricular Redes de Computadoras - 20191022.pdf` | 6 | Programa de Redes con objetivos y texto extraíble |

Estas observaciones son de muestreo, no una clasificación de todas las páginas. La presencia de texto por sí sola no prueba origen digital: GRIMALDI conserva OCR sobre una imagen de página.

## Selección propuesta para el benchmark

- **Libro digital:** un rango pequeño del libro de Redes; seleccionar páginas con fórmulas, diagramas y texto en español antes de medir.
- **Libro escaneado:** un rango pequeño de GRIMALDI. Es útil precisamente porque su OCR existente contiene errores: el benchmark deberá comparar también contra el render original, no tomar el OCR como referencia correcta.
- **Ejercicios/evaluaciones digitales complejos:** `practico1.pdf` (fórmulas y unidades), `sol_prc20240926.pdf` p. PDF 4 (tabla rasterizada) y `sol_prc2024123.pdf` p. PDF 1 (diagramas rasterizados).
- **Parcial/práctico escaneado real:** no se identificó uno entre los archivos revisados; tampoco manuscritos. Las imágenes grandes observadas en los parciales son diagramas o tablas, no fotos de páginas completas.

Si no hay un parcial escaneado real, se puede proponer una **copia de prueba rasterizada** de un práctico digital, generada en un directorio de trabajo sin tocar el PDF fuente. Eso sería un ensayo controlado, no una muestra de escaneo real ni una validación de manuscritos; requiere aprobación de esa sustitución para no dar por cumplido un criterio distinto del acordado.

## Límites y checkpoints

- No procesar las 2031 páginas para elegir el motor: el benchmark usará rangos pequeños representativos.
- No hay que crear un curso con todo el directorio automáticamente. GRIMALDI corresponde a otra materia; por ahora solo es candidato de benchmark.
- Los nombres de las carpetas no son la clasificación final: en `evaluaciones/` hay prácticos y parciales con soluciones. No se reclasificó ni copió nada todavía.
- El usuario aceptó después el smoke técnico para cerrar Fase 0 (opción «1»), según `verificacion-base.md`. Fase 1 espera un OK específico; no se autorizó sustituir el parcial escaneado por una copia rasterizada. La carga de archivos solo preparó las muestras.
- No se eligió motor de extracción ni se instaló una dependencia pesada.
