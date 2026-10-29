# Instalación reproducible — Fases 0 a 8 (piloto en curso)

**Estado:** Fases 0–4 aprobadas y cerradas (`79b1976`, `352c249`, `6409acd`, `3616e71`, `c757542`). Fase 5 aprobada con «Confirmado, avanzá», tras verificar la foto recuperada en Obsidian (`98f642a`, corrección `53a7476`). Fase 6 aprobada con «Aprobado, continuá» (`f9aeea7`). Fase 7 aprobada con «Aprobado, continuá» (`29cdb0c`): progreso persistente, cierre y reconstrucción confirmada. Fase 8 (piloto humano) en curso; seguimiento en `../fricciones.md`. El 2026-10-22 se auditó el sistema (`../AUDITORIA.md`) y se integraron en la rama `cursos` tres etapas de arreglos: entorno, ingesta, cursos, progreso, quiz, researcher, sesión, presentación y preparación por tema; después, pedagogía (modo-curso, objetivo y plan guardados, ítem reservado y `/simulacro`) y remates de integración; y, tras la primera prueba de punta a punta con el modelo real, el selector en español, la página mostrada en la nota, la fidelidad a la bibliografía, la reserva sin casi copias y los cortes de turno. Historial y límites en `informes/fase1.md` a `informes/fase7.md` y `DECISIONES.md`.

**Base actual: pi 1.4.0.** La instalación administrada ya se había actualizado al probar Fase 5. En Fase 6 se verificaron docs/declaraciones/ejemplos instalados, tests y runtime real, y se adoptó esa versión exacta en doctor y esta guía. No se reinstaló ni degradó pi, ni se cambió la configuración personal. La base original fue 1.3.0; los informes de esas fases conservan su versión histórica. Doctor avisa si pi no es 1.4.0.

Actualizar entre semestres, no en semana de parciales.

## Versiones fijadas / verificadas

| Componente | Versión |
|---|---|
| pi | `1.4.0` (instalación administrada existente; verificada en Fase 6) |
| Node.js / npm | `26.1.0` / `11.13.0` |
| learn (fork) | `7cfd8942f82ab9476e63572387e1fe9bcea5082c` |
| pi-interactive-subagents | `3.7.2`, commit `c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7` |
| pi-web-access | `0.42.0`; árbol transitivo en `npm/package-lock.json` |
| tmux | `3.8` (paquete `3.8-1.1`) |
| fish | `4.9.3` (paquete `4.9.3-1`) |
| wl-clipboard | `2.3.0` (paquete `1:2.3.0-1.1`) |
| coreutils | `9.12` (paquete `9.12-2.1`); `timeout` ya no hace falta: el researcher lo corta `scripts/vigilante.mjs` (DA39) |
| ImageMagick (opcional) | `7.1.2-34`, con libheif `1.23.6` |
| Poppler | `26.10.0` (paquete `26.10.0-1.1`); sólo para inventarios manuales, el código no lo usa |
| Git | `2.56.0` |
| uv | `0.13.5` (paquete `0.13.5-1.1`) |
| Python de ingesta | `3.13.13` gestionado por uv, entorno `.pi/.venv` |
| PyMuPDF / OCRmyPDF / wordfreq | `1.28.2` / `17.13.0` / `3.1.1`; transitivas en `scripts/ingesta/uv.lock` |
| PyYAML (Fase 2: ítems) | `6.0.3`; transitivas en el mismo `uv.lock` |
| Pillow (fixture opcional de Fase 5) | `13.0.0`, transitiva de OCR, fijada en `uv.lock`; no se usa en el logger |
| Tesseract utilizado | `5.5.2`, Conda `h1f36d38_0`, con `spa` y `eng`, fijado con `ruta_tesseract` |
| Ghostscript | `10.08.0`, paquete `10.08.0-1.1` |

Las dependencias Python están aisladas en `.pi/.venv`; los ensayos ML no son dependencias de uso diario. Las herramientas de visualización originales no se modificaron: los mapas Mermaid del skill se renderizan directamente en Obsidian. No se instalaron todavía las dependencias opcionales para generar PNG de Mermaid.

Si hace falta una instalación nueva de pi, el comando npm con versión exacta es:

```bash
npm install --global --ignore-scripts @earendil-works/pi-coding-agent@1.4.0
pi --version
```

No lo ejecutes sobre esta instalación administrada sin planificar la migración. Para instalaciones npm, `doctor` puede necesitar `PI_LEARN_PI_MODULE` apuntando a la ruta absoluta de `@earendil-works/pi-coding-agent/dist/index.js`. En esta máquina lo localiza automáticamente leyendo `~/.pi/agent/install/current-version`.

## Dependencias globales

Viven fuera de `.pi/` y el proyecto no las instala. El doctor comprueba todas salvo ImageMagick; de uv, sólo el Python del venv.

| Dependencia | Para qué | Si falta |
|---|---|---|
| pi `1.4.0` en `~/.pi/agent` | todo | doctor falla; con otra versión avisa con «!» y no lo cuenta como falla |
| Node.js `26.1.0` | doctor, tests y ensayos | no corren |
| fish | `pi-learn` y el shell de tmux (`config/tmux.conf`) | no hay lanzador |
| tmux | `pi-learn` (una sesión por carpeta) y los paneles de los subagentes: los de `visualize` y el researcher de `teach` fuera de un curso. La app no lo necesita: abre los subagentes en sus propios paneles (DA45) | `pi-learn` dice «Falta tmux. Instalalo antes de usar pi-learn.» |
| `wl-paste` (Wayland) o `xclip` (X11) | pegar fotos con Ctrl+V en la terminal (en la app se pegan solas) | Ctrl+V no pega la foto: guardala y escribí su ruta en el mensaje |
| Git Bash (sólo Windows, viene con Git for Windows) | la herramienta bash de pi y los paneles de los subagentes en la app | el doctor lo marca; pi no puede correr comandos |
| Chrome, Chromium o Edge | los diagramas de `visualize` (DA46); Windows 11 trae Edge | el doctor avisa con «!»; los diagramas no se dibujan y el resto anda |
| uv y su Python `3.13.13` | `.pi/.venv` | sin ese Python el venv no arranca: fallan la ingesta, la preparación por tema y el progreso, y la clase sigue con la última carga del curso (ver Fase 4); receta abajo |
| Tesseract con `spa` y `eng` | OCR de páginas escaneadas | sólo esas páginas fallan y quedan pendientes |
| ImageMagick (`magick`, con libheif) | fotos HEIC y BMP en la nota | pi avisa en una línea que la mandes en JPEG o PNG, y la nota marca «Imagen N no guardada» |

**El venv.** `.pi/.venv` usa el Python `3.13.13` que gestiona uv (`~/.local/share/uv/python/cpython-3.13.13-linux-x86_64-gnu`), no el de Conda; el entorno anterior, ligado a Conda, quedó en `.pi/.venv.conda-bak`. Para recrearlo, desde la raíz del vault (bash o fish):

```bash
UV_PROJECT_ENVIRONMENT="$PWD/.pi/.venv" uv sync --project .pi/scripts/ingesta --python 3.13.13 --python-preference only-managed --locked
.pi/.venv/bin/python .pi/scripts/ingesta/comprobar.py
```

La ruta tiene que ser absoluta: con `UV_PROJECT_ENVIRONMENT=.pi/.venv`, uv la resuelve desde `--project` y crea el entorno en `.pi/scripts/ingesta/.pi/.venv`. El doctor y `comprobar.py` imprimen la misma receta con `$PWD`; copiala desde la raíz del vault.

**Tesseract.** La clave opcional `ruta_tesseract` de `curso.config.json` fija el ejecutable (acepta `~`). Su carpeta se antepone al `PATH` de OCRmyPDF y de la comprobación de idiomas. Hoy vale `~/miniconda3/bin/tesseract` (5.5.2, con `spa` y `eng`); el `/usr/bin/tesseract` del sistema (5.5.3) sólo trae `eng` y `osd`. Comprobar:

```bash
~/miniconda3/bin/tesseract --version
~/miniconda3/bin/tesseract --list-langs
```

Sólo si falta, puede restaurarse en un entorno separado, sin modificar Conda base, y apuntar `ruta_tesseract` a `~/.cache/pi-learning/ocr/bin/tesseract`:

```bash
conda create --prefix "$HOME/.cache/pi-learning/ocr" --channel conda-forge 'tesseract=5.5.2=h1f36d38_0'
```

Paquete oficial observado: `https://conda.anaconda.org/conda-forge/linux-64/tesseract-5.5.2-h1f36d38_0.conda`, SHA-256 `67125e3aa53a069c1cd5b17ff2b9cb66019b8bc8615a45c456dbd9093721ebd6`. La restauración alternativa no se ejecutó: ya estaba instalado.

**Paquetes y skills personales.** `~/.pi/agent/settings.json` carga el paquete `ponytail`, ajeno al tutor. `.pi/settings.json` lo neutraliza sólo en este proyecto, sin tocar `~/.pi` (ver «Settings del proyecto»). Si algún día lo quitás de `~/.pi/agent/settings.json`, borrá también su entrada de `.pi/settings.json`: sin la entrada personal, pi la toma como paquete del proyecto e intenta clonarlo en `.pi/git` al arrancar, lo que necesita red. Las skills globales se evitan sólo abriendo con `pi-learn` (`-ns`); `pi` a secas las carga.

**Red en el primer arranque.** Los paquetes fijados (`.pi/git/…` y `.pi/npm/node_modules`) no se versionan. Si faltan, pi intenta instalarlos al arrancar. `pi-learn` lo detecta, avisa y abre pi con `PI_OFFLINE=1`, sin subagentes ni web; reinstalalos con los comandos de «Paquetes pi».

## Base Git

**Solo para un directorio nuevo**; no sobreescribir `.pi/`:

