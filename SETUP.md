# Instalación reproducible — Fases 0 a 5

**Estado:** Fases 0–4 aprobadas y cerradas (`79b1976`, `352c249`, `6409acd`, `3616e71`, `c757542`). Redes: 17 documentos / 987 páginas y 8 temas, con 268 páginas referidas todavía pendientes; aprobación de organización no equivale a revisión individual. Fase 5 implementada con manuscrito público y modelo principal reales; checkpoint pendiente, incluido Ctrl+V físico/render Obsidian. Historial y límites en `informes/fase1.md` a `informes/fase5.md` y `DECISIONES.md`. No se inicia Fase 6.

**Aviso posterior al chequeo manual de fotos:** el entorno ahora responde `pi 1.4.0`, mientras este proyecto conserva el pin `1.3.0`. Los 60 tests y el chequeo de fotos con el runtime actual pasan; doctor señala sólo esa diferencia de versión. No se reinstaló pi ni se relajó el pin como parte del arreglo. La migración/versionado queda pendiente.

Actualizar entre semestres, no en semana de parciales.

## Versiones fijadas / verificadas

| Componente | Versión |
|---|---|
| pi | `1.3.0` (instalación administrada existente) |
| Node.js / npm | `26.1.0` / `11.13.0` |
| learn (fork) | `7cfd8942f82ab9476e63572387e1fe9bcea5082c` |
| pi-interactive-subagents | `3.7.2`, commit `c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7` |
| pi-web-access | `0.42.0`; árbol transitivo en `npm/package-lock.json` |
| tmux | `3.8` (paquete existente `3.8-1.1`) |
| fish | `4.9.3` (paquete existente `4.9.3-1`) |
| wl-clipboard | `2.3.0` (paquete existente `1:2.3.0-1.1`) |
| Poppler | `26.08.0` (paquete existente `26.08.0-1.1`); inventario preliminar de muestras |
| Git | `2.56.0`, existente |
| uv | `0.13.1`, existente |
| Python de ingesta | `3.13.13`, entorno `.pi/.venv` |
| PyMuPDF / OCRmyPDF / wordfreq | `1.28.2` / `17.13.0` / `3.1.1`; transitivas en `scripts/ingesta/uv.lock` |
| PyYAML (Fase 2: ítems) | `6.0.3`; transitivas en el mismo `uv.lock` |
| Pillow (fixture opcional de Fase 5) | `13.0.0`, transitiva ya instalada de OCR, fijada en `uv.lock`; no se usa en el logger |
| Tesseract utilizado | `5.5.2`, Conda `h1f36d38_0`, con `spa` y `eng` |
| Ghostscript existente | `10.08.0`, paquete `10.08.0-1.1` |

No se instalaron paquetes del sistema. Las dependencias Python de Fase 1 están aisladas; los ensayos ML no son dependencias de uso diario. Las herramientas de visualización originales no se modificaron: los mapas Mermaid del skill se renderizan directamente en Obsidian. No se instalaron todavía las dependencias opcionales para generar PNG de Mermaid.

Si hace falta una instalación nueva de pi, el comando npm con versión exacta es:

```bash
npm install --global --ignore-scripts @earendil-works/pi-coding-agent@1.3.0
pi --version
```

No lo ejecutes sobre esta instalación administrada sin planificar la migración. Para instalaciones npm, `doctor` puede necesitar `PI_LEARN_PI_MODULE` apuntando a la ruta absoluta de `@earendil-works/pi-coding-agent/dist/index.js`. En esta máquina lo localiza automáticamente leyendo `~/.pi/agent/install/current-version`.

## Base Git

Comandos originales, **solo para un directorio nuevo**; no sobreescribir `.pi/`:

```bash
cd ~/Projects/pi-learning
git clone https://github.com/santi-esquerre/learn .pi
git -C .pi switch -c cursos
git -C .pi remote add upstream https://github.com/amosblomqvist/learn
git -C .pi remote -v
```

`origin` es el fork del usuario; `upstream`, la herramienta original. La base inspeccionada de ambos fue `7cfd8942f82ab9476e63572387e1fe9bcea5082c`. `skills/teach/SKILL.md` permanece intacto.

## Paquetes pi, solo en este proyecto

Desde la raíz del vault:

