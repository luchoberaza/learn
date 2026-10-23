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

**Fase 8 autorizada, piloto en curso:** `../fricciones.md` registra 3–5 sesiones reales para priorizar y reprobar sus tres trabas principales. Todavía tiene 0 sesiones del piloto; el alumno virtual no cuenta. El commit/checkpoint de cierre de esta fase sigue pendiente.

**Auditoría de robustez (2026-10-22):** `../AUDITORIA.md` midió sesiones reales, una ingesta y arneses sin modelo sobre copias del vault; los P0 y P1 se arreglan y los P2 sólo se reportan. Con las decisiones del usuario (DA1–DA7) se integraron en la rama `cursos`, hasta `2a3f212`, tres etapas de arreglos: entorno, ingesta, cursos, progreso, quiz, researcher, sesión, presentación y preparación por tema (DA8–DA26); después, pedagogía y remates de integración (DA7, DA27, DA28). Sobre ese código, sin modelo ni red: 234 tests Node en verde (incluyen la suite Python) y 150 tests Python OK; `doctor --sin-red`, en una copia del vault y fuera de tmux, sólo marca «Dentro de tmux», las rutas del vault (por la copia) y los cuatro chequeos que `--sin-red` omite. Pendiente: no hay simulacro de varios temas ni del curso completo, ni ficha del alumno (H58: patrones de error entre temas, confianza declarada y fechas de evaluación).

## D0.1 — Conservar el upstream y fijar los subagentes

- `.pi/` es el clon del fork `santi-esquerre/learn`, rama `cursos`.
- `origin`: fork del usuario. `upstream`: `amosblomqvist/learn`.
- Base original de ambos inspeccionada: `7cfd8942f82ab9476e63572387e1fe9bcea5082c`.
- Subagentes `3.7.2`, fijados al commit `c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7`, instalados con alcance local.
- No se modificaron `skills/teach/SKILL.md`, quiz, ask-user-question, visual-tools ni md-log. El researcher solo recibió el modelo acordado y una instrucción de salida en español. Los modos anclados al curso quedan para Fase 6.
- Los checkouts y node_modules no se versionan. Sí se versionan las declaraciones, lockfiles, configuraciones e instalador idempotente.

*Superada en parte por DA12 y DA21: el researcher del curso ya no es un subagente, y quiz y ask_user_question se tradujeron y cambiaron de forma. `skills/teach/SKILL.md` sigue intacto.*

## D0.2 — La instalación de pi manda

Se verificó pi `1.3.0` contra sus documentos instalados: README, extensiones, paquetes, CLI, configuración, SDK, modelos, TUI y seguridad; se consultaron ejemplos SDK 02/06 y hello, y las declaraciones exportadas.

- El loader conserva los alias `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai` y `@sinclair/typebox`.
- Prueba real: las extensiones originales, los subagentes y la web cargan sin errores ni warnings.
- El SDK usa `ModelRuntime.getModel/completeSimple`; la fachada `ctx.modelRegistry` tiene `find/streamSimple` y no los mismos nombres. El doctor usa `session.modelRuntime`, verificado en las declaraciones instaladas. No confundir ambas superficies en fases posteriores.
- Los tests y el doctor usan sesiones en memoria y carga con confianza solo para ese proceso; no guardan aprobaciones ni prompts de prueba en las sesiones del usuario.

*Superada en parte por D6.1: la versión verificada y fijada es pi 1.4.0.*

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

*Superada en parte por DA12: el researcher del curso no pasa por pi-interactive-subagents, el puente ni `safe_bash`; carga pi-web-access directo y usa `web_search, web_fetch, read`. El puente queda para los subagentes fuera del curso.*

Comprobación real: la consulta «regla de la cadena derivada universidad» devolvió con Exa fuentes de UNAM y OpenStax; `web_fetch` leyó una página completa. Para el smoke de lectura se usa una página de Wikipedia con contenido suficiente: `example.com` activaba la heurística de contenido incompleto de este extractor, no un fallo de conexión.

No se prometen cuotas ilimitadas ni disponibilidad garantizada de los endpoints sin clave. No se añadieron claves. Las variables de API que se agreguen en el futuro podrían activar créditos de esos proveedores; revisar antes de hacerlo.

## D0.4 — Catálogo no equivale a permiso de uso

El usuario aprobó inicialmente `openai/gpt-5.4-mini` para researcher y `openai/gpt-5.5` para visión. Se guardaron inicialmente en `curso.config.json`, con el frontmatter del researcher sincronizado.

Las llamadas reales de ambos fallaron con HTTP 400: la cuenta ChatGPT/Codex no admite esos ids, aunque el catálogo de pi los liste. El diagnóstico no los marca en verde por tener credenciales del proveedor o aparecer en `/model`.

Se probó también `openai/gpt-6.1-sol`, el modelo de esta sesión: respondió un ping de texto y aceptó un PNG válido. Se ofreció como alternativa, sin sustituir silenciosamente la elección del usuario.

El usuario eligió después **`openai/gpt-6-luna` para ambos roles**. Se actualizaron `modelo_researcher`, `modelo_vision` y el frontmatter del researcher. El doctor ejecutado dentro de tmux confirmó una respuesta real de texto y otra con un PNG para ese modelo; todo el diagnóstico automático quedó en verde. Esto no evalúa la fidelidad de transcripción matemática, que se medirá en el benchmark. No se solicitaron ni tocaron claves.

El modelo principal del proyecto se fijó a `openai/gpt-6.1-sol`, para que abrir pi no dependa del predeterminado global `gpt-5.5` que esta cuenta rechaza. No se modificó el predeterminado global.

*Superada en parte por D7.4: el proveedor de los tres roles es `openai-codex`.*

## D0.5 — Función fish, no alias textual ni tmux anidado

Pedido del usuario: `pi-learn` abre pi en la carpeta actual con tmux configurado.

- Función autoload en `~/.config/fish/functions/pi-learn.fish`, con copia versionada; `config.fish` queda intacto.
- Argumentos pasados como lista, sin `eval` ni concatenación de órdenes. Tests con espacios, comillas y metacaracteres.
- Fuera de tmux: servidor exclusivo `-L pi-learn`, configuración `config/tmux.conf`, directorio actual y sesión nueva en cada invocación. Se evita el problema de `new-session -A`: podría adjuntar otra carpeta y descartar argumentos.
- Dentro de tmux: ejecutar pi sin anidamiento ni modificaciones globales. La configuración existente inspeccionada ya habilita clipboard, passthrough y teclas extendidas.
- La configuración dedicada importa las preferencias personales existentes y ajusta las capacidades necesarias para pi. No se modificó `~/.config/tmux/tmux.conf` ni archivos de Omarchy.
- El arranque fish existente inicializa conda. Se deja un margen conservador de 2500 ms para los hijos, usando la variable documentada `PI_SUBAGENT_SHELL_READY_DELAY_MS`; se respeta un valor ya configurado.

Pruebas: sintaxis, ramas dentro/fuera de tmux y argumentos mediante stubs; además `pi-learn --version` ejecutado bajo un pseudoterminal real abrió tmux, imprimió `1.3.0` y salió correctamente. La interacción de Ctrl+V requiere una imagen real del portapapeles del usuario: no se reemplazó ni se leyó ese portapapeles durante la instalación.

*Superada en parte por DA3 y DA8: una sesión de tmux por carpeta con `new-session -A` y `destroy-unattached`, pi con `-ns --skill .pi/skills`, y 300 ms para el shell de los subagentes, que ya no incluyen al researcher del curso.*

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

*Superada en parte por DA21: los popups de quiz y ask_user_question están en español.*

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

*Superada en parte por DA4: el venv usa ahora el Python 3.13.13 de uv. Tesseract sigue siendo el de Conda, fijado con `ruta_tesseract` (DA22).*

La referencia de tres páginas usó `openai/gpt-6-luna`, con `session.modelRuntime.getModel/completeSimple` verificados contra pi `1.3.0`, igual que el doctor; no se intercambió con la fachada de extensiones. No se repitieron llamadas ni se implementó anticipadamente la tool E. Los costos de catálogo registrados no son una factura.

Los informes visibles están en `informes/fase1/` del vault porque `_procesado` está excluido de Obsidian. Se publican copias nuevas, sin sobrescribir notas existentes. No se creó un curso ni se mezcló GRIMALDI con Redes.

El usuario aprobó la base presentada y autorizó continuar con «aprobado, sigamos». **Fase 1 cerrada por aprobación de esa base con la limitación declarada.** En ese checkpoint la muestra de parcial/práctico escaneado real seguía pendiente; no se la declaró ensayada ni se la sustituyó. La prueba externa posterior de Fase 2 se registra abajo.

## D2.1 — Visión en la extensión; persistencia en Python

Se usa la fachada real de extensiones de pi `1.3.0`: `ctx.modelRegistry.find/streamSimple(...).result()`, con un único mensaje que contiene prompt e imagen PNG. Se verificaron declaraciones, docs y ejemplos y se ejecutaron tres llamadas reales con esa fachada, no solo con el SDK. La conversación principal no se envía y la tool solo devuelve cantidades, ids de páginas y avisos. Se informa el uso agregado al runtime, también si una respuesta llegó truncada.

El render, la validación de fuente, el bloqueo y la persistencia reutilizan `almacen.py` y el registro por página de Fase 1; `atomico` admite ahora bytes para publicar PNG sin archivos parciales. La extensión espera al hijo Python de forma asíncrona. No se agrega un daemon, una cola persistente ni otro motor. Los reemplazos se serializan con `withFileMutationQueue` y `flock`; además se compara el hash previo al guardar para detectar cambios durante la llamada remota.

El modelo se toma de `curso.config.json`, sin fallback ni reintentos automáticos. Superar el límite de páginas requiere `ctx.ui.confirm`, con rechazo seguro sin UI y sin argumento de autoaprobación. Fuente/modelo/prompt/umbral y ediciones de Markdown controlan la caché. La visión vigente conserva la clave base, de modo que reanudar la ingesta no la degrade a OCR. Un error mantiene el texto previo y el estado pendiente; `[ilegible]` o LaTeX roto no se dan por recuperados.

`revision_humana: pendiente` se conserva incluso con puntaje alto. La calidad automática no certifica la semántica ni la fidelidad de las tablas. Se reconstruyen índice e informe por página para mantener la consistencia; agrupar esas escrituras queda diferido hasta medir un problema en cursos grandes.

*Superada en parte por DA2 y DA24: la preparación por tema transcribe sin pedir confirmación (tope de 150 páginas por corrida), y un error ya no degrada una página que era buena: la marca `error_vision` para reintentar.*

## D2.2 — Ítems elegidos por el agente, no por otro pipeline LLM