```bash
cd ~/Projects/pi-learning
git clone -b cursos https://github.com/santi-esquerre/learn .pi
git -C .pi remote add upstream https://github.com/amosblomqvist/learn
git -C .pi remote -v
```

`origin` es el fork del usuario: `cursos` es la rama de trabajo del modo curso y `main` la sigue. `upstream` es la herramienta original. La base inspeccionada de ambos fue `7cfd8942f82ab9476e63572387e1fe9bcea5082c`. `skills/teach/SKILL.md` permanece intacto.

## Paquetes pi, solo en este proyecto

Desde la raíz del vault:

```bash
pi install --local --approve git:github.com/amosblomqvist/pi-interactive-subagents@c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7
pi install --local --approve npm:pi-web-access@0.42.0
npm ci --ignore-scripts --prefix .pi/npm
PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --ignore-scripts --prefix .pi/extensions/visual-tools
pi list --approve
.pi/scripts/instalar-config
```

El segundo `npm ci` instala mermaid-cli para los diagramas de `visualize`, que dibujan con el Chrome, Chromium o Edge del sistema, sin bajar otro navegador (DA46). En Windows, con PowerShell: `$env:PUPPETEER_SKIP_DOWNLOAD=1; npm ci --omit=dev --ignore-scripts --prefix .pi/extensions/visual-tools`.

El `npm ci` restaura el árbol exacto del lockfile versionado. Pi genera inicialmente un rango con `^` en `npm/package.json`; en este proyecto se lo fijó a `0.42.0`. No actualizarlo incidentalmente al reinstalar.

`--approve` autoriza la carga para ese proceso, no guarda una decisión global. En el primer inicio interactivo, **pi pedirá confiar en el proyecto**. Revisá y aceptá para cargar `.pi/`; `/trust` permite guardar la decisión.

`instalar-config` es idempotente: instala `config/fish/pi-learn.fish` en `~/.config/fish/functions/` y `config/web-search.json` donde lo lee pi-web-access. Crea archivos ausentes y rechaza cualquier archivo existente con contenido distinto: no reemplaza configuraciones personales.

### Settings del proyecto

`.pi/settings.json` fija el modelo principal (`openai-codex/gpt-6.1-sol`), `hideThinkingBlock: true` y los paquetes: los dos de arriba y esta entrada, que apaga ponytail sólo acá:

```json
{ "source": "git:github.com/DietrichGebert/ponytail", "autoload": false, "extensions": ["!**"], "skills": ["!**"] }
```

Con `autoload: false`, pi toma la entrada del proyecto como filtro sobre la personal: ponytail no aporta extensiones ni skills. El doctor lo comprueba en «Prompt del tutor» (sin secciones ajenas) y «Skills de cursos» (`teach`, `curso-nuevo` y `curso-agregar`, sin nombres repetidos). Todo `.pi/settings.json` rige sólo con el proyecto confiado: sin confianza, pi no lo lee.

El tutor razona con thinking `medium`, el valor por defecto de pi 1.4.0: ni `.pi/settings.json` ni `~/.pi/agent/settings.json` lo cambian. El bloque de thinking queda oculto y la etiqueta dice «Pensando…».

## Búsqueda y lectura web

Se eligió `pi-web-access@0.42.0`, con:

- Exa MCP sin clave como primera opción; Parallel MCP y DuckDuckGo como respaldo.
- Lectura HTTP directa; el nombre público `fetch_content` se configura como `web_fetch`.
- Herramientas activas desde el inicio. Los subagentes de pi-interactive-subagents las reciben por el puente `extensions/web-subagentes.ts`; el researcher del curso carga pi-web-access directamente (ver Fase 6).
- Sin cookies del navegador, navegador automático, resúmenes LLM, clonación GitHub, procesamiento PDF ni lectura de videos.
- Sin servicios de extracción HTTP alojados por terceros.

La configuración reproducible está en `config/web-search.json`. En esta sesión, `XDG_CONFIG_HOME=~/.config`, así que se instaló en `~/.config/pi/web-search.json`. Con `PI_CODING_AGENT_DIR`, se usa ese directorio; sin XDG, se usa `~/.pi/agent`. El instalador respeta también la precedencia de archivos heredados documentada por el paquete. El renombre `toolNames.fetchContent: "web_fetch"` es imprescindible: sin él la tool se llama `fetch_content` y el researcher, que filtra sus tools por nombre, queda sin leer páginas y sin aviso. El doctor lo comprueba («web_fetch del researcher»).

No fue necesario crear cuentas ni guardar claves. Las consultas salen hacia el proveedor que atienda la búsqueda; los respaldos también reciben la consulta si se utilizan. Los endpoints sin clave tienen límites de uso y no ofrecen una garantía de disponibilidad permanente. Si en el futuro se agregan `EXA_API_KEY` o `PARALLEL_API_KEY`, esos proveedores pueden pasar a consumir cuotas/créditos de esas cuentas: revisar antes la configuración.

`safe_bash` viene con los subagentes, no con pi ni con learn, y el researcher ya no lo usa (`agents/researcher.md` lista `web_search, web_fetch, read`). Su filtro de órdenes no es un sandbox de seguridad del sistema operativo.

## Modelos configurados y verificados

Por elección explícita del usuario:

- principal (tutor): `openai-codex/gpt-6.1-sol`, en `.pi/settings.json`;
- researcher: `openai-codex/gpt-6-luna`, thinking `medium` (frontmatter de `agents/researcher.md`);
- visión, segmentación y clasificación de ítems: `openai-codex/gpt-6-luna` (`modelo_vision` de `curso.config.json`).

**Con otra clave (DA58):** si uno de estos modelos no tiene credenciales en la máquina, se usa el de la conversación. pi lo elige solo entre los que tienen credenciales. Vale para la visión (si acepta imágenes), el researcher y los subagentes, y el doctor dice cuál se usa en cada rol. `curso.config.local.json` (o *Ajustes* en la app) fija otro por máquina.

El frontmatter de `agents/researcher.md` coincide con `curso.config.json`; el doctor lo comprueba. En Fase 7 el usuario autorizó «Usar openai-codex» al comprobar que `openai` ya no tenía credenciales configuradas. Antes de cambiar el proyecto respondieron Sol por texto y Luna por texto/PNG; doctor repitió los dos pings de Luna correctamente. Sólo cambiaron archivos del proyecto, sin claves nuevas, login ni preferencias personales. Los informes anteriores conservan el proveedor histórico `openai`.

Esto confirma disponibilidad y aceptación de imágenes, **no** la fidelidad del OCR matemático. En Fase 1 se transcribieron tres páginas con Luna solo como referencia del benchmark; todavía requieren revisión. Ver `informes/fase1.md`.

La primera propuesta (`gpt-5.4-mini` / `gpt-5.5`) había fallado con HTTP 400 porque esta cuenta ChatGPT/Codex no admite esos ids, pese a figurar en el catálogo. Se conserva el antecedente en `DECISIONES.md`: aparecer en `/model` no prueba el acceso real.

No hay proveedor de respaldo. Si un turno de una clase termina en error del proveedor, pi muestra su error en inglés y el curso agrega una línea en español con la causa probable (disco lleno, cuota o límite de uso, credenciales, red u otro error) y sugiere escribir «seguí» para reintentar o /fin para guardar. Las claves, si se necesitan, se ingresan mediante `/login`, nunca en el chat ni en archivos versionados.

## Lanzador fish: `pi-learn`

Instalado en `~/.config/fish/functions/pi-learn.fish`; copia versionada en `config/fish/pi-learn.fish` (el doctor exige que sean iguales). No se cambió `config.fish` ni la configuración personal de tmux.

```fish
cd ~/Projects/pi-learning
pi-learn
# También admite los argumentos nativos de pi:
pi-learn --resume
pi-learn -c
```

- Conserva **la carpeta actual**, sin cambiarla al vault.
- Abre `pi <argumentos> -ns --skill ~/Projects/pi-learning/.pi/skills`: el tutor ve sólo las skills del proyecto. Los subcomandos de pi (`install`, `remove`, `uninstall`, `update`, `list`, `config`, `mcp`, `auth`) pasan sin agregados.
- Fuera de tmux usa el servidor separado `pi-learn` con `config/tmux.conf` y una sesión por carpeta, `pi-learn-<hash>`. Si ya hay un pi abierto en esa carpeta, se adjunta a él en vez de abrir otro; si le pasaste argumentos, avisa que no los usa (el aviso se lee al salir de tmux).
- Cerrar la ventana termina pi, igual que un kill (`destroy-unattached`). También lo termina cualquier cosa que deje la sesión sin cliente: prefijo+d, crear otra sesión o cambiar de sesión con los atajos de `~/.config/tmux/tmux.conf`, que `config/tmux.conf` carga. Para retomar, `pi-learn -c`.
- Dentro de tmux ejecuta pi directamente: no anida tmux ni altera sus opciones globales.
- `config/tmux.conf` importa las preferencias personales y habilita passthrough, portapapeles y teclas extendidas; conserva el entorno Wayland para `wl-paste`.
- Da 300 ms al shell de cada subagente de pi-interactive-subagents antes de enviarle la orden (`PI_SUBAGENT_SHELL_READY_DELAY_MS`, que respeta si ya está definido). No afecta al researcher del curso.
- Si faltan los paquetes fijados, avisa y abre pi con `PI_OFFLINE=1`, sin investigador ni web.

Para tomar una versión nueva del lanzador (`instalar-config` no pisa una copia distinta), sin clase en curso y desde la raíz del vault:

```fish
cp .pi/config/fish/pi-learn.fish ~/.config/fish/functions/pi-learn.fish
tmux -L pi-learn kill-server
source ~/.config/fish/functions/pi-learn.fish
```

`kill-server` cierra el servidor viejo (si no hay ninguno, da un «error connecting» inofensivo); `source` hace falta sólo si esa shell ya conocía otra definición.

