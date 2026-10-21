# Decisiones de implementación

## Estado — 2026-10-20

**Fase 0 cerrada**, commit `79b1976`, con aceptación explícita del smoke técnico y de la prueba independiente del researcher real. La lección se interrumpió en el probe: no se afirma que se completó. Evidencia: `informes/verificacion-base.md`.

**Fase 1 aprobada por el usuario:** «aprobado, sigamos», tras presentar el informe y sus limitaciones. La ingesta base procesó nueve páginas, siete pendientes de revisión/visión; los 18 PDFs originales conservan sus hashes. Pasan 18 tests Node, incluida una suite de 20 tests Python, y el doctor completo dentro de tmux. Esta base quedó cerrada en el commit `352c249` y quedó autorizado iniciar Fase 2. Al cerrar Fase 1 no se había evaluado un parcial/práctico escaneado real: esa aprobación no dio por cumplido el caso ni autorizó sustituirlo por una copia rasterizada. Detalle: `informes/fase1.md`.

**Fase 2 aprobada por el usuario:** «Fase 2 aprobada, continuá». Tools de visión e ítems implementadas; 28 tests Node y 34 tests Python sin LLM aprobados, doctor completo repetido en verde dentro de tmux para el cierre. Piloto digital: tres páginas y diez ítems. A pedido del usuario se buscó además papel escaneado real externo: dos páginas de Limric (1895), quince ítems y el ejercicio 9 multipágina. Tras corregir moneda y continuaciones en el prompt, seis fracciones y ocho importes cotejados; repetición con dos aciertos de caché. Se acepta este checkpoint con sus límites declarados y se completa el commit de cierre. Los estados de revisión de las salidas individuales no cambian por la aprobación global. No se inició Fase 3. Evidencia: `informes/fase2.md`.

## D0.1 — Conservar el upstream y fijar los subagentes

- `.pi/` es el clon del fork `santi-esquerre/learn`, rama `cursos`.
- `origin`: fork del usuario. `upstream`: `amosblomqvist/learn`.
- Base original de ambos inspeccionada: `7cfd8942f82ab9476e63572387e1fe9bcea5082c`.
- Subagentes `3.7.2`, fijados al commit `c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7`, instalados con alcance local.
- No se modificaron `skills/teach/SKILL.md`, quiz, ask-user-question, visual-tools ni md-log. El researcher solo recibió el modelo acordado y una instrucción de salida en español. Los modos anclados al curso quedan para Fase 6.
- Los checkouts y node_modules no se versionan. Sí se versionan las declaraciones, lockfiles, configuraciones e instalador idempotente.

## D0.2 — La instalación de pi manda

Se verificó pi `1.3.0` contra sus documentos instalados: README, extensiones, paquetes, CLI, configuración, SDK, modelos, TUI y seguridad; se consultaron ejemplos SDK 02/06 y hello, y las declaraciones exportadas.

- El loader conserva los alias `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai` y `@sinclair/typebox`.
- Prueba real: las extensiones originales, los subagentes y la web cargan sin errores ni warnings.
- El SDK usa `ModelRuntime.getModel/completeSimple`; la fachada `ctx.modelRegistry` tiene `find/streamSimple` y no los mismos nombres. El doctor usa `session.modelRuntime`, verificado en las declaraciones instaladas. No confundir ambas superficies en fases posteriores.
- Los tests y el doctor usan sesiones en memoria y carga con confianza solo para ese proceso; no guardan aprobaciones ni prompts de prueba en las sesiones del usuario.

## D0.3 — Web sin cuentas nuevas: pi-web-access

El usuario delegó la elección del proveedor. Se inspeccionaron dos opciones actuales:

| Opción | Resultado |
|---|---|
| `pi-native-search 0.1.0` | Nombres compatibles, pero la ruta OpenAI se basa en `OPENAI_API_KEY`; no reutiliza el login ChatGPT existente. Su respaldo es scraping DDG. No elegida. |
| `pi-web-access 0.42.0` | Exa MCP sin clave, proveedores de respaldo, controles SSRF, configuración de nombres y compatibilidad con la generación actual de pi. Elegida y probada. |

Configuración: Exa → Parallel MCP → DuckDuckGo ante fallos tipados; sin resúmenes generados por modelos, cookies ni navegador. Lectura HTTP directa. Integraciones PDF, video, imagen, GitHub y servicios alojados de extracción deshabilitadas: no se mezclan con la futura ingesta de cursos.

