# Decisiones de implementación

## Estado — 2026-10-22

**Fase 0 cerrada**, commit `79b1976`, con aceptación explícita del smoke técnico y de la prueba independiente del researcher real. La lección se interrumpió en el probe: no se afirma que se completó. Evidencia: `informes/verificacion-base.md`.

**Fase 1 aprobada por el usuario:** «aprobado, sigamos», tras presentar el informe y sus limitaciones. La ingesta base procesó nueve páginas, siete pendientes de revisión/visión; los 18 PDFs originales conservan sus hashes. Pasan 18 tests Node, incluida una suite de 20 tests Python, y el doctor completo dentro de tmux. Esta base quedó cerrada en el commit `352c249` y quedó autorizado iniciar Fase 2. Al cerrar Fase 1 no se había evaluado un parcial/práctico escaneado real: esa aprobación no dio por cumplido el caso ni autorizó sustituirlo por una copia rasterizada. Detalle: `informes/fase1.md`.

**Fase 2 aprobada por el usuario:** «Fase 2 aprobada, continuá». Tools de visión e ítems implementadas; 28 tests Node y 34 tests Python sin LLM aprobados, doctor completo repetido en verde dentro de tmux para el cierre. Piloto digital: tres páginas y diez ítems. A pedido del usuario se buscó además papel escaneado real externo: dos páginas de Limric (1895), quince ítems y el ejercicio 9 multipágina. Tras corregir moneda y continuaciones en el prompt, seis fracciones y ocho importes cotejados; repetición con dos aciertos de caché. Se acepta este checkpoint con sus límites declarados y se completa el commit de cierre. Los estados de revisión de las salidas individuales no cambian por la aprobación global. Fase 2 cerrada en `6409acd`. Evidencia: `informes/fase2.md`.

**Fase 3 autorizada:** «Continuá con la fase 3». Implementadas skills de creación/ampliación, comandos, guardado con diff/confirmación, validador e informe visible. Curso real `redes`: 14 PDFs copiados y ocho temas; 52 páginas preparadas, 23 con Luna, 15 ítems segmentados. El usuario aprobó luego «Aprobado; continuá»: se aplicó la propuesta exacta revisada, se asignaron esos ítems y se incorporaron las tres diapositivas complementarias (17 PDFs / 987 páginas). Se preservaron contrato, progreso y PDFs previos. Fase 3 cerrada en `3616e71`. Detalle: `informes/fase3.md`.

**Fase 4 aprobada:** «Aprobado; continuá», commit `c757542`. `/estudiar`, tools de lectura/render, dossier, inyección estructurada, persistencia y puente de md-log. Smoke con `gpt-6.1-sol`: primera pregunta en 20,08 s, compactación real y reapertura del JSONL con estado/log restaurados; sin respuestas inventadas ni progreso escrito. 46 tests Node y 56 Python. Evidencia y límites: `informes/fase4.md`.

**Fase 5 aprobada:** «Confirmado, avanzá» confirma la imagen recuperada en Obsidian y autoriza Fase 6. Fotos guardadas/embebidas y protocolo transcribir → aclarar → corregir, con ensayo público separado de Redes y corrección del pegado nativo en `53a7476`. Su advertencia de pi 1.4.0 frente al antiguo pin 1.3.0 se resolvió validando la base 1.4.0 en Fase 6, sin reinstalar. Revisiones individuales y progreso no cambian. Detalle: `informes/fase5.md`.

**Fase 6 aprobada:** «Aprobado, continuá», commit `f9aeea7`. Researcher anclado, modos y caché; 71 tests Node / 56 Python y doctor completo correcto en pi 1.4.0 al cierre. Ensayo final: probes en 20,62 s / 7,42 s sin nuevo hijo; A1/A3 discrepan y A2 concuerda. Fallos semánticos anteriores conservados; estructura/caché no certifican verdad. Detalle: `informes/fase6.md`.

**Fase 7 aprobada:** «Aprobado, continuá», commit `29cdb0c`. progreso validado/fusionado/atómico con `.bak`, `/fin`, `/progreso`, reconstrucción confirmada y sugerencia. 83 tests Node / 67 Python, doctor completo en verde. Dos sesiones con Sol y alumno virtual aislado: segundo probe confirma el borde en tres preguntas. Sin progreso ficticio en Redes. El usuario autorizó «Usar openai-codex» al faltar credenciales para el proveedor anterior; se verificaron Sol/Luna texto y Luna imagen antes de cambiar sólo configuración local del proyecto. Detalle: `informes/fase7.md`.

