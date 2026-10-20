# Instalación reproducible — Fases 0 y 1

**Estado:** Fase 0 aceptada por el usuario (opción «1») con el smoke técnico de preguntas, quiz, log e imagen, más la prueba independiente del researcher real. Los 11 tests y el diagnóstico automático se repitieron en verde dentro de tmux para el commit de cierre. La lección quedó en el probe; no se afirma que se haya completado. Ver `informes/verificacion-base.md`. El usuario aprobó después la base de Fase 1 con «aprobado, sigamos», conociendo las limitaciones del informe, y autorizó Fase 2. El parcial escaneado real sigue sin evaluarse; no se declara cumplido ese caso.

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

El guardado de imágenes en el log se implementa en Fase 5; no está listo en el md-log original.

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

No hay todavía `/curso-nuevo`, `/curso-estado` ni `/estudiar`: corresponden a fases posteriores. Los ensayos de marker, docling y visión están separados en [`scripts/ingesta/benchmark/`](scripts/ingesta/benchmark/README.md); **no es necesario restaurarlos para usar la ingesta**.

## Comprobaciones y checkpoint

```bash
node --test .pi/tests/*.test.mjs
.pi/scripts/doctor
# Sin red ni gasto de modelos; las pruebas omitidas quedan explícitamente pendientes:
.pi/scripts/doctor --sin-red
```

El diagnóstico carga las extensiones locales con confianza solo para su propio proceso, sin modificar `trust.json`. No envía un prompt de enseñanza ni lee el portapapeles. Por defecto ejecuta dos pings de hasta 64 tokens (uno con un PNG sintético), una búsqueda y una lectura web. No consulta material privado del curso.

Resultado automático de Fase 1: **18 tests Node sin LLM en verde**, incluida una suite de **20 tests Python**, y **`doctor` completamente en verde dentro de tmux**, con pings reales de `gpt-6-luna` y pruebas web. El diagnóstico comprueba la instalación de uso diario; no exige los entornos ML experimentales ni confunde la aprobación humana de calidad con una dependencia rota. El lanzador se comprobó además con un pseudoterminal real ejecutando `pi-learn --version`.

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
6. Copiar una imagen al portapapeles y pegarla con Ctrl+V **dentro de esa sesión**. Comprobar que pi muestra el adjunto y el modelo lo recibe. No se espera todavía que md-log guarde la foto.
7. Verificar en Obsidian el log de texto y los quizzes; `/md-unlog` al terminar.
8. Correr `doctor` desde otra terminal dentro de tmux, o pedir a pi que ejecute `.pi/scripts/doctor`.

La Fase 0 se cierra con la aceptación explícita del smoke técnico, los tests y el doctor en verde, mediante un único commit en `.pi/`. La base de Fase 1 fue aprobada explícitamente y se cierra con un único commit. La Fase 2 está autorizada; su prueba con un parcial escaneado real sigue pendiente. La autorización de cierre no implica aceptar una muestra rasterizada en reemplazo de un parcial escaneado real.