`guardar_items` es una tool de persistencia para la preparación. No segmenta ni inventa por su cuenta: recibe los ítems que el agente identificó al leer las páginas. Guarda ids originales, páginas, enunciado y solución opcional `{doc, id}` en `items.yaml`, con hashes de fuente/páginas y revisión humana pendiente. Valida duplicados, rangos, visión previa y referencias existentes; preserva YAML con cambios manuales. No devuelve los enunciados ni las soluciones completas.

PyYAML `6.0.3` vuelve a ser dependencia directa **ahora que tiene uso real**: serialización/lectura segura de `items.yaml`. No se instaló ningún paquete del sistema ni se añadieron dependencias de ML.

*Superada por DA2 y DA13: la preparación por tema segmenta con `modelo_vision`, y un ítem admite además `solucion_de` (solución del mismo documento) y `puntos`. `guardar_items` sigue para preparar un documento a mano.*

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

`guardar_curso` recibe la ruta de un JSON de propuesta dentro de `_procesado/` de la raíz del vault (nunca en `cursos/<slug>/_procesado/`). El contrato y el YAML son textos, para conservar comentarios y cambios manuales al construir el diff, no una reserialización automática del índice anterior. El código valida documentos/temas, copia solamente PDFs nuevos desde `_entrada/` y verifica SHA-256. No permite eliminar documentos/temas, reclasificar o renombrar las fuentes existentes ni escribir progreso existente. La creación inicializa únicamente `version: 1, temas: {}, historial: []` por código.

Para un curso ya existente se muestra el diff y se requiere `ctx.ui.confirm`; sin UI se rechaza y no hay argumento de autoaprobación. Se comparan huellas de propuesta e índice/contrato/progreso al aplicar, y otra vez después de las copias para detectar una edición durante ellas. Los rechazos conservan los textos actuales. Una falla de disco puede dejar una carpeta/copia nueva incompleta: se conserva para intervención, sin borrar ni pisar material para simular reanudación. La ingesta de páginas reutiliza la reanudación existente. El CLI local expone la operación interna para el usuario con permisos de edición; no es un atajo para que una skill eluda la confirmación.

El informe visible verifica su hash antes de regenerarlo y publica un registro recuperable antes del Markdown, siguiendo el patrón de Fase 2. Una edición manual queda preservada.

*Superada en parte por DA23: un `aplicar` cortado ya no deja copias con el nombre final; el curso nuevo se arma en `cursos/.<slug>.nuevo/` y cada PDF se publica con un hard link tras verificar su SHA-256.*

## D3.3 — Validez estructural no es preparación ni fidelidad

El validador comprueba esquemas de índice/progreso, rutas y symlinks, archivos/páginas, objetivos, ids, ítems, soluciones, hashes de fuentes/transcripciones y ciclos de prerequisitos. YAML con claves duplicadas o alias se rechaza. Se distingue `ok` (sin errores estructurales) de `listo_estudio` (además sin avisos). Páginas referidas sin procesar o pendientes se enumeran como avisos explícitos; referencias a ítems inexistentes sí son errores. El doctor debe detectar una instalación/estructura rota, no fallar artificialmente porque un borrador todavía necesita curación o revisión humana. Imprime sus avisos de preparación sin certificar calidad.

El presupuesto del contrato se avisa mediante estimación bytes UTF-8 / 4; no se agregó un tokenizer ni se presenta esa estimación como un conteo exacto. La escritura/fusión/restauración de progreso sigue reservada a Fase 7; aquí sólo se inicializa el archivo vacío y se lo valida de lectura.

*Sigue vigente: las páginas pendientes y los documentos sin segmentar son avisos, pero ya no esperan una preparación manual (DA1, DA2).*

## D3.4 — Redes real y checkpoint de revisión pendiente

Se copiaron 14 PDFs de Redes (754 páginas), sin GRIMALDI ni la muestra externa de Limric. Se leyeron programa, portada/edición, índices y páginas relevantes. La ingesta real en segundo plano seleccionó 52 páginas y dejó claro qué quedó fuera. Se transcribieron con la tool registrada las 23 páginas que requerían visión: 23 respuestas, sin fallos de llamada, conservando cinco pendientes heurísticos. Se guardaron diez ejercicios del Práctico 1 y cinco preguntas del parcial 26/09/2024; sus soluciones integradas no se incluyeron en los enunciados. Repetición: 52 cachés base y 23 de visión, sin llamadas nuevas.

La fuente oficial aportada es un programa aprobado en 2017: no se presume vigente su evaluación en 2026. Recomienda la quinta edición del libro; la aportada es la séptima, complementaria según el programa. Sus rangos y capítulos se verificaron, sin trasladar números de otra edición. Se comprobó que los tres archivos Capitulo3/4/5 son diapositivas en inglés de 2016, no capítulos duplicados, y que el Práctico 7 es de 2025 (los primeros seis son de 2026). Se corrigieron esas etiquetas del borrador inicial antes de entregarlo para revisión.

El índice actual tiene ocho temas y todavía no asigna los 15 ítems. La propuesta validada los asigna y agrega las tres diapositivas, con sus objetivos/esquemas verificados; aún no se copiaron esos PDFs ni se reemplazó el índice existente. La diferencia queda visible en `cursos/redes/revision-inicial.md`, `indice-propuesto.yaml` y `cambios-propuestos.diff`. Hay 261 páginas referidas pendientes en el índice actual y 268 en la propuesta. La tabla de solución del parcial PDF 4 no se declara fiel por su puntaje. El usuario confirmó «Aprobado; continuá» a la tabla y las tres diapositivas. Antes del cierre local se cotejaron las huellas de propuesta/base con las registradas, se aplicó exactamente esa propuesta y se conservaron contrato, progreso y fuentes previas. No se simuló `ctx.ui.confirm` ni se debilitó el rechazo de la tool sin UI: esta operación local contó con la autorización explícita del chat. Resultado: 17 documentos, 8 temas, 15 ítems asignados y 268 páginas referidas pendientes. Se repitieron tests y doctor y se cerró Fase 3 en `3616e71`.

## D4.1 — Contexto estructurado y estado de rama

Se verificaron las docs instaladas de extensiones, TUI, SDK, sesiones, formato de sesión y compactación, más `prompt-customizer.ts`, `todo.ts`, `commands.ts`, tipos y fuentes de `ExtensionRunner`, `EventBus` y autocompletado de pi 1.3.0. Se mutan `event.systemPromptOptions.sections` (`teach`, `modo_curso`, `curso`), sin retornar un campo inexistente ni reemplazar el prompt completo. El contenido de teach/modo se lee al activar/restaurar. El dossier es un mapa acotado y se reinyecta en cada arranque de agente; no depende de que el modelo recuerde cargar la skill tras compactar. Las otras secciones se conservan.

`appendEntry('curso', {curso, tema, log})` guarda estado no contextual. Para un tema ad hoc se añade su mapa mínimo, de modo que pueda restaurarse sin inventar una entrada al índice. La restauración recorre `getBranch()`, también en `session_tree`, no `getEntries()` con ramas abandonadas. Un estado inexistente elimina nuestras secciones y estado de barra. La curación/progreso son snapshots al activar/restaurar; después de ampliar el curso se reactiva el tema, sin watchers ni una segunda base de datos.

El autocompletador instalado pasa todos los argumentos previos, y reemplaza ese prefijo completo: devuelve `curso tema`. Su caché se invalida al cambiar el mtime de `indice.yaml`. La resolución por id precede a nombre/alias, aproximación y selector; fuera del índice se ofrece bibliografía BM25 y modo ad hoc, nunca una asociación persistida sin curación.

*Superada en parte por DA14, DA15, DA16 y DA25: durante el estudio no se lista ninguna skill; la restauración también lee `.sesion-activa.json`; el autocompletado usa `.sesion-cargada.json` (no `indice.yaml`) y no sugiere sobre un texto exacto; un subtema que BM25 ubica en el rango de un tema activa ese tema.*

## D4.2 — Lectura liviana, render local y log sin destrucción

Se reutiliza el parser YAML seguro de Fase 3 mediante un proceso Python asíncrono al activar/restaurar; las lecturas de páginas y búsqueda son TS puro. No se creó un índice paralelo normalizado. Los errores de preparación son avisos y se usa lo identificable. Los retornos de lectura están acotados a 32000 bytes, con citas base 1; las soluciones requieren petición explícita y vínculo real. `ver_pagina` renderiza sin OCR/modelo y usa el mismo formato de caché/1800 px de Fase 2, también para páginas que no fueron seleccionadas en ingesta. Un render cambiado se preserva. No se agregan dependencias ni modelos.

Los logs se crean con apertura exclusiva y sufijos; el vínculo del curso usa `backfill: false`, sin arrastrar programación previa ni reemplazar una nota. El bus instalado emite void y captura errores de listeners: se añade un acuse explícito con timeout para que `/estudiar` no arranque fingiendo que vinculó el log. El comando manual mantiene el relleno de rama, pero exige confirmación para una nota no vacía. Se reemplazó la reescritura de toda la nota al añadir mensajes por append. Un quiz abortado sin detalles no se califica como incorrecto.

La restauración original de md-log usaba `ctx.ui.theme`, que falla en un SDK headless sin tema inicializado. Se comprobó con un error real y se usa estado de texto plano, igual que el vínculo. La regresión prueba restauración con un getter de tema que arroja error. Se conservan la numeración/barajado de los quizzes y la omisión de resultados de lectura/soluciones en el log. Adjuntos de fotos quedan para Fase 5.

*Superada en parte por DA9, DA13 y DA20: antes del intento las tools no muestran soluciones (`ver_pagina` exige `despues_del_intento` en documentos con soluciones), el render tiene su propio lock, y si md-log no confirma la clase sigue sin nota.*

## D4.3 — Smoke real y aislamiento del harness

El usuario autorizó continuar tras aprobar Fase 3. Se probó `/estudiar redes retardos` con el modelo principal configurado, seis tools de lectura/preguntas y detención en el primer quiz sin responder por el alumno. Primera pregunta: 20,08 s; compactación real; cierre y reapertura del mismo JSONL, recreando loader/runner. Curso, tema, log y teach se restauraron; progreso quedó intacto. Dossier de 6296 bytes, lector 0,45 ms, BM25 4,75 ms y render frío adicional 388,6 ms. Son mediciones puntuales, no garantías ni prueba de una clase completa. No se hizo clic manual en los enlaces o en el selector `/resume`.

Se conservaron dos intentos incompletos del harness. `SettingsManager.inMemory(settings combinados)` pierde el origen de paquetes del proyecto y ocasionó una descarga redundante a la caché global; no se usa en el harness final, no se cambian manifiestos/credenciales y no se borra esa caché. Se usa `SettingsManager.create` y `applyOverrides` efectivos de proceso. Los overrides se aplican **después** de `loader.reload()`, que recarga settings; antes se descartaban y el segundo intento no podía compactar poca historia. No son retries del producto. El script real opcional conserva artefactos y usa una sesión independiente, no el archivo del usuario.