**Fase 8 autorizada y en preparación:** se creó `../fricciones.md` para registrar 3–5 sesiones reales y priorizar/reprobar sus tres trabas principales. Todavía hay 0 sesiones reales del piloto registradas; el alumno virtual no cuenta. Doctor completo volvió a verde; plan, teach y progreso de Redes intactos. Sin cambios de código ni traducción opcional de UI anticipada. Se espera uso real antes de arreglos y del único commit/checkpoint de cierre de esta fase.

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

## D3.1 — Skills nativas, no otro sistema de prompts

En pi instalado 1.3.0, las skills se invocan como `/skill:nombre`; no se vuelven `/nombre` por el nombre del directorio. Se registran los alias requeridos por el plan con `pi.registerCommand` y `pi.sendUserMessage('/skill:…', {expandPromptTemplates: true, deliverAs: 'followUp'})`. La opción de expansión se comprobó en las declaraciones instaladas; enviarlo como texto sin ella no garantiza invocar la skill. Se verificaron docs completas de skills, extensiones, configuración, settings, paquetes y TUI, ejemplos `hello.ts`/`send-user-message.ts` y tipos reales de comandos, ejecución y resource loader. Las comprobaciones del runtime usan `getRegisteredCommands()`, no un método supuesto `getCommands()` del runner.

`/curso-check` y `/curso-estado` usan `pi.exec` asíncrono con argumentos separados, sin interpolación de shell. El estado actualiza el indicador al consultar, sin un daemon o temporizador permanente. No se inyecta una clase ni se crea estado de sesión de estudio: eso queda para Fase 4.

## D3.2 — Propuesta explícita y protección de curación manual

`guardar_curso` recibe la ruta de un JSON de propuesta dentro de `_procesado/`. El contrato y el YAML son textos, para conservar comentarios y cambios manuales al construir el diff, no una reserialización automática del índice anterior. El código valida documentos/temas, copia solamente PDFs nuevos desde `_entrada/` y verifica SHA-256. No permite eliminar documentos/temas, reclasificar o renombrar las fuentes existentes ni escribir progreso existente. La creación inicializa únicamente `version: 1, temas: {}, historial: []` por código.

Para un curso ya existente se muestra el diff y se requiere `ctx.ui.confirm`; sin UI se rechaza y no hay argumento de autoaprobación. Se comparan huellas de propuesta e índice/contrato/progreso al aplicar, y otra vez después de las copias para detectar una edición durante ellas. Los rechazos conservan los textos actuales. Una falla de disco puede dejar una carpeta/copia nueva incompleta: se conserva para intervención, sin borrar ni pisar material para simular reanudación. La ingesta de páginas reutiliza la reanudación existente. El CLI local expone la operación interna para el usuario con permisos de edición; no es un atajo para que una skill eluda la confirmación.

El informe visible verifica su hash antes de regenerarlo y publica un registro recuperable antes del Markdown, siguiendo el patrón de Fase 2. Una edición manual queda preservada.

## D3.3 — Validez estructural no es preparación ni fidelidad

El validador comprueba esquemas de índice/progreso, rutas y symlinks, archivos/páginas, objetivos, ids, ítems, soluciones, hashes de fuentes/transcripciones y ciclos de prerequisitos. YAML con claves duplicadas o alias se rechaza. Se distingue `ok` (sin errores estructurales) de `listo_estudio` (además sin avisos). Páginas referidas sin procesar o pendientes se enumeran como avisos explícitos; referencias a ítems inexistentes sí son errores. El doctor debe detectar una instalación/estructura rota, no fallar artificialmente porque un borrador todavía necesita curación o revisión humana. Imprime sus avisos de preparación sin certificar calidad.

El presupuesto del contrato se avisa mediante estimación bytes UTF-8 / 4; no se agregó un tokenizer ni se presenta esa estimación como un conteo exacto. La escritura/fusión/restauración de progreso sigue reservada a Fase 7; aquí sólo se inicializa el archivo vacío y se lo valida de lectura.

## D3.4 — Redes real y checkpoint de revisión pendiente