## La app de escritorio (Windows y Linux)

`app/` es una interfaz gráfica para todo lo anterior: se usa sin comandos y la terminal sigue igual (DA44). Corre la misma pi 1.4.0 y el mismo `.pi/` del vault. Detalle, capturas y pruebas en `informes/interfaz.md`.

- **Instaladores:** `npm run empaquetar` dentro de `app/` arma `dist/learn-<versión>-instalador-windows.exe` (NSIS) en Windows y `dist/learn-<versión>-linux.AppImage` en Linux. No están firmados: Windows muestra el aviso de SmartScreen la primera vez. En una distro con espacios de nombres sin privilegios restringidos (Ubuntu 24.04), el AppImage se abre con `--no-sandbox`; en Arch no hace falta.
- **Desarrollo:** `cd .pi/app && npm ci && npm run dev`. Pruebas: `npm test` (host y lógica) y `npm run e2e` (Electron real con el proveedor falso de pi-ai; necesita el curso de demostración de `app/e2e/curso_demo.py`).
- **Primera vez:** la app abre «Preparar la computadora», que corre este mismo doctor y tiene un botón para cada faltante (en Windows instala con winget, y Tesseract con micromamba en la carpeta del usuario, sin permisos de administrador). Pide confiar en la carpeta como pi la primera vez.
- **Lo que necesita:** Node.js `>=22.19.0` (el piso de pi 1.4.0) y pi 1.4.0 instalada para la terminal. La app usa ese mismo Node para correr pi.
- **Subagentes:** la app los abre en paneles propios, sin tmux. Hasta que `pi-interactive-subagents` traiga esa superficie, la app la agrega al checkout instalado en `.pi/git/` cada vez que abre (`app/subagentes/aplicar.mjs`, reversible con `--quitar`). En la terminal no cambia nada (DA45).

## Windows

learn corre en Windows con los mismos tests en verde que en Linux (DA39–DA41). Diferencias con la receta de arriba:

- **Instalación:** Node.js, Git for Windows (trae Git Bash, que pi necesita), uv y pi con `npm install -g --ignore-scripts @earendil-works/pi-coding-agent@1.4.0`. Clonar con `git -c core.autocrlf=false clone -b cursos …`: el repo fuerza LF con `.gitattributes`, pero un clon con `autocrlf` previo puede traer CRLF.
- **Sin `pi-learn`:** fish y tmux no aplican. Se abre con la app, o en una terminal con `pi -ns --skill .pi/skills` desde la raíz del vault.
- **El venv:** `.pi/.venv/Scripts/python.exe`. Los textos que arma el código ya usan esa ruta. Los fijos (`CURSOS.md`, este archivo) muestran la de Linux; fuera de una clase, el prompt le dice al modelo cuál es la de esta máquina (DA57).
- **Tesseract:** el de conda-forge (`micromamba create -p <carpeta> -c conda-forge tesseract=5.5.2 ghostscript libcurl`) más los modelos `spa`, `eng` y `osd` de `tessdata_fast`. Su ruta va en `curso.config.local.json` (`ruta_tesseract`), no en el `curso.config.json` versionado (DA40). La app lo hace sola desde «Preparar la computadora».
- **Carpeta del vault:** conviene una local (por ejemplo `C:\Users\<vos>\pi-learning`) y no una sincronizada con OneDrive, por los enlaces y bloqueos de archivos de la ingesta.

## Obsidian e imágenes

Se creó `.obsidian/app.json` con `userIgnoreFilters: ["_procesado"]` cuando Obsidian no estaba abierto y el archivo no existía. No se reemplazó configuración existente. En futuras modificaciones, cerrar Obsidian primero para que no reescriba el archivo al salir.

Abrí `~/Projects/pi-learning` como vault. Las citas usan `[[ruta/al.pdf#page=N]]`.

En Wayland, pi usa `wl-paste` (`wl-clipboard`); en X11 necesita `xclip`. Pegá las fotos con **Ctrl+V** dentro de pi; si el portapapeles no funciona, guardá la foto y escribí su ruta (absoluta, `./`, `../` o `~/`) sola en una línea del mensaje. No hay comando de transferencia de fotos. Durante una clase el tutor sólo abre PNG, JPEG, WebP y GIF fuera de `cursos/`: una foto HEIC llega a la nota, pero el tutor no la puede leer; mandala en JPEG.

Desde Fase 5, el md-log adaptado guarda las imágenes junto a la nota en `adjuntos/` y las embebe para Obsidian. El original de upstream no tenía ese guardado. Ver «Fotos persistentes» abajo.

Cada página que el tutor muestra con `ver_pagina` también queda en la nota: un bloque «Página mostrada» con el enlace al PDF y la imagen embebida desde su render, `cursos/<curso>/_procesado/<doc>/render/NNNN.png`. La misma página dos veces seguidas se anota una vez (se compara con el final de la nota: si se recreó o escribiste debajo, se vuelve a anotar); lo que `ver_pagina` rechaza no se anota. **Pendiente de confirmar en Obsidian** que el embed se ve, porque `_procesado` está en `userIgnoreFilters`.

## Ingesta base — Fase 1

Desde la raíz del vault, con el venv de «Dependencias globales»:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/comprobar.py
```

Se usan **PyMuPDF para digital/mixta** y **OCRmyPDF + Tesseract para escaneada**, sin GPU, Torch ni servidores. La ingesta base no usa modelos. El manifiesto solo necesita documentos y páginas; `config/muestras-fase1.json` es un ejemplo con 9 páginas. Los overrides de motor se conservan para el benchmark. Tesseract sólo se exige si hay páginas escaneadas; sin él, esas páginas quedan pendientes y se conservan las transcripciones de visión o manuales ya hechas.

### Procesar, consultar, reanudar y adoptar

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto .pi/config/muestras-fase1.json --salida _procesado/fase1/base-simple
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py estado --salida _procesado/fase1/base-simple
```

Repetir `iniciar` con los mismos argumentos reanuda/reutiliza la caché. `procesar` hace lo mismo en primer plano. Los dos procesan varias páginas a la vez: la mitad de los hilos de la máquina, y la mitad de eso en OCR, con prioridad baja. Los archivos que dejan son los mismos que de a una (DA50). `iniciar` espera unos 2 s: si el proceso muere al arrancar, sale con código 1 y el error. `estado` puede decir `iniciando`, `en_curso`, `completada`, `completada_con_pendientes`, `interrumpida` (cita la última línea de `proceso.log`) o `error`. El umbral, los idiomas y `ruta_tesseract` salen de `curso.config.json`; cambios de motor, versión, calidad, tipo o ruta de cita invalidan la caché correspondiente. Los originales solo se leen; si cambia un PDF se informa un conflicto en vez de borrar trabajo.

**Grabaciones de clase (DA51).** Un video o audio del curso se transcribe en la misma ingesta, con faster-whisper 1.2.1 (está en el venv; PyAV queda en 18.1.0 porque la 19 quitó un argumento que faster-whisper todavía usa). El modelo es `modelo_transcripcion` de `curso.config.json`, `large-v3-turbo` por defecto; una máquina puede elegir otro en `curso.config.local.json` (por ejemplo `large-v3`, más preciso y bastante más lento). Se descarga la primera vez, unos 1,6 GB, a la caché de Hugging Face (`~/.cache/huggingface`), o a la carpeta que diga `carpeta_modelos` en `curso.config.local.json` (por ejemplo, otro disco). Transcribe con el procesador (int8, la mitad de los hilos). Si hay una placa NVIDIA y están las bibliotecas de CUDA 12 y cuDNN 9, la usa sola; si no, sigue con el procesador sin avisar. Una grabación se parte en tramos de 5 minutos, cortados en el primer silencio desde cada minuto 5·k; `cursos.py inventario` da cuántos tiene. Nada de una grabación pasa por el modelo de visión.