`modo-curso.md` adapta el borrador del plan a capacidades realmente presentes: researcher normal disponible sin anclaje/caché automáticos (Fase 6); resumen de cierre en chat/log sin tool de progreso ficticia ni escritura manual (Fase 7); no promete fotos durables antes de Fase 5. La aceptación técnica de esta fase no aprueba revisiones individuales ni habilita Fase 5 sin nuevo OK. Ese OK llegó después con «Aprobado; continuá».

## D5.1 — Imágenes nativas, formato fiel y recuperación sin reemplazos

Se releen las docs instaladas completas de extensiones, SDK, message-types, session-format y TUI, el ejemplo SDK 06 y las declaraciones de `PromptOptions`/`ImageContent`. La API real recibe `{type: 'image', data: base64, mimeType}` en el contenido del mensaje user; `session.prompt(texto, {images})` reproduce esa entrada sin implementar transporte. El logger usa `message_end` y la misma función de formato al rellenar la rama. Sólo copia imágenes del usuario, nunca resultados de `ver_pagina` o soluciones.

Se conserva PNG/JPEG/WebP/GIF, no el `.jpg` incondicional ilustrado en el plan: recodificar perdería fidelidad y agregaría trabajo/dependencias. Timestamp/posición/hash completo vuelven idempotente la copia de un mensaje, con comparación byte por byte antes de reutilizarla. Creación exclusiva y rechazo de symlinks protegen fotos/notas existentes; validación de MIME (sin propiedades heredadas), base64 y firma, sin prometer decodificación o legibilidad. Nuevos archivos `0600`, nuevos directorios `0700`, sin cambiar permisos del usuario. Fallos aislados por imagen: aviso y texto preservado. No se purgan parciales/huérfanos ni temporales del cliente.

Dentro del vault, embed con ruta desde el vault para evitar ambigüedades entre carpetas; para notas genéricas fuera de cwd se usa el subdirectorio relativo `adjuntos/`. Un mensaje sin texto también se registra. La restauración no reescribe notas ni duplica imágenes. No se agregan dependencias al logger ni un comando de fotos.

*Superada en parte por DA20: el formato sale de la firma del archivo, y HEIC y BMP se convierten con ImageMagick, dependencia opcional.*

## D5.2 — Manuscrito real externo y alcance del checkpoint

Se buscó autónomamente una foto pública auténtica de un cuaderno (Wikimedia Commons, FlexingCA, CC0); original y procedencia en `_entrada/muestras/externas/fase5/`. No se simuló escritura, no se rasterizó un PDF digital y no se ingesta el material. Es de finanzas, no de Redes: se ensayó aisladamente el protocolo real y la pauta general de justificar de `curso.md`, sin inventar un ítem del curso, rúbrica ni puntaje. El log técnico queda en `informes/fase5/`, no en sesiones/fuentes de Redes.

Se ocultó intencionalmente un dato en un recorte derivado para probar que se pide aclaración antes de corregir. Primer turno de `gpt-6.1-sol`: transcripción provisional y petición de foto completa, sin completar el dato ni resultado. Segundo: original completo, transcripción antes de devolución, cálculo cotejado con aritmética exacta, sin puntaje al faltar una escala aplicable. Dos adjuntos idénticos a los mensajes y reapertura del JSONL sin duplicación; índice, contrato, progreso y teach intactos. No hubo alumno ni respuestas reales del usuario.

El harness inicial exigía un signo `?` y falló con la petición válida «Mandame la foto completa». Se corrigió esa aserción y se retomó el mismo JSONL mediante un script temporal que luego se retiró: dos llamadas en total, no repetición de la primera. Se conserva evidencia del recorrido reanudado y se distingue su tiempo del recorrido total. El script opcional normal incorpora la corrección. Usa Pillow 13.0.0 ya fijado por OCR sólo para crear el caso negativo de prueba; no es un motor ni una dependencia nueva.

No se cambió ni se leyó el contenido del portapapeles personal (sólo tipos disponibles). El código nativo instalado confirma que Ctrl+V usa `wl-paste` y puede insertar una ruta temporal antes del envío, pero esto no prueba la tecla física en tmux. Esa comprobación y el render en Obsidian requieren el paso manual de SETUP; doctor sólo acredita guardado/embed sintético con runtime. No se declara probada una respuesta manuscrita de Redes o una rúbrica detallada ausente. El usuario aprobó el checkpoint con «Confirmado, avanzá»; revisión humana individual y progreso no se modifican.

## D6.1 — Researcher existente, despachado desde una tool de curso

`investigar_tema(modo, afirmaciones)` arma el contexto y llama a `ctx.executeTool("subagent", …)` con el modelo de config; conserva validación, permisos, sandbox, tmux y entrega automática existentes. Se verificaron `ExtensionToolContext`, `AgentToolCallOutcome` y el ejecutor anidado instalado; no se llama a APIs privadas desde producto. Se adopta pi **1.4.0**, ya instalado, como versión exacta comprobada: docs de extensiones/TUI, SDK/message-types/session-format, ejemplo hello, declaraciones, tests y runtime. No hay reinstalación ni cambios a preferencias personales. F4 mantiene un smoke acotado sin hijos; F6 tiene su propio ensayo opcional para esperar entregas antes de cerrar.

La preparación silenciosa del modelo llama a la tool antes del probe si falta caché: no es un daemon ni una llamada pesada dentro de /estudiar. Se comprobó el proceso real, no sólo una simulación de schema. Modo ad hoc admite verificar sin inventar un tema/caché de alcance. La tool entrega un resumen inmediato en español y no promete resultados antes de recibirlos.

*Superada por DA12 en el despacho: ya no hay `subagent`, tmux ni entrega automática. Sigue vigente la adopción de pi 1.4.0.*

## D6.2 — Entradas concretas y salida contrastada

El hijo recibe contrato completo, afirmaciones A1–A3, rutas/citas de transcripciones preparadas y enunciados curados de ejercicios sin soluciones. No se pasan resultados ni páginas crudas de evaluaciones con soluciones integradas. Presupuesto: 50 transcripciones y 200000 bytes totales, inspección acotada a 2000 posiciones y 100 archivos de huella. No se hace OCR ni se recorre el PDF. La comparación es de la afirmación original contra el curso, no de una corrección contra las fuentes; la versión corregida se separa del veredicto. Extensiones rotuladas fuera del material, límites de búsqueda/lectura por modo, huecos explícitos.

Los primeros ensayos detectaron dos etiquetas falsas de «concuerda» pese a una explicación correcta. No se relajó el test para aceptarlas: se aclaró el veredicto literal con ejemplo y se controlaron dos afirmaciones falsas y una verdadera. También se añadieron los enunciados y el contrato completo al descubrir contexto omitido por el hijo. El ensayo final etiquetó correctamente los tres casos; eso no mide una tasa de fiabilidad ni certifica otras atribuciones, URLs o lecturas. Revisión humana sigue pendiente.

*Superada en parte por DA12: el hijo recibe el contrato sin los objetivos de otros temas.*

## D6.3 — Caché inmutable y correlación por rama

La huella incorpora tema, contrato, enunciados, configuración/modelo, prompt del agente, índice, metadatos/calidad y transcripciones utilizadas. No incorpora progreso: aprender algo no invalida la investigación. Cabecera de control y hash del cuerpo distinguen una publicación íntegra de una nota editada/incompleta. Publicación mediante temporal privado, fsync y hardlink exclusivo, sin sobrescribir. Primera salida <tema>.md; nuevas fuentes/prompts producen <tema>-<huella>.md. El dossier enlaza la generación vigente, fecha/modelo y un extracto acotado como datos externos, no instrucciones. Se preservan notas manuales y generaciones anteriores, sin limpieza automática.

`appendEntry("curso-researcher", …)` registra inicio/fin; sólo getBranch correlaciona nombre y tarea con una entrega, sin usar ramas abandonadas. Se comprueban fuentes al recibir, éxito del hijo, formato y citas admitidas antes de guardar alcance. Verificar no reemplaza ese mapa. Una entrega de otro tema no cambia el activo. Los errores dejan un aviso y se sigue con el material. Tras reinicio con despacho sin entrega confirmada, no se duplica automáticamente: puede retomarse explícitamente por nombre con subagent_message. No hay sondeo ni segunda base de tareas.

*Superada en parte por DA12: la huella cubre sólo tema, páginas y enunciados adjuntados, contrato sin objetivos ajenos y el cuerpo de `researcher.md`; un trabajo interrumpido se recoge por huella desde cualquier sesión, sin `subagent_message`.*

## D6.4 — Evidencia y límites

Cinco iteraciones técnicas con principal Sol y diez hijos Luna quedan en _procesado/fase6/. Dos se detuvieron por el fallo de veredicto; las intermedias no se confunden con el ensayo del contexto final. Evidencia final: prueba-1792630409914. Primera pregunta 20,62 s mientras alcance tardó 68 s en segundo plano; segunda pregunta 7,42 s y cero hijos adicionales. Safe_bash, web_search y web_fetch reales en los hijos. Controles falsos del script, no errores del estudiante. Ninguna pregunta respondida, nota de progreso escrita ni curso completo realizado. Los 18 originales, 17 copias, contrato, índice, progreso, teach y plan conservan integridad. Costo de catálogo de todos los ensayos: 0,3807107; no factura. Revisión de informes y piloto humano siguen pendientes.

## D7.1 — Un backend de progreso, sin segunda base de datos

`progreso.py` reutiliza YAML seguro, rutas seguras, bloqueo del curso y escritura atómica/fsync existentes. `sesion.py` lo consulta al activar/restaurar; el registro usa el puente Python asíncrono ya instalado, ahora con selector interno de script. No agrega dependencia, daemon, watcher ni OCR. La tool es secuencial y conserva la cola de mutación de archivos; el bloqueo Python protege también dos procesos del proyecto. Las ediciones externas no cooperativas aún pueden competir en el último intervalo antes de rename: se comprueban bytes antes de publicar, no se promete una transacción con editores arbitrarios.

Cada guardado valida esquema, fechas de evidencia no futuras, tema/ítems del curso y log del mismo tema; conserva exactamente los bytes previos como .bak. Fusiona listas por igualdad exacta, errores por descripción y borde moviendo textos explícitamente confirmados entre domina/falla. No hace deduplicación semántica ni decide dominio: eso sigue siendo juicio del modelo sobre respuestas observadas. Conserva otros temas e historial, con una entrada por tema/log y cierre monotónico. No permite pasar evidencia existente a sin_empezar por cerrar sin respuestas nuevas.

