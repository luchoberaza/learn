# Fase 5 — fotos persistentes y corrección

**Implementada; pendiente de confirmar el render del adjunto recuperado.** Ver actualización al final: la primera prueba SDK no cubría el pegado nativo; se agregó regresión y arreglo. Doctor ahora advierte una diferencia de versión de pi. Fase 4 fue aprobada con «Aprobado; continuá» y está en `c757542`. Los mensajes repetidos se tomaron como una sola aprobación, no como permiso para saltar fases. No se inicia Fase 6.

## Cambio

`md-log.ts` guarda las imágenes del usuario junto a la nota en `adjuntos/` y escribe su embed Obsidian en el bloque VOS. En cursos: `cursos/<curso>/sesiones/adjuntos/`. Funciona con texto + imágenes y también con mensajes que sólo contienen imágenes; conserva su orden.

- PNG, JPEG, GIF y WebP conservan **los bytes recibidos y la extensión real**, sin recodificar ni renombrar un PNG como JPG. Esta adaptación al `.jpg` ilustrativo del plan evita pérdida y no necesita otra biblioteca.
- Nombre `<timestamp>-<n>-<sha256>.<ext>`: recuperar el historial reutiliza exclusivamente copias idénticas, sin duplicar adjuntos ni pisar ediciones. La restauración de sesión no reconstruye ni vuelve a guardar lo ya registrado.
- Creación exclusiva, archivos nuevos con permisos `0600`, directorios nuevos `0700`; valida MIME, base64 y firma. Rechaza enlaces simbólicos en adjuntos. Las carpetas preexistentes conservan sus permisos. Una firma válida no certifica legibilidad ni es un decodificador completo.
- Un fallo queda como aviso en UI y nota; se conservan el texto, otras imágenes válidas y cualquier archivo existente. No se limpian automáticamente archivos parciales o huérfanos.
- Misma función para mensajes en vivo e historial; se conservan las citas y la omisión de resultados de lectura/soluciones. No hay nuevos comandos de fotos, transferencia desde el celular, OCR ni llamadas de visión añadidas por el logger.

`modo-curso.md` ahora exige transcribir antes de corregir, conservar errores/tachaduras/unidades y esperar aclaración de los datos necesarios ilegibles. Con la foto entendida, corrige según el contrato; sólo asigna puntaje si hay una escala aplicable. `teach` no cambió.

## Ensayo con manuscrito auténtico

Se usó una **foto pública de un cuaderno**, no texto digital rasterizado ni escritura simulada: *Financial Management Equity Distribution Solution 2026.jpg*, Wikimedia Commons, autor **FlexingCA**, licencia declarada **CC0**.

- Fuente: <https://commons.wikimedia.org/wiki/File:Financial_Management_Equity_Distribution_Solution_2026.jpg>.
- Original: `_entrada/muestras/externas/fase5/respuesta-externa.jpg`, 158371 bytes, SHA-256 `c3e4b5141d0728242dbe020496bc8ec79994b3740fdabfaf63430fd62a9bd0a0`.
- Es de finanzas, **no es material ni respuesta de Redes o del usuario**. No se agregó al índice, a fuentes ni al banco. El ensayo aislado recibió el protocolo real y el contrato de Redes, usando solamente su pauta general de justificar, sin atribuirle una rúbrica o escala ajena.

Con **`openai/gpt-6.1-sol`**, dos turnos reales:

1. Recorte de la foto con un dato ocultado intencionalmente para el caso negativo (original intacto). El modelo transcribió lo visible, marcó la lectura provisional, pidió la foto completa y no inventó el dato ni el resultado.
2. Foto original completa. Transcribió el ejercicio 2 antes de revisar; reconoció las tachaduras, comprobó el cálculo y explicó la justificación/presentación faltante. **No asignó puntaje**, porque no había una escala aplicable, ni revisó el ejercicio 1 fuera de alcance.

Se cotejó visualmente la foto y el orden de la devolución; la cuenta se comprobó aparte con fracciones exactas. Ambos adjuntos corresponden byte por byte a las imágenes de los mensajes nativos. Reabrir el mismo JSONL no duplicó imágenes ni modificó el log. Contrato, índice, progreso y teach intactos.

El primer chequeo del harness falló por exigir un `?`: la petición real era «Mandame la foto completa». Se corrigió para aceptar esa formulación y se **retomó el mismo JSONL**, sin repetir la primera llamada. Se completaron solamente dos respuestas del modelo; el script normal ya incluye la corrección. La duración guardada para el tramo reanudado no representa el recorrido completo.

Uso informado por pi: **18533 tokens de entrada + 634 de salida = 19167**, costo de catálogo **0,043406** (no factura). No hubo respuestas reales del alumno ni escritura de progreso.

## Evidencia y reproducción