```bash
pi install --local --approve git:github.com/amosblomqvist/pi-interactive-subagents@c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7
pi install --local --approve npm:pi-web-access@0.42.0
npm ci --ignore-scripts --prefix .pi/npm
pi list --approve
.pi/scripts/instalar-config
```

El `npm ci` restaura el árbol exacto del lockfile versionado. Pi genera inicialmente un rango con `^` en `npm/package.json`; en este proyecto se lo fijó a `0.42.0`. No actualizarlo incidentalmente al reinstalar.

`--approve` autoriza la carga para ese proceso, no guarda una decisión global. En el primer inicio interactivo, **pi pedirá confiar en el proyecto**. Revisá y aceptá para cargar `.pi/`; `/trust` permite guardar la decisión.

`instalar-config` es idempotente. Crea archivos ausentes y rechaza cualquier archivo existente con contenido distinto: no reemplaza configuraciones personales.

## Búsqueda y lectura web

Se eligió `pi-web-access@0.42.0`, con:

- Exa MCP sin clave como primera opción; Parallel MCP y DuckDuckGo como respaldo.
- Lectura HTTP directa; el nombre público `fetch_content` se configura como `web_fetch`.
- Herramientas activas desde el inicio, también en hijos restringidos; puente en `extensions/web-subagentes.ts`.
- Sin cookies del navegador, navegador automático, resúmenes LLM, clonación GitHub, procesamiento PDF ni lectura de videos.
- Sin servicios de extracción HTTP alojados por terceros.

La configuración reproducible está en `config/web-search.json`. En esta sesión, `XDG_CONFIG_HOME=~/.config`, así que se instaló en `~/.config/pi/web-search.json`. Con `PI_CODING_AGENT_DIR`, se usa ese directorio; sin XDG, se usa `~/.pi/agent`. El instalador respeta también la precedencia de archivos heredados documentada por el paquete.

No fue necesario crear cuentas ni guardar claves. Las consultas salen hacia el proveedor que atienda la búsqueda; los respaldos también reciben la consulta si se utilizan. Los endpoints sin clave tienen límites de uso y no ofrecen una garantía de disponibilidad permanente. Si en el futuro se agregan `EXA_API_KEY` o `PARALLEL_API_KEY`, esos proveedores pueden pasar a consumir cuotas/créditos de esas cuentas: revisar antes la configuración.

`safe_bash` viene con los subagentes, no con pi ni con learn. Su filtro de órdenes no es un sandbox de seguridad del sistema operativo.

## Modelos configurados y verificados

Por elección explícita del usuario:

- researcher: `openai/gpt-6-luna`;
- visión: `openai/gpt-6-luna`.

El frontmatter de `agents/researcher.md` coincide con `curso.config.json`. Las dos llamadas reales de `doctor` respondieron correctamente con la autenticación existente, incluida la petición con un PNG sintético. No se agregaron claves ni se cambió el login.

Esto confirma disponibilidad y aceptación de imágenes, **no** la fidelidad del OCR matemático. En Fase 1 se transcribieron tres páginas con Luna solo como referencia del benchmark; todavía requieren revisión. Ver `informes/fase1.md`.

La primera propuesta (`gpt-5.4-mini` / `gpt-5.5`) había fallado con HTTP 400 porque esta cuenta ChatGPT/Codex no admite esos ids, pese a figurar en el catálogo. Se conserva el antecedente en `DECISIONES.md`: aparecer en `/model` no prueba el acceso real.

El modelo principal del proyecto sigue siendo `openai/gpt-6.1-sol`, ya verificado; no se modificaron las preferencias globales. Las claves, si se necesitan en el futuro, se ingresan mediante `/login`, nunca en el chat ni en archivos versionados.

## Lanzador fish: `pi-learn`

Ya instalado en:

```text
~/.config/fish/functions/pi-learn.fish
```

Copia versionada: `config/fish/pi-learn.fish`. No se cambió `config.fish` ni la configuración personal de tmux.

```fish
cd ~/Projects/pi-learning
pi-learn
# También admite los argumentos nativos de pi:
pi-learn --resume
```