Si progreso es inválido, un .bak válido se restaura con aviso, preservando los bytes inválidos por SHA en _procesado/. Sin respaldo válido se conserva todo y se continúa sin registrar hasta reparar; un backup inválido existente tampoco se reemplaza sin intervención. Tests cubren cortes, bloqueo, edición concurrente, UTF-8 inválido, symlinks e idempotencia. No se usó progreso real de Redes para probar recuperación.

*Superada en parte por DA9, DA10 y DA11: el progreso tiene su propio lock (`.progreso.lock`) y leerlo no toma ninguno; los guardados son deltas; un id con inciso, un ítem que desapareció o un log renombrado ya no rechazan el registro.*

## D7.2 — Cierre confirmado y recuperación desde logs

`/fin` solicita un registro final; cierre natural usa `cierre:true`. Entradas curso-cierre/curso-progreso en getBranch correlacionan solicitud y guardado con el log activo. Se verificó AgentSettledEvent de pi 1.4.0: incluye aborted y ocurre después de continuaciones/reintentos. Sólo se desvincula tras un mensaje assistant completo con texto y stopReason stop, sin llamadas pendientes; Escape/error no cierra. La regresión inicial falló al cerrar sin mensaje final y quedó verde con esta condición. md-log serializa su resumen y el unlink con el mismo lock, comprueba el archivo esperado y acusa éxito/error. Sin acuse se mantiene el curso activo. Ad hoc puede cerrar sin escribir un tema ficticio.

La próxima activación detecta el último log del tema sin cierre final; coincide el nombre completo del tema y no sólo un sufijo (regresión roja→verde con otra-derivacion frente a derivacion). Historial legado sin flag se considera registrado. leer_sesion_anterior devuelve texto acotado y SHA; la propuesta se confirma con UI real y el backend verifica esa huella. La reconstrucción se etiqueta, preserva el log y no cierra la sesión actual. No supone errores a partir de preguntas sin respuesta ni persiste pruebas técnicas como si fueran intentos del usuario. La confirmación se cubrió con fixtures (aceptar, rechazar, sin UI y cambio del log), no como clic humano real.

*Superada en parte por DA17 y DA25: la orden de `/fin` va oculta; con el agente ocupado, `/fin` corta el turno en vez de rechazarse; se ofrece reconstruir una sola vez la última sesión real del tema sin cierre.*

## D7.3 — Confirmar el borde, no reiniciar el probe

Modo-curso pide confirmar domina/falla previos con hasta tres preguntas conceptuales en total; si los contradice la nueva evidencia, se amplía el mapeo. El dossier prioriza borde/próximo paso frente a listas de intentos. La sugerencia omite dominados y exige prerequisitos dominados; orden de preferencia: en curso, repasar, temas nuevos accesibles. No se agrega un planificador de repasos.

Ensayo real final: _procesado/fase7/prueba-1792672775843/resultado.json. Dos sesiones nuevas de la fixture prueba-progreso con Sol, tres preguntas en cada una. El sistema recibió el borde de la primera; se cotejó en el JSONL de la segunda y las preguntas lo confirmaron en tres, con igual borde registrado. Dos /fin guardaron y conservaron el resumen antes de desvincular. Respuestas programadas: primer quiz correcto y siguientes no sé; sólo describen al alumno virtual aislado. No certifican el nivel del usuario, una clase completa, práctica evaluada ni el piloto humano. Researcher/visión se excluyeron de este smoke porque ya tienen ensayos propios.

Se conservan los intentos fallidos: modelo inicial distinto (1792636116750); ruta de backend incorrecta (1792636295117); rechazo prudente a convertir respuestas sintéticas en evidencia del usuario (1792636612356); simulador que respondió todo bien, sin techo (1792636786643); divergencia de proveedor (1792672185762); openai sin credenciales (1792672223350). Se corrigieron el harness y su guardia temprana de autenticación, no se relajó la exigencia de piso/techo. También se corrigió una fixture de test que editaba los datos antes de su serialización, no el snapshot activo. Uso registrado en JSONL de todos los ensayos: 54873 entrada, 3199 salida, 172544 lectura de caché, costo de catálogo 0,1589904 (no factura; excluye doctor y pings).

## D7.4 — Cambio de proveedor autorizado, no fallback silencioso

Al retomar la fase, openai ya no tenía autenticación configurada y el modelo seleccionado por el runtime era openai-codex/gpt-6.1-sol. Doctor falló ambos pings openai/gpt-6-luna. Se informó y el usuario eligió «Usar openai-codex». Antes de adoptar el cambio respondieron openai-codex/gpt-6.1-sol por texto y gpt-6-luna por texto/PNG. Se verificaron docs de modelos y las declaraciones públicas del runtime instalado. Se cambiaron sólo .pi/settings.json, curso.config.json, frontmatter del researcher y las expectativas de los scripts de ensayo; ninguna credencial ni configuración personal.

Doctor completo volvió a verde con el nuevo proveedor; los informes previos conservan sus ids históricos. El cambio de modelo/config invalida por diseño las claves de researcher/visión, preservando sus generaciones anteriores. No se recreó alcance ni se retranscribieron PDFs durante Fase 7: el próximo estudio puede lanzar un alcance nuevo, y una futura preparación de visión explícita puede consumir llamadas nuevas. No se alteró la versión de pi ni se eligió otro nombre de modelo. No se relanzaron los ensayos históricos de fotos/visión/researcher sólo para actualizar su etiqueta de proveedor; siguen disponibles como opcionales.

## Auditoría de robustez — 2026-10-22

Decisiones tomadas a partir de `../AUDITORIA.md`; los ids H/X son sus hallazgos. DA1–DA7 son decisiones del usuario y DA8–DA28, decisiones de diseño de los arreglos. «Verifica» nombra el test o el comando que lo comprueba. Los tests corren sin modelo ni red desde la raíz del vault:

```bash
node --test .pi/tests/*.test.mjs
.pi/.venv/bin/python -m unittest discover -s .pi/tests/ingesta
```

### DA1 — Al crear un curso se ingiere todo sin modelo (usuario, decisión 3)

- **Contexto:** Redes tenía ingeridas 52 de 987 páginas; aplicación, transporte, red y enlace no tenían texto y el tutor leía imágenes página por página (H05).
- **Decisión:** `/curso-nuevo` y `/curso-agregar` ingieren sin modelo todas las páginas de todos los documentos: `cursos.py manifiesto --curso <slug> --todo` (escribe `_procesado/manifiesto-<slug>.json` en la raíz del vault) e `ingestar.py iniciar`. Mientras corre, la salida del curso queda tomada («Ya hay una ingesta escribiendo en esta salida.») y las skills esperan a que `estado` diga `completada` o `completada_con_pendientes`.
- **Por qué:** es local y no gasta modelo; la caché saltea lo ya preparado.
- **Verifica:** `test_cursos_auditoria.py`, `test_h05_manifiesto_de_pendientes_y_de_todo_con_los_ids_del_indice`; `.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py --help` muestra `manifiesto` y `--todo | --pendientes`.

### DA2 — La primera vez que se estudia un tema se prepara con modelo, en segundo plano (usuario, decisión 3)

- **Contexto:** visión, segmentación y asignación de ítems eran pasos manuales con confirmación: había 5 de 25 preguntas de parcial y 10 de 71 ejercicios segmentados, y la matemática digital de Kurose sale rota (H19, H22).
- **Decisión:** si el tema activo (no ad hoc) necesita preparación, un handler de `before_agent_start` la lanza sin `await`, una vez por clase, con `modelo_vision`: visión de las páginas pendientes de su bibliografía; visión de todas las páginas de parciales y prácticos sin segmentar; segmentación en `items.yaml`, con las soluciones integradas como ítems aparte; y clasificación por tema de los ítems que el índice no asigna, en `cursos/<c>/_procesado/asignaciones.json`. `indice.yaml` no se toca y manda.
  - Sin confirmación por cantidad; tope de 150 páginas por corrida (`TOPE` en `extensions/curso/preparacion.ts`). Lo que falta sigue la próxima vez.
  - Lock `cursos/<c>/_procesado/.preparacion.lock` con `{pid, inicio, proceso}` (`proceso`: arranque del sistema y del proceso): sólo lo borra quien lo tomó, y se reemplaza si su pid murió, si es de otro arranque u otro proceso con ese pid, o si tiene más de 6 h. Con la ingesta base corriendo, espera al próximo turno sin avisar.
  - Una respuesta inválida se reintenta una vez con el motivo; un enunciado que trae un marcador de solución se rechaza. Si vuelve a fallar, esa segmentación o clasificación queda en `fallos` de `preparacion.json` con la huella de lo enviado y espera 24 h o hasta que cambien sus entradas; se avisa una vez («…, se reintenta mañana o si cambia el material»). Un documento de tipo `soluciones` no se segmenta solo.
  - Red, cuota o credenciales, reconocidas sólo por el error del proveedor, cortan la tanda en la primera falla; un plazo vencido se dice «el modelo no respondió en 3 minutos» (visión) o «en 5 minutos». Una falla es una línea «Preparación del material no disponible: …; seguimos con lo que hay.». El estado por tema queda en `_procesado/preparacion.json`, y `/curso-check` suma una línea por tema con ese estado y los ítems asignados automáticamente.
- **Por qué:** fricción cero sin demorar la primera pregunta; en el e2e de la rama `fix/preparacion` con pi 1.4.0 llegó a los 0,6–0,75 s con la preparación ya lanzada (notas de esa rama). El tope acota lo que gasta una corrida sin pedir confirmación, y un fallo que se repetiría no gasta llamadas en cada `/estudiar` (antes, sin red, la visión de retardos intentaba sus 49 páginas).
- **Verifica:** `preparacion-auditoria.test.mjs`: «preparación: la primera vez transcribe, segmenta con soluciones y puntos, clasifica y avisa sin turno ni confirmación», «preparación: no demora el turno, y sin credenciales avisa una línea y no llama al modelo», «preparación: con la ingesta base corriendo u otro pi preparando espera sin avisos y retoma un lock de un pi muerto», «preparación: un kill a mitad no rompe nada y la próxima vez sigue sin repetir páginas». `test_preparacion_auditoria.py`: `test_prioriza_el_tema_luego_parciales_y_practicos_con_tope`, `test_asignar_valida_y_nunca_toca_el_indice`. `remates-auditoria.test.mjs`: «preparación (a): una segmentación que falla siempre no gasta llamadas en cada /estudiar hasta mañana o hasta que cambien sus entradas», «preparación (b, c): red, cuota o credenciales cortan la tanda en la primera falla; un plazo vencido se dice en español», «preparación (b): un ítem inválido que habla de sockets o conexiones no corta la tanda como una falla de red», «preparación (e, f): sólo se borra el lock propio y un pid reutilizado tras reiniciar no lo retiene», «/curso-check suma una línea por tema con la preparación automática, y sin ella igual valida». `test_remates_auditoria.py`: `test_un_fallo_espera_hasta_que_cambien_sus_entradas_o_pase_un_dia`, `test_curso_check_dice_por_tema_el_estado_y_los_items_asignados`.