Una página cuyo Markdown editaste a mano se preserva, no se indexa y aparece como `editada` en `estado` y en el informe. Para que cuente como transcripción revisada, adoptala:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py adoptar --salida cursos/<curso>/_procesado --doc <id> --pagina <n>
```

Queda como `manual` (revisión humana hecha) y ninguna ingesta ni visión la regenera.

Las salidas contienen metadatos, clasificación, Markdown por página, calidad, estructura, `busqueda.json`, estado e informe. Los fallos quedan por página. Los ejercicios, evaluaciones y soluciones quedan pendientes de visión aunque su texto parezca bueno. El índice BM25 de evaluaciones y ejercicios guarda sólo enunciados (corta desde «Solución», «Resolución», «Respuesta(s)» o «Rta.:»), y los documentos de soluciones no se indexan. Un puntaje alto no certifica las fórmulas ni las figuras.

Para revisar en Obsidian: **`informes/fase1/resumen.md`** e **`informes/fase1/ingesta-base.md`**. Como `_procesado` está excluido, una copia manual de otro informe puede publicarse sin pisar notas:

```bash
mkdir -p informes/fase1
cp -n _procesado/fase1/base-simple/informe-ingesta.md informes/fase1/ingesta-base.md
```

Los ensayos de marker, docling y visión están separados en [`scripts/ingesta/benchmark/`](scripts/ingesta/benchmark/README.md); **no es necesario restaurarlos para usar la ingesta**.

## Visión e ítems — Fase 2

Mismo venv; PyYAML `6.0.3` guarda `items.yaml`. No requiere GPU ni dependencias ML. Después de cambiar los archivos de la extensión, ejecutar `/reload` o abrir una sesión nueva para que pi registre las tools.

- `transcribir_paginas(curso, doc, paginas)` usa `modelo_vision`, renderiza las páginas ya ingeridas, guarda Markdown, actualiza BM25/informe y devuelve solo un resumen. Más de 50 páginas (`max_paginas_vision_sin_confirmar`) exige confirmación interactiva; sin UI se rechaza. La caché evita repetir llamadas vigentes y una página `manual` cuenta como caché; cambiar modelo, prompt o umbral puede invalidarla y consumir nuevamente. Sin credenciales del modelo de visión usa el de la conversación, si acepta imágenes (DA58). Si no, no llama y dice «… ejecutá /login.».
- `guardar_items(curso, doc, items)` guarda una segmentación: `{id, paginas, enunciado, solucion?: {doc, id}, solucion_de?, puntos?}`. Los ids conservan la numeración del documento. Una solución integrada en el mismo PDF es otro ítem con `solucion_de: '<id del enunciado>'`; `puntos` es el puntaje oficial (número ≥ 0 o texto de hasta 40 caracteres). Requiere páginas transcriptas, valida referencias y no pisa ediciones manuales.

Son tools de preparación, no comandos `/`. Desde la preparación por tema (Fase 3, abajo) ya no hace falta llamarlas a mano: sirven si querés preparar un documento antes de estudiarlo. Para repetir la prueba digital original sin crear otro curso:

```bash
# Opcional, con LLM: puede enviar tres páginas a Luna si no hay caché vigente.
node .pi/scripts/probar-vision
# Dos páginas de papel escaneado real, ya descargadas en _entrada/muestras/externas/limric-1895/.
# También puede consumir llamadas si la caché no está vigente.
node .pi/scripts/probar-vision --escaneo
```

Primera prueba real: 3/3 páginas transcritas; segunda: 3/3 en caché y ninguna llamada nueva. Se guardaron diez ejercicios, incluido el 7 en páginas 2–3. Informes visibles: `informes/fase2/resumen.md`, `transcripciones.md` e `items.md`. Los datos internos están en `_procesado/fase2/piloto-practico1/`.

Prueba externa: dos imágenes de papel escaneado de *Algebra elemental* (Limric, 1895), procedentes de Internet Archive / colección Library of Congress. El PDF de prueba contiene esos JPEG sin recomprimir y sin capa de texto; no deriva de un PDF digital rasterizado. Se cotejaron seis fracciones y ocho importes; quince ítems, incluido el 9 multipágina. Segunda ejecución con el prompt corregido: dos aciertos de caché y cero llamadas nuevas. Fuente, SHA-256, fallos iniciales y límites en `informes/verificacion-escaneo-fase2.json`; comparación visible en `informes/fase2/escaneo-real.md`.

Un error o cancelación conserva el texto previo; una página que ya era buena sólo queda marcada para reintentar. Las transcripciones incompletas se rechazan; `[ilegible]` queda pendiente. El prompt distingue moneda (`\$`) de LaTeX y un salto de página de contenido ilegible. `revision_humana: pendiente` no cambia automáticamente por tener puntaje alto. El usuario aprobó el checkpoint de Fase 2 con sus límites; esa aceptación global no modifica la revisión pendiente de páginas e ítems individuales.

## Crear y ampliar cursos — Fase 3

No agrega dependencias. Después de `/reload` o de abrir una sesión nueva:

```text
/curso-nuevo <slug>
/curso-agregar <slug> [archivos…]
/curso-check redes
/curso-estado redes
```

Los dos primeros invocan las skills `/skill:curso-nuevo` y `/skill:curso-agregar`. El agente selecciona material del curso y redacta una propuesta explícita, no importa toda la bandeja por defecto. La propuesta va en `_procesado/` de la raíz del vault. `guardar_curso(curso, propuesta)` valida/copia fuentes nuevas y, para un curso existente, muestra el diff completo y pide confirmación interactiva; sin UI rechaza la actualización. No hay bandera de autoaprobación, ni reemplazo de PDFs o progreso existente. Un curso nuevo se arma en `cursos/.<slug>.nuevo/` y recién completo pasa a `cursos/<slug>/`.

**Ingesta base completa al crear o ampliar.** Después de guardar, la skill ingiere sin modelo todas las páginas de todos los documentos:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py manifiesto --curso <slug> --todo
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto _procesado/manifiesto-<slug>.json --salida cursos/<slug>/_procesado
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py estado --salida cursos/<slug>/_procesado
```

Mientras corre, una barra sobre el editor muestra «⏳ Ingesta de <slug> [████░░…] N/M páginas · P% · <doc> p. N». Al terminar se limpia, avisa en una línea («Ingesta de <slug> terminada: …» o «La ingesta de <slug> se cortó…») y el agente retoma solo el armado; si se cortó, propone reanudar y no la relanza sin tu OK. Sobrevive a `/reload`, `/resume` y a un kill de pi, y sólo la ve la sesión que la lanzó (DA37). La caché saltea lo ya preparado. Mientras corre, la salida del curso queda bloqueada: `transcribir_paginas`, `guardar_items` e `informe` esperan hasta 5 s y fallan con «Ya hay una ingesta escribiendo en esta salida.», y la skill espera a que `estado` diga `completada` o `completada_con_pendientes`. El progreso, `/fin` y `ver_pagina` no usan ese bloqueo y siguen andando. `manifiesto --pendientes` (predeterminado) toma sólo las páginas referidas por el índice sin transcripción; `/curso-check` lo sugiere cuando `validar` encuentra páginas `sin_transcripcion`. `cruzar` es una ayuda de curación: busca las siglas y términos con guion de los objetivos e ítems de cada tema en su bibliografía.

**Preparación por tema, al estudiar.** Lo que necesita modelo se hace solo la primera vez que se estudia cada tema (o mientras su preparación siga incompleta), en segundo plano y sin pedir confirmación: la primera pregunta no espera. En orden:

1. transcribe con `modelo_vision` las páginas de la bibliografía del tema que siguen pendientes;
2. transcribe todas las páginas de los parciales y prácticos sin segmentar (sus preguntas pueden ser de cualquier tema);
3. segmenta cada uno en `items.yaml`, con soluciones integradas aparte (`solucion_de`) y `puntos`;
4. clasifica por tema los ítems que `indice.yaml` no asigna y los guarda en `cursos/<c>/_procesado/asignaciones.json`. El índice no se toca y manda.

Apenas están las páginas de la bibliografía del tema, el dossier se refresca. Formato y casos borde (ingesta base en curso, parcial editado a mano, marcador de solución) en [`scripts/ingesta/CURSOS.md`](scripts/ingesta/CURSOS.md), sección «Preparación por tema».

*Qué gasta.* Todo va a `modelo_vision`: una llamada por página (imagen + prompt, hasta 8000 tokens de salida), una por documento a segmentar (hasta 32000) y una por cada 40 ítems a clasificar (hasta 8000). Una segmentación o una clasificación inválida se reintenta una vez con el motivo y, si vuelve a fallar, espera 24 h o hasta que cambien sus entradas; la visión de una página no se reintenta. Un plazo vencido (3 min por página, 5 por segmentación o clasificación) cuenta como una falla de esa llamada y no corta la tanda. Red, cuota o credenciales cortan la tanda en la primera falla, sin más llamadas. Tope: 150 páginas por corrida; lo que queda sigue la próxima vez que se estudie un tema. Las páginas en caché o `manual` no se mandan. Un documento de tipo `soluciones` no se segmenta solo: se prepara con `/curso-agregar`. En el e2e de la rama `fix/preparacion` (49 páginas), la corrida tardó unos 12 min y el dossier dejó de decir «sin texto confiable» a las 9 páginas.

*Dónde se ve.* Sólo en la barra: «⏳ Preparando material de <tema>: N/M páginas», después «… ítems de <doc>» y «… clasificando ítems». Al terminar, completa o a medias, la barra se limpia sin aviso: el tutor recibe el resultado en un mensaje oculto, y `/curso-check` muestra si el tema quedó incompleto. Sólo avisa una falla que corta la tanda (sin credenciales, red, cuota o sin Python): «Preparación del material no disponible: <motivo>; seguimos con lo que hay.», y la clase sigue. La preparación se intenta una vez por clase, y otra vez si la retomás en un pi nuevo: mientras dure la falla, el aviso vuelve en cada una. Lo que ya falló en esa corrida queda en espera aunque después la red, la cuota o las credenciales corten la tanda. `cursos/<c>/_procesado/preparacion.json` guarda por tema el estado (`completa`/`incompleta`), las páginas pendientes y la huella del índice, y en `fallos` lo que espera. `/curso-check` suma una línea por tema: «Preparación de <tema>: sin preparar | completa | incompleta (…) | cambió el índice: se rehace al estudiarlo; N ítems asignados automáticamente.». El uso de visión de cada página queda en `cursos/<c>/_procesado/<doc>/calidad.json` (`vision.uso`); el de segmentar y clasificar no se registra en ningún archivo.

Formatos, seguridad y comandos locales: [`scripts/ingesta/CURSOS.md`](scripts/ingesta/CURSOS.md). El validador es de sólo lectura; `ok` sólo acredita estructura/referencias, y `listo_estudio` exige cero avisos. Documentos sin segmentar y temas sin preguntas de evaluaciones son avisos que la preparación por tema resuelve sola. El doctor valida cada curso y señala páginas pendientes sin fingir que su revisión humana es una dependencia faltante. `/curso-estado` muestra el estado de la ingesta (también el error, la interrupción y las páginas editadas) y actualiza su indicador al consultar, sin servicio de sondeo permanente.