- Conserva **la carpeta actual**, sin cambiarla al vault automáticamente.
- Fuera de tmux crea una sesión nueva en el servidor separado `pi-learn`, con `config/tmux.conf`.
- Dentro de tmux ejecuta pi directamente: no anida tmux ni altera sus opciones globales.
- La configuración exclusiva importa las preferencias personales existentes y habilita passthrough, portapapeles y teclas extendidas; conserva el entorno Wayland para `wl-paste`.
- Da 2500 ms al shell fish de cada hijo antes de enviarle la orden de inicio; respeta `PI_SUBAGENT_SHELL_READY_DELAY_MS` si ya está definido.
- Cada invocación externa crea una sesión distinta: no reutiliza otra carpeta ni pierde argumentos. Si se separa una sesión con el prefijo de tmux y `d`, se puede volver con `tmux -L pi-learn attach`.

Fish carga la función automáticamente. Si esa shell ya conocía otra definición, abrir una shell nueva o ejecutar `source ~/.config/fish/functions/pi-learn.fish`.

## Obsidian e imágenes

Se creó `.obsidian/app.json` con `userIgnoreFilters: ["_procesado"]` cuando Obsidian no estaba abierto y el archivo no existía. No se reemplazó configuración existente. En futuras modificaciones, cerrar Obsidian primero para que no reescriba el archivo al salir.

Abrí `~/Projects/pi-learning` como vault. Las citas futuras usarán `[[ruta/al.pdf#page=N]]`.

En Wayland, pi usa `wl-paste` (`wl-clipboard`); en X11 necesita `xclip`. Pi admite PNG, JPEG, WebP y GIF, **no HEIC**. Pasá las fotos del celular en JPEG y pegalas directamente en pi con **Ctrl+V**. No hay comando de transferencia de fotos.

Desde Fase 5, el md-log adaptado guarda las imágenes junto a la nota en `adjuntos/` y las embebe para Obsidian. El original de upstream no tenía ese guardado. Se conserva el formato recibido: un PNG no se renombra como JPEG. Ver «Fotos persistentes» abajo.

## Ingesta base — Fase 1

Desde la raíz del vault:

```bash
UV_PROJECT_ENVIRONMENT="$PWD/.pi/.venv" uv sync --project .pi/scripts/ingesta --python 3.13.13 --locked
.pi/.venv/bin/python .pi/scripts/ingesta/comprobar.py
```

Se usan **PyMuPDF para digital/mixta** y **OCRmyPDF + Tesseract para escaneada**, sin GPU, Torch ni servidores. El manifiesto solo necesita documentos y páginas; `config/muestras-fase1.json` es un ejemplo con 9 páginas, no una orden de procesar los 18 PDFs completos. Los overrides de motor se conservan para el benchmark.

Tesseract se resuelve por `PATH`. En esta máquina se utiliza `/home/sesquerre/miniconda3/bin/tesseract`, con datos en `/home/sesquerre/miniconda3/share/tessdata/`, **no** el Tesseract `5.5.3` del sistema. Comprobar:

```bash
command -v tesseract
tesseract --version
tesseract --list-langs
```

Solo si falta esa versión, puede restaurarse en un entorno separado, sin modificar Conda base:

```bash
conda create --prefix "$HOME/.cache/pi-learning/ocr" --channel conda-forge 'tesseract=5.5.2=h1f36d38_0'
# Bash; en fish: set -gx PATH "$HOME/.cache/pi-learning/ocr/bin" $PATH
export PATH="$HOME/.cache/pi-learning/ocr/bin:$PATH"
```

Paquete oficial observado: `https://conda.anaconda.org/conda-forge/linux-64/tesseract-5.5.2-h1f36d38_0.conda`, SHA-256 `67125e3aa53a069c1cd5b17ff2b9cb66019b8bc8615a45c456dbd9093721ebd6`. La restauración alternativa no se ejecutó: ya estaba instalado.