### DA3 — ponytail y las skills globales, fuera sólo en este proyecto (usuario)

- **Contexto:** la última sección del prompt del tutor era ponytail («lazy senior developer…») y entraban 58 skills globales, una en colisión con teach (H14).
- **Decisión:** `.pi/settings.json` filtra el paquete personal con `{ "source": "git:github.com/DietrichGebert/ponytail", "autoload": false, "extensions": ["!**"], "skills": ["!**"] }`, sin tocar `~/.pi`. `pi-learn` abre `pi <args> -ns --skill ~/Projects/pi-learning/.pi/skills`, salvo en los subcomandos de pi. Se reinstaló `pi-learn.fish` en `~/.config/fish/functions/`.
- **Por qué:** el usuario no quiere cambiar su configuración personal. El filtro con `[]` no funciona y `"!**"` sí (AUDITORIA §6).
- **Verifica:** doctor, «Prompt del tutor: sin secciones ajenas» y «Skills de cursos»; `entorno-auditoria.test.mjs`, «H14: pi-learn abre el tutor sin ponytail ni skills globales y con las skills del proyecto» y «H14: los argumentos de pi-learn van primero y no tapan los subcomandos de pi».

### DA4 — `.pi/.venv` con el Python 3.13.13 de uv (usuario)

- **Contexto:** el venv dependía de Conda base (`home = ~/miniconda3/bin` en su `pyvenv.cfg`), y con el venv roto o lento `/estudiar` no arrancaba (H03).
- **Decisión:** `.pi/.venv` se recreó con el Python 3.13.13 que gestiona uv; el anterior quedó en `.pi/.venv.conda-bak`. La receta está en SETUP, «Dependencias globales».
- **Por qué:** un Python gestionado por uv no depende de la instalación de Conda.
- **Verifica:** doctor, «Python de ingesta: 3.13.13»; `.pi/.venv/pyvenv.cfg` apunta a `~/.local/share/uv/python/cpython-3.13.13-linux-x86_64-gnu`; `entorno-auditoria.test.mjs`, «comprobar: respeta ruta_tesseract y dice cómo recrear el venv con Python de uv».

### DA5 — Thinking medium, sin proveedor de respaldo, errores en español (usuario, decisiones 7 y 8)

- **Contexto:** sin credenciales, red o cuota, `/estudiar` dejaba un error rojo en inglés y un log de 0 B (H02); el thinking se veía en inglés (H09). La auditoría proponía thinking «low» para acortar esperas (H10).
- **Decisión:** el tutor razona en `medium`, el predeterminado de pi 1.4.0, que ningún settings cambia; el bloque queda oculto (`hideThinkingBlock: true`). Por ahora no hay proveedor de respaldo. `/estudiar` comprueba modelo y credenciales antes de crear nada, y un turno que termina en error del proveedor suma una línea en español con la causa probable (disco, cuota, credenciales, red u otro) y «seguí» o /fin.
- **Por qué:** el usuario prefirió no bajar el razonamiento ni sumar otro proveedor; lo que sí hace falta es que el alumno entienda en español qué pasó y qué hacer.
- **Verifica:** `sesion-auditoria.test.mjs`: «H02: sin modelo o sin credenciales no se crea nada y se dice qué hacer en una línea», «H02: un turno que termina en error del proveedor agrega una línea en español con la causa y qué hacer». `entorno-auditoria.test.mjs`: «H09: el thinking del tutor queda oculto como setting de proyecto». Doctor, «Thinking oculto».

### DA6 — Logs técnicos fuera de las notas del curso (usuario)

- **Contexto:** cada sesión de Redes ofrecía reconstruir logs de pruebas técnicas como si fueran del alumno; en pantalla apareció una «afirmación deliberadamente falsa» (H15).
- **Decisión:** los logs técnicos de las pruebas de Redes se movieron a `_procesado/archivo-pruebas/redes/` del vault, con un `LEEME.md`.
- **Por qué:** no son evidencia del alumno, y `_procesado` está excluido de Obsidian.
- **Verifica:** `ls _procesado/archivo-pruebas/redes/` muestra `LEEME.md`, `sesiones/` y `verificaciones/`; `cursos/redes/sesiones/` sólo conserva `adjuntos/`.

### DA7 — Pedagogía en `modo-curso.md`, que prevalece sobre teach (usuario, decisión 6)

- **Contexto:** la auditoría dejó al usuario el tope del probe, la aprobación del plan, el puntaje, la reserva de ítems y el simulacro (H12, H35, H56, H20; AUDITORIA §5). La precedencia entre teach y modo-curso era ambigua: un pedido de explicación esperó 3 min 46 s detrás del probe y del plan (H12), y al retomar se repetían objetivo y plan (H56).
- **Decisión:** (a) un pedido explícito de explicación corta el probe, que tiene tope de 4 preguntas en un tema nuevo; (b) el plan se aprueba con `ask_user_question` y, al retomar con objetivo y plan guardados, no se vuelven a pedir; (c) la corrección da «≈ x/N» por pregunta (y por inciso si la escala oficial lo desglosa) sólo cuando hay escala oficial; (d) un ítem reservado por tema y `/simulacro` (DA27); (e) por ahora no hay práctica por bloque: la práctica tipo evaluación va al final del tema.
  - Todo vive en `modo-curso.md`, que mientras hay un curso activo prevalece sobre `teach` en lo que regula y lista sus conflictos: LaTeX en los popups, el researcher subagent (reemplazado por `investigar_tema`), el probe sin tope, el objetivo «interrogando la visión», la aprobación del plan por texto y las tres fases siempre. `teach` no se toca.
  - `registrar_progreso` guarda por tema `objetivo` (≤300 caracteres) y `plan` (≤1500), que reemplazan a los anteriores sólo cuando vienen; el dossier los trae como «Objetivo acordado» y «Plan» (DA26).
- **Por qué:** cierra los desvíos del contrato pedagógico que la auditoría dejó a decisión del usuario (C4, E3, E7, E9; PLAN:480, 487 y 492) sin cambiar la filosofía de teach.
- **Verifica:** `pedagogia-auditoria.test.mjs`: «modo-curso: prevalece sobre teach con sus conflictos explícitos y trae las reglas de la auditoría», «H56: registrar_progreso ofrece objetivo y plan acotados en el esquema que ve el modelo», «H56: el dossier trae objetivo y plan dentro del presupuesto, sin perder borde, próximo paso ni errores abiertos». `test_pedagogia_auditoria.py`: `test_h56_objetivo_y_plan_se_guardan_por_tema_como_delta`, `test_h56_una_reconstruccion_vieja_no_pisa_objetivo_ni_plan`. Las reglas que dependen del modelo (corte y tope del probe, «≈ x/N», no rozar el reservado) sólo se probaron como texto, sin un modelo real.

### DA8 — pi-learn: una sesión de tmux por carpeta, que muere sin cliente

- **Contexto:** cerrar la ventana no terminaba pi, y el siguiente `pi-learn` abría otro pi sobre la misma sesión; `/resume` podía perder la respuesta del alumno (X03). Sin red y sin los paquetes fijados, pi no arrancaba (H41).
- **Decisión:** fuera de tmux, `pi-learn` usa `new-session -A -s pi-learn-<hash de la carpeta>` en el servidor `-L pi-learn`: si ya hay un pi en esa carpeta se adjunta, y avisa si no puede usar los argumentos. `config/tmux.conf` fija `destroy-unattached on`. Si faltan los paquetes fijados, avisa y abre pi con `PI_OFFLINE=1`. El margen del shell de los subagentes baja a 300 ms.
- **Por qué:** una sola instancia por carpeta evita dos pi sobre la misma sesión. Fish con Conda ejecuta la orden aunque llegue a los 0 ms (comentario de `config/fish/pi-learn.fish`): 300 ms queda de margen.
- **Verifica:** `entorno-auditoria.test.mjs`: «X03: en el servidor de pi-learn una sesión sin cliente no sobrevive», «X03: pi-learn reutiliza la sesión de tmux de la carpeta y avisa si no puede usar los argumentos», «H41: sin los paquetes fijados pi-learn avisa en una línea y arranca pi sin red de inicio», «X06: el hijo del researcher recibe su orden a los 300 ms y se respeta un valor propio».

### DA9 — El progreso tiene su propio lock

- **Contexto:** el progreso usaba el lock de la salida del curso, que la ingesta retiene durante toda la corrida: con una ingesta en curso, `/estudiar` arrancaba con progreso vacío y fallaban `registrar_progreso`, `/fin` y `ver_pagina` (H06).
- **Decisión:** leer el progreso no toma lock. `registrar_progreso` toma `cursos/<c>/.progreso.lock` y espera hasta 5 s («Otro proceso está guardando; reintentá.»). `ver_pagina` lee su caché sin lock y renderiza bajo `_procesado/<doc>/render/.render.lock`.
- **Por qué:** `progreso.yaml` ya se publicaba atómico (temporal + fsync + rename); el lock compartido sólo hacía esperar a lectores detrás de un escritor largo.
- **Verifica:** `test_progreso_auditoria.py`: `test_h06_leer_y_registrar_no_usan_el_bloqueo_de_la_ingesta`, `test_h06_registrar_espera_el_bloqueo_de_progreso`, `test_h06_dos_registros_simultaneos_guardan_ambas_evidencias`, `test_h06_cargar_y_render_cacheado_no_esperan_a_la_ingesta`.

### DA10 — `registrar_progreso` recibe deltas

- **Contexto:** el esquema exigía los 8 campos en cada guardado y `registrar_progreso` se llevaba el 26 % de la espera entre preguntas (H10); `borde.falla` acumulaba fallas superadas (H27).
- **Decisión:** sólo `resumen` es obligatorio; lo omitido se conserva y lo nuevo se fusiona. Sin `estado` explícito, un tema nuevo sigue `sin_empezar` hasta que llega evidencia del alumno y entonces pasa a `en_curso`. `falla_resuelta` quita fallas por texto exacto; una falla nueva saca el concepto de `conceptos_firmes`; `dominado` con fallas en el borde da un aviso.
- **Por qué:** la fusión ya existía; mandar sólo lo nuevo acorta cada guardado.
- **Verifica:** `test_progreso_auditoria.py`: `test_h10_delta_con_solo_lo_nuevo_conserva_lo_previo`, `test_h10_el_estado_omitido_sigue_a_la_evidencia`, `test_h27_falla_resuelta_y_falla_nueva_sacan_lo_contradicho`.