Se copiaron 14 PDFs de Redes (754 páginas), sin GRIMALDI ni la muestra externa de Limric. Se leyeron programa, portada/edición, índices y páginas relevantes. La ingesta real en segundo plano seleccionó 52 páginas y dejó claro qué quedó fuera. Se transcribieron con la tool registrada las 23 páginas que requerían visión: 23 respuestas, sin fallos de llamada, conservando cinco pendientes heurísticos. Se guardaron diez ejercicios del Práctico 1 y cinco preguntas del parcial 26/09/2024; sus soluciones integradas no se incluyeron en los enunciados. Repetición: 52 cachés base y 23 de visión, sin llamadas nuevas.

La fuente oficial aportada es un programa aprobado en 2017: no se presume vigente su evaluación en 2026. Recomienda la quinta edición del libro; la aportada es la séptima, complementaria según el programa. Sus rangos y capítulos se verificaron, sin trasladar números de otra edición. Se comprobó que los tres archivos Capitulo3/4/5 son diapositivas en inglés de 2016, no capítulos duplicados, y que el Práctico 7 es de 2025 (los primeros seis son de 2026). Se corrigieron esas etiquetas del borrador inicial antes de entregarlo para revisión.

El índice actual tiene ocho temas y todavía no asigna los 15 ítems. La propuesta validada los asigna y agrega las tres diapositivas, con sus objetivos/esquemas verificados; aún no se copiaron esos PDFs ni se reemplazó el índice existente. La diferencia queda visible en `cursos/redes/revision-inicial.md`, `indice-propuesto.yaml` y `cambios-propuestos.diff`. Hay 261 páginas referidas pendientes en el índice actual y 268 en la propuesta. La tabla de solución del parcial PDF 4 no se declara fiel por su puntaje. El usuario confirmó «Aprobado; continuá» a la tabla y las tres diapositivas. Antes del cierre local se cotejaron las huellas de propuesta/base con las registradas, se aplicó exactamente esa propuesta y se conservaron contrato, progreso y fuentes previas. No se simuló `ctx.ui.confirm` ni se debilitó el rechazo de la tool sin UI: esta operación local contó con la autorización explícita del chat. Resultado: 17 documentos, 8 temas, 15 ítems asignados y 268 páginas referidas pendientes. Se repitieron tests y doctor y se cerró Fase 3 en `3616e71`.

## D4.1 — Contexto estructurado y estado de rama

Se verificaron las docs instaladas de extensiones, TUI, SDK, sesiones, formato de sesión y compactación, más `prompt-customizer.ts`, `todo.ts`, `commands.ts`, tipos y fuentes de `ExtensionRunner`, `EventBus` y autocompletado de pi 1.3.0. Se mutan `event.systemPromptOptions.sections` (`teach`, `modo_curso`, `curso`), sin retornar un campo inexistente ni reemplazar el prompt completo. El contenido de teach/modo se lee al activar/restaurar. El dossier es un mapa acotado y se reinyecta en cada arranque de agente; no depende de que el modelo recuerde cargar la skill tras compactar. Las otras secciones se conservan.

`appendEntry('curso', {curso, tema, log})` guarda estado no contextual. Para un tema ad hoc se añade su mapa mínimo, de modo que pueda restaurarse sin inventar una entrada al índice. La restauración recorre `getBranch()`, también en `session_tree`, no `getEntries()` con ramas abandonadas. Un estado inexistente elimina nuestras secciones y estado de barra. La curación/progreso son snapshots al activar/restaurar; después de ampliar el curso se reactiva el tema, sin watchers ni una segunda base de datos.

El autocompletador instalado pasa todos los argumentos previos, y reemplaza ese prefijo completo: devuelve `curso tema`. Su caché se invalida al cambiar el mtime de `indice.yaml`. La resolución por id precede a nombre/alias, aproximación y selector; fuera del índice se ofrece bibliografía BM25 y modo ad hoc, nunca una asociación persistida sin curación.

## D4.2 — Lectura liviana, render local y log sin destrucción

Se reutiliza el parser YAML seguro de Fase 3 mediante un proceso Python asíncrono al activar/restaurar; las lecturas de páginas y búsqueda son TS puro. No se creó un índice paralelo normalizado. Los errores de preparación son avisos y se usa lo identificable. Los retornos de lectura están acotados a 32000 bytes, con citas base 1; las soluciones requieren petición explícita y vínculo real. `ver_pagina` renderiza sin OCR/modelo y usa el mismo formato de caché/1800 px de Fase 2, también para páginas que no fueron seleccionadas en ingesta. Un render cambiado se preserva. No se agregan dependencias ni modelos.