### Procesar, consultar y reanudar

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto .pi/config/muestras-fase1.json --salida _procesado/fase1/base-simple
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py estado --salida _procesado/fase1/base-simple
```

Repetir `iniciar` con los mismos argumentos reanuda/reutiliza la caché. `procesar` hace lo mismo en primer plano. El umbral y los idiomas salen de `curso.config.json`; cambios de motor, versión, calidad, tipo o ruta de cita invalidan la caché correspondiente. Los originales solo se leen; si cambia un PDF o alguien edita el Markdown generado, se informa un conflicto en vez de borrar su trabajo.

Las salidas contienen metadatos, clasificación, Markdown por página, calidad, estructura, `busqueda.json`, estado e informe. Los fallos quedan por página. Los ejercicios, evaluaciones y soluciones quedan provisionales hasta visión en Fase 2, aunque su texto parezca bueno. Un puntaje alto no certifica las fórmulas ni las figuras.

Para revisar ahora en Obsidian: **`informes/fase1/resumen.md`** e **`informes/fase1/ingesta-base.md`**. Como `_procesado` está excluido, una copia manual de otro informe puede publicarse sin pisar notas:

```bash
mkdir -p informes/fase1
cp -n _procesado/fase1/base-simple/informe-ingesta.md informes/fase1/ingesta-base.md
```

Están disponibles `/curso-nuevo`, `/curso-agregar`, `/curso-check` y `/curso-estado` (Fase 3). `/estudiar` y `/cursos` están disponibles desde Fase 4 (ver abajo). Los ensayos de marker, docling y visión están separados en [`scripts/ingesta/benchmark/`](scripts/ingesta/benchmark/README.md); **no es necesario restaurarlos para usar la ingesta**.

## Visión e ítems — Fase 2

Se restaura con el mismo `uv sync --locked` de arriba; se añade únicamente PyYAML `6.0.3` para `items.yaml`. No requiere GPU ni dependencias ML. Después de cambiar los archivos de la extensión, ejecutar `/reload` o abrir una sesión nueva para que pi registre las tools.

- `transcribir_paginas(curso, doc, paginas)` usa Luna, renderiza las páginas ya preparadas, guarda Markdown, actualiza BM25/informe y devuelve solo un resumen. Más de 50 páginas —límite configurable— exige confirmación interactiva; sin UI se rechaza. La caché evita repetir llamadas vigentes; cambiar modelo, prompt o umbral puede invalidarla y consumir nuevamente.
- `guardar_items(curso, doc, items)` guarda la segmentación hecha por el agente: `{id, paginas, enunciado, solucion?: {doc, id}}`. Los ids conservan la numeración del documento. Requiere páginas transcritas, valida referencias y no pisa ediciones manuales.

Son tools de preparación, no comandos `/`. Los pilotos aislados de Fase 2 siguen disponibles; Fase 3 incorpora además el curso real `redes`. Para repetir la prueba digital original sin crear otro curso:

```bash
# Opcional, con LLM: puede enviar tres páginas a Luna si no hay caché vigente.
node .pi/scripts/probar-vision
# Dos páginas de papel escaneado real, ya descargadas en _entrada/muestras/externas/limric-1895/.
# También puede consumir llamadas si la caché no está vigente.
node .pi/scripts/probar-vision --escaneo
```

Primera prueba real: 3/3 páginas transcritas; segunda: 3/3 en caché y ninguna llamada nueva. Se guardaron diez ejercicios, incluido el 7 en páginas 2–3. Informes visibles: `informes/fase2/resumen.md`, `transcripciones.md` e `items.md`. Los datos internos están en `_procesado/fase2/piloto-practico1/`.

Prueba externa: dos imágenes de papel escaneado de *Algebra elemental* (Limric, 1895), procedentes de Internet Archive / colección Library of Congress. El PDF de prueba contiene esos JPEG sin recomprimir y sin capa de texto; no deriva de un PDF digital rasterizado. Se cotejaron seis fracciones y ocho importes; quince ítems, incluido el 9 multipágina. Segunda ejecución con el prompt corregido: dos aciertos de caché y cero llamadas nuevas. Fuente, SHA-256, fallos iniciales y límites en `informes/verificacion-escaneo-fase2.json`; comparación visible en `informes/fase2/escaneo-real.md`.

Un error o cancelación conserva el texto previo. Las transcripciones incompletas se rechazan; `[ilegible]` o LaTeX roto quedan pendientes. El prompt distingue moneda (`\$`) de LaTeX y un salto de página de contenido ilegible. `revision_humana: pendiente` no cambia automáticamente por tener puntaje alto. Al cerrar Fase 2, fotos/manuscritos no estaban verificados; el ensayo público aislado de Fase 5 se describe abajo, sin certificar respuestas reales de Redes. El usuario aprobó el checkpoint de Fase 2 con sus límites; esa aceptación global no modifica la revisión pendiente de páginas e ítems individuales.

## Crear y ampliar cursos — Fase 3

No agrega dependencias: usa el mismo Python/PyMuPDF/PyYAML fijado en `uv.lock`, con los comandos `uv sync --locked` de arriba. Después de `/reload` o de abrir una sesión nueva:

```text
/curso-nuevo <slug>
/curso-agregar <slug> [archivos…]
/curso-check redes
/curso-estado redes
```

Los dos primeros alias invocan las skills nativas `/skill:curso-nuevo` y `/skill:curso-agregar`. El agente selecciona material del curso y redacta una propuesta explícita, no importa toda la bandeja por defecto. `guardar_curso(curso, propuesta)` valida/copia fuentes nuevas y muestra un diff con confirmación interactiva antes de reemplazar curación existente; sin UI rechaza la actualización. No hay bandera de autoaprobación, ni reemplazo de PDFs o progreso existente. La selección de páginas y su ingesta en segundo plano reutilizan la CLI base.

Formatos, seguridad y comandos locales: [`scripts/ingesta/CURSOS.md`](scripts/ingesta/CURSOS.md). El validador es de sólo lectura; `ok` sólo acredita estructura/referencias, y `listo_estudio` exige cero avisos. El doctor comprueba cada curso y señala páginas pendientes sin fingir que su revisión humana es una dependencia faltante. `/curso-estado` actualiza su indicador al consultar, sin servicio de sondeo permanente.

El curso real está en `cursos/redes/`: **17 PDFs / 987 páginas, 8 temas** y 52 páginas preparadas, 23 con Luna. Los 15 ítems ya están asignados. El usuario aprobó la tabla y las tres diapositivas complementarias; la propuesta `_procesado/fase3/propuesta-redes-curada.json` se aplicó verificando sus huellas. Abrí `cursos/redes/revision-inicial.md` e `informe-ingesta.md` en Obsidian. Hay **268 páginas referidas pendientes**, no el curso entero preparado.

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py validar --curso redes
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py informe --curso redes
```