### DA11 — El registro tolera ids con inciso, ítems huérfanos y logs movidos

- **Contexto:** un id como «2(a–c)» rechazaba todo el registro (H13); re-segmentar un banco invalidaba `progreso.yaml` (H31); las fechas eran UTC (H53); reconstruir una sesión vieja pisaba lo actual (H29); renombrar la nota impedía guardar (H04).
- **Decisión:** los ids se normalizan al id base y el inciso va a notas; en documentos sin `items.yaml` quedan `sin_segmentar`; un ítem que desaparece queda «huérfano» con aviso. Las fechas son locales y el backend completa `fecha` y `detectado`; una reconstrucción fecha con el día del log y no pisa estado ni próximo paso más nuevos. Un log renombrado no impide guardar: sólo reconstruir lo exige.
- **Por qué:** perder evidencia del alumno por un detalle de formato es peor que guardar con un aviso.
- **Verifica:** `test_progreso_auditoria.py`: `test_h13_ids_tolerantes_guardan_el_resto_y_avisan`, `test_h31_item_resegmentado_queda_huerfano_sin_invalidar_progreso`, `test_h53_fechas_locales_y_completadas_por_el_backend`, `test_h29_reconstruir_una_sesion_vieja_no_pisa_lo_actual`, `test_h04_log_renombrado_no_impide_guardar`.

### DA12 — El researcher corre en un pi propio, sin tmux

- **Contexto:** el researcher iba por pi-interactive-subagents: partía la pantalla unos 60 s durante el probe, mostraba el informe crudo con su costo y disparaba turnos, también después de `/fin` (H07); `/reload` lo mataba (H33); no tenía plazo (H34); su caché estaba vigente en 0 de 8 temas (H32).
- **Decisión:** `investigar_tema` lanza, desacoplado (`detached`), un `pi -p` sin sesión, extensiones, skills ni archivos de contexto, que carga sólo pi-web-access y usa el modelo, el thinking y las tools (`web_search, web_fetch, read`) de `agents/researcher.md`, bajo `timeout -k 5 180`. Trabaja en `cursos/<c>/notas/verificaciones/.trabajos/<clave>/`.
  - Cualquier sesión lo recoge por huella; tras un plazo vencido, esa huella espera 10 min antes de relanzarse. Sin credenciales del modelo no se lanza.
  - El informe llega al tutor como mensaje oculto `curso-verificacion` para el turno siguiente, sin disparar turnos; el alumno ve una línea.
  - La huella del alcance cubre tema, páginas y enunciados adjuntados, contrato sin objetivos ajenos y el cuerpo de `researcher.md`; el modelo, sin proveedor, es un metadato. Las cachés anteriores quedan como «previa».
- **Por qué:** el plan pedía un researcher silencioso (AUDITORIA §5); un proceso propio sobrevive a `/reload`, a un kill y al cierre de la terminal. pi-interactive-subagents sigue cargado para los subagentes fuera del curso.
- **Verifica:** `researcher-auditoria.test.mjs`: «H07: investigar_tema lanza un pi propio sin tmux ni subagent, vuelve enseguida y entrega sin turnos», «H33: un informe terminado se recupera por huella desde otra sesión, sin relanzar», «H34: el researcher colgado se mata al vencer el plazo, avisa una vez y espera antes de relanzar», «H34: sin credenciales del modelo del researcher no se lanza nada», «H32: la huella del alcance depende sólo del tema, sus páginas y el prompt del researcher».

### DA13 — Índice sin soluciones y soluciones separadas por ítem

- **Contexto:** los parciales reales traen la solución integrada. `buscar_material` mostró en pantalla la solución oficial de UDP, 9 de 16 búsquedas típicas traían texto de solución (H01, X02), y una solución del mismo PDF no se podía vincular (H18).
- **Decisión:**
  - El BM25 de evaluaciones y ejercicios guarda sólo enunciados: corta desde «Solución», «Resolución», «Respuesta(s)» o «Rta.:» (`pipeline.SOLUCION`) hasta el próximo «Pregunta/Ejercicio/Problema N», también entre páginas. Los documentos de tipo `soluciones` no se indexan.
  - Un documento cuenta como «con soluciones» si es de tipo `evaluaciones` o `soluciones` o tiene algún ítem `solucion_de`. Antes del intento, `buscar_material` da de él sólo la ubicación y los ids; `leer_paginas` cambia cada solución por «[Solución omitida hasta después del intento.]» o rechaza si no puede separarla; `ver_pagina` exige `despues_del_intento:true`; `leer_items` no lista ítems de solución ni enlaza sus páginas.
  - En `items.yaml`, la solución integrada es otro ítem con `solucion_de: '<id>'`, y `puntos` guarda el puntaje oficial (número ≥ 0 o texto de hasta 40 caracteres), que `leer_items` muestra.
- **Por qué:** «nunca muestres una solución antes del intento» (PLAN §5.2) quedaba abierto en tres tools; separar por ítem permite corregir contra la solución oficial sin mostrarla antes.
- **Verifica:** `fuga-auditoria.test.mjs`, incluido «datos reales: 0 fragmentos de solución en búsquedas, páginas e ítems del parcial» (se saltea sin los datos de Redes). `test_pipeline_auditoria.py`: `test_evaluaciones_indexan_solo_enunciados_y_soluciones_nada`, `test_parcial_real_con_solucion_integrada`. `test_cursos_auditoria.py`: `test_h18_guardar_items_acepta_solucion_del_mismo_documento_sin_ciclos`, `test_h72_guardar_items_conserva_puntos_validos`.

### DA14 — Set de tools de estudio

- **Contexto:** durante el estudio seguían activas 21 tools (bash, edit, write, `transcribir_paginas`, `web_search`…), y teach figuraba también como skill: el tutor la releía antes de la primera pregunta (H44, H43).
- **Decisión:** con un curso activo sólo quedan `quiz`, `ask_user_question`, `buscar_material`, `leer_paginas`, `leer_items`, `ver_pagina`, `registrar_progreso`, `leer_sesion_anterior`, `investigar_tema` y `read`, que sólo abre imágenes fuera de `cursos/`; no se lista ninguna skill. El set se reafirma en cada turno y al cerrar vuelve el anterior.
- **Por qué:** «sólo la extensión escribe progreso» (PLAN §3.3) se cumplía sólo por prompt; además se evita gastar visión o editar archivos en plena clase.
- **Verifica:** `sesion-auditoria.test.mjs`: «H44/H43: con un curso activo sólo quedan las tools del estudio, sin skills; al cerrar vuelve el set anterior», «H44: una tool que se registra tarde (reanudar sin el registro de pi, web, MCP) no queda activa durante el estudio».

### DA15 — Snapshot de la carga del curso

- **Contexto:** toda la carga pasaba por Python con un timeout de 10 s y sin respaldo: con el venv roto o lento `/estudiar` no arrancaba y al reanudar se perdía el modo curso (H03).
- **Decisión:** cada `sesion.py cargar` exitoso se copia a `cursos/<c>/.sesion-cargada.json`. Si Python falla o se cuelga, la clase sigue con esa copia y avisa una vez («Material desde la última carga; el entorno de ingesta no respondió: corré .pi/scripts/doctor.», o «Material desde la última carga. <error>» si Python dio un error propio, como un disco lleno); sin copia, `/estudiar` falla con ese consejo. Sin el venv, las demás operaciones locales dicen «Falta el entorno de ingesta (Python): corré .pi/scripts/doctor.». Al restaurar espera hasta 30 s. El autocompletado de `/estudiar` lee la copia, sin llamar a Python.
- **Por qué:** una dependencia caída no debe cortar la sesión (AUDITORIA §5), y el material no cambia entre cargas.
- **Verifica:** `sesion-auditoria.test.mjs`: «H03: Python colgado o roto sin copia previa: una línea en español que remite al doctor, sin curso a medias», «H03: con una carga previa, /estudiar y la restauración siguen con la copia y lo avisan una vez», «H17: el autocompletado no se ofrece sobre un texto exacto y no vuelve a llamar a Python». `remates-auditoria.test.mjs`: «H45: sin el venv, las operaciones locales fallan en español y remiten al doctor», «textos: la copia muestra el error limpio de Python y la nota se nombra en palabras del alumno».

### DA16 — Registro propio del curso activo y margen de disco

- **Contexto:** con el disco lleno pi rompe su archivo de sesión: `/resume` recuperó 1 de 13 entradas, sin curso ni log (X01, bug de pi).
- **Decisión:** el curso activo se anota también en `cursos/<c>/.sesion-activa.json` (sesión de pi, pid, curso, tema y log), que se borra al cerrar y restaura el curso si el archivo de pi perdió sus entradas. `/estudiar` no arranca con menos de 200 MB libres y avisa con menos de 1 GB; el doctor marca menos de 2 GB. Un ENOSPC al guardar el progreso, o al cargar o renderizar el material, se explica en una línea en español.
- **Por qué:** el bug es de pi; el proyecto puede guardar su estado fuera de ese archivo y avisar antes de llegar al disco lleno.
- **Verifica:** `sesion-auditoria.test.mjs`: «X01: con menos de 200 MB libres /estudiar no arranca; con menos de 1 GB avisa y sigue», «X01: un registro propio restaura curso, tema y log si pi perdió sus entradas; se borra al cerrar». `entorno-auditoria.test.mjs`: «X01: el doctor marca menos de 2 GB libres y dice cómo ver qué ocupa». `test_progreso_auditoria.py`: `test_x01_disco_lleno_da_una_linea_en_espanol_y_conserva_el_progreso`.

### DA17 — Órdenes internas ocultas

- **Contexto:** las órdenes internas («Iniciá el probe…», «Llamá registrar_progreso…») se veían en el chat y quedaban como «VOS» en la nota (H54).
- **Decisión:** `/estudiar`, `/fin`, `/simulacro`, el cambio de tema y la respuesta tras un corte mandan sus órdenes como mensaje custom `curso-orden` con `display: false`, que dispara el turno. Los avisos al tutor de la preparación (`curso-preparacion`) y del researcher (`curso-verificacion`) también van ocultos, para el turno siguiente y sin dispararlo.
- **Por qué:** son instrucciones al modelo, no mensajes del alumno.
- **Verifica:** `sesion-auditoria.test.mjs`: «H54: /estudiar y /fin mandan sus órdenes ocultas, que disparan el turno y no quedan como mensaje del alumno».

### DA18 — Cada tool del curso se ve en una línea en español