Los logs se crean con apertura exclusiva y sufijos; el vínculo del curso usa `backfill: false`, sin arrastrar programación previa ni reemplazar una nota. El bus instalado emite void y captura errores de listeners: se añade un acuse explícito con timeout para que `/estudiar` no arranque fingiendo que vinculó el log. El comando manual mantiene el relleno de rama, pero exige confirmación para una nota no vacía. Se reemplazó la reescritura de toda la nota al añadir mensajes por append. Un quiz abortado sin detalles no se califica como incorrecto.

La restauración original de md-log usaba `ctx.ui.theme`, que falla en un SDK headless sin tema inicializado. Se comprobó con un error real y se usa estado de texto plano, igual que el vínculo. La regresión prueba restauración con un getter de tema que arroja error. Se conservan la numeración/barajado de los quizzes y la omisión de resultados de lectura/soluciones en el log. Adjuntos de fotos quedan para Fase 5.

## D4.3 — Smoke real y aislamiento del harness

El usuario autorizó continuar tras aprobar Fase 3. Se probó `/estudiar redes retardos` con el modelo principal configurado, seis tools de lectura/preguntas y detención en el primer quiz sin responder por el alumno. Primera pregunta: 20,08 s; compactación real; cierre y reapertura del mismo JSONL, recreando loader/runner. Curso, tema, log y teach se restauraron; progreso quedó intacto. Dossier de 6296 bytes, lector 0,45 ms, BM25 4,75 ms y render frío adicional 388,6 ms. Son mediciones puntuales, no garantías ni prueba de una clase completa. No se hizo clic manual en los enlaces o en el selector `/resume`.

Se conservaron dos intentos incompletos del harness. `SettingsManager.inMemory(settings combinados)` pierde el origen de paquetes del proyecto y ocasionó una descarga redundante a la caché global; no se usa en el harness final, no se cambian manifiestos/credenciales y no se borra esa caché. Se usa `SettingsManager.create` y `applyOverrides` efectivos de proceso. Los overrides se aplican **después** de `loader.reload()`, que recarga settings; antes se descartaban y el segundo intento no podía compactar poca historia. No son retries del producto. El script real opcional conserva artefactos y usa una sesión independiente, no el archivo del usuario.

`modo-curso.md` adapta el borrador del plan a capacidades realmente presentes: researcher normal disponible sin anclaje/caché automáticos (Fase 6); resumen de cierre en chat/log sin tool de progreso ficticia ni escritura manual (Fase 7); no promete fotos durables antes de Fase 5. La aceptación técnica de esta fase no aprueba revisiones individuales ni habilita Fase 5 sin nuevo OK. Ese OK llegó después con «Aprobado; continuá».

## D5.1 — Imágenes nativas, formato fiel y recuperación sin reemplazos

Se releen las docs instaladas completas de extensiones, SDK, message-types, session-format y TUI, el ejemplo SDK 06 y las declaraciones de `PromptOptions`/`ImageContent`. La API real recibe `{type: 'image', data: base64, mimeType}` en el contenido del mensaje user; `session.prompt(texto, {images})` reproduce esa entrada sin implementar transporte. El logger usa `message_end` y la misma función de formato al rellenar la rama. Sólo copia imágenes del usuario, nunca resultados de `ver_pagina` o soluciones.

Se conserva PNG/JPEG/WebP/GIF, no el `.jpg` incondicional ilustrado en el plan: recodificar perdería fidelidad y agregaría trabajo/dependencias. Timestamp/posición/hash completo vuelven idempotente la copia de un mensaje, con comparación byte por byte antes de reutilizarla. Creación exclusiva y rechazo de symlinks protegen fotos/notas existentes; validación de MIME (sin propiedades heredadas), base64 y firma, sin prometer decodificación o legibilidad. Nuevos archivos `0600`, nuevos directorios `0700`, sin cambiar permisos del usuario. Fallos aislados por imagen: aviso y texto preservado. No se purgan parciales/huérfanos ni temporales del cliente.

Dentro del vault, embed con ruta desde el vault para evitar ambigüedades entre carpetas; para notas genéricas fuera de cwd se usa el subdirectorio relativo `adjuntos/`. Un mensaje sin texto también se registra. La restauración no reescribe notas ni duplica imágenes. No se agregan dependencias al logger ni un comando de fotos.