El informe visible se regenera sólo si conserva su huella generada; si se editó manualmente, se preserva y se avisa. Los detalles de fuentes, resultados y límites están en `informes/fase3.md` y `informes/verificacion-fase3.json`. Las fuentes y enunciados reales permanecen fuera de Git. Los datos del curso no se restauran desde el commit del código: conservar el vault o volver a preparar los originales.

## Sesión de estudio — Fase 4

No agrega dependencias: mismo `uv sync --locked`, pi 1.3.0 y Node 26.1.0. El parser YAML se reutiliza en Python al activar/restaurar; páginas/BM25 se leen en TypeScript, sin OCR. Después de `/reload` o de abrir una sesión nueva:

```text
/cursos
/estudiar redes retardos
/estudiar redes
```

El último muestra un selector; tema por id, nombre o alias, sin tildes, con selector ante ambigüedad. Fuera del índice se ofrece un modo ad hoc sin escribirlo automáticamente al curso. El comando arranca hasta la primera pregunta sin otra orden. Cambia nombre/estado y vincula una **nota nueva**, sin rellenarla con la historia previa ni pisar notas del mismo día. Tras `/curso-agregar`, reactivá el tema para tomar la nueva curación.

Las tools `leer_paginas`, `buscar_material`, `leer_items` y `ver_pagina` requieren curso activo. Devuelven citas/texto acotado, sin rutas de derivados que el modelo deba recorrer; las soluciones se omiten por defecto. `ver_pagina` sólo renderiza localmente, con caché y protección de originales/renders. Los resultados de lectura no van al log. `teach` permanece intacto y se reinyecta junto a modo/dossier en cada arranque. Progreso existente se lee, **no se escribe**.

La sesión y el vínculo se restauran desde la rama activa. Para retomar una sesión real, cerrá pi y usá `pi --resume` o `/resume` en la próxima apertura; buscá el nombre `<Curso> · <Tema>`. `/compact` conserva el mecanismo de inyección y las entradas de estado. El log queda en `cursos/<curso>/sesiones/`. Si se inicia otra sesión sin progreso registrado, se señala el log anterior; la reconstrucción automática sigue en Fase 7.

Prueba opcional con el modelo principal real, en una sesión independiente:

```bash
node .pi/scripts/probar-sesion
```

Consume LLM para la primera pregunta y compactación; se detiene sin responder por vos. Usa sólo seis tools de lectura/preguntas y crea su propio JSONL bajo `_procesado/fase4/`. Primera prueba completa correcta: quiz a los **20,08 s**, compactación real y reapertura del mismo archivo con curso/tema/log restaurados. Dossier 6296 bytes, lectura 0,45 ms, BM25 4,75 ms y render frío adicional 388,6 ms. No son garantías ni una clase completa. `informes/fase4.md` documenta también dos intentos previos fallidos del harness, sus correcciones y una descarga redundante a la caché global; el harness final conserva el scope de paquetes y no modifica settings personales.