- Log visible con las dos fotos: `informes/fase5/prueba-1792607375280.md`.
- Respuesta/JSONL nativos: `_procesado/fase5/prueba-1792607375280/`.
- Resumen sin enunciados completos: `.pi/informes/verificacion-fase5.json`.
- Repetición opcional: `node .pi/scripts/probar-fotos`. Descarga sólo esa muestra pública si falta, verifica su SHA antes de guardarla/enviarla y usa notas nuevas sin reemplazar otras. Consume dos turnos del modelo principal. El recorte usa Pillow **13.0.0**, ya presente y fijado como transitiva de OCR en `uv.lock`; no es una dependencia nueva del logger.

**55 tests Node y 56 Python aprobados**, más doctor completo correcto dentro de tmux. Los tests cubren los cuatro formatos, sólo imagen, orden, historial, reapertura, MIME/base64/firma inválidos, propiedades heredadas de objetos, copias editadas, symlinks, ruta desde el vault y ausencia de vínculo. Doctor prueba además un PNG sintético y su embed con el runtime real, sin modelo; no confunde esa prueba con una foto manuscrita ni con Ctrl+V.

## Comprobación manual pendiente

No se leyó el contenido ni se cambió el portapapeles personal: sólo se inspeccionaron sus tipos disponibles. **Ctrl+V físico dentro de tmux y render visual en Obsidian siguen pendientes**, no certificados por tests.

Para un smoke corto sin completar una clase, se dejó una nota vacía nueva `informes/fase5/prueba-manual.md`:

1. Abrí una sesión nueva de pi dentro de tmux con `pi-learn`; `/reload` si seguís en una sesión abierta.
2. `/md-log informes/fase5/prueba-manual.md` (sólo mientras esté vacía; si ya tiene contenido, elegí otra nota vacía).
3. Copiá una imagen **como imagen**, Ctrl+V en el editor normal de pi y enviá «Prueba técnica: transcribí esta foto, sin registrar progreso». En pi 1.3.0 el pegado puede aparecer como ruta temporal antes de enviarlo.
4. Abrí esa nota en Obsidian y verificá que se ve la foto, no sólo el nombre del adjunto. `/md-unlog` al terminar.

Durante una práctica real del curso el guardado es igual y no requiere `/md-log`: `/estudiar` ya vincula la nota. No se probó aún una respuesta manuscrita real de Redes, una clase completa ni calificación por una rúbrica detallada del curso, que no está disponible. Fotos/JSONL pueden contener datos personales: permanecen locales, fuera del Git de `.pi/`; pi conserva además su propio historial y temporales nativos, que esta fase no purga.

## Corrección posterior — pegado nativo

El usuario envió una foto y reportó que el modelo la entendía, pero el log mostraba sólo la ruta. La entrada real del JSONL tiene **un bloque `text` con la ruta temporal**, no `ImageContent`; el modelo la abrió con `read`. La función nativa `handleClipboardPaste()` guarda el portapapeles en un archivo e inserta esa ruta en el editor. Su implementación es idéntica en pi 1.3.0 y 1.4.0: el error no se atribuye a la actualización.

Se reprodujo con `node --test --test-name-pattern='Ctrl\+V nativo' .pi/tests/md-log-fotos.test.mjs`: rojo «La ruta quedó como texto, sin copiar la imagen», luego verde. El arreglo acepta rutas explícitas de imagen por línea, con comillas/`@`/relativas cuando corresponda, y rutas `pi-clipboard-<UUID>` en medio de texto; comparte el copiado protegido y el formato de historial. No modifica el mensaje que recibe el modelo ni registra imágenes devueltas por tools. Abre la fuente sólo para lectura con `O_NOFOLLOW`/`O_NONBLOCK`, valida archivo regular y cierra el descriptor. Si falta o no es regular, preserva la ruta y avisa.

Se repitió la entrada real por el logger corregido sin reenviar la foto al modelo. Se copió y cotejó byte por byte y se agregó el embed **al final de `informes/fase5/prueba-manual.md`**, sin reescribir el texto anterior ni modificar la foto original. Copia previa y comprobación privada en `_procesado/fase5/reparacion-log-nativo/`, fuera de Git; no se versiona el contenido de esa imagen o respuesta.

**60 tests Node / 56 Python en verde.** Doctor comprueba ahora tanto ruta nativa como bloque `image`; fotos, modelos y web pasan. El único fallo es que el entorno responde **pi 1.4.0 frente al pin 1.3.0**: no se reinstaló pi ni se cambió el pin. Se leyeron docs actuales de extensiones/TUI; SDK/message-types/session-format son idénticos a los ya leídos de 1.3.0. Esto no reemplaza una decisión de migración de versión.

Para las próximas fotos, ejecutar `/reload` o abrir una sesión nueva. No volver a vincular/rellenar la nota manual no vacía. Resta que el usuario confirme la imagen recuperada en Obsidian; Fase 6 sigue detenida.