- **Contexto:** las tools mostraban argumentos y resultados crudos (enunciados del práctico, JSON) y las etiquetas decían «Working…» y «Thinking...» (H08, H09).
- **Decisión:** `pi.registerToolRenderer` (`extensions/curso/render.ts`, registrado desde `presentacion.ts`) dibuja cada tool del curso en una línea («Leí PDF 54–57 de kurose-7», «Progreso guardado»), sin argumentos y sin el texto de `leer_paginas`, `leer_items` o `buscar_material`, ni siquiera expandido. Los errores de pi en inglés (validación, Esc, traza de Python) se reducen a la línea de la tool, como «No se guardó el progreso». `progreso.py` convierte sus errores de archivo y los internos de Python en una línea en español que dice qué revisar («Progreso no guardado: no hay permiso para escribir el progreso; revisá los permisos de cursos/<c>/.», «…: un archivo del curso está dañado (no es texto)…»), y la tool la muestra como «No se guardó el progreso: …». `guardar_curso` muestra el diff entero antes de confirmar. En cada `session_start`, las etiquetas pasan a «Trabajando…» y «Pensando…». Una tool nueva del curso necesita su fila en `render.ts`.
- **Por qué:** el alumno no tiene que ver material ni soluciones en crudo, ni textos en inglés.
- **Verifica:** `presentacion-auditoria.test.mjs`: «H08: cada tool del curso se ve en una línea en español, sin argumentos ni texto del resultado», «H08: un registrar o guardar_items cortado con Esc o con traza de Python no muestra el error en inglés», «H09/X04: «Working» y «Thinking...» quedan en español desde el arranque». `test_pedagogia_auditoria.py`: `test_permiso_denegado_es_una_linea_en_espanol`, `test_un_archivo_corrupto_no_llega_en_ingles`, `test_errores_internos_de_python_no_llegan_en_ingles`.

### DA19 — Compactación con plantilla de clase

- **Contexto:** `/compact` resumía con la plantilla de pi, en inglés, y una vez marcó «(Correcta)» un quiz sin responder (H62).
- **Decisión:** con una clase activa, `session_before_compact` pide el resumen con una plantilla en español (Curso y tema, Borde, Práctica, Próximo paso, Datos) en la que lo no respondido queda «pendiente, sin responder». Es una sola llamada con el modelo y el thinking de la sesión; `/compact <texto>` se suma como «Además:». Sin clase (preparando un curso o después de `/fin`), o si algo falla, sigue la plantilla de pi.
- **Por qué:** después de compactar el tutor tiene que conservar el borde real del alumno; fuera de clase, la plantilla de pi conserva mejor rutas y decisiones.
- **Verifica:** `presentacion-auditoria.test.mjs`: «H62: /compact resume en español con curso, tema y log, y no califica el quiz sin responder», «H62: si el resumen en español falla, pi sigue con el suyo y la sesión no se corta», «H62: sin clase activa (preparando un curso o tras /fin) /compact usa la plantilla de pi, que conserva rutas y decisiones».

### DA20 — md-log sigue la nota por inode y la clase no depende de ella

- **Contexto:** renombrar o mover la nota en Obsidian hacía fallar el progreso y `/fin` (H04); si md-log no confirmaba o faltaba disco no había clase y quedaba un .md vacío (H16); una foto HEIC o BMP no se procesaba (H70).
- **Decisión:** cada vínculo de md-log guarda `ino`, `dev` y nacimiento de la nota, y la sigue por inode dentro del vault si se renombra o mueve (evento `md-log:movido`); si se borra, la recrea en su ruta con un aviso. El curso escucha ese evento y guarda la ruta nueva como `nota` en la entrada `curso` y en `.sesion-activa.json`, si sigue en `sesiones/`, para revincularla al retomar (también sólo con el registro propio) y cerrarla con `/fin`; fuera de `sesiones/` se cierra por su ruta de origen. `log` sigue siendo el nombre de la sesión, del que `progreso.py` saca fecha y orden. Si md-log no confirma en 2 s, o falta permiso o disco, la clase sigue sin nota y avisa «No se pudo crear la nota de la clase en Obsidian[ (disco lleno)| (sin permiso para escribir en sesiones/)]; seguimos sin nota.», y ese nombre de log no se reutiliza. Si no se puede cerrar, la clase sigue abierta: «… repetí /fin.», o «… hay otra nota vinculada, desvinculala con /md-unlog y repetí /fin.». El formato de una foto sale de su firma; HEIC pasa a JPEG y BMP a PNG con ImageMagick (`magick`), dependencia opcional; sin él, pi avisa en una línea que la manden en JPEG o PNG y la nota marca «Imagen N no guardada».
- **Por qué:** la nota es un registro para el alumno, no un requisito de la clase.
- **Verifica:** `md-log-auditoria.test.mjs`: «H04: renombrar la nota en Obsidian no pierde entradas, no avisa y /fin la cierra», «H04: una nota movida a otra carpeta del vault se encuentra por inode; una ajena con el mismo nombre no», «H04: si la nota se borró, se recrea en su ruta con un solo aviso», «H70: la firma decide el formato: HEIC y BMP por ruta se convierten y un PNG con extensión .jpg se guarda como .png». `sesion-auditoria.test.mjs`: «H16: si md-log no confirma o sesiones/ no se puede escribir, la clase sigue sin nota y sin .md vacío». `remates-auditoria.test.mjs`: «H04: con la nota renombrada en Obsidian, /fin guarda con el nombre de la sesión, escribe en la nota movida y cierra», «H04: la ruta nueva de la nota queda en el curso activo: un pi que retoma sólo con el registro propio (X01) la revincula y /fin cierra», «H04: una nota movida fuera de sesiones/ no invalida el curso al retomar y /fin la cierra».

### DA21 — Forma del quiz (D1–D5)