El modo incorpora fotos persistentes desde Fase 5, sin prometer funciones futuras: researcher anclado/caché en Fase 6, `/fin`, `/progreso` y `registrar_progreso` en Fase 7. Por ahora, un cierre se resume en chat/log sin editar YAML de progreso. El md-log manual ahora pide confirmación para rellenar una nota no vacía; el vínculo de curso nunca la reemplaza.

## Fotos persistentes — Fase 5

Mismo `uv sync --locked`, sin dependencias nuevas ni comando propio de transferencia. El pegado real de pi puede enviar sólo una **ruta en un bloque de texto**, que el modelo abre con `read`, no un bloque `image`: el logger admite ambos. Copia rutas explícitas de imagen por línea (absolutas, `./`, `../`, `~/` o `@`, con comillas si hay espacios) y las rutas nativas `pi-clipboard-<UUID>` insertadas dentro de una respuesta; no captura menciones genéricas en prosa ni imágenes de resultados de herramientas. La fuente se abre sólo para lectura, sin seguir symlinks y verificando archivo regular. Después de `/reload`, cualquier imagen del usuario recibida por pi con un log vinculado se copia a `adjuntos/` junto a la nota, incluidos mensajes sin texto. En el curso es `cursos/<curso>/sesiones/adjuntos/`; `/estudiar` ya vincula el log. Se conservan PNG/JPEG/WebP/GIF y su orden, con nombre de timestamp, posición y SHA-256. Los embeds dentro del vault usan su ruta desde el vault.

La misma ruta se usa al recuperar historial; reutiliza sólo copias idénticas y preserva cambios manuales. No sigue symlinks en adjuntos ni reemplaza archivos. Los nuevos archivos tienen permisos `0600` y los directorios nuevos `0700`; no se cambian permisos preexistentes. Un fallo deja aviso en el log/UI, sin perder texto ni las demás fotos. No hay limpieza automática de copias parciales o temporales nativos de pi.

El protocolo transcribe antes de corregir, conserva errores/unidades/tachaduras y espera aclaración de los datos necesarios ilegibles. Corrige con el contrato y sólo da puntaje con escala aplicable. No se escribe progreso todavía.

Prueba opcional, **dos turnos del modelo principal**, sin respuestas reales del alumno:

```bash
node .pi/scripts/probar-fotos
```

Usa una foto manuscrita pública de Wikimedia Commons (FlexingCA, CC0), **de finanzas y ajena a Redes**, no una muestra simulada ni material añadido al curso. Si falta, descarga sólo ese JPEG y exige el SHA documentado. Recorta/oculta un dato para el caso negativo con Pillow 13.0.0 (ya instalado por OCR), luego envía el original completo. El modelo pide aclaración y después transcribe/corrige según la pauta general de justificación, sin inventar escala. Reapertura, dos embeds y bytes idénticos a los mensajes comprobados. Evidencia, procedencia e incidente del harness: `informes/fase5.md`. Log visible: `informes/fase5/prueba-1792607375280.md`.

**Manual pendiente:** el ensayo SDK no certifica Ctrl+V físico dentro de tmux ni render en Obsidian. No se cambió el portapapeles personal. Para probar sin hacer una clase, abrí una sesión nueva de pi dentro de tmux, vinculá la nota vacía preparada con `/md-log informes/fase5/prueba-manual.md`, pegá una imagen como imagen con Ctrl+V en el editor normal y enviá «Prueba técnica: transcribí esta foto, sin registrar progreso». En pi 1.3.0 puede aparecer una ruta temporal antes del envío. Abrí esa nota en Obsidian y comprobá la foto; `/md-unlog` al terminar. Si la nota ya tiene contenido, creá otra vacía: no la rellenes otra vez. No uses `prueba-base.md`.

Las imágenes y JSONL quedan locales, fuera del Git de `.pi/`. Pueden contener datos personales y metadatos: evitá información sensible innecesaria. El usuario sigue encargándose del paso celular → PC. No se verificó todavía una respuesta manuscrita real de Redes ni una rúbrica detallada inexistente.

## Comprobaciones y checkpoint