Se usa el renombrado documentado `toolNames.fetchContent = web_fetch`, no un fork del paquete ni un cambio a las herramientas del researcher.

Los hijos de `pi-interactive-subagents` arrancan con `--no-extensions`. Su código busca originalmente web en rutas globales que aquí no existen. `extensions/web-subagentes.ts` registra ambos nombres mediante el hook real `globalThis.__pi_interactive_subagents.registerToolExtension`, apuntando al entrypoint instalado. Un test carga ese entrypoint y `safe-bash.ts` como extensiones explícitas de un proceso restringido, sin descubrimiento automático: quedan exactamente `safe_bash`, `web_fetch`, `web_search`.

`safe_bash` sí está incluido en los subagentes. No necesita una tercera extensión.

Comprobación real: la consulta «regla de la cadena derivada universidad» devolvió con Exa fuentes de UNAM y OpenStax; `web_fetch` leyó una página completa. Para el smoke de lectura se usa una página de Wikipedia con contenido suficiente: `example.com` activaba la heurística de contenido incompleto de este extractor, no un fallo de conexión.

No se prometen cuotas ilimitadas ni disponibilidad garantizada de los endpoints sin clave. No se añadieron claves. Las variables de API que se agreguen en el futuro podrían activar créditos de esos proveedores; revisar antes de hacerlo.

## D0.4 — Catálogo no equivale a permiso de uso

El usuario aprobó inicialmente `openai/gpt-5.4-mini` para researcher y `openai/gpt-5.5` para visión. Se guardaron inicialmente en `curso.config.json`, con el frontmatter del researcher sincronizado.

Las llamadas reales de ambos fallaron con HTTP 400: la cuenta ChatGPT/Codex no admite esos ids, aunque el catálogo de pi los liste. El diagnóstico no los marca en verde por tener credenciales del proveedor o aparecer en `/model`.

Se probó también `openai/gpt-6.1-sol`, el modelo de esta sesión: respondió un ping de texto y aceptó un PNG válido. Se ofreció como alternativa, sin sustituir silenciosamente la elección del usuario.

El usuario eligió después **`openai/gpt-6-luna` para ambos roles**. Se actualizaron `modelo_researcher`, `modelo_vision` y el frontmatter del researcher. El doctor ejecutado dentro de tmux confirmó una respuesta real de texto y otra con un PNG para ese modelo; todo el diagnóstico automático quedó en verde. Esto no evalúa la fidelidad de transcripción matemática, que se medirá en el benchmark. No se solicitaron ni tocaron claves.

El modelo principal del proyecto se fijó a `openai/gpt-6.1-sol`, para que abrir pi no dependa del predeterminado global `gpt-5.5` que esta cuenta rechaza. No se modificó el predeterminado global.

## D0.5 — Función fish, no alias textual ni tmux anidado

Pedido del usuario: `pi-learn` abre pi en la carpeta actual con tmux configurado.

- Función autoload en `~/.config/fish/functions/pi-learn.fish`, con copia versionada; `config.fish` queda intacto.
- Argumentos pasados como lista, sin `eval` ni concatenación de órdenes. Tests con espacios, comillas y metacaracteres.
- Fuera de tmux: servidor exclusivo `-L pi-learn`, configuración `config/tmux.conf`, directorio actual y sesión nueva en cada invocación. Se evita el problema de `new-session -A`: podría adjuntar otra carpeta y descartar argumentos.
- Dentro de tmux: ejecutar pi sin anidamiento ni modificaciones globales. La configuración existente inspeccionada ya habilita clipboard, passthrough y teclas extendidas.
- La configuración dedicada importa las preferencias personales existentes y ajusta las capacidades necesarias para pi. No se modificó `~/.config/tmux/tmux.conf` ni archivos de Omarchy.
- El arranque fish existente inicializa conda. Se deja un margen conservador de 2500 ms para los hijos, usando la variable documentada `PI_SUBAGENT_SHELL_READY_DELAY_MS`; se respeta un valor ya configurado.

Pruebas: sintaxis, ramas dentro/fuera de tmux y argumentos mediante stubs; además `pi-learn --version` ejecutado bajo un pseudoterminal real abrió tmux, imprimió `1.3.0` y salió correctamente. La interacción de Ctrl+V requiere una imagen real del portapapeles del usuario: no se reemplazó ni se leyó ese portapapeles durante la instalación.