## D5.2 — Manuscrito real externo y alcance del checkpoint

Se buscó autónomamente una foto pública auténtica de un cuaderno (Wikimedia Commons, FlexingCA, CC0); original y procedencia en `_entrada/muestras/externas/fase5/`. No se simuló escritura, no se rasterizó un PDF digital y no se ingesta el material. Es de finanzas, no de Redes: se ensayó aisladamente el protocolo real y la pauta general de justificar de `curso.md`, sin inventar un ítem del curso, rúbrica ni puntaje. El log técnico queda en `informes/fase5/`, no en sesiones/fuentes de Redes.

Se ocultó intencionalmente un dato en un recorte derivado para probar que se pide aclaración antes de corregir. Primer turno de `gpt-6.1-sol`: transcripción provisional y petición de foto completa, sin completar el dato ni resultado. Segundo: original completo, transcripción antes de devolución, cálculo cotejado con aritmética exacta, sin puntaje al faltar una escala aplicable. Dos adjuntos idénticos a los mensajes y reapertura del JSONL sin duplicación; índice, contrato, progreso y teach intactos. No hubo alumno ni respuestas reales del usuario.

El harness inicial exigía un signo `?` y falló con la petición válida «Mandame la foto completa». Se corrigió esa aserción y se retomó el mismo JSONL mediante un script temporal que luego se retiró: dos llamadas en total, no repetición de la primera. Se conserva evidencia del recorrido reanudado y se distingue su tiempo del recorrido total. El script opcional normal incorpora la corrección. Usa Pillow 13.0.0 ya fijado por OCR sólo para crear el caso negativo de prueba; no es un motor ni una dependencia nueva.

No se cambió ni se leyó el contenido del portapapeles personal (sólo tipos disponibles). El código nativo instalado confirma que Ctrl+V usa `wl-paste` y puede insertar una ruta temporal antes del envío, pero esto no prueba la tecla física en tmux. Esa comprobación y el render en Obsidian requieren el paso manual de SETUP; doctor sólo acredita guardado/embed sintético con runtime. No se declara probada una respuesta manuscrita de Redes o una rúbrica detallada ausente. El usuario aprobó el checkpoint con «Confirmado, avanzá»; revisión humana individual y progreso no se modifican.

## D6.1 — Researcher existente, despachado desde una tool de curso

`investigar_tema(modo, afirmaciones)` arma el contexto y llama a `ctx.executeTool("subagent", …)` con el modelo de config; conserva validación, permisos, sandbox, tmux y entrega automática existentes. Se verificaron `ExtensionToolContext`, `AgentToolCallOutcome` y el ejecutor anidado instalado; no se llama a APIs privadas desde producto. Se adopta pi **1.4.0**, ya instalado, como versión exacta comprobada: docs de extensiones/TUI, SDK/message-types/session-format, ejemplo hello, declaraciones, tests y runtime. No hay reinstalación ni cambios a preferencias personales. F4 mantiene un smoke acotado sin hijos; F6 tiene su propio ensayo opcional para esperar entregas antes de cerrar.

La preparación silenciosa del modelo llama a la tool antes del probe si falta caché: no es un daemon ni una llamada pesada dentro de /estudiar. Se comprobó el proceso real, no sólo una simulación de schema. Modo ad hoc admite verificar sin inventar un tema/caché de alcance. La tool entrega un resumen inmediato en español y no promete resultados antes de recibirlos.

## D6.2 — Entradas concretas y salida contrastada

El hijo recibe contrato completo, afirmaciones A1–A3, rutas/citas de transcripciones preparadas y enunciados curados de ejercicios sin soluciones. No se pasan resultados ni páginas crudas de evaluaciones con soluciones integradas. Presupuesto: 50 transcripciones y 200000 bytes totales, inspección acotada a 2000 posiciones y 100 archivos de huella. No se hace OCR ni se recorre el PDF. La comparación es de la afirmación original contra el curso, no de una corrección contra las fuentes; la versión corregida se separa del veredicto. Extensiones rotuladas fuera del material, límites de búsqueda/lectura por modo, huecos explícitos.