```bash
node --test .pi/tests/*.test.mjs
.pi/scripts/doctor
# Sin red ni gasto de modelos; las pruebas omitidas quedan explícitamente pendientes:
.pi/scripts/doctor --sin-red
```

El diagnóstico carga las extensiones locales con confianza solo para su propio proceso, sin modificar `trust.json`. No envía un prompt de enseñanza ni lee el portapapeles. Por defecto ejecuta dos pings de hasta 64 tokens (uno con un PNG sintético), una búsqueda y una lectura web. No envía material del curso a modelos o proveedores web. Desde Fase 5 prueba además el guardado/embed de un PNG sintético en una carpeta temporal propia, sin LLM y sin leer el portapapeles.

Resultado automático actual, tras corregir el pegado nativo: **60 tests Node sin LLM en verde**, incluida una suite de **56 tests Python**. Doctor valida ambas entradas de foto (ruta y bloque `image`), modelos y web, pero **no está completamente verde**: el único fallo es pi `1.4.0` frente al pin `1.3.0`. El diagnóstico comprueba la instalación de uso diario; no exige los entornos ML experimentales ni confunde la aprobación humana de calidad con una dependencia rota. El lanzador se comprobó además con un pseudoterminal real ejecutando `pi-learn --version`.

### Prueba del researcher real (opcional, con LLM y red)

```bash
.pi/scripts/probar-researcher
```

Ejecutar solo dentro de tmux. Abre un panel de researcher real, comprueba búsqueda y lectura web en el hijo y la entrega automática al padre. Usa una sesión temporal independiente, no modifica `prueba-base.md` y tiene un plazo de 180 segundos. Se mantiene fuera de la suite sin LLM. La primera ejecución aprobada tardó 17 segundos; no garantiza ese tiempo en otras ejecuciones.

### Prueba manual: smoke aceptado; recorrido completo opcional

El usuario aceptó la prueba técnica parcial para cerrar Fase 0. La lista siguiente queda como referencia para repetir un recorrido completo, no como evidencia de que ya se haya realizado.

`prueba-base.md` ya contiene material del usuario: **no volver a vincularla para rellenar el historial**, porque eso podría reemplazar su contenido. Para una nueva prueba, crear una nota vacía distinta.

1. En fish, `cd ~/Projects/pi-learning` y `pi-learn`; aceptar la confianza del proyecto si se solicita.
2. Abrir la nota nueva vacía en Obsidian. **No vincular una nota con material personal:** el md-log original rellena y reemplaza su contenido al vincular.
3. Ejecutar `/md-log <nombre-de-la-nota-nueva>.md`.
4. Ejecutar `/skill:teach regla de la cadena` y completar el flujo: quiz, objetivo, researcher, aprobación del plan, explicación y verificaciones.
5. Comprobar que el researcher abre un panel de tmux, busca y lee fuentes, y entrega un resultado en español al padre.
6. Copiar una imagen al portapapeles y pegarla con Ctrl+V **dentro de esa sesión**. Comprobar que pi muestra el adjunto y el modelo lo recibe. Desde Fase 5 se espera además la copia en `adjuntos/` y su embed; esta comprobación física sigue pendiente.
7. Verificar en Obsidian el log de texto y los quizzes; `/md-unlog` al terminar.
8. Correr `doctor` desde otra terminal dentro de tmux, o pedir a pi que ejecute `.pi/scripts/doctor`.

La Fase 0 se cierra con la aceptación explícita del smoke técnico, los tests y el doctor en verde, mediante un único commit en `.pi/`. La base de Fase 1 fue aprobada explícitamente y se cierra con un único commit. La Fase 2 fue aprobada explícitamente con «Fase 2 aprobada, continuá», aceptando el checkpoint con problemas escaneados reales externos y sus límites declarados; se cierra con un único commit tras repetir tests y doctor en verde. No se declara probado un parcial manuscrito ni se usó una muestra digital rasterizada como sustituto. Fase 3 aprobada con «Aprobado; continuá», propuesta aplicada y chequeos repetidos para su único commit. La aprobación no modifica la revisión humana pendiente de las transcripciones y no equivale a aprobar Fase 4 por adelantado. Fase 4 aprobada explícitamente con «Aprobado; continuá», sin convertir los mensajes repetidos en varias autorizaciones. Fase 5 tiene checkpoint técnico listo con límites y comprobaciones manuales pendientes; se espera su OK antes de Fase 6.