## D0.6 — Archivos del usuario y Obsidian

No existían `.obsidian/`, `_entrada/`, `cursos/`, función fish propia ni configuración web. Se crearon los directorios y archivos necesarios sin reemplazar material existente. Obsidian no estaba ejecutándose cuando se creó `app.json` con `_procesado` excluido.

Se creó `prueba-base.md` vacío para el checkpoint. El md-log original puede reemplazar el contenido de la nota vinculada al rellenar el historial: la prueba debe usar esa nota nueva, nunca una nota personal.

`instalar-config` rechaza reemplazar archivos de contenido distinto. Las configuraciones globales nuevas se copian solo donde el paquete realmente las busca; el resolver replica el orden documentado XDG / agent-dir / ubicación heredada.

## D0.7 — Qué se comprobó al cerrar Fase 0

- 11 tests sin LLM: carga de API/alias y herramientas; carga explícita de herramientas de hijos; instalador idempotente/no destructivo; integridad de teach; modelo researcher sincronizado; configuración web acotada; log textual sin resultados de herramientas; sintaxis fish; conservación de carpeta/argumentos dentro y fuera de tmux; doctor sin llamadas de red.
- `doctor` v1: versiones, tmux real, lanzador, portapapeles requerido, rutas, Obsidian, refs de paquetes, configuración, carga de herramientas, pings reales de modelos y smoke web. No lee secretos ni contenido del portapapeles.
- Corrido dentro de tmux con `gpt-6-luna`: todas las comprobaciones automáticas en verde. Desde esta sesión de implementación fuera de tmux, seguirá señalando correctamente que no está dentro de tmux.
- Prueba del usuario revisada en `prueba-base.md`: preguntas, quiz, log e imagen verificados dentro de tmux; no avanzó más allá del probe. Panel real del researcher, web y entrega al padre verificados por separado con `scripts/probar-researcher` (usa LLM). No se afirma que se haya completado la lección ni que cargar un plugin pruebe su flujo completo.
- Ingesta, motor OCR, validación de cursos y fotos en logs: diferidos explícitamente a sus fases. No hay benchmark ni elección de motor por anticipado.
- Los textos técnicos originales de los popups de quiz/ask/md-log siguen sin traducirse, conservando la base original para la prueba inicial. La prosa generada se pide en español; la traducción de UI es opcional en el piloto según el plan.

## D1.1 — Base liviana; ensayos fuera del uso diario

Se implementan A–D, F y H, sin anticipar cursos, tools de visión ni ítems. Predeterminados en `scripts/ingesta/pipeline.py`: digital → PyMuPDF; escaneada → OCRmyPDF/Tesseract `spa+eng`; mixta → PyMuPDF, dejando sus imágenes pendientes. El manifiesto no obliga a elegir motores. Su override se conserva para medir candidatos sobre las mismas páginas.

La elección es una **base técnica provisional**, no fidelidad aprobada por el usuario. Marker y docling fueron ensayados realmente, pero su peso, tiempos y fallos no justificaron ponerlos en el camino diario. No se sigue depurando su infraestructura. Sus scripts y entornos permanecen separados en `scripts/ingesta/benchmark/`, con locks CPU; `doctor` solo exige el entorno diario. Se eliminan la configuración paralela de “aprobación de motor”, PyYAML todavía sin uso y el publicador genérico de informes. El checkpoint humano queda documentado, no convertido en un falso fallo de instalación.

### Comparación observada, mismo subconjunto de tres páginas

| Motor | Redes 56 | GRIMALDI 522 | Parcial tabla 4 | Límite observado |
|---|---:|---:|---:|---|
| PyMuPDF | 0.540 s | 0.257 s | 0.378 s | No produce LaTeX fiel ni transcribe la tabla. La capa OCR previa no cuenta como OCR validado. |
| OCRmyPDF/Tesseract | 15.841 s | 8.205 s | 5.631 s | Prosa utilizable, notación matemática dañada y tabla sin estructura. |
| docling con fórmulas | 108.143 s | 14.671 s | timeout 120.428 s | Notación incompleta; tabla vacía con `PARTIAL_SUCCESS`, no éxito de calidad. |
| marker | 164.284 s | `AttributeError` | `AttributeError` | Parte de la matemática digital queda fuera de LaTeX; dos páginas fallidas. |
| Luna, referencia | 19.674 s | 14.488 s | 29.961 s | Mejor notación, pero alinea mal al menos una fila de la tabla. No es verdad de terreno. |