- **Contexto:** quiz y ask_user_question estaban en inglés («I don't know», «Submit»), el popup mostraba LaTeX crudo y la forma delataba la respuesta: 5 de 22 quizzes con dos opciones, details con el enlace a la página de la respuesta y `shuffle:false` con la correcta primera (H45–H50).
- **Decisión:** UI en español, con «No sé» siempre al final. El LaTeX común del enunciado, de details y de las opciones se muestra en Unicode; la explicación se guarda en LaTeX. Un single-select con menos de 3 opciones reales es el único rechazo: el modelo lo rehace y el alumno ve «Pregunta descartada por tener menos de 3 opciones; ya viene otra.». Descriptions en todas las opciones o en ninguna; antes de responder no se muestran enlaces; siempre se baraja, y `shuffle:false` sólo ordena opciones que son todas numéricas.
- **Por qué:** es el contrato de quizzes de la versión anterior (AUDITORIA §2, D1–D5).
- **Verifica:** `quiz-ui.test.mjs`, por ejemplo «H47: single-select con 2 opciones se rechaza en español sin abrir el popup; con 3 o multi-select se acepta», «H49: details no muestra enlaces antes de responder», «H50: shuffle:false no fija la correcta salvo opciones numéricas, que se ordenan».

### DA22 — Ingesta: matemática, ediciones a mano y Tesseract

- **Contexto:** la matemática de Kurose (fuente MathematicalPi) salía rota con un aviso genérico tapado por falsos positivos (H22); una fórmula destrozada por el OCR pasaba sin aviso (H23); editar a mano un .md trababa la preparación (H36); `iniciar` informaba éxito aunque el hijo muriera y se exigía Tesseract con `spa` hasta para PDFs digitales (H37).
- **Decisión:**
  - Detector de matemática v3 (`VERSION_ALGORITMO = 3`): fuentes matemáticas (sin OpenSymbol/StarSymbol ni monoespaciadas), superíndices numéricos, símbolos y `^`; MathematicalPi marca `operadores_cifrados`; en OCR se buscan restos de fórmulas. Al subir la versión, las páginas de visión o manuales sólo se reclasifican.
  - Una página editada sin adoptar se preserva, no se indexa y figura como `editada`; `ingestar.py adoptar --salida … --doc … --pagina …` la registra como ruta `manual`, con revisión humana hecha, y ninguna ingesta la regenera.
  - Tesseract se exige sólo con páginas escaneadas; la clave opcional `ruta_tesseract` de `curso.config.json` fija cuál. `iniciar` espera unos 2 s y sale con código 1 si el hijo murió; `estado` distingue `iniciando` y `error`.
- **Por qué:** avisos específicos donde hay matemática de verdad, y que una edición humana o una herramienta ausente no frenen lo demás.
- **Verifica:** `test_pipeline_auditoria.py`: `test_operadores_cifrados_avisan_y_piden_vision`, `test_nuevo_algoritmo_conserva_vision_y_desatasca_falsos_positivos`, `test_formula_escaneada_queda_pendiente_y_la_prosa_no` (necesita Tesseract con `spa`), `test_adoptar_registra_la_edicion_y_la_ingesta_la_conserva`, `test_pdf_digital_no_exige_tesseract_con_spa`, `test_iniciar_informa_si_el_hijo_muere_y_estado_no_muestra_la_corrida_anterior`.

### DA23 — Curación: copias seguras, propuesta en la raíz y avisos por tema

- **Contexto:** un `aplicar` cortado dejaba un PDF parcial con el nombre final y el curso no se podía volver a guardar (H38); una propuesta o un manifiesto en `cursos/<c>/_procesado/` trababan la creación (H40); un tema sin evaluaciones no avisaba (H19); los rangos del índice dejaban afuera material que piden objetivos y parciales (H21).
- **Decisión:** un curso nuevo se arma en `cursos/.<slug>.nuevo/`. Cada PDF se copia como `.<pdf>.parcial-<pid>`, con fsync y verificación de SHA-256, y pasa al nombre final con `os.link`, que requiere hard links. Una carpeta de curso sin `indice.yaml` se informa y no se toca. Propuesta y manifiesto van en `_procesado/` de la raíz del vault, y el error nombra el archivo ajeno. `validar` suma un aviso por tema sin evaluaciones y por documento sin segmentar, y devuelve `sin_transcripcion`. `cursos.py cruzar` es una ayuda de curación: busca siglas y términos con guion de objetivos e ítems en la bibliografía del tema.
- **Por qué:** que un corte siempre se pueda resolver repitiendo la operación.
- **Verifica:** `test_cursos_auditoria.py`: `test_h38_curso_nuevo_cortado_no_aparece_y_se_puede_repetir`, `test_h38_ampliacion_cortada_o_matada_no_deja_pdf_parcial_con_el_nombre_final`, `test_h38_carpeta_incompleta_no_es_un_curso_existente`, `test_h40_propuesta_dentro_del_curso_pide_la_raiz_del_vault`, `test_h19_avisa_por_tema_sin_evaluaciones_y_por_documento_sin_segmentar`, `test_h21_cruzar_senala_terminos_fuera_del_rango_y_donde_estan`.

### DA24 — Un fallo de visión no degrada lo que estaba bien

- **Contexto:** un fallo de visión dejaba «pendiente» una página digital buena y ocultaba el error real (H39).
- **Decisión:** antes de llamar se comprueba que el modelo exista, acepte imágenes y tenga credenciales (el snapshot y, si dice que no, `getProviderAuth`); sin credenciales no se pide confirmar ni se llama, y se dice «…; ejecutá /login». Un fallo muestra el error real y no degrada páginas digitales, de OCR ni de visión que ya eran buenas: las marca `error_vision` para reintentar. Esc no cuenta como fallo. Una página `manual` es caché.
- **Por qué:** una llamada fallida no debe empeorar lo que ya servía.
- **Verifica:** `vision-auditoria.test.mjs`: «H39: un 401 dice el error real y no degrada una página digital buena», «H39: cancelar con Esc no registra la página como fallida», «H39: sin credenciales de visión no pide confirmar, no llama y dice qué hacer», «H39: un snapshot de credenciales viejo no bloquea la visión si pi resuelve la autenticación». `test_preparacion_auditoria.py`: `test_pagina_adoptada_es_cache_no_se_pisa_y_sirve_para_items`.

### DA25 — `/estudiar` y `/fin`: cortes, cambio de tema y reconstrucción

- **Contexto:** con un quiz abierto `/fin` y `/estudiar` se rechazaban y se perdía lo tipeado (H26); cambiar de tema abandonaba el log sin registrar (H25); cada sesión ofrecía reconstruir logs técnicos, vacíos o ad hoc, y un rechazo no se recordaba (H15); tras un kill el último mensaje del alumno quedaba sin respuesta (H63); los subtemas caían en ad hoc (H24).
- **Decisión:** con el agente ocupado, `/fin` y `/estudiar` cortan el turno (`abort` + `waitForIdle`); `/estudiar` primero pregunta y sólo corta al confirmar; un quiz o una pregunta abiertos se cierran solos con el corte (DA28). Con un tema activo, `/estudiar` ofrece «Guardar y cambiar», «Cambiar sin guardar» o «Cancelar». Se ofrece reconstruir una sola vez la última sesión real del tema sin cierre (ni ad hoc, ni técnica, ni la viva de otro pi); lo ya ofrecido queda en `cursos/<c>/.no-reconstruir.json`. Al reanudar tras un corte con un mensaje del alumno sin respuesta, el tutor lo responde solo. Un subtema que BM25 ubica dentro del rango de un tema activa ese tema.
- **Por qué:** un comando del alumno no se pierde ni deja la clase a medias.
- **Verifica:** `sesion-auditoria.test.mjs`: «H26: /estudiar con el agente ocupado corta el turno y sigue; con una pregunta abierta, antes confirma», «H25: con un tema activo, /estudiar ofrece guardar y cambiar, cambiar sin guardar o cancelar», «H15: sólo se ofrece reconstruir una sesión real, una sola vez», «H63: si pi se cortó antes de responder al alumno, al reanudar se avisa y el tutor lo responde sin duplicarlo», «H24: un subtema que sólo encuentra BM25 resuelve al tema cuyo rango contiene esas páginas».

### DA26 — El dossier ordena por prioridad

- **Contexto:** el dossier cortaba el progreso en 3000 B con la verificación al final: tras dos sesiones ya no se veían errores ni ejercicios (H28, H61). Además avisaba «Preparación parcial» de todo el curso en cada `/estudiar` (H55).
- **Decisión:** el progreso del tema entra en ≤3000 B en este orden: estado, próximo paso, fallas, errores sin resolver, últimos ejercicios, domina y conceptos firmes, cada lista con su parte del presupuesto y lo más reciente primero. «Objetivo acordado» y «Plan» (DA7) van antes y ocupan hasta 2000 B de esos 3000, medidos en bytes, así el progreso conserva al menos 1000. La verificación se resume en ≤1200 B y cada prerequisito en ≤800 B. Los ítems van con vistas previas de hasta 2400 B, primero los del índice y después los asignados automáticamente, y nunca se listan soluciones ni ítems reservados (una línea dice que hay uno para `/simulacro`). Una línea «Preparación del tema» dice qué páginas del tema faltan, en vez de los avisos de todo el curso.
- **Por qué:** al retomar, el «dónde quedamos» es lo que más necesita el tutor.
- **Verifica:** `preparacion-auditoria.test.mjs`: «H28, H61: el dossier conserva el dónde quedamos y resume la verificación sin cortarla», «H55, H31: la preparación se informa por tema y no por avisos del curso ni ejercicios huérfanos», «el dossier nunca lista ítems de solución aunque el índice los referencie». `pedagogia-auditoria.test.mjs`: «H56: un objetivo y un plan largos con caracteres multibyte no desplazan el progreso del tema».

### DA27 — Ítem reservado por código y `/simulacro`

- **Contexto:** no había ensayo cronometrado y sin pistas con un ítem que el alumno no hubiera visto (H35; contrato E3, E9). La reserva dependía de la disciplina del modelo y se filtró dos veces en la versión anterior.
- **Decisión:**
  - `reservas` (`extensions/curso/material.ts`) elige por tema un enunciado de un documento de evaluaciones, asignado por el índice o por la preparación, sin intentos registrados ni reservado por otro tema, y prefiere los que tienen solución oficial y después puntos. `registrar_progreso` lo fija en `progreso.yaml` (`reservado: [{doc, id, usado?}]`) sólo para el tema que guarda; los demás no se escriben y su reserva se calcula igual. El primero vigente manda: los ítems nuevos no lo cambian; usado o desaparecido, se elige otro.
  - Fuera del simulacro, ni los reservados ni sus soluciones salen por ninguna vía: el dossier no los lista (sólo dice que hay uno), `leer_items` los rechaza, `leer_paginas` omite su pregunta entera o rechaza el rango si no puede separarla, `buscar_material` no los ofrece y `ver_pagina` rechaza sus páginas. Durante el simulacro, `leer_items` da el que se rinde y su solución.
  - `/simulacro` corta el turno, marca el ítem `usado` en `progreso.yaml` antes de mostrarlo, anota `curso-simulacro` en la rama y manda una orden oculta: enunciado tal cual, puntaje, tiempo proporcional de `curso.md` y nada de pistas hasta la entrega; al entregar, corregir con la solución oficial, registrar el intento y los nodos fallados en `borde.falla` y proponer un repaso por peso en el examen. La sección `simulacro` del prompt repite esas reglas en cada turno. Termina cuando `registrar_progreso` guarda el intento de ese ítem, o con `/fin` o el cambio de tema, que cambian el log. Sólo cubre el tema activo.
- **Por qué:** visto es usado: marcado recién al registrar el intento, tras un kill seguía reservado y `/simulacro` lo volvía a presentar. Fijar sólo el tema que se guarda deja que la curación quite o renombre temas sin estudiar; un guardado de lo pendiente de la clase no corta el simulacro.
- **Límites:** antes de que se segmente un parcial (en segundo plano, la primera vez que se estudia un tema) `leer_paginas` puede mostrar sus enunciados, y la reserva, elegida después, puede caer en uno que el tutor ya leyó; lo mismo si el ítem fijado desaparece del banco. `ver_pagina` rechaza siempre la página entera de un reservado o de su solución, también tras otro intento o durante el simulacro (en Redes, las páginas 1 a 3 de `sol-prc20240926`). Un tema con un solo ítem de evaluación lo reserva. El tiempo sólo sale de «N horas|minutos» y «N preguntas» en `curso.md`.
- **Verifica:** `pedagogia-auditoria.test.mjs`: «E3: la reserva elige un ítem real de evaluación con solución y puntos, y los ítems nuevos no la cambian», «E3: fuera del simulacro el reservado no está en el dossier, leer_items, leer_paginas ni buscar_material», «E3: ver_pagina rechaza una página con el reservado, aun después del intento», «E3 con el curso real: el reservado de cada tema no se ve en sol-prc20240926», «E9: /simulacro sin tema activo o sin ítem reservado lo dice en una línea», «E9: /simulacro corta el turno, presenta el reservado con su tiempo y termina al registrar el intento», «E3, E9: el reservado queda usado al presentarlo, un guardado sin el intento no corta el simulacro y /fin lo cierra». `test_pedagogia_auditoria.py`: `test_la_primera_reserva_queda_fija`, `test_un_tema_sin_estudiar_no_entra_en_progreso_y_la_curacion_puede_quitarlo`, `test_presentado_en_el_simulacro_queda_usado_sin_esperar_el_intento`, `test_si_el_reservado_desaparece_se_elige_otro`.

### DA28 — Confirmaciones en español y popups que se cierran al cortar el turno

- **Contexto:** `ui.confirm` de pi 1.4.0 dibuja «Yes»/«No» (`interactive-mode.js:2157-2163`). `ctx.ui.custom` no mira el signal de la tool y el loop del agente espera a `execute`: `/fin` o `/estudiar` con un quiz o una pregunta abiertos quedaban colgados hasta el Esc (H26, H25). `ui.editor` tampoco recibe el signal y dibuja sus atajos en inglés (`interactive-mode.js:2192-2200`, `extension-editor.js:59-64`) (H45).
- **Decisión:** las confirmaciones (reconstruir el progreso, gasto de visión, `/md-log` sobre una nota con texto, guardar un curso existente) usan `ctx.ui.select` con «Sí, <acción>» y «No»; Esc o un corte valen como no. Quiz y `ask_user_question` escuchan el signal: un corte los cierra como cancelados, salvo un quiz que ya mostró la corrección, que queda respondido. La respuesta libre de `ask_user_question` es un popup propio («Enter enviar • Ctrl+J nueva línea • Esc cancelar»); en modo RPC, donde no hay `custom`, sigue el editor del cliente.
- **Por qué:** un comando del alumno no queda esperando un Esc, y una respuesta cuya corrección ya vio no se pierde.
- **Límite:** en la terminal no se puede tipear un comando con un popup abierto; el cierre cubre un cliente SDK o un comando que entra justo cuando aparece el popup. En RPC, `custom` devuelve `undefined` y el editor del cliente no recibe el signal (`rpc-mode.js:152-155`, `:174-192`): un corte no cierra la respuesta libre.
- **Verifica:** `remates-auditoria.test.mjs`: «H26/H25: cortar el turno (/fin, /estudiar) cierra un quiz o una pregunta abiertos sin Esc», «H26/H25: un corte con el quiz ya corregido conserva la respuesta (el alumno ya vio la correcta)», «H26/H25, H45: la respuesta libre de ask_user_question se cierra al cortar el turno y dibuja sus atajos en español», «H45: las confirmaciones se dibujan en español y Esc o un corte valen como no».