Los primeros ensayos detectaron dos etiquetas falsas de «concuerda» pese a una explicación correcta. No se relajó el test para aceptarlas: se aclaró el veredicto literal con ejemplo y se controlaron dos afirmaciones falsas y una verdadera. También se añadieron los enunciados y el contrato completo al descubrir contexto omitido por el hijo. El ensayo final etiquetó correctamente los tres casos; eso no mide una tasa de fiabilidad ni certifica otras atribuciones, URLs o lecturas. Revisión humana sigue pendiente.

## D6.3 — Caché inmutable y correlación por rama

La huella incorpora tema, contrato, enunciados, configuración/modelo, prompt del agente, índice, metadatos/calidad y transcripciones utilizadas. No incorpora progreso: aprender algo no invalida la investigación. Cabecera de control y hash del cuerpo distinguen una publicación íntegra de una nota editada/incompleta. Publicación mediante temporal privado, fsync y hardlink exclusivo, sin sobrescribir. Primera salida <tema>.md; nuevas fuentes/prompts producen <tema>-<huella>.md. El dossier enlaza la generación vigente, fecha/modelo y un extracto acotado como datos externos, no instrucciones. Se preservan notas manuales y generaciones anteriores, sin limpieza automática.

`appendEntry("curso-researcher", …)` registra inicio/fin; sólo getBranch correlaciona nombre y tarea con una entrega, sin usar ramas abandonadas. Se comprueban fuentes al recibir, éxito del hijo, formato y citas admitidas antes de guardar alcance. Verificar no reemplaza ese mapa. Una entrega de otro tema no cambia el activo. Los errores dejan un aviso y se sigue con el material. Tras reinicio con despacho sin entrega confirmada, no se duplica automáticamente: puede retomarse explícitamente por nombre con subagent_message. No hay sondeo ni segunda base de tareas.

## D6.4 — Evidencia y límites

Cinco iteraciones técnicas con principal Sol y diez hijos Luna quedan en _procesado/fase6/. Dos se detuvieron por el fallo de veredicto; las intermedias no se confunden con el ensayo del contexto final. Evidencia final: prueba-1792630409914. Primera pregunta 20,62 s mientras alcance tardó 68 s en segundo plano; segunda pregunta 7,42 s y cero hijos adicionales. Safe_bash, web_search y web_fetch reales en los hijos. Controles falsos del script, no errores del estudiante. Ninguna pregunta respondida, nota de progreso escrita ni curso completo realizado. Los 18 originales, 17 copias, contrato, índice, progreso, teach y plan conservan integridad. Costo de catálogo de todos los ensayos: 0,3807107; no factura. Revisión de informes y piloto humano siguen pendientes.

## D7.1 — Un backend de progreso, sin segunda base de datos

`progreso.py` reutiliza YAML seguro, rutas seguras, bloqueo del curso y escritura atómica/fsync existentes. `sesion.py` lo consulta al activar/restaurar; el registro usa el puente Python asíncrono ya instalado, ahora con selector interno de script. No agrega dependencia, daemon, watcher ni OCR. La tool es secuencial y conserva la cola de mutación de archivos; el bloqueo Python protege también dos procesos del proyecto. Las ediciones externas no cooperativas aún pueden competir en el último intervalo antes de rename: se comprueban bytes antes de publicar, no se promete una transacción con editores arbitrarios.

Cada guardado valida esquema, fechas de evidencia no futuras, tema/ítems del curso y log del mismo tema; conserva exactamente los bytes previos como .bak. Fusiona listas por igualdad exacta, errores por descripción y borde moviendo textos explícitamente confirmados entre domina/falla. No hace deduplicación semántica ni decide dominio: eso sigue siendo juicio del modelo sobre respuestas observadas. Conserva otros temas e historial, con una entrada por tema/log y cierre monotónico. No permite pasar evidencia existente a sin_empezar por cerrar sin respuestas nuevas.

Si progreso es inválido, un .bak válido se restaura con aviso, preservando los bytes inválidos por SHA en _procesado/. Sin respaldo válido se conserva todo y se continúa sin registrar hasta reparar; un backup inválido existente tampoco se reemplaza sin intervención. Tests cubren cortes, bloqueo, edición concurrente, UTF-8 inválido, symlinks e idempotencia. No se usó progreso real de Redes para probar recuperación.

## D7.2 — Cierre confirmado y recuperación desde logs