Entorno diario: 266 MiB, aparte de Tesseract/Ghostscript existentes. Los entornos de docling y marker son aproximadamente 1.5 y 1.4 GiB, más modelos/cachés; el árbol experimental completo mide 5692 MiB con hardlinks internos contados una vez. No sumar tamaños compartidos como ocupación independiente. Detalle de alcance, versiones, límites de comparación y evidencia: `informes/fase1.md` y `informes/benchmark-fase1.json`. No se copiaron textos de los PDFs al repositorio Git.

## D1.2 — Reanudación y calidad conservadora

- Las fuentes solo se leen. Salidas acotadas a `_procesado/`, con control de propiedad, rechazo de symlinks/traversal, bloqueo de un escritor y reemplazo atómico.
- Caché por hash y página, más motor/versiones/idiomas/umbral y los datos que afectan citas o revisión (ruta y tipo). Se recupera el corte entre registro y Markdown; no se pisan anotaciones editadas.
- El lanzador libera el bloqueo antes de crear el hijo: se detectó y corrigió una carrera que podía hacer que el hijo rechazara el arranque. Test de regresión primero fallido, después aprobado.
- Umbral 0.6, leído desde `curso.config.json`. Se conservan las heurísticas léxicas y las señales de matemática/imágenes, no se confunde el puntaje con fidelidad. La muestra GRIMALDI 522 mostró un falso positivo alto al leer OCR previo; se amplió la señal matemática para expresiones como `$n+2$`, con invalidación de caché por versión del algoritmo. La revisión completa sigue pendiente.
- Toda página de ejercicios/evaluaciones/soluciones queda provisional y requiere visión en Fase 2, aunque supere el umbral. Los fallos se aíslan por página y quedan en el informe; no se inventa una fórmula para mejorar el puntaje.

## D1.3 — Instalación real, benchmark y checkpoint

La base usa Python `3.13.13`, PyMuPDF `1.28.2`, OCRmyPDF `17.13.0`, wordfreq `3.1.1`. Tesseract `5.5.2` proviene de Conda, no del paquete `5.5.3` del sistema; se documentan la ruta y el build exacto. No se instalaron paquetes de sistema. Docling necesitó OpenCV explícito en su entorno de ensayo; no se parcheó upstream. Se usaron cuatro hilos CPU, sin suponer utilizable la GPU visible.

La referencia de tres páginas usó `openai/gpt-6-luna`, con `session.modelRuntime.getModel/completeSimple` verificados contra pi `1.3.0`, igual que el doctor; no se intercambió con la fachada de extensiones. No se repitieron llamadas ni se implementó anticipadamente la tool E. Los costos de catálogo registrados no son una factura.

Los informes visibles están en `informes/fase1/` del vault porque `_procesado` está excluido de Obsidian. Se publican copias nuevas, sin sobrescribir notas existentes. No se creó un curso ni se mezcló GRIMALDI con Redes.

El usuario aprobó la base presentada y autorizó continuar con «aprobado, sigamos». **Fase 1 cerrada por aprobación de esa base con la limitación declarada.** En ese checkpoint la muestra de parcial/práctico escaneado real seguía pendiente; no se la declaró ensayada ni se la sustituyó. La prueba externa posterior de Fase 2 se registra abajo.

## D2.1 — Visión en la extensión; persistencia en Python

Se usa la fachada real de extensiones de pi `1.3.0`: `ctx.modelRegistry.find/streamSimple(...).result()`, con un único mensaje que contiene prompt e imagen PNG. Se verificaron declaraciones, docs y ejemplos y se ejecutaron tres llamadas reales con esa fachada, no solo con el SDK. La conversación principal no se envía y la tool solo devuelve cantidades, ids de páginas y avisos. Se informa el uso agregado al runtime, también si una respuesta llegó truncada.

El render, la validación de fuente, el bloqueo y la persistencia reutilizan `almacen.py` y el registro por página de Fase 1; `atomico` admite ahora bytes para publicar PNG sin archivos parciales. La extensión espera al hijo Python de forma asíncrona. No se agrega un daemon, una cola persistente ni otro motor. Los reemplazos se serializan con `withFileMutationQueue` y `flock`; además se compara el hash previo al guardar para detectar cambios durante la llamada remota.