El curso real está en `cursos/redes/`: **17 PDFs / 987 páginas, 8 temas**. El usuario aprobó la tabla y las tres diapositivas complementarias; la propuesta `_procesado/fase3/propuesta-redes-curada.json` se aplicó verificando sus huellas. Abrí `cursos/redes/revision-inicial.md` e `informe-ingesta.md` en Obsidian. Para ver qué falta preparar:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py validar --curso redes
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py informe --curso redes
```

El informe visible se regenera sólo si conserva su huella generada; si se editó manualmente, se preserva y se avisa. Los detalles de fuentes, resultados y límites están en `informes/fase3.md` y `informes/verificacion-fase3.json`. Las fuentes y enunciados reales permanecen fuera de Git. Los datos del curso no se restauran desde el commit del código: conservar el vault o volver a preparar los originales.

## Sesión de estudio — Fase 4

No agrega dependencias. Después de `/reload` o de abrir una sesión nueva con `pi-learn`:

```text
/cursos
/estudiar redes retardos
/estudiar redes
/estudiar retardos
/estudiar redes retardos desde-cero
/preguntas
```

**Elegir el tema.** El curso se reconoce sin mayúsculas ni tildes, y con un solo curso alcanza con el tema. El tema se busca por id, nombre o alias sin tildes, y después por parecido; ante varios candidatos aparece un selector. Si no coincide, BM25 busca la consulta en la bibliografía y propone los temas cuyo rango la contiene: si es uno solo, lo activa; si son varios, el selector suma la opción ad hoc. Si no cae en ningún rango, pasa a un modo ad hoc: elegís una de las secciones que encontró BM25 (o ninguna) y la clase no toca el índice ni el progreso; sólo crea su nota. Sin tema, el selector lista primero los temas en curso y para repasar, después los que tienen los prerequisitos dominados y al final los dominados. El autocompletado lista cursos y temas. Sin la carpeta `cursos/`, remite a `/curso-nuevo`.

**Antes de arrancar**, `/estudiar` comprueba que haya modelo elegido y credenciales («Sin credenciales para <proveedor>/<modelo>: ejecutá /login y repetí /estudiar.») y el disco: con menos de 200 MB libres no arranca y con menos de 1 GB avisa.

**Al arrancar** crea una nota nueva `cursos/<curso>/sesiones/<fecha local>-<tema>[-n].md`, la vincula con md-log, nombra la sesión `<Curso> · <Tema>` y dispara el primer turno: el tutor empieza con la primera pregunta, o con una línea de dónde quedaron si el tema ya se estudió. `modo-curso.md` le pide leer antes, en la misma tanda que `investigar_tema`, 2–3 páginas del comienzo de la bibliografía del tema, y después, antes de enseñar cada nodo, la página que lo define: el dossier lista cada rango como «leer_paginas <doc> PDF a–b · sección · título». Si md-log no confirma en 2 s, o falta permiso o disco, la clase sigue sin nota y avisa «No se pudo crear la nota de la clase en Obsidian[ (disco lleno)| (sin permiso para escribir en sesiones/)]; seguimos sin nota.». Las órdenes internas de `/estudiar`, `/fin`, `/simulacro` y del cambio de tema son mensajes ocultos: no se ven en el chat ni en la nota. Tras `/curso-agregar`, reactivá el tema para tomar la nueva curación.

**Modos y mezcla de preguntas (DA52).** Un modo al final de `/estudiar` cambia cómo se encara el tema: `desde-cero` (también «desde cero») repasa todo desde las bases, sin la lista de lo que ya vio y con objetivo y plan nuevos; `fortalecer` va a lo que el progreso registra como falla, errores abiertos y ejercicios fallados, y a sus bases. Sin modo, sigue donde quedó. El autocompletado lo sugiere tras un tema exacto. El modo queda en el estado de la clase, así que `pi-learn -c` lo conserva, y cambia la orden de arranque. La mezcla de preguntas (`automatico`, `solo-opcion`, `mas-opcion`, `mitad`, `mas-desarrollo` o `solo-desarrollo`) es `preguntas` en `curso.config.local.json`, por máquina; `/preguntas` la elige con un selector o por nombre (`/preguntas mitad`) y la app, en Ajustes → Cómo estudio. Automático, el predeterminado, no queda escrito. Las dos cosas llegan al tutor en una sección propia del prompt, «Esta clase», que se arma en cada turno y sólo cambia si cambian el modo o la mezcla: por eso una mezcla nueva vale desde la pregunta siguiente, sin romper la caché del prompt en cada turno. Cada pregunta respondida (`quiz` o `pregunta_desarrollo`) suma al resultado, sólo para el modelo, cuántas van en la clase y, con una mezcla fija, cuál toca después; esa línea no va a la nota ni a la app. Una clase de tema libre (`/skill:teach`) también recibe la mezcla y el conteo, sin modo. Con `curso.config.local.json` dañado o ausente vale automático.

**La pregunta de desarrollo** es la tool `pregunta_desarrollo` (en `extensions/quiz.ts`): `pregunta`, `detalles` opcionales y `respuesta_esperada` obligatoria. En la terminal abre una caja para escribir (Enter manda, Ctrl+J abre otro renglón, Tab va a «No sé», Esc cancela; Enter con la caja vacía no manda nada); en la app, una tarjeta con «Responder», «No sé» y «Prefiero responder en el chat». La respuesta esperada no aparece antes de responder: ni en la ventana, ni en la nota, ni en la línea de la llamada; después se ve junto a lo escrito, y al seguir el tutor corrige (bien, a medias o mal, qué está bien, qué falta y de qué nodo viene el error), sin exigir las palabras exactas. La nota anota «Desarrollo» con la pregunta y, al responder, «Desarrollo — tu respuesta» o «Desarrollo — No sé» con la respuesta esperada. Sin pregunta o sin respuesta esperada se descarta y el modelo vuelve a llamarla, como un quiz con menos de 3 opciones.

**La explicación antes de cada pregunta (DA52).** `quiz` y `pregunta_desarrollo` aceptan `clase`, la explicación que la pregunta verifica. Se muestra justo antes de la pregunta: en la terminal, en el historial y con el formato del texto del tutor; en la app, como texto del tutor con sus citas al margen; en la nota, como un bloque «PI». Una pregunta de verificación (la que no lleva `momento: "diagnostico"`) se muestra sólo si, desde la pregunta respondida anterior, hay al menos 120 caracteres visibles entre el texto de los mensajes y su `clase`. Si no, vuelve al modelo con el motivo y el alumno no la ve: la terminal muestra «(la pregunta vuelve después de la explicación)» en la línea de la llamada, y la app y la nota no la muestran. Frena una sola vez seguida: un reintento igual pasa. Después de cada respuesta de verificación, el resultado le recuerda al modelo que primero va la explicación. Motivo: en una clase real el tutor escribía la explicación en su razonamiento, que el alumno no ve.

**Durante la clase** sólo están activas las tools del curso: `quiz`, `pregunta_desarrollo`, `ask_user_question`, `buscar_material`, `leer_paginas`, `leer_items`, `ver_pagina`, `registrar_progreso`, `leer_sesion_anterior`, `investigar_tema` y `read`, que sólo abre fotos fuera de `cursos/`. No se cargan skills: `teach`, `modo-curso.md` y «Esta clase» van en el prompt, y mientras hay un curso activo `modo-curso.md` prevalece sobre `teach` en lo que regula, con sus conflictos explícitos (ver `DECISIONES.md`, DA7 y DA52); `visualize` no está disponible. Cada tool se ve en la terminal como una línea en español («Leí PDF 54–57 de kurose-7», «Progreso guardado»); el texto del material nunca se muestra. El quiz y las preguntas están en español, con «No sé» siempre al final; las confirmaciones (reconstruir el progreso, gasto de visión, reemplazar una nota con `/md-log`, guardar un curso existente) se eligen entre «Sí, <acción>» y «No», y Esc o un corte valen como no. En la terminal, esas confirmaciones y los selectores de `/estudiar` y `/simulacro` usan un selector propio, igual al de pi en aspecto y teclas, con la ayuda «↑↓ moverse  enter elegir  escape/ctrl+c cancelar»; fuera de la terminal (RPC, SDK) es el `ui.select` de pi. Antes del intento, las tools no devuelven soluciones ni la imagen de páginas de parciales; `leer_items` las da con `incluir_solucion` recién después. `/compact` resume en español con curso, tema, borde, práctica y próximo paso; en una clase corta pi lo rechaza con «Error: Compaction failed: Nothing to compact (session too small)» y debajo se suma «Todavía no hay nada para resumir; la clase sigue igual.». Al cerrar vuelve el set de tools anterior.

Quedan en inglés, porque los dibuja pi y una extensión no puede cambiarlos: los prefijos «Warning: » y «Error: » de los avisos de advertencia y de error (por ejemplo «Warning: Preparación del material no disponible: …» o «Error: Sin credenciales para …»), el error de `/compact` en una clase corta y «Operation aborted» al cortar un turno con el tutor escribiendo.

**Cambiar de tema.** `/estudiar` con un tema activo ofrece «Guardar y cambiar», «Cambiar sin guardar» o «Cancelar»; guardar pide, como `/fin`, un resumen de toda la sesión. Con el tutor escribiendo, primero pregunta y recién al confirmar corta el turno (Cancelar o Esc no lo cortan); sin tema activo y con una pregunta abierta, pide confirmación. Cortar el turno (`/estudiar`, `/fin` o `/simulacro`) cierra solo un quiz o una pregunta abiertos, como cancelados, y termina el turno sin otra llamada al modelo; si el quiz ya mostró la corrección, la respuesta queda. La nota anota «(cortado al cerrar la clase)», «al cambiar de tema» o «al empezar el simulacro»; el Esc del alumno sigue como «(omitido por el usuario)». En la terminal no se puede tipear un comando con un popup abierto: ese cierre cubre un cliente SDK o un comando que entra justo cuando aparece el popup; en la terminal el camino real es Esc y después el comando, con el tutor escribiendo, y pi muestra «Operation aborted». En modo RPC la respuesta libre la dibuja el cliente y un corte no la cierra. Un corte durante otra tool del curso (`leer_items`, `registrar_progreso`…), o con un quiz que viene después de otra tool en el mismo mensaje, todavía muestra «Error: This operation was aborted».

**Retomar.** La sesión, el curso y la nota se restauran desde la rama activa: cerrá pi y usá `pi-learn -c`, `pi-learn --resume` o `/resume`, y buscá `<Curso> · <Tema>`. Si el archivo de sesión de pi perdió las entradas del curso (disco lleno), vale el registro propio `cursos/<c>/.sesion-activa.json`. Tras un corte con un mensaje del alumno sin respuesta, el tutor lo responde solo al reabrir. Si se inicia otra sesión del tema sin registro final, se ofrece una vez reconstruir la última sesión real (ver Fase 7).

**Ítem reservado y `/simulacro`.** Por tema queda reservado un ítem real de evaluación que no se practicó, ni él ni una casi copia suya; de preferencia, sin casi copias en prácticos y parciales, después con solución oficial y después con puntos. Casi copia es un enunciado, o un bloque de una página, con al menos 10 términos en común (números y palabras de 5 letras o más) y Jaccard ≥ 0,5. Ni el reservado ni sus casi copias se ven: el dossier no lo lista (sólo avisa que hay uno), `leer_items` y `buscar_material` no los dan, `leer_paginas` omite la pregunta o el ejercicio entero (o rechaza el rango si no puede separarlo) y, en una página que lee entera (el libro, un práctico sin segmentar), cambia el bloque del problema casi igual por «[Problema reservado para /simulacro.]»; `ver_pagina` rechaza esas páginas. En Redes, con el parcial 2023 segmentado, su Pregunta 3 queda para retardos y con ella se ocultan el Ej. 10 del Práctico 1 y el problema P29 de Kurose (PDF p. 88). Se fija en `progreso.yaml` la primera vez que se guarda ese tema (ver Fase 7).

Con el plan cubierto y la práctica terminada, `modo-curso.md` le pide al tutor registrar el tema como dominado y, antes del cierre, ofrecer `/simulacro` (sin probar todavía con el modelo real; DA33). Si el tema todavía no está dominado, `/simulacro` pregunta «Todavía no terminaste el tema: el simulacro usa el único ítem reservado y no se repite. ¿Rendirlo ahora?», arrancando en «No, seguir estudiando»; «No» o Esc no gastan nada («Seguimos estudiando: el simulacro queda reservado para cuando termines el tema.»), un kill con la pregunta abierta tampoco, y sin interfaz no se rinde. Confirmado, corta el turno y presenta ese ítem tal cual, con su puntaje y el tiempo proporcional del examen según `curso.md` («2 horas» y «5 preguntas» dan ~24 min; si no dice horas o minutos y cantidad de preguntas, va sin tiempo). Acepta texto o foto y no da pistas hasta la entrega; después corrige contra la solución oficial, dice si un error viene de un nodo que todavía no se enseñó, registra el intento y los nodos fallados y propone un repaso ordenado por peso: los puntos que suman, en los parciales de `curso.md`, las preguntas del tema que tocan cada nodo. Mientras dura, la barra muestra «📝 Simulacro · <tema>»; sobrevive `/compact`, `/resume` y un kill, y termina al registrarse el intento, con `/fin` o al cambiar de tema. El ítem queda «usado» apenas se presenta, aunque no haya entrega: el próximo simulacro del tema toma otro. Sin tema activo dice «Empezá con /estudiar <tema> y después /simulacro.»; sin ítem, «… no tiene un ítem de evaluación para simulacro: todavía no hay parciales del tema preparados o ya se usaron todos.»; si no puede anotar el uso, «No se pudo anotar el simulacro en el progreso; se reintenta al guardar tu intento.». No hay simulacro de varios temas ni del curso completo.

Límites conocidos de la reserva: hasta que se segmenta el parcial del tema (en segundo plano, la primera vez que se estudia) no hay reserva, así que `leer_paginas` puede mostrar sus enunciados y su casi copia está en el dossier; si el alumno practica esa copia y se registra, el ítem ya no se reserva, pero si sólo se mostró, se reserva igual. Lo mismo si el ítem fijado desaparece del banco. Un problema del libro partido entre dos páginas puede quedar bajo el umbral en cada mitad. `ver_pagina` rechaza siempre la página entera que trae un reservado, su solución o una casi copia, también después de otro intento o durante el simulacro (en Redes, hoy las páginas 1 a 3 de `sol-prc20240926`; con el parcial 2023 segmentado como en la prueba con el modelo real, también sus páginas 1 y 2, la p. 3 del Práctico 1 y la p. 88 de Kurose); `leer_items` con `incluir_solucion` sigue disponible. Si un tema tiene un solo ítem de evaluación, ése queda reservado aunque tenga casi copias.

**Sin Python, sin disco, sin credenciales.**

- Si `.pi/.venv` no responde, la sesión usa la última carga buena (`cursos/<c>/.sesion-cargada.json`) y avisa «Material desde la última carga; el entorno de ingesta no respondió: corré .pi/scripts/doctor.» (si Python dio un error propio, como un disco lleno, «Material desde la última carga. <ese error>»). Sin esa copia, `/estudiar` falla con ese mismo consejo. Al restaurar espera hasta 30 s a Python. `ver_pagina`, la preparación por tema y `registrar_progreso` necesitan Python: sin él fallan con una línea y la clase sigue; sin el venv, la preparación y el progreso dicen «Falta el entorno de ingesta (Python): corré .pi/scripts/doctor.».
- Con el disco lleno, el progreso no se guarda («Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin.») y `progreso.yaml` queda intacto.
- Sin credenciales, `/estudiar` no arranca, la preparación por tema y el researcher no llaman al modelo, y un error del proveedor a mitad de clase se explica en español (ver «Modelos»).

Archivos propios por curso, ocultos en Obsidian y borrables sin perder nada: `.sesion-cargada.json`, `.sesion-activa.json` (se borra al cerrar) y `.no-reconstruir.json` (logs ya ofrecidos para reconstruir).

Prueba opcional con el modelo principal real, en una sesión independiente:

```bash
node .pi/scripts/probar-sesion
```

Consume LLM para la primera pregunta y compactación; se detiene sin responder por vos y crea su propio JSONL bajo `_procesado/fase4/`. Primera prueba completa (Fase 4): quiz a los **20,08 s**, compactación real y reapertura del mismo archivo con curso/tema/log restaurados. No son garantías ni una clase completa; ver `informes/fase4.md`.

El modo incorpora fotos persistentes desde Fase 5, researcher anclado/caché desde Fase 6 y progreso desde Fase 7. `/fin` guarda antes de cerrar; `/progreso [curso]` muestra estados y próximo paso. El md-log manual pide confirmación para rellenar una nota no vacía; el vínculo de curso nunca la reemplaza. La nota se puede renombrar o mover dentro del vault: md-log la sigue, y el curso guarda su ruta nueva (en la entrada `curso` y en `.sesion-activa.json`, si sigue en `sesiones/`) para revincularla al retomar y cerrarla con `/fin`; movida fuera de `sesiones/`, se cierra por su ruta de origen. El progreso sigue anotando el nombre original de la sesión, del que salen fecha y orden, pero comprueba la nota por su ruta actual: renombrada o movida dentro de `sesiones/`, o en una clase sin nota, no avisa que el log no está; movida fuera de `sesiones/`, cada guardado le devuelve al tutor «El log … no está (¿se renombró o movió en Obsidian?); el progreso se guardó igual con esa ruta.». Si se borra, md-log la recrea con un aviso. Si no se puede cerrar: «No se pudo cerrar la nota de la clase en Obsidian; la clase sigue abierta: repetí /fin.», o «…: hay otra nota vinculada, desvinculala con /md-unlog y repetí /fin.» si se vinculó otra a mano.

## Fotos persistentes — Fase 5

Mismo venv, sin comando propio de transferencia. El pegado real de pi puede enviar sólo una **ruta en un bloque de texto**, que el modelo abre con `read`, no un bloque `image`: el logger admite ambos. Copia rutas explícitas de imagen por línea (absolutas, `./`, `../`, `~/` o `@`, con comillas si hay espacios) y las rutas nativas `pi-clipboard-<UUID>` insertadas dentro de una respuesta; no captura menciones genéricas en prosa ni imágenes de resultados de herramientas. La fuente se abre sólo para lectura, sin seguir symlinks y verificando archivo regular. Cualquier imagen del usuario recibida con un log vinculado se copia a `adjuntos/` junto a la nota, incluidos mensajes sin texto. En el curso es `cursos/<curso>/sesiones/adjuntos/`. El formato sale de la firma del archivo, no de la extensión: PNG, JPEG, WebP y GIF se conservan; HEIC pasa a JPEG y BMP a PNG con ImageMagick (`magick`); sin él, pi avisa en una línea y la nota marca la imagen como no guardada. Nombre con timestamp, posición y SHA-256. Los embeds dentro del vault usan su ruta desde el vault.

La misma ruta se usa al recuperar historial; reutiliza sólo copias idénticas y preserva cambios manuales. No sigue symlinks en adjuntos ni reemplaza archivos. Los nuevos archivos tienen permisos `0600` y los directorios nuevos `0700`; no se cambian permisos preexistentes. Un fallo deja aviso en el log/UI, sin perder texto ni las demás fotos. No hay limpieza automática de copias parciales o temporales nativos de pi.

El protocolo transcribe antes de corregir, conserva errores/unidades/tachaduras y espera aclaración de los datos necesarios ilegibles. Corrige con el contrato y sólo da puntaje con escala aplicable. Desde Fase 7 se registra sólo evidencia real observada del estudiante; los ensayos técnicos no cuentan.

Prueba opcional, **dos turnos del modelo principal**, sin respuestas reales del alumno:

```bash
node .pi/scripts/probar-fotos
```

Usa una foto manuscrita pública de Wikimedia Commons (FlexingCA, CC0), **de finanzas y ajena a Redes**, no una muestra simulada ni material añadido al curso. Si falta, descarga sólo ese JPEG y exige el SHA documentado. Recorta/oculta un dato para el caso negativo con Pillow 13.0.0 (ya instalado por OCR), luego envía el original completo. El modelo pide aclaración y después transcribe/corrige según la pauta general de justificación, sin inventar escala. Reapertura, dos embeds y bytes idénticos a los mensajes comprobados. Evidencia, procedencia e incidente del harness: `informes/fase5.md`. Log visible: `informes/fase5/prueba-1792607375280.md`.

**Manual confirmado por el usuario:** envió una foto por el recorrido nativo y confirmó el render recuperado en Obsidian con «Confirmado, avanzá». Esto no convierte el smoke SDK en observación física del teclado ni en una clase completa. Para repetir sin hacer una clase, creá otra nota vacía, abrí una sesión nueva con `pi-learn` y vinculala con `/md-log <nota-nueva>.md`. **No reutilices `informes/fase5/prueba-manual.md`: ya tiene contenido.** Pegá una imagen con Ctrl+V en el editor normal y enviá «Prueba técnica: transcribí esta foto, sin registrar progreso». En pi 1.3/1.4 puede aparecer una ruta temporal antes del envío. No se cambió el portapapeles personal. Abrí esa nota en Obsidian y comprobá la foto; `/md-unlog` al terminar. Si la nota ya tiene contenido, creá otra vacía: no la rellenes otra vez. No uses `prueba-base.md`.

Las imágenes y JSONL quedan locales, fuera del Git de `.pi/`. Pueden contener datos personales y metadatos: evitá información sensible innecesaria. El usuario sigue encargándose del paso celular → PC. No se verificó todavía una respuesta manuscrita real de Redes ni una rúbrica detallada inexistente.

## Comprobaciones y checkpoint

### Doctor

```bash
.pi/scripts/doctor
# Sin red ni gasto de modelos; las pruebas omitidas quedan como pendientes:
.pi/scripts/doctor --sin-red
```

Carga las extensiones con confianza sólo para su propio proceso, sin modificar `trust.json`, y con las mismas skills que `pi-learn`. No envía un prompt de enseñanza, no lee el portapapeles ni manda material del curso a modelos o proveedores web. Comprueba:

- versiones de pi, Node.js, fish y tmux, y que corre dentro de tmux;
- el lanzador instalado igual a la copia versionada, el portapapeles (`wl-paste` o `xclip`), las rutas del vault (`_entrada/` y `cursos/`) y al menos 2 GB libres en el disco del vault y de pi;
- Obsidian con `_procesado` excluido;
- subagentes y pi-web-access fijados, la configuración web, el vigilante del researcher (`scripts/vigilante.mjs`), la web del researcher, el renombre a `web_fetch` y que el modelo de `agents/researcher.md` coincida con `curso.config.json`;
- `skills/teach/SKILL.md` sin cambios respecto de upstream;
- carga de extensiones, cada tool y comando del curso, el guardado/embed de un PNG sintético en md-log (sin modelo), el prompt del tutor sin secciones ajenas, las skills de cursos sin colisiones y el thinking oculto;
- credenciales del principal, del researcher y de visión, sin llamar al modelo;
- sin `--sin-red`: dos pings de hasta 64 tokens (researcher y visión, uno con un PNG sintético), una búsqueda y una lectura web;
- el venv (Python 3.13.13 y las versiones de `uv.lock`), Tesseract y sus idiomas según `ruta_tesseract`, y los motores de ingesta;
- cada curso con `validar`, con un aviso «!» de las páginas referidas pendientes.

Un «!» es un aviso y no cuenta como falla. Corrido con `--sin-red` el 2026-10-22, fuera de tmux y sobre una copia del vault, las únicas faltas fueron las esperables: «Dentro de tmux», las rutas del vault (por ser una copia) y los cuatro chequeos omitidos por `--sin-red`. Redes dio «17 documentos, 8 temas: estructura válida» y el aviso de 72 páginas referidas pendientes: todos los documentos tienen ingesta base y lo que falta es la visión, que hace la preparación por tema.

### Tests

Sin modelos ni red. Desde la raíz del vault:

```bash
node --test .pi/tests/*.test.mjs
.pi/.venv/bin/python -m unittest discover -s .pi/tests/ingesta
```

El 2026-10-23, sobre la rama `cursos` en `e79708d`, la suite Python dio 151 tests OK en unos 25 s y la Node, 268 en verde en 60 a 100 s según la carga de la máquina. La suite Node incluye la Python: `tests/ingesta.test.mjs` corre el mismo `unittest discover` con un plazo de 90 s, que en una corrida con la máquina cargada venció y dejó ese test en rojo. Si ves `actual: null` en «ingesta Python», es ese plazo: repetí `node --test .pi/tests/ingesta.test.mjs` solo (esa vez dio 7/7). Los tests de OCR real (`test_ocr_real_local_sin_llm`, `test_formula_escaneada_queda_pendiente_y_la_prosa_no`) necesitan un Tesseract con `spa` en el `PATH`; algunos tests se saltean si faltan los PDFs reales de `cursos/redes`.

### Prueba del researcher con subagentes (opcional, con LLM y red)

```bash
.pi/scripts/probar-researcher
```

Ejecutar solo dentro de tmux. Prueba el researcher como subagente de pi-interactive-subagents (el recorrido de `teach` fuera de un curso): abre un panel, comprueba búsqueda y lectura web en el hijo y la entrega automática al padre. Usa una sesión temporal independiente, no modifica `prueba-base.md` y tiene un plazo de 180 segundos. La primera ejecución aprobada tardó 17 segundos; no garantiza ese tiempo en otras ejecuciones. El researcher del curso no usa este camino (ver Fase 6).

### Prueba manual: smoke aceptado; recorrido completo opcional

El usuario aceptó la prueba técnica parcial para cerrar Fase 0. La lista siguiente queda como referencia para repetir un recorrido completo de `teach` fuera de un curso, no como evidencia de que ya se haya realizado.

`prueba-base.md` ya contiene material del usuario: **no volver a vincularla para rellenar el historial**, porque eso podría reemplazar su contenido. Para una nueva prueba, crear una nota vacía distinta.

1. En fish, `cd ~/Projects/pi-learning` y `pi-learn`; aceptar la confianza del proyecto si se solicita.
2. Abrir la nota nueva vacía en Obsidian. **Usar una nota vacía:** md-log puede reconstruir el historial de una nota existente tras confirmación; no hace falta para este ensayo.
3. Ejecutar `/md-log <nombre-de-la-nota-nueva>.md`.
4. Ejecutar `/skill:teach regla de la cadena` y completar el flujo: quiz, objetivo, researcher, aprobación del plan, explicación y verificaciones.
5. Comprobar que el researcher abre un panel de tmux, busca y lee fuentes, y entrega un resultado en español al padre.
6. Copiar una imagen al portapapeles y pegarla con Ctrl+V **dentro de esa sesión**. Comprobar que pi muestra el adjunto, el modelo lo recibe y md-log lo copia a `adjuntos/` con su embed.
7. Verificar en Obsidian el log de texto y los quizzes; `/md-unlog` al terminar.
8. Correr `doctor` desde otra terminal dentro de tmux, o pedir a pi que ejecute `.pi/scripts/doctor`.

La Fase 0 se cierra con la aceptación explícita del smoke técnico, los tests y el doctor en verde, mediante un único commit en `.pi/`. La base de Fase 1 fue aprobada explícitamente y se cierra con un único commit. La Fase 2 fue aprobada explícitamente con «Fase 2 aprobada, continuá», aceptando el checkpoint con problemas escaneados reales externos y sus límites declarados; se cierra con un único commit tras repetir tests y doctor en verde. No se declara probado un parcial manuscrito ni se usó una muestra digital rasterizada como sustituto. Fase 3 aprobada con «Aprobado; continuá», propuesta aplicada y chequeos repetidos para su único commit. La aprobación no modifica la revisión humana pendiente de las transcripciones y no equivale a aprobar Fase 4 por adelantado. Fase 4 aprobada explícitamente con «Aprobado; continuá», sin convertir los mensajes repetidos en varias autorizaciones. Fase 5 aprobada con «Confirmado, avanzá» tras corregir y confirmar la foto del log. Fase 6 aprobada con «Aprobado, continuá», autorizando sólo Fase 7. Fase 7 aprobada después con «Aprobado, continuá», autorizando Fase 8; el piloto no se considera realizado por esa aprobación.

## Researcher anclado y caché (Fase 6)

Requiere pi-web-access en `.pi/npm`; no usa tmux, `sh` ni pi-interactive-subagents, y corre igual en Windows (DA39). Con `/estudiar redes retardos`, si el dossier no trae caché vigente, el tutor llama `investigar_tema({modo: "alcance", afirmaciones: ["…"]})` antes del probe; para 1–3 afirmaciones nuevas, `modo: "verificar"` (en ad hoc, sólo ese modo). La tool adjunta contrato del tema, citas preparadas y enunciados curados de ejercicios sin soluciones (sin los ítems reservados ni sus casi copias, ni las páginas que traen una), lanza el researcher y no espera su informe.

**Cómo se lanza.** Un `pi -p` propio y desacoplado, sin sesión, extensiones, skills ni archivos de contexto, que carga sólo pi-web-access y usa el modelo, el thinking y las tools (`web_search, web_fetch, read`) de `agents/researcher.md`. `scripts/vigilante.mjs`, también desacoplado, lo corta a los 180 s (y lo fuerza 5 s después si no terminó), igual que antes `timeout -k 5 180`. Trabaja en `cursos/<curso>/notas/verificaciones/.trabajos/<clave>/` (oculta para Obsidian): se borra al recoger con éxito y tras un fallo conserva `error.txt`, `salida.md` y `fallo` para diagnóstico. El hijo sobrevive a `/reload`, a un kill y al cierre de la terminal; cualquier sesión lo recoge por huella. Tras un plazo vencido, esa huella espera 10 min antes de relanzarse. Sin credenciales del modelo del researcher no se lanza nada.

**Mientras se prepara el tema.** Si alguna página que el alcance usa de ancla sigue pendiente de visión y el curso se está preparando (`_procesado/.preparacion.lock` vigente), `investigar_tema` contesta enseguida «Verificación en segundo plano; seguí con el material.» y lanza el researcher más tarde, cuando esas anclas dejan de estar pendientes o la preparación termina, con las afirmaciones que pasó el tutor; la primera pregunta no espera. Si se lanza con anclas todavía pendientes, la tarea las nombra y el informe guardado empieza con «Páginas pendientes de transcripción al verificar (…)», y si esas páginas cambian después, la caché pasa a «previa». Límites: la espera mira el lock de todo el curso, así que si la preparación no va a reescribir un ancla pendiente (una página del programa o una que excede el tope de 150) espera a que termine toda; vive en memoria (un `/reload` o un kill la pierden y el tutor la vuelve a pedir) y se resuelve recién al terminar el próximo mensaje o al empezar el próximo turno; si ese lanzamiento diferido falla, nadie se entera y el dossier sigue diciendo «Sin caché vigente». El modo verificar no espera: si la preparación cambia sus anclas durante la corrida, el informe se descarta.

**Qué ve el alumno.** Con el tema activo, «Verificación del material lista.» o «Verificación del material no disponible; seguimos con el material del curso.». El informe le llega al tutor como mensaje oculto para el turno siguiente; no dispara turnos ni va a la nota.

El informe separa veredicto sobre la afirmación recibida, corrección, contraste con el curso y extensiones. Páginas PDF base 1 y fuentes web leídas; sin rúbricas inventadas. Si falla el hijo, falta web o cambian las fuentes, se sigue con el material sin atribuir verificación externa. Se declara cualquier cobertura parcial.

Alcance se publica en `cursos/<curso>/notas/verificaciones/<tema>.md`, o `<tema>-<huella>.md` si ya había otra generación; el dossier enlaza la vigente. Cabecera/control de integridad, fecha y modelo; las notas manuales o incompletas se preservan. La huella cubre tema, páginas y enunciados adjuntados, contrato sin objetivos ajenos y el cuerpo de `researcher.md`; el progreso queda afuera. Las cachés anteriores a este formato quedan como «previa»: la primera sesión de cada tema relanza alcance una vez. No se sobrescribe ni se limpia automáticamente. Verificar no reemplaza el mapa.

Ensayo opcional, **consume principal y researcher** y genera notas/logs nuevos:

```bash
node .pi/scripts/probar-researcher-curso
```

No requiere tmux. Comprueba arranque del probe, lectura local/web del hijo, recogida del informe, controles A1/A2/A3, caché en un segundo `/estudiar` y progreso intacto. Deja la evidencia en `_procesado/fase6/prueba-*/resultado.json`. La suite de tests usa fixtures y no consume modelos. El ensayo F4 `probar-sesion` sigue intencionalmente sin hijos para medir sólo ese recorrido.

Evidencia del cierre de Fase 6 (con el lanzamiento anterior por subagente): `_procesado/fase6/prueba-1792630409914/resultado.json`. Probe en 20,62 s y siguiente en 7,42 s; alcance tardó 68 s en paralelo. A1/A3 discrepan y A2 concuerda; ninguna respuesta del estudiante. La calibración no certifica fiabilidad general, atribuciones o exactitud del informe. La revisión humana sigue pendiente. Resumen histórico visible: `informes/fase6/resumen.md`.

## Progreso persistente (Fase 7)

Sin dependencias nuevas. Después de `/reload`:

```text
/progreso redes
/estudiar redes retardos
/fin
```

`registrar_progreso` recibe sólo lo nuevo: `resumen` es obligatorio y lo omitido se conserva. Fusiona estado, borde, conceptos, errores, intentos y discrepancias, sin duplicados exactos y sin tocar otros temas. Un tema nuevo queda `sin_empezar` hasta que llega evidencia del alumno; `falla_resuelta` quita una falla por su texto exacto. El backend valida ids/fechas/rutas, completa fechas locales, toma su propio bloqueo `cursos/<c>/.progreso.lock` (espera hasta 5 s; si no se libera, «Otro proceso está guardando; reintentá.») y guarda mediante temporal + fsync + rename. Antes conserva los bytes exactos previos en `progreso.yaml.bak`. Leer el progreso no toma bloqueo, así que una ingesta en curso no impide guardar ni `/fin`. El historial tiene una entrada por tema/log: `cierre:false` durante el probe/práctica y `cierre:true` al finalizar.

Campos de la etapa de pedagogía, por tema: `objetivo` (hasta 300 caracteres) y `plan` (hasta 1500) reemplazan a los guardados cuando vienen; `reservado: [{doc, id, usado?}]` lo escribe el código, no el tutor. La reserva se fija la primera vez que se guarda ese tema; los temas sin estudiar no se escriben (su reserva se calcula igual y queda oculta), así quitar o renombrar uno a mano en `indice.yaml` no invalida el progreso. Un reservado pasa a `usado` al presentarse en `/simulacro` o con un intento registrado; desde ahí queda oculto otro, si hay, que se fija en el próximo guardado del tema. Los errores de archivo y los internos de Python se ven en una línea: «No se guardó el progreso: no hay permiso para escribir el progreso; revisá los permisos de cursos/<c>/.», «…: un archivo del curso está dañado (no es texto); revisá progreso.yaml, su .bak e indice.yaml del curso.», «…: un dato del registro no tiene el formato esperado; …» o «…: falló la escritura del archivo de progreso; reintentá y, si sigue, corré .pi/scripts/doctor.».

`/fin` pide el guardado con un resumen de toda la sesión (qué se aprendió, qué falló y qué sigue), no sólo de lo nuevo, y después ese resumen y el próximo paso. Con el tutor ocupado corta el turno en vez de rechazarse, y un quiz o una pregunta abiertos se cierran solos (ver «Cambiar de tema»). Sólo desvincula el log después de un mensaje final completo y del acuse de md-log; aborto, guardado fallido o vínculo cambiado dejan el curso abierto. Sin respuestas nuevas conserva la evidencia previa. Ad hoc puede cerrar su log, pero no crea progreso ni temas ficticios.

Al retomar un tema, el dossier incluye borde y próximo paso y, si están guardados, «Objetivo acordado» y «Plan» antes del progreso del tema: ocupan hasta 2000 B de los 3000 que comparten con él, así el progreso conserva al menos 1000, y el tutor no los vuelve a pedir. `/progreso [curso]` sugiere un tema pendiente con prerequisitos dominados, sin asignar dominio por contestar una pregunta aislada.

Un log anterior sin registro final se ofrece una sola vez para reconstrucción: `leer_sesion_anterior` devuelve texto acotado y SHA; `registrar_progreso` muestra la propuesta y exige confirmación real. Sin UI o si se cancela, no guarda. El log previo nunca se modifica. Preguntas sin respuesta y pruebas técnicas no se convierten en errores del alumno. La reconstrucción se identifica en historial y no cierra la sesión actual.

Los ids de ítem se normalizan («2(a–c)» → `2`, el inciso va en notas). Un ítem que desaparece al volver a segmentar queda «huérfano» con aviso, sin invalidar `progreso.yaml`. Si el YAML es inválido y hay `.bak` válido, se restaura y avisa, conservando los bytes inválidos en `cursos/<c>/_procesado/progreso-invalido-<sha>.yaml`. Sin respaldo válido se continúa con material, sin guardar hasta reparar. Un `.bak` existente inválido tampoco se pisa a ciegas; requiere intervención. Son defensas contra cortes/ediciones accidentales, no contra un proceso externo que ignore los bloqueos y reemplace archivos en el último instante.

Ensayo opcional, **consume Sol y usa respuestas programadas exclusivamente en una fixture aislada**:

```bash
node .pi/scripts/probar-progreso
```

Evidencia: `_procesado/fase7/prueba-1792672775843/resultado.json`. Dos sesiones nuevas del mismo tema, ambas con tres preguntas; la segunda recibió el borde previo y lo confirmó en tres. Ambos `/fin` guardaron y conservaron el resumen final. Esto prueba la integración con modelo real y alumno virtual; **no** mide tu comprensión ni sustituye el piloto humano. No escribe progreso de Redes ni lanza researcher. Reconstrucción/confirmación se prueban sin modelo. Resumen visible: `informes/fase7/resumen.md`.

El cambio autorizado a `openai-codex` invalidó por huella las cachés anteriores de alcance/visión: se preservan, pero el próximo alcance o una preparación de visión pueden generar una nueva salida y consumir modelo.

## Piloto humano (Fase 8, en curso)

Seguimiento en `../fricciones.md`, visible en Obsidian. Se requieren 3–5 sesiones reales, sin sustituirlas por scripts o respuestas simuladas. Empezá con `pi-learn` en la carpeta del vault y `/estudiar redes retardos`, estudiá y terminá con `/fin`. En la segunda sesión retomá el mismo tema para comprobar el borde. Anotá las trabas, su impacto y el log; se priorizarán las tres principales para corregir y reprobar. Si aparecen menos, se acuerda el cierre, no se inventan problemas.

Los logs técnicos de las pruebas de Redes se movieron a `_procesado/archivo-pruebas/redes/`, fuera de las notas del curso. `probar-sesion` y `probar-researcher-curso` todavía crean sus notas en `cursos/redes/sesiones/` (y el segundo, su verificación en `cursos/redes/notas/verificaciones/`): después de correrlos, movelas también a `_procesado/archivo-pruebas/redes/`. El commit único y el checkpoint de Fase 8 quedan pendientes de sesiones y arreglos; no se declara la fase terminada.