`/fin` solicita un registro final; cierre natural usa `cierre:true`. Entradas curso-cierre/curso-progreso en getBranch correlacionan solicitud y guardado con el log activo. Se verificó AgentSettledEvent de pi 1.4.0: incluye aborted y ocurre después de continuaciones/reintentos. Sólo se desvincula tras un mensaje assistant completo con texto y stopReason stop, sin llamadas pendientes; Escape/error no cierra. La regresión inicial falló al cerrar sin mensaje final y quedó verde con esta condición. md-log serializa su resumen y el unlink con el mismo lock, comprueba el archivo esperado y acusa éxito/error. Sin acuse se mantiene el curso activo. Ad hoc puede cerrar sin escribir un tema ficticio.

La próxima activación detecta el último log del tema sin cierre final; coincide el nombre completo del tema y no sólo un sufijo (regresión roja→verde con otra-derivacion frente a derivacion). Historial legado sin flag se considera registrado. leer_sesion_anterior devuelve texto acotado y SHA; la propuesta se confirma con UI real y el backend verifica esa huella. La reconstrucción se etiqueta, preserva el log y no cierra la sesión actual. No supone errores a partir de preguntas sin respuesta ni persiste pruebas técnicas como si fueran intentos del usuario. La confirmación se cubrió con fixtures (aceptar, rechazar, sin UI y cambio del log), no como clic humano real.

## D7.3 — Confirmar el borde, no reiniciar el probe

Modo-curso pide confirmar domina/falla previos con hasta tres preguntas conceptuales en total; si los contradice la nueva evidencia, se amplía el mapeo. El dossier prioriza borde/próximo paso frente a listas de intentos. La sugerencia omite dominados y exige prerequisitos dominados; orden de preferencia: en curso, repasar, temas nuevos accesibles. No se agrega un planificador de repasos.

Ensayo real final: _procesado/fase7/prueba-1792672775843/resultado.json. Dos sesiones nuevas de la fixture prueba-progreso con Sol, tres preguntas en cada una. El sistema recibió el borde de la primera; se cotejó en el JSONL de la segunda y las preguntas lo confirmaron en tres, con igual borde registrado. Dos /fin guardaron y conservaron el resumen antes de desvincular. Respuestas programadas: primer quiz correcto y siguientes no sé; sólo describen al alumno virtual aislado. No certifican el nivel del usuario, una clase completa, práctica evaluada ni el piloto humano. Researcher/visión se excluyeron de este smoke porque ya tienen ensayos propios.

Se conservan los intentos fallidos: modelo inicial distinto (1792636116750); ruta de backend incorrecta (1792636295117); rechazo prudente a convertir respuestas sintéticas en evidencia del usuario (1792636612356); simulador que respondió todo bien, sin techo (1792636786643); divergencia de proveedor (1792672185762); openai sin credenciales (1792672223350). Se corrigieron el harness y su guardia temprana de autenticación, no se relajó la exigencia de piso/techo. También se corrigió una fixture de test que editaba los datos antes de su serialización, no el snapshot activo. Uso registrado en JSONL de todos los ensayos: 54873 entrada, 3199 salida, 172544 lectura de caché, costo de catálogo 0,1589904 (no factura; excluye doctor y pings).

## D7.4 — Cambio de proveedor autorizado, no fallback silencioso

Al retomar la fase, openai ya no tenía autenticación configurada y el modelo seleccionado por el runtime era openai-codex/gpt-6.1-sol. Doctor falló ambos pings openai/gpt-6-luna. Se informó y el usuario eligió «Usar openai-codex». Antes de adoptar el cambio respondieron openai-codex/gpt-6.1-sol por texto y gpt-6-luna por texto/PNG. Se verificaron docs de modelos y las declaraciones públicas del runtime instalado. Se cambiaron sólo .pi/settings.json, curso.config.json, frontmatter del researcher y las expectativas de los scripts de ensayo; ninguna credencial ni configuración personal.

Doctor completo volvió a verde con el nuevo proveedor; los informes previos conservan sus ids históricos. El cambio de modelo/config invalida por diseño las claves de researcher/visión, preservando sus generaciones anteriores. No se recreó alcance ni se retranscribieron PDFs durante Fase 7: el próximo estudio puede lanzar un alcance nuevo, y una futura preparación de visión explícita puede consumir llamadas nuevas. No se alteró la versión de pi ni se eligió otro nombre de modelo. No se relanzaron los ensayos históricos de fotos/visión/researcher sólo para actualizar su etiqueta de proveedor; siguen disponibles como opcionales.