El modelo se toma de `curso.config.json`, sin fallback ni reintentos automáticos. Superar el límite de páginas requiere `ctx.ui.confirm`, con rechazo seguro sin UI y sin argumento de autoaprobación. Fuente/modelo/prompt/umbral y ediciones de Markdown controlan la caché. La visión vigente conserva la clave base, de modo que reanudar la ingesta no la degrade a OCR. Un error mantiene el texto previo y el estado pendiente; `[ilegible]` o LaTeX roto no se dan por recuperados.

`revision_humana: pendiente` se conserva incluso con puntaje alto. La calidad automática no certifica la semántica ni la fidelidad de las tablas. Se reconstruyen índice e informe por página para mantener la consistencia; agrupar esas escrituras queda diferido hasta medir un problema en cursos grandes.

## D2.2 — Ítems elegidos por el agente, no por otro pipeline LLM

`guardar_items` es una tool de persistencia para la preparación. No segmenta ni inventa por su cuenta: recibe los ítems que el agente identificó al leer las páginas. Guarda ids originales, páginas, enunciado y solución opcional `{doc, id}` en `items.yaml`, con hashes de fuente/páginas y revisión humana pendiente. Valida duplicados, rangos, visión previa y referencias existentes; preserva YAML con cambios manuales. No devuelve los enunciados ni las soluciones completas.

PyYAML `6.0.3` vuelve a ser dependencia directa **ahora que tiene uso real**: serialización/lectura segura de `items.yaml`. No se instaló ningún paquete del sistema ni se añadieron dependencias de ML.

## D2.3 — Piloto sin curso ficticio y checkpoint aceptado

El piloto usa las tres páginas originales de `practico1.pdf` bajo `_procesado/fase2/piloto-practico1/`. Es un PDF digital: no se rasterizó otro PDF para declararlo escaneado. Los diez ejercicios se delimitaron después de leer y cotejar las tres páginas; el ejercicio 7 conserva su apartado (e) de la página siguiente. No se añadieron soluciones ni se creó un curso para sortear la ausencia de Fase 3.

`scripts/probar-vision` reproduce opcionalmente este recorrido con Luna y asserts de integridad/resultado. Permanece fuera de la suite automática porque puede consumir la cuenta. Repetido tras el piloto: tres aciertos de caché y cero llamadas nuevas. Las pruebas automáticas usan PDFs sintéticos y respuestas simuladas; los ensayos reales se registran aparte.

### Prueba externa autónoma con papel escaneado

El usuario pidió buscar una imagen escaneada y probar sin depender de que él aporte otra muestra. Se descargaron dos JPEG auténticos de *Algebra elemental* (Enrique G. Limric, 1895), colección Library of Congress en Internet Archive. Se verificaron visualmente las páginas impresas 101–102 y los índices BookReader; el PDF de dos páginas conserva exactamente los bytes JPEG y no contiene texto. No se rasterizó un PDF digital ni se creó un curso de prueba.

El ensayo expuso dos errores de presentación: signos de moneda sin escapar y un falso `[ilegible]` en un enunciado partido por el salto de página. Se corrigió el prompt compartido, con regresión sin LLM —primero roja, luego verde— y una nueva prueba real: dos transcripciones, seis fracciones y ocho importes cotejados, quince ítems y el 9 multipágina. No se editaron a mano las respuestas ni se agregó un reintento automático. El cambio de prompt invalida cachés anteriores por diseño; repetir el piloto digital puede consumir nuevas llamadas.

`node .pi/scripts/probar-vision --escaneo` reutiliza esta muestra descargada. Repetición con el prompt corregido: dos aciertos de caché y cero llamadas nuevas. Evidencia y limitaciones en `informes/verificacion-escaneo-fase2.json`; comparación en el vault: `informes/fase2/escaneo-real.md`. Es papel impreso antiguo, no manuscrito ni un parcial de Redes. El usuario aceptó el checkpoint de Fase 2 con «Fase 2 aprobada, continuá»; al retomarla se repitieron los chequeos y se completó su cierre, sin avanzar a Fase 3. Se conservan los estados de revisión humana de páginas e ítems: esta aprobación global no certifica individualmente su fidelidad.
