# Decisiones de implementación

## Estado — 2026-10-23

**Fase 0 cerrada**, commit `79b1976`, con aceptación explícita del smoke técnico y de la prueba independiente del researcher real. La lección se interrumpió en el probe: no se afirma que se completó. Evidencia: `informes/verificacion-base.md`.

**Fase 1 aprobada por el usuario:** «aprobado, sigamos», tras presentar el informe y sus limitaciones. La ingesta base procesó nueve páginas, siete pendientes de revisión/visión; los 18 PDFs originales conservan sus hashes. Pasan 18 tests Node, incluida una suite de 20 tests Python, y el doctor completo dentro de tmux. Esta base quedó cerrada en el commit `352c249` y quedó autorizado iniciar Fase 2. Al cerrar Fase 1 no se había evaluado un parcial/práctico escaneado real: esa aprobación no dio por cumplido el caso ni autorizó sustituirlo por una copia rasterizada. Detalle: `informes/fase1.md`.

**Fase 2 aprobada por el usuario:** «Fase 2 aprobada, continuá». Tools de visión e ítems implementadas; 28 tests Node y 34 tests Python sin LLM aprobados, doctor completo repetido en verde dentro de tmux para el cierre. Piloto digital: tres páginas y diez ítems. A pedido del usuario se buscó además papel escaneado real externo: dos páginas de Limric (1895), quince ítems y el ejercicio 9 multipágina. Tras corregir moneda y continuaciones en el prompt, seis fracciones y ocho importes cotejados; repetición con dos aciertos de caché. Se acepta este checkpoint con sus límites declarados y se completa el commit de cierre. Los estados de revisión de las salidas individuales no cambian por la aprobación global. Fase 2 cerrada en `6409acd`. Evidencia: `informes/fase2.md`.

**Fase 3 autorizada:** «Continuá con la fase 3». Implementadas skills de creación/ampliación, comandos, guardado con diff/confirmación, validador e informe visible. Curso real `redes`: 14 PDFs copiados y ocho temas; 52 páginas preparadas, 23 con Luna, 15 ítems segmentados. El usuario aprobó luego «Aprobado; continuá»: se aplicó la propuesta exacta revisada, se asignaron esos ítems y se incorporaron las tres diapositivas complementarias (17 PDFs / 987 páginas). Se preservaron contrato, progreso y PDFs previos. Fase 3 cerrada en `3616e71`. Detalle: `informes/fase3.md`.

**Fase 4 aprobada:** «Aprobado; continuá», commit `c757542`. `/estudiar`, tools de lectura/render, dossier, inyección estructurada, persistencia y puente de md-log. Smoke con `gpt-6.1-sol`: primera pregunta en 20,08 s, compactación real y reapertura del JSONL con estado/log restaurados; sin respuestas inventadas ni progreso escrito. 46 tests Node y 56 Python. Evidencia y límites: `informes/fase4.md`.

**Fase 5 aprobada:** «Confirmado, avanzá» confirma la imagen recuperada en Obsidian y autoriza Fase 6. Fotos guardadas/embebidas y protocolo transcribir → aclarar → corregir, con ensayo público separado de Redes y corrección del pegado nativo en `53a7476`. Su advertencia de pi 1.4.0 frente al antiguo pin 1.3.0 se resolvió validando la base 1.4.0 en Fase 6, sin reinstalar. Revisiones individuales y progreso no cambian. Detalle: `informes/fase5.md`.

**Fase 6 aprobada:** «Aprobado, continuá», commit `f9aeea7`. Researcher anclado, modos y caché; 71 tests Node / 56 Python y doctor completo correcto en pi 1.4.0 al cierre. Ensayo final: probes en 20,62 s / 7,42 s sin nuevo hijo; A1/A3 discrepan y A2 concuerda. Fallos semánticos anteriores conservados; estructura/caché no certifican verdad. Detalle: `informes/fase6.md`.

**Fase 7 aprobada:** «Aprobado, continuá», commit `29cdb0c`. progreso validado/fusionado/atómico con `.bak`, `/fin`, `/progreso`, reconstrucción confirmada y sugerencia. 83 tests Node / 67 Python, doctor completo en verde. Dos sesiones con Sol y alumno virtual aislado: segundo probe confirma el borde en tres preguntas. Sin progreso ficticio en Redes. El usuario autorizó «Usar openai-codex» al faltar credenciales para el proveedor anterior; se verificaron Sol/Luna texto y Luna imagen antes de cambiar sólo configuración local del proyecto. Detalle: `informes/fase7.md`.

**Fase 8 autorizada, piloto en curso:** `../fricciones.md` registra 3–5 sesiones reales para priorizar y reprobar sus tres trabas principales. Todavía tiene 0 sesiones del piloto; el alumno virtual no cuenta. El commit/checkpoint de cierre de esta fase sigue pendiente.

**Auditoría de robustez (2026-10-22 y 23):** `../AUDITORIA.md` midió sesiones reales, una ingesta y arneses sin modelo sobre copias del vault; los P0 y P1 se arreglan y los P2 sólo se reportan. Con las decisiones del usuario (DA1–DA7) se integraron en la rama `cursos`, hasta `2a3f212`, tres etapas de arreglos: entorno, ingesta, cursos, progreso, quiz, researcher, sesión, presentación y preparación por tema (DA8–DA26); después, pedagogía y remates de integración (DA7, DA27, DA28). En `2a3f212`, `doctor --sin-red`, en una copia del vault y fuera de tmux, sólo marcó «Dentro de tmux», las rutas del vault (por la copia) y los cuatro chequeos que `--sin-red` omite.

La primera prueba de punta a punta con el modelo real (`gpt-6.1-sol`, una clase de retardos con kill, `/compact`, `/simulacro` y `/fin` sobre una copia del vault, 41 llamadas) llegó a la primera pregunta a los 15,7 s y no perdió estado ni mostró soluciones antes del intento, pero encontró tres fallas graves: se enseñó de memoria sin leer la bibliografía, `/simulacro` gastó el reservado a mitad del tema y el reservado era casi copia de un ejercicio del dossier; además, textos de pi en inglés. Con los restos de la etapa anterior y los arreglos de fidelidad y plomería (DA29–DA36), la rama llega a `64cb42d`: sin modelo ni red, 267 tests Node en verde (incluyen la suite Python) y 151 tests Python OK. Pendiente: verificar con el modelo real las reglas nuevas de modo-curso (DA31) y en Obsidian el embed de la página mostrada (DA30); no hay simulacro de varios temas ni del curso completo, ni ficha del alumno (H58: patrones de error entre temas, confianza declarada y fechas de evaluación).

**Interfaz de escritorio y Windows (2026-10-25, propuesta en un PR de luchoberaza):** app de escritorio en `app/` y núcleo portable a Windows, sin cambios de comportamiento en Linux ni en la terminal. Sin modelo ni red: suite Node 293 tests (Windows 271 en verde y 22 salteadas con motivo; Linux 280 y 13), Python 165 OK en las dos, y la app con 39 tests de host y lógica y 10 de punta a punta con Electron real en las dos. Con el modelo real se probó Claude Sonnet 5.5 en la app (DA48). La ingesta base procesa varias páginas a la vez según los hilos de cada máquina y deja los mismos archivos que de a una (DA50). Pendiente: probarla con `openai-codex` y decidir el fork de los subagentes. Ver DA39–DA50 y `informes/interfaz.md`.

**Grabaciones de clase (2026-10-26, propuesta en el mismo PR):** un video o audio de clase es material del curso, transcripto en local con faster-whisper en tramos de cinco minutos que el tutor cita al segundo y la app reproduce en su propia ventana. Con DA51, sin modelo ni red: suite Node 298 tests (Windows 276 en verde y 22 salteadas; Linux 285 y 13), Python 175 (Windows 169 OK y 6 salteadas; Linux 171 y 4), y la app con 40 tests y 11 de punta a punta en las dos. Con el modelo real, una grabación de 41 minutos se transcribió sin placa de video. Ver DA51.

**Un tutor que no da nada por sabido (2026-10-26, en el mismo PR):** el diagnóstico vuelve a ser el de `teach`, sin tope, y arranca con la lista de lo que el alumno ya vio. Cada pregunta llega con la explicación que verifica: en una clase real el tutor la escribía en su razonamiento, que el alumno no ve. Un tema se encara como siempre, desde cero o para fortalecer lo flojo, y el alumno elige la mezcla de múltiple opción y desarrollo. Con DA52, sin modelo ni red: suite Node 317 tests (Windows 295 en verde y 22 salteadas; Linux 304 y 13) y la app con 45 tests y 12 de punta a punta en las dos; la suite Python no cambió. Con el modelo real, cinco clases con un alumno simulado sin bases. Ver DA52.

**Eliminar un curso (2026-10-27, en el mismo PR):** en la app, desde la pantalla del curso. Va a la papelera del sistema, de donde se restaura, y no se elimina con una clase abierta, la ingesta o la preparación de un tema corriendo. Con DA53, una prueba de host y una de punta a punta nuevas, que pasan en Windows y en Linux, igual que la papelera real de cada uno. Ver DA53.

**Paneles, escala y pestañas (2026-10-28, en el mismo PR):** pedido del dueño del repo después de usar la app. La barra lateral se pliega y, como el panel de página, se ensancha arrastrando su borde; la interfaz se agranda o achica en Ajustes o con Ctrl + y Ctrl −; y la ventana tiene pestañas, como un navegador, con una conversación o un PDF en cada una. Al abrir un PDF se elige si va en una pestaña o en su ventana. Ver DA54–DA56.

**Lo que vio un alumno nuevo en Windows (2026-10-29, PR nuevo):** un amigo del usuario instaló la app en su PC y armó un curso. El tutor copió de `CURSOS.md` el Python de Linux y salió a buscar otro, contó como una falla las páginas que la ingesta deja para la visión y a un «¿por qué?» le contestó con una pregunta sin la explicación. Ver DA57.

**learn anda con la clave que tenga el alumno (2026-10-29, en el mismo PR):** la visión, el researcher y los subagentes tenían fijo un modelo de openai-codex. Sin una sesión de ChatGPT fallaban, aunque la conversación anduviera con otra clave. Ahora, si el modelo configurado no tiene credenciales, usan el de la conversación, y el doctor dice cuál en vez de marcarlo en rojo. Ver DA58.

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

*Superada en parte por DA2, DA24 y DA28: la preparación por tema transcribe sin pedir confirmación (tope de 150 páginas por corrida); un error ya no degrada una página que era buena: la marca `error_vision` para reintentar; y la confirmación de una tanda grande es «Sí, transcribir»/«No», no `ctx.ui.confirm`.*

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

*Superada en parte por DA23 y DA28: un `aplicar` cortado ya no deja copias con el nombre final; el curso nuevo se arma en `cursos/.<slug>.nuevo/` y cada PDF se publica con un hard link tras verificar su SHA-256. La confirmación es «Sí, guardar los cambios»/«No», no `ctx.ui.confirm`.*

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

*Superada en parte por DA52: con borde previo el probe empieza por lo que fallaba, sin tope de preguntas.*

Modo-curso pide confirmar domina/falla previos con hasta tres preguntas conceptuales en total; si los contradice la nueva evidencia, se amplía el mapeo. El dossier prioriza borde/próximo paso frente a listas de intentos. La sugerencia omite dominados y exige prerequisitos dominados; orden de preferencia: en curso, repasar, temas nuevos accesibles. No se agrega un planificador de repasos.

Ensayo real final: _procesado/fase7/prueba-1792672775843/resultado.json. Dos sesiones nuevas de la fixture prueba-progreso con Sol, tres preguntas en cada una. El sistema recibió el borde de la primera; se cotejó en el JSONL de la segunda y las preguntas lo confirmaron en tres, con igual borde registrado. Dos /fin guardaron y conservaron el resumen antes de desvincular. Respuestas programadas: primer quiz correcto y siguientes no sé; sólo describen al alumno virtual aislado. No certifican el nivel del usuario, una clase completa, práctica evaluada ni el piloto humano. Researcher/visión se excluyeron de este smoke porque ya tienen ensayos propios.

Se conservan los intentos fallidos: modelo inicial distinto (1792636116750); ruta de backend incorrecta (1792636295117); rechazo prudente a convertir respuestas sintéticas en evidencia del usuario (1792636612356); simulador que respondió todo bien, sin techo (1792636786643); divergencia de proveedor (1792672185762); openai sin credenciales (1792672223350). Se corrigieron el harness y su guardia temprana de autenticación, no se relajó la exigencia de piso/techo. También se corrigió una fixture de test que editaba los datos antes de su serialización, no el snapshot activo. Uso registrado en JSONL de todos los ensayos: 54873 entrada, 3199 salida, 172544 lectura de caché, costo de catálogo 0,1589904 (no factura; excluye doctor y pings).

## D7.4 — Cambio de proveedor autorizado, no fallback silencioso

Al retomar la fase, openai ya no tenía autenticación configurada y el modelo seleccionado por el runtime era openai-codex/gpt-6.1-sol. Doctor falló ambos pings openai/gpt-6-luna. Se informó y el usuario eligió «Usar openai-codex». Antes de adoptar el cambio respondieron openai-codex/gpt-6.1-sol por texto y gpt-6-luna por texto/PNG. Se verificaron docs de modelos y las declaraciones públicas del runtime instalado. Se cambiaron sólo .pi/settings.json, curso.config.json, frontmatter del researcher y las expectativas de los scripts de ensayo; ninguna credencial ni configuración personal.

Doctor completo volvió a verde con el nuevo proveedor; los informes previos conservan sus ids históricos. El cambio de modelo/config invalida por diseño las claves de researcher/visión, preservando sus generaciones anteriores. No se recreó alcance ni se retranscribieron PDFs durante Fase 7: el próximo estudio puede lanzar un alcance nuevo, y una futura preparación de visión explícita puede consumir llamadas nuevas. No se alteró la versión de pi ni se eligió otro nombre de modelo. No se relanzaron los ensayos históricos de fotos/visión/researcher sólo para actualizar su etiqueta de proveedor; siguen disponibles como opcionales.

## Auditoría de robustez — 2026-10-22

Decisiones tomadas a partir de `../AUDITORIA.md`; los ids H/X son sus hallazgos. DA1–DA7 son decisiones del usuario y DA8–DA36, decisiones de diseño de los arreglos. «Verifica» nombra el test o el comando que lo comprueba. Los tests corren sin modelo ni red desde la raíz del vault:

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
  - Una respuesta inválida se reintenta una vez con el motivo; un enunciado que trae un marcador de solución se rechaza. Si vuelve a fallar, esa segmentación o clasificación queda en `fallos` de `preparacion.json` con la huella de lo enviado y espera 24 h o hasta que cambien sus entradas, también si después se corta la tanda (DA36). Un documento de tipo `soluciones` no se segmenta solo.
  - Red, cuota o credenciales, reconocidas sólo por el error del proveedor, cortan la tanda en la primera falla; un plazo vencido (3 min por página, 5 por segmentación o clasificación) es una falla de esa llamada, no un corte. Sólo lo que corta la tanda llega al alumno, en una línea «Preparación del material no disponible: …; seguimos con lo que hay.» (DA36). El estado por tema queda en `_procesado/preparacion.json`, y `/curso-check` suma una línea por tema con ese estado y los ítems asignados automáticamente.
- **Por qué:** fricción cero sin demorar la primera pregunta; en el e2e de la rama `fix/preparacion` con pi 1.4.0 llegó a los 0,6–0,75 s con la preparación ya lanzada (notas de esa rama). El tope acota lo que gasta una corrida sin pedir confirmación, y un fallo que se repetiría no gasta llamadas en cada `/estudiar` (antes, sin red, la visión de retardos intentaba sus 49 páginas).
- **Verifica:** `preparacion-auditoria.test.mjs`: «preparación: la primera vez transcribe, segmenta con soluciones y puntos, clasifica y avisa sin turno ni confirmación» (desde DA36 comprueba que no hay aviso al terminar), «preparación: no demora el turno, y sin credenciales avisa una línea y no llama al modelo», «preparación: con la ingesta base corriendo u otro pi preparando espera sin avisos y retoma un lock de un pi muerto», «preparación: un kill a mitad no rompe nada y la próxima vez sigue sin repetir páginas». `test_preparacion_auditoria.py`: `test_prioriza_el_tema_luego_parciales_y_practicos_con_tope`, `test_asignar_valida_y_nunca_toca_el_indice`. `remates-auditoria.test.mjs`: «preparación (a): una segmentación que falla siempre no gasta llamadas en cada /estudiar hasta mañana o hasta que cambien sus entradas», «preparación (b, c): red, cuota o credenciales cortan la tanda en la primera falla; un plazo vencido se dice en español» (desde DA36, que el plazo vencido deja el parcial en espera sin aviso), «preparación (b): un ítem inválido que habla de sockets o conexiones no corta la tanda como una falla de red», «preparación (e, f): sólo se borra el lock propio y un pid reutilizado tras reiniciar no lo retiene», «/curso-check suma una línea por tema con la preparación automática, y sin ella igual valida». `test_remates_auditoria.py`: `test_un_fallo_espera_hasta_que_cambien_sus_entradas_o_pase_un_dia`, `test_curso_check_dice_por_tema_el_estado_y_los_items_asignados`.

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

*Superada en parte por DA52: el probe vuelve a no tener tope, arranca con la lista de lo que el alumno ya vio y las raíces del plan son las que el alumno tiene; el corte por pedido de explicación queda.*

- **Contexto:** la auditoría dejó al usuario el tope del probe, la aprobación del plan, el puntaje, la reserva de ítems y el simulacro (H12, H35, H56, H20; AUDITORIA §5). La precedencia entre teach y modo-curso era ambigua: un pedido de explicación esperó 3 min 46 s detrás del probe y del plan (H12), y al retomar se repetían objetivo y plan (H56).
- **Decisión:** (a) un pedido explícito de explicación corta el probe, que tiene tope de 4 preguntas en un tema nuevo; (b) el plan se aprueba con `ask_user_question` y, al retomar con objetivo y plan guardados, no se vuelven a pedir; (c) la corrección da «≈ x/N» por pregunta, con el descuento de cada inciso (DA31), sólo cuando hay escala oficial; (d) un ítem reservado por tema y `/simulacro` (DA27); (e) por ahora no hay práctica por bloque: la práctica tipo evaluación va al final del tema.
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
- **Decisión:** cada `sesion.py cargar` exitoso se copia a `cursos/<c>/.sesion-cargada.json`. Si Python falla o se cuelga, la clase sigue con esa copia y avisa una vez («Material desde la última carga; el entorno de ingesta no respondió: corré .pi/scripts/doctor.», o «Material desde la última carga. <error>» si Python dio un error propio, como un disco lleno); sin copia, `/estudiar` falla con ese consejo. Sin el venv, lo que corre Python desde la extensión (progreso, preparación, visión, ítems) dice «Falta el entorno de ingesta (Python): corré .pi/scripts/doctor.»; lo que pasa por `pi.exec` (`ver_pagina`, `/curso-check`, `/curso-estado`), «El entorno de ingesta (Python) falló: corré .pi/scripts/doctor y reintentá.». Al restaurar espera hasta 30 s. El autocompletado de `/estudiar` lee la copia, sin llamar a Python.
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
- **Decisión:** con una clase activa, `session_before_compact` pide el resumen con una plantilla en español (Curso y tema, Borde, Práctica, Próximo paso, Datos) en la que lo no respondido queda «pendiente, sin responder». Es una sola llamada con el modelo y el thinking de la sesión; `/compact <texto>` se suma como «Además:». Sin clase (preparando un curso o después de `/fin`), o si algo falla, sigue la plantilla de pi. En una clase corta o recién compactada, pi rechaza `/compact` antes de `session_before_compact` («Nothing to compact (session too small)» o «Already compacted», `agent-session.js:2244-2250`) y dibuja «Error: Compaction failed: …» en inglés (`interactive-mode.js:2981-2983`, `:3755-3757`) antes de `session_compact_failed` (`agent-session.js:2330-2352`): una extensión no puede evitarlo, así que en ese evento se suma «Todavía no hay nada para resumir; la clase sigue igual.» (P3).
- **Por qué:** después de compactar el tutor tiene que conservar el borde real del alumno. El resumen cubre sólo lo anterior a los mensajes que se conservan, así que su «Próximo paso» no afirma que no queda nada pendiente (en la segunda prueba real lo afirmó con un ejercicio a medio resolver); fuera de clase, la plantilla de pi conserva mejor rutas y decisiones.
- **Verifica:** `presentacion-auditoria.test.mjs`: «H62: /compact resume en español con curso, tema y log, y no califica el quiz sin responder», «H62: si el resumen en español falla, pi sigue con el suyo y la sesión no se corta», «H62: sin clase activa (preparando un curso o tras /fin) /compact usa la plantilla de pi, que conserva rutas y decisiones», «P3: /compact en una clase corta suma una línea en español a la de pi, que queda en inglés», «P3: sin clase activa, /compact no suma la línea de la clase».

### DA20 — md-log sigue la nota por inode y la clase no depende de ella

- **Contexto:** renombrar o mover la nota en Obsidian hacía fallar el progreso y `/fin` (H04); si md-log no confirmaba o faltaba disco no había clase y quedaba un .md vacío (H16); una foto HEIC o BMP no se procesaba (H70).
- **Decisión:** cada vínculo de md-log guarda `ino`, `dev` y nacimiento de la nota, y la sigue por inode dentro del vault si se renombra o mueve (evento `md-log:movido`); si se borra, la recrea en su ruta con un aviso. El curso escucha ese evento y guarda la ruta nueva como `nota` en la entrada `curso` y en `.sesion-activa.json`, si sigue en `sesiones/`, para revincularla al retomar (también sólo con el registro propio) y cerrarla con `/fin`; fuera de `sesiones/` se cierra por su ruta de origen. `log` sigue siendo el nombre de la sesión, del que `progreso.py` saca fecha y orden; `registrar_progreso` le pasa además `nota`, la ruta actual (validada dentro de `sesiones/`, `.md` y sin salir del curso), que sólo usa para ver si existe, y ninguna en una clase sin nota: así no avisa «El log … no está» tras un renombre ni le repite al tutor lo que el alumno ya sabe (H04, H16). Si md-log no confirma en 2 s, o falta permiso o disco, la clase sigue sin nota y avisa «No se pudo crear la nota de la clase en Obsidian[ (disco lleno)| (sin permiso para escribir en sesiones/)]; seguimos sin nota.», y ese nombre de log no se reutiliza. Si no se puede cerrar, la clase sigue abierta: «… repetí /fin.», o «… hay otra nota vinculada, desvinculala con /md-unlog y repetí /fin.». El formato de una foto sale de su firma; HEIC pasa a JPEG y BMP a PNG con ImageMagick (`magick`), dependencia opcional; sin él, pi avisa en una línea que la manden en JPEG o PNG y la nota marca «Imagen N no guardada».
- **Por qué:** la nota es un registro para el alumno, no un requisito de la clase.
- **Límite:** movida fuera de `sesiones/`, el curso no guarda su ruta (no se aceptaría al restaurar) y cada guardado le devuelve al tutor «El log … no está (¿se renombró o movió en Obsidian?)…».
- **Verifica:** `md-log-auditoria.test.mjs`: «H04: renombrar la nota en Obsidian no pierde entradas, no avisa y /fin la cierra», «H04: una nota movida a otra carpeta del vault se encuentra por inode; una ajena con el mismo nombre no», «H04: si la nota se borró, se recrea en su ruta con un solo aviso», «H70: la firma decide el formato: HEIC y BMP por ruta se convierten y un PNG con extensión .jpg se guarda como .png». `sesion-auditoria.test.mjs`: «H16: si md-log no confirma o sesiones/ no se puede escribir, la clase sigue sin nota y sin .md vacío». `remates-auditoria.test.mjs`: «H04: con la nota renombrada en Obsidian, /fin guarda con el nombre de la sesión, escribe en la nota movida y cierra», «H04: la ruta nueva de la nota queda en el curso activo: un pi que retoma sólo con el registro propio (X01) la revincula y /fin cierra», «H04: una nota movida fuera de sesiones/ no invalida el curso al retomar y /fin la cierra», «H04: registrar_progreso recibe la ruta actual de la nota y sólo avisa mientras no se la encuentra», «H16: una clase sin nota no repite en cada guardado que falta el log». `test_progreso_auditoria.py`: `test_h04_h16_con_la_nota_renombrada_o_sin_nota_no_avisa_y_la_ruta_se_valida`.

### DA21 — Forma del quiz (D1–D5)

- **Contexto:** quiz y ask_user_question estaban en inglés («I don't know», «Submit»), el popup mostraba LaTeX crudo y la forma delataba la respuesta: 5 de 22 quizzes con dos opciones, details con el enlace a la página de la respuesta y `shuffle:false` con la correcta primera (H45–H50).
- **Decisión:** UI en español, con «No sé» siempre al final. Las opciones largas de `ask_user_question` se envuelven en vez de cortarse al ancho (el objetivo va en el botón con su peso). El LaTeX común del enunciado, de details y de las opciones se muestra en Unicode (también `\min`/`\max` como «mín»/«máx» y las llaves escapadas); la explicación se guarda en LaTeX. Un single-select con menos de 3 opciones reales es el único rechazo: el modelo lo rehace y el alumno ve «Pregunta descartada por tener menos de 3 opciones; ya viene otra.». Descriptions en todas las opciones o en ninguna; antes de responder no se muestran enlaces; siempre se baraja, y `shuffle:false` sólo ordena opciones que son todas numéricas.
- **Por qué:** es el contrato de quizzes de la versión anterior (AUDITORIA §2, D1–D5).
- **Verifica:** `quiz-ui.test.mjs`, por ejemplo «H47: single-select con 2 opciones se rechaza en español sin abrir el popup; con 3 o multi-select se acepta», «H49: details no muestra enlaces antes de responder», «H50: shuffle:false no fija la correcta salvo opciones numéricas, que se ordenan», «A4: una opción larga de ask_user_question se envuelve y se ve entera».

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
  - `reservas` (`extensions/curso/material.ts`) elige por tema un enunciado de un documento de evaluaciones, asignado por el índice o por la preparación, que ni él ni sus casi copias tengan intentos registrados o estén reservados por otro tema, y prefiere los que no tienen casi copias, después los que tienen solución oficial y después puntos (DA32). `registrar_progreso` lo fija en `progreso.yaml` (`reservado: [{doc, id, usado?}]`) sólo para el tema que guarda; los demás no se escriben y su reserva se calcula igual. El primero vigente manda: los ítems nuevos no lo cambian; usado o desaparecido, se elige otro.
  - Fuera del simulacro, ni los reservados ni sus casi copias ni sus soluciones salen por ninguna vía: el dossier no los lista (sólo dice que hay uno), `leer_items` los rechaza, `leer_paginas` omite su pregunta entera o rechaza el rango si no puede separarla, `buscar_material` no los ofrece y `ver_pagina` rechaza sus páginas. Durante el simulacro, `leer_items` da el que se rinde y su solución.
  - `/simulacro`, confirmado si el tema no está dominado (DA33), corta el turno, marca el ítem `usado` en `progreso.yaml` antes de mostrarlo, anota `curso-simulacro` en la rama y manda una orden oculta: enunciado tal cual, puntaje, tiempo proporcional de `curso.md` y nada de pistas hasta la entrega; al entregar, corregir con la solución oficial, registrar el intento y los nodos fallados en `borde.falla` y proponer un repaso por peso en el examen. La sección `simulacro` del prompt repite esas reglas en cada turno; el doctor la acepta en su lista blanca de secciones. Termina cuando `registrar_progreso` guarda el intento de ese ítem, o con `/fin` o el cambio de tema, que cierran o cambian el log. Sólo cubre el tema activo.
- **Por qué:** visto es usado: marcado recién al registrar el intento, tras un kill seguía reservado y `/simulacro` lo volvía a presentar. Fijar sólo el tema que se guarda deja quitar o renombrar a mano en `indice.yaml` un tema todavía no estudiado sin invalidar `progreso.yaml` (la ampliación nunca quita temas); un guardado de lo pendiente de la clase no corta el simulacro.
- **Límites:** hasta que se segmenta el parcial del tema (en segundo plano, la primera vez que se estudia) no hay reserva: `leer_paginas` puede mostrar sus enunciados, su casi copia está a la vista y la reserva, elegida después, puede caer en uno que el tutor ya leyó o cuya copia se mostró (si la copia se practicó y se registró, ya no); lo mismo si el ítem fijado desaparece del banco. `ver_pagina` rechaza siempre la página entera de un reservado, de su solución o de una casi copia, también tras otro intento o durante el simulacro (en Redes, las páginas 1 a 3 de `sol-prc20240926`). Un tema con un solo ítem de evaluación lo reserva. El tiempo sólo sale de «N horas|minutos» y «N preguntas» en `curso.md`.
- **Verifica:** `pedagogia-auditoria.test.mjs`: «E3: la reserva elige un ítem real de evaluación con solución y puntos, y los ítems nuevos no la cambian», «E3: fuera del simulacro el reservado no está en el dossier, leer_items, leer_paginas ni buscar_material», «E3: ver_pagina rechaza una página con el reservado, aun después del intento», «E3 con el curso real: el reservado de cada tema no se ve en sol-prc20240926», «E9: /simulacro sin tema activo o sin ítem reservado lo dice en una línea», «E9: /simulacro corta el turno, presenta el reservado con su tiempo y termina al registrar el intento», «E3, E9: el reservado queda usado al presentarlo, un guardado sin el intento no corta el simulacro y /fin lo cierra». `test_pedagogia_auditoria.py`: `test_la_primera_reserva_queda_fija`, `test_un_tema_sin_estudiar_no_entra_en_progreso_y_la_curacion_puede_quitarlo`, `test_presentado_en_el_simulacro_queda_usado_sin_esperar_el_intento`, `test_si_el_reservado_desaparece_se_elige_otro`. `entorno-auditoria.test.mjs`: «preventivo: la lista blanca de secciones del doctor cubre las que agrega el curso, también la de /simulacro».

### DA28 — Confirmaciones en español y popups que se cierran al cortar el turno

- **Contexto:** `ui.confirm` de pi 1.4.0 dibuja «Yes»/«No» (`interactive-mode.js:2157-2163`). `ctx.ui.custom` no mira el signal de la tool y el loop del agente espera a `execute`: `/fin` o `/estudiar` con un quiz o una pregunta abiertos quedaban colgados hasta el Esc (H26, H25). `ui.editor` tampoco recibe el signal y dibuja sus atajos en inglés (`interactive-mode.js:2192-2200`, `extension-editor.js:59-64`) (H45).
- **Decisión:** las confirmaciones (reconstruir el progreso, gasto de visión, `/md-log` sobre una nota con texto, guardar un curso existente) usan el selector en español de DA29 con «Sí, <acción>» y «No»; Esc o un corte valen como no. Quiz y `ask_user_question` escuchan el signal: un corte los cierra como cancelados, salvo un quiz que ya mostró la corrección, que queda respondido; desde DA35 el corte además termina el turno. La respuesta libre de `ask_user_question` es un popup propio («Enter enviar • Ctrl+J nueva línea • Esc cancelar»); en modo RPC, donde no hay `custom`, sigue el editor del cliente.
- **Por qué:** un comando del alumno no queda esperando un Esc, y una respuesta cuya corrección ya vio no se pierde.
- **Límite:** en la terminal no se puede tipear un comando con un popup abierto; el cierre cubre un cliente SDK o un comando que entra justo cuando aparece el popup. En RPC, `custom` devuelve `undefined` y el editor del cliente no recibe el signal (`rpc-mode.js:152-155`, `:174-192`): un corte no cierra la respuesta libre.
- **Verifica:** `remates-auditoria.test.mjs`: «H26/H25: cortar el turno (/fin, /estudiar) cierra un quiz o una pregunta abiertos sin Esc», «H26/H25: un corte con el quiz ya corregido conserva la respuesta (el alumno ya vio la correcta)», «H26/H25, H45: la respuesta libre de ask_user_question se cierra al cortar el turno y dibuja sus atajos en español», «H45: las confirmaciones se dibujan en español y Esc o un corte valen como no».

### DA29 — Selector propio con la ayuda en español

- **Contexto:** pi 1.4.0 dibuja la ayuda de `ui.select` en inglés («↑↓ navigate  enter select  escape/ctrl+c cancel», `extension-selector.js:42-46`) y no deja cambiarla: el alumno la veía en el selector de temas y en cada «Sí, <acción>»/«No» (H45).
- **Decisión:** todas las extensiones eligen con `elegir` (`extensions/comun/elegir.ts`). En la terminal (`ctx.mode === "tui"`) dibuja con `ctx.ui.custom` el mismo selector que pi (borde, título, «→» en la opción marcada, ↑↓ o j/k, enter, escape/ctrl+c, ctrl+o para expandir las tools), con la ayuda «↑↓ moverse  enter elegir  escape/ctrl+c cancelar», sin pasar el ancho de la terminal; arranca en la primera opción y un corte (signal) lo cierra como Esc. Fuera de la terminal (RPC, JSON, print, SDK) usa `ui.select` tal cual. `extensions/comun/` no es una extensión: pi carga sólo los `.ts` directos de `extensions/` y las subcarpetas con `index.ts` (`docs/extensions.md:46`).
- **Por qué:** todo lo que ve el alumno, en español; copiar el selector de pi conserva sus teclas y su aspecto.
- **Límites:** a diferencia de `ui.select` (`interactive-mode.js:2151`), un diálogo de `ui.custom` no marca la terminal como esperando una respuesta (`:2342`); y si pi lo desecha al invalidar la sesión o en `/reload`, su promesa queda sin resolver. Igual que quiz y ask_user_question; desde el teclado no se puede provocar.
- **Verifica:** `elegir.test.mjs`, por ejemplo «H45: ↑↓, j/k, enter y esc o ctrl+c como el selector de pi; ctrl+o expande las tools», «H45: fuera de la terminal (rpc, json, print o sin modo) usa ui.select tal cual», «H45: las extensiones no llaman a ui.select ni ui.confirm directo: todo pasa por el selector en español». `remates-auditoria.test.mjs`: «H45: en la terminal, el selector de temas, el cambio de tema y las confirmaciones se dibujan con la ayuda en español». Probado además en la TUI real de pi 1.4.0 con un proveedor falso.

### DA30 — La página que muestra `ver_pagina` queda en la nota

- **Contexto:** C5 prohíbe preguntar por una figura que el alumno no vio, y la nota sólo guardaba el enlace al PDF, no la imagen que vio (H48).
- **Decisión:** `ver_pagina` devuelve en `details.render` la ruta de su render, `cursos/<c>/_procesado/<doc>/render/NNNN.png`, y md-log anota, al recibir el resultado y al rellenar la rama, un bloque «Página mostrada» con el enlace y el embed `![[…]]` de esa imagen, si vive en el vault y existe. La misma página dos veces seguidas se anota una vez: se compara con el final de la nota después de seguirla o recrearla, así que si se recreó o el alumno escribió debajo, se vuelve a anotar. Lo que `ver_pagina` rechaza (reservado, solución antes del intento) no se anota.
- **Por qué:** la nota es lo que el alumno repasa; la figura sobre la que se le pregunta tiene que estar ahí, y el render ya vive en una ruta estable del vault. `details` no llega al modelo: ningún proveedor de pi-ai lo envía.
- **Límite:** `_procesado` está en `userIgnoreFilters` de Obsidian: falta que el usuario confirme que el embed se ve. Si no, la alternativa es copiar la imagen a `sesiones/adjuntos/`.
- **Verifica:** `md-log-auditoria.test.mjs`: «H48, C5: la página mostrada queda embebida en la nota si su render vive en el vault, sin repetirla si se muestra dos veces seguidas», «H48, C5: si la nota se borró, la página que se vuelve a mostrar queda en la nota recreada; renombrada, no se repite». `fuga-auditoria.test.mjs`: «H48, C5: ver_pagina devuelve su render, que vive en el curso, para que la nota lo embeba».

### DA31 — Enseñar desde la bibliografía y corregir como la evaluación

- **Contexto:** en la prueba con el modelo real el tutor no llamó ni una vez a `leer_paginas`, `buscar_material` ni `ver_pagina`: enseñó de memoria y citó enunciados del práctico como definiciones (F1). También: el objetivo llegó sin su peso en los parciales (A4, E2); tras el kill repitió el quiz sin decir dónde estaban y con un dato nuevo en `details` que delataba la respuesta (A3, D5); `details` anunciaba la forma de la correcta (D3); la parte simbólica se pidió sin criterios ni tiempo (E5, C8); el simulacro dio «≈ 5/8» sin descuentos ni citas (E7); una notación distinta y una errata se normalizaron en silencio (E8); un «creo que ya lo tengo» llevó a un ítem real con un nodo sin enseñar (6e); no hubo puente entre el ejemplo y la fórmula del libro (C6); el historial cerró con «Cierre sin respuestas nuevas…» (G2).
- **Decisión:** reglas nuevas en `modo-curso.md`, que cambian lo que ve el alumno:
  - Al arrancar, en la misma tanda que `investigar_tema`, `leer_paginas` con 2–3 páginas del comienzo de la bibliografía («sin preámbulo» es sin texto, no sin leer); antes de establecer cada nodo, la página que lo define, citada; un enunciado nunca respalda una definición, y sin texto de bibliografía se marca «sin respaldo en el material». El dossier lista cada rango como «- leer_paginas <doc> PDF a–b · sección · título (prioridad)», sin enlace al comienzo del rango (F1, F2).
  - El objetivo dice su peso en `curso.md` («cae en N de M parciales») y que se puede ajustar, también cuando un pedido de explicación corta el probe (A4, E2).
  - Al retomar tras un corte, una línea de dónde quedamos y la pregunta pendiente idéntica, sin datos nuevos (A3, D5); `details` lleva sólo condiciones del enunciado, nunca la propiedad que verifica ni la forma de la respuesta, salvo que todas las opciones la compartan (D3).
  - Antes del intento, al pedir cada parte o inciso: criterios, puntaje oficial si consta y «tomate el tiempo» si es escrito (E5, C8).
  - Corrección: «≈ x/N» por pregunta con el descuento de cada inciso, el oficial si la escala lo desglosa («(−0,5)») o uno estimado («c) ≈ (−3)», no oficial), y una frase textual de la solución oficial por inciso (E7).
  - Si un enunciado usa otra notación que la cátedra o trae una errata, se dice una vez (E8); al cerrar un nodo con fórmula, una tabla breve «lo que hicimos ↔ nombre y fórmula del material», citada (C6).
  - Si el alumno dice que ya lo tiene antes de terminar el plan, `ask_user_question` con «Seguir con <nodo siguiente>» / «Practicar lo visto» (6e).
  - `/fin` y «Guardar y cambiar» piden un `resumen` de toda la sesión (qué se aprendió, qué falló, qué sigue); la evidencia sigue siendo sólo lo nuevo (G2).
  - Un reintento después de mostrarle el error o la solución no es un intento nuevo: va en las notas del mismo ejercicio, nunca como correcto (G2; en la segunda prueba real el reintento guiado de practico-1/3 quedó «correcto»).
  - Para que entren, modo-curso se compactó (repetía tools y órdenes) y su tope pasa a 11,5 KiB; hoy mide 11 776 B, justo en el tope.
- **Por qué:** el material del curso manda y la práctica se corrige como la evaluación. Un descuento estimado y marcado no oficial no es un descuento inventado, que `curso.md` prohíbe.
- **Límite:** son reglas de texto. La segunda prueba con el modelo real (AUDITORIA §7) las vio cumplirse en el camino normal: 13 `leer_paginas`, cada nodo establecido después de leer su página de Kurose, objetivo con su peso, retomar con la pregunta idéntica, criterios y «tomate el tiempo», «Seguir / Practicar lo visto» y primera pregunta a los 12,1 s con la lectura inicial. No se observaron todavía la corrección con escala oficial (E7) ni el simulacro rendido con el tema dominado.
- **Verifica:** `fidelidad-auditoria.test.mjs`: «modo-curso: reglas de fidelidad y evaluación de la etapa I», «F1, F2: el dossier muestra la bibliografía del tema con su tool y su rango, antes de los ítems y sin enlace al comienzo del rango», «F1, F2 con el curso real: el dossier de retardos nombra la tool y los rangos de Kurose dentro del presupuesto», «G2: /fin pide un resumen de toda la sesión, no sólo de lo nuevo desde el último guardado». `pedagogia-auditoria.test.mjs`: «modo-curso: prevalece sobre teach con sus conflictos explícitos y trae las reglas de la auditoría», con el tope de 11,5 KiB.

### DA32 — Las casi copias del reservado tampoco se ven

- **Contexto:** en la prueba, el reservado de retardos (Pregunta 3 del parcial 2023) era casi idéntico al Ej. 10 del Práctico 1, que estaba en el dossier, y el problema P29 de Kurose (PDF p. 88, dentro del rango que F1 manda leer) es el mismo problema. Además, si el parcial se segmentaba después de practicar la copia, se reservaba igual y el simulacro repetía lo resuelto (E3).
- **Decisión:** casi copia = al menos 10 términos en común y Jaccard ≥ 0,5, sobre números normalizados (36,000 → 36000; 2,4 → 2.4) y palabras de 5 letras o más, sin comandos LaTeX (`casi` y `huella` en `extensions/curso/material.ts`).
  - La reserva descarta un ítem cuya casi copia ya se practicó o está reservada, y prefiere uno sin casi copias entre los enunciados de ejercicios y evaluaciones. Si todos tienen copia, reserva igual y oculta la copia y sus soluciones por las mismas vías que el reservado; `leer_paginas` separa también un práctico sin soluciones.
  - En una página que se lee entera (bibliografía, un práctico sin segmentar), `leer_paginas` cambia por «[Problema reservado para /simulacro.]» el bloque («P29.», «R3.», «Ejercicio/Pregunta/Problema N») casi igual a un reservado; `buscar_material` da esa página sin fragmento y `ver_pagina` la rechaza. El researcher no recibe esas páginas ni los ejercicios ocultos (DA34).
- **Por qué:** visto es usado: una copia a la vista vacía el simulacro. Se compara por bloque y no por página: en Redes, de 38 025 pares (25 ítems de evaluación contra 1521 bloques), sólo superan el umbral las dos copias reales (Ej. 10, 0,66; P29, 0,63) y el par siguiente da 0,21; por página entera, la p. 88 contiene el 76 % del ítem y la siguiente ya el 41 %, y se habrían tapado páginas que la clase necesita.
- **Límites:** hasta que se segmenta el parcial del tema no hay reserva y su copia está a la vista: si se practica y se registra, ese ítem ya no se reserva; si sólo se mostró, sí. Un problema partido entre dos páginas puede quedar bajo el umbral en cada mitad. Un ítem sin copias ni solución oficial gana a uno con copia, solución y puntos (en Redes todos los parciales tienen solución). El umbral se calibró con los dos parciales segmentados y un corte aproximado de los demás: conviene medirlo otra vez cuando estén todos segmentados.
- **Verifica:** `fidelidad-auditoria.test.mjs`: «E3: la reserva prefiere un ítem de evaluación sin casi copias visibles y, si todos tienen, oculta también la copia», «E3: un ítem de evaluación cuya casi copia ya se practicó no se reserva», «E3: el problema del libro casi igual al reservado no se ve por leer_paginas, buscar_material ni ver_pagina; el resto de la página sí», «E3 con el curso real: el Ej. 10 del Práctico 1, casi copia de la Pregunta 3 del parcial 2023, no se ve mientras esa pregunta esté reservada», «E3 con el curso real: el problema P29 de Kurose, gemelo de la Pregunta 3 reservada, no se ve en la p. 88 y el resto de la bibliografía de retardos queda igual».

### DA33 — `/simulacro` confirma si el tema no está dominado

- **Contexto:** en la prueba, `/simulacro` gastó el único reservado a mitad del tema, con el nodo 3 sin enseñar, y no quedó simulacro para el final (E9, 6d). El dossier, además, pedía ofrecerlo «terminada la práctica» sin registrar dominado, así que una confirmación habría contradicho al tutor.
- **Decisión:** si el tema no figura `dominado` en `progreso.yaml`, `/simulacro` pregunta con el selector de DA29 «Todavía no terminaste el tema: el simulacro usa el único ítem reservado y no se repite. ¿Rendirlo ahora?», con «No, seguir estudiando» primero (la opción marcada) y «Sí, rendirlo ahora». La pregunta va antes de cortar el turno: «No» o Esc no gastan el ítem ni cortan el turno, y un kill con la pregunta abierta tampoco lo gasta; sin interfaz no se rinde. modo-curso y el dossier piden ofrecerlo sólo con el plan cubierto y la práctica terminada, después de registrar `estado: dominado`. La orden del simulacro pide además decir si un error viene de un nodo que no se enseñó y ordenar el repaso por los puntos de `curso.md`.
- **Por qué:** el reservado es único y no se repite: un Enter de más no tiene que gastarlo.
- **Límite:** depende de que el tutor registre `dominado` antes de ofrecerlo; si no, al alumno le aparece la pregunta aunque haya cubierto el plan.
- **Verifica:** `fidelidad-auditoria.test.mjs`: «E9, 6d: /simulacro con el tema sin dominar pregunta antes de gastar el reservado; cancelar no usa nada», «E9, 6d: sin interfaz y con el tema sin dominar /simulacro no gasta el reservado; con el tema dominado no pregunta». `pedagogia-auditoria.test.mjs`: «E3: fuera del simulacro el reservado no está en el dossier, leer_items, leer_paginas ni buscar_material», que comprueba la línea «Simulacro:» del dossier.

### DA34 — El alcance espera a que la preparación termine con sus anclas

- **Contexto:** en el primer estudio, la preparación reescribía con visión las páginas que el researcher leía como anclas; al recoger el informe la huella ya no coincidía y se descartaba («Las fuentes cambiaron…»): el alumno veía «Verificación del material no disponible» (P1). Además, el researcher leía con `read` páginas enteras, entre ellas la p. 88 de Kurose con el gemelo del reservado (E3).
- **Decisión:** en modo alcance, si alguna ancla está pendiente de visión (el criterio de `preparacion.py`: dudosa, sin visión vigente y no `manual`) y el lock `.preparacion.lock` del curso está vigente, `investigar_tema` contesta «Verificación en segundo plano; seguí con el material.» y anota la espera en memoria con las afirmaciones del tutor. Al terminar cada mensaje y al empezar cada turno la retoma, y lanza cuando las anclas ya no están pendientes o la preparación soltó el lock. Si se lanza con anclas pendientes, la tarea las nombra y el informe guardado empieza con «Páginas pendientes de transcripción al verificar (…)»; si después cambian, la caché pasa a «previa». El researcher no recibe las páginas con una casi copia de un reservado ni los ejercicios ocultos (DA32).
- **Por qué:** verificar contra el texto definitivo sin demorar la primera pregunta, y no presentar como verificado lo leído de una transcripción provisoria.
- **Límites:** la espera mira el lock de todo el curso: si la preparación no va a reescribir un ancla pendiente (una página del programa o una que excede el tope), espera a que termine toda. Vive en memoria: un `/reload` o un kill la pierden y el tutor la vuelve a pedir. Si el lanzamiento diferido falla (otro trabajo vencido, credenciales quitadas a mitad de la espera), el error no le llega a nadie. El modo verificar no espera.
- **Verifica:** `researcher.test.mjs`: «P1: con la preparación reescribiendo anclas, el alcance espera a que termine y se guarda contra el texto definitivo», que también comprueba que el relanzado conserva la afirmación, y «P1: sin preparación en curso lanza enseguida, declara las anclas pendientes y la caché pasa a previa cuando cambian». `fidelidad-auditoria.test.mjs`: «E3: el researcher no recibe la página del libro con la casi copia del reservado ni los ejercicios ocultos».

### DA35 — Un corte termina el turno y la nota dice por qué

- **Contexto:** con DA28, `ctx.abort()` cerraba el quiz, pero el loop arrancaba otra llamada con la señal abortada y pi-ai la daba por error: «Error: This operation was aborted» (`agent-loop.js:172`, `lazy.js:57-63`) (P2). La nota anotaba el quiz cortado por `/fin` como «(omitido por el usuario)», como si el alumno lo hubiera salteado (P5).
- **Decisión:** `extensions/comun/corte.ts`. `/fin`, `/estudiar` y `/simulacro` cortan con `cortarTurno`, que antes del `abort` avisa el motivo («al cerrar la clase», «al cambiar de tema», «al empezar el simulacro»). Quiz y `ask_user_question` envuelven su `execute` con `cortable`: cerrados por el aborto, devuelven `terminate: true` y el motivo en `details`, y no arranca otra llamada. md-log anota «(cortado <motivo>)» o «(cortada <motivo>)», «al interrumpirse el turno» si el aborto vino de otro lado; el Esc del alumno sigue como «(omitido por el usuario)».
- **Por qué:** un comando del alumno no tiene que terminar en un error rojo en inglés, y la nota no le atribuye lo que no hizo.
- **Límites:** `terminate` vale sólo si todas las tools del lote lo devuelven (`agent-loop.js:471-473`): un corte durante otra tool del curso, o con un quiz detrás de otra tool en el mismo mensaje, todavía muestra el error; falta envolver las tools de `extensions/curso/index.ts`. En la terminal un popup oculta el editor, así que el camino real es Esc y el comando con el tutor escribiendo, y pi dibuja «Operation aborted» (`interactive-mode.js:2836-2843`).
- **Verifica:** `corte-auditoria.test.mjs`: «P2: cortar el turno con una pregunta abierta no arranca otra llamada ni muestra «Error: This operation was aborted»», «P2: la respuesta ya corregida se conserva al cortar, también sin otra llamada», «P5: la nota distingue la pregunta cortada por /fin, /estudiar o /simulacro del Esc del alumno».

### DA36 — La preparación sólo avisa lo que corta la tanda

- **Contexto:** «Material de … preparado en parte: …» llegaba en medio de un quiz y no cambiaba nada que el alumno pudiera hacer (P4). Y los fallos de segmentación o clasificación de una corrida no se registraban si después la red cortaba la tanda: lo ya rechazado dos veces se volvía a pedir, y a pagar, en la próxima clase (H19).
- **Decisión:** al terminar, completa o a medias, la preparación sólo limpia la barra; el tutor recibe el resultado oculto como antes y `/curso-check` muestra si el tema quedó incompleto. Sólo avisa una falla que corta la tanda (credenciales, red, cuota o Python): «Preparación del material no disponible: …; seguimos con lo que hay.». Antes de ese aviso registra los fallos ya vistos en la corrida, salvo que la haya cancelado el cierre de pi o la ingesta base.
- **Por qué:** un aviso que no pide nada interrumpe; que un parcial quede a medias ya lo dice `/simulacro` cuando no hay ítem.
- **Límites:** pi antepone «Warning: » a todo aviso de tipo advertencia (`interactive-mode.js:2276-2285`, `:3760-3763`), también a éste; y como la preparación se intenta una vez por clase y por proceso de pi, sin credenciales de visión el aviso vuelve en cada `/estudiar`. Falta decidir si los avisos al alumno pasan a tipo información. Si pi se cierra a mitad de la tanda, los fallos de esa corrida se reintentan la próxima vez.
- **Verifica:** `remates-auditoria.test.mjs`: «H19: los fallos de la corrida quedan registrados aunque después la corte la red, y la próxima clase no los repite»; los tests de preparación de DA2 comprueban que al terminar no hay aviso.

### DA37 — La ingesta base muestra su avance y avisa al agente al terminar

- **Contexto:** al crear o ampliar un curso, la skill lanza la ingesta base en segundo plano con `ingestar.py iniciar`. Con un curso grande (Aprendizaje Automático: 2592 páginas) tarda más de una hora: el avance sólo se veía consultando `estado` y el agente se quedaba esperando o volvía a consultar en cada turno.
- **Decisión:** `extensions/curso/ingesta-fondo.ts` reconoce en el `tool_result` del bash del agente un `ingestar.py iniciar … --salida cursos/<slug>/_procesado` que no falló, anota un inicio en la sesión (`curso-ingesta`) y lee cada 2 s `estado-ingesta.json`. Mientras corre, muestra sobre el editor «⏳ Ingesta de <slug> [████░░…] N/M páginas · P% · <doc> p. N». Al llegar a un estado final limpia la barra, anota el fin, avisa en una línea y manda al agente un mensaje oculto con `triggerTurn` (como follow-up si está ocupado): si terminó, que siga el armado según la skill; si se cortó, que se lo diga al usuario y proponga reanudar sin relanzarla sola. Las skills `curso-nuevo` y `curso-agregar` ya no piden consultar `estado` ni esperar.
- **Por qué:** se detecta por el bash en vez de una tool nueva porque la skill, `CURSOS.md` y `/curso-check` ya lanzan la ingesta así. El aviso va sólo a la sesión que la lanzó, para no disparar turnos en otro pi abierto. No relanza sola para no entrar en un bucle si el error se repite.
- **Límites:** mira sólo la primera `--salida` de un comando. No ve una ingesta lanzada por el alumno con `!` ni una lanzada antes de esta versión. Si `iniciar` ya devolvió un estado final (todo en caché), no avisa, porque el agente lo leyó en el resultado. Un proceso muerto sin estado final cuenta como `interrumpida`, igual que en `ingestar.py estado`.
- **Verifica:** `ingesta-fondo.test.mjs`: barra y turno al terminar, proceso muerto, comandos que no se miran y retomada desde la sesión con un solo aviso.

### DA38 — La capa OCR que ya trae un escaneo se usa siempre, marcada como OCR

- **Contexto:** Mitchell (1997), en Aprendizaje Automático, es un libro escaneado de 421 páginas que ya trae su capa de texto OCR. La ingesta la descartaba y volvía a pasar Tesseract a cada página, a 10–50 s por página: horas para un solo libro, y la barra parecía colgada. Desde Fase 1, «la capa OCR previa no cuenta como OCR validado». Un primer arreglo usaba la capa sólo si pasaba el control de calidad, pero casi la mitad de las páginas lo fallaban por «posible matemática sin LaTeX», con la prosa impecable; y Tesseract tampoco arregla eso: de 150 páginas que volvió a pasar por OCR, 78 quedaron igual pendientes.
- **Decisión:** en una página `escaneada` con capa probable (`capa_ocr_probable`: al menos 30 letras) se usa siempre esa capa: `motor: pymupdf` y `capa_ocr_previa: true` en `calidad.json`. El puntaje se sigue calculando con el mismo `calidad()`, que suma `matematica_ocr`: decide si la página queda pendiente para visión, no si se repite el OCR. Sin capa, Tesseract como antes. `leer_paginas` antepone a esas páginas «[OCR que traía el PDF escaneado: interpretalo como tal; puede confundir letras, y los símbolos y fórmulas no son fiables. Cotejá con ver_pagina lo que cites textual.]», hasta que la visión o una edición manual la reemplacen. Lo propuso el usuario el 2026-10-23.
- **Por qué:** Tesseract no mejora lo que deja pendiente una capa previa (las fórmulas) y cuesta horas; lo que importa es que el tutor sepa qué está leyendo y que las páginas dudosas sigan yendo a visión.
- **Límites:** las páginas ya pasadas por Tesseract se conservan en caché. Una capa previa mala se usa igual: queda pendiente y la preparación del tema la pasa por visión, pero sin visión el tutor lee ese texto con el aviso. La marca está sólo en `leer_paginas`: `buscar_material` devuelve fragmentos sin ella.
- **Verifica:** `test_ingesta.py`: «test_capa_ocr_previa_se_usa_siempre_y_sin_capa_hay_tesseract»; `fidelidad-auditoria.test.mjs`: «DA38: una página con la capa OCR del escaneo llega al tutor marcada como OCR, y deja de estarlo al pasar por visión».

## Interfaz de escritorio y Windows — 2026-10-25

Propuesta de luchoberaza en un PR, para que la apruebe el dueño del repo. La app (`app/`) usa learn sin quitarle nada: todo lo que hoy es un comando pasa a ser algo que se ve y se toca, y la terminal sigue igual. Para que funcione en Windows hubo que tocar el núcleo (DA39–DA41) y, para que el quiz y las preguntas existan fuera de la terminal, sumar un puente (DA42–DA43). Informe completo, con capturas y pruebas: `informes/interfaz.md`.

### DA39 — learn corre en Windows sin cambiar su comportamiento en Linux

- **Contexto:** el núcleo no arrancaba en Windows. Python importaba `fcntl` y usaba `os.O_NOFOLLOW`; `os.kill(pid, 0)`, que en Windows **termina** el proceso en lugar de consultarlo; `start_new_session`. TypeScript tenía la ruta fija `.venv/bin/python` y comparaba con `/` las rutas de `path.relative`. El researcher se lanzaba con `sh -c "timeout …"`. Y Git con `autocrlf=true` convertía los archivos a CRLF, que rompían las huellas y los frontmatter. Línea de base en Windows: 147 tests Node en verde y 119 en rojo; la suite Python casi entera en rojo.
- **Decisión:**
  - **Python** (`almacen.py`): `tomar_bloqueo` usa `msvcrt.locking` en Windows y `fcntl.flock` en POSIX. `SIN_SEGUIR = getattr(os, "O_NOFOLLOW", 0)`, y sin él se rechaza el enlace simbólico con `is_symlink()` antes de abrir. `proceso_vivo` usa `OpenProcess` + `GetExitCodeProcess` (ctypes) en Windows. `opciones_desacoplado` da `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` en Windows. `_reemplazar` reintenta un momento si un lector retiene el destino. `atomico` escribe siempre LF y no sincroniza directorios en Windows. Los scripts reconfiguran stdin, stdout y stderr a UTF-8, y sus hijos reciben `PYTHONUTF8`.
  - **TypeScript:** `pythonDelVenv()` y `PYTHON_TEXTO` en `scripts/lib/pi-sdk.mjs`, usados en todas las extensiones y en los textos que sugieren comandos. `aBarra()` en `material.ts` para comparar rutas en formato `/`. md-log acepta `C:\…` y barras invertidas en las fotos, y sin `O_NOFOLLOW` rechaza el enlace con `lstat`.
  - **Researcher:** `scripts/vigilante.mjs` (Node, desacoplado) lanza `pi -p`, lo corta al vencer el plazo (`taskkill /T` en Windows, grupo de procesos en POSIX) y escribe `codigo` en forma atómica: 124 si venció, 137 si hubo que forzarlo. El hijo corre con cwd en la carpeta temporal, para que Windows pueda borrar su carpeta al recoger. `comandoPi()` lanza pi como `[process.execPath, cli.js]` en Windows (allá `pi` es un `.cmd`).
  - **pi:** `rutaModuloPi` encuentra también una pi instalada con `npm install -g` (Windows no tiene la instalación administrada de Linux).
  - **Repo:** `.gitattributes` con `* text=auto eol=lf`.
- **Por qué:** el comportamiento en Linux es el mismo de antes. En cada lugar, la rama de Windows reemplaza sólo lo que allá no existe o hace otra cosa.
- **Límites:** en Windows no hay `pi-learn` (fish + tmux): se abre con la app (DA44) o con `pi -ns --skill .pi/skills`. Un PDF abierto en otro programa puede demorar un reemplazo hasta un segundo.
- **Verifica:** `test_portabilidad.py`: «test_proceso_vivo_consulta_sin_terminar_el_proceso», «test_bloqueo_exclusivo_entre_procesos», «test_un_mismo_proceso_no_toma_dos_veces_el_bloqueo», «test_enlace_simbolico_rechazado», «test_atomico_escribe_saltos_de_linea_lf», «test_python_del_venv_y_arranque_desacoplado_segun_la_plataforma». `researcher-auditoria.test.mjs` y `researcher.test.mjs` corren con el vigilante en las dos plataformas. Las dos suites en verde en Windows y en Linux (cifras en `informes/interfaz.md`).

### DA40 — Lo propio de cada máquina va en `curso.config.local.json`

- **Contexto:** `curso.config.json` versiona valores de una computadora: `vault`, `ruta_tesseract` y los modelos. En Windows hubo que apuntar a otro Tesseract, y cambiarlo ensuciaba el repo.
- **Decisión:** `curso.config.local.json` (en `.gitignore`) puede pisar sólo `vault`, `ruta_tesseract`, `modelo_vision`, `modelo_researcher` y, desde DA49, `modelo_principal` (`leerConfig` y `leerConfigLocal` en `pi-sdk.mjs`; `cargar_config` y `CLAVES_LOCALES` en `almacen.py`). El researcher toma su modelo de ahí si está. `usar_tesseract` pone la carpeta del Tesseract primero en el PATH y fija `TESSDATA_PREFIX` si encuentra `../share/tessdata` (el Tesseract de conda-forge en Windows).
- **Por qué:** cada máquina usa lo suyo sin tocar archivos versionados. La app escribe ahí lo que el alumno elige en Ajustes y en «Preparar la computadora».
- **Límite:** una clave que no está en la lista se ignora en el archivo local: los umbrales siguen siendo del curso.
- **Verifica:** `test_portabilidad.py`: «test_la_configuracion_local_pisa_solo_sus_claves». El doctor muestra el modelo del researcher de la máquina si difiere.

### DA41 — El doctor revisa lo que corresponde a cada plataforma

- **Contexto:** el doctor exigía fish, tmux, `wl-paste` y `timeout`, que en Windows no existen ni hacen falta.
- **Decisión:** en Windows informa que fish, tmux y `pi-learn` no aplican y revisa Git Bash, que pi usa para su herramienta bash. El chequeo de `timeout` pasa a ser «Vigilante del researcher». Un Node distinto del verificado pero que cumple el piso de pi 1.4.0 (`>=22.19.0`) es un aviso (`!`), no una falla. Suma «Diagramas (visualize)» (DA46) como aviso.
- **Por qué:** el diagnóstico tiene que decir qué falta de verdad en esa máquina.
- **Verifica:** `entorno-auditoria.test.mjs` y «H80: el doctor revisa el vigilante, la web del researcher y el renombre a web_fetch en vez de safe_bash».

### DA42 — Quiz y preguntas fuera de la terminal: `ctx.ui.preguntar`

- **Contexto:** fuera de la terminal (modo RPC o SDK), `ctx.ui.custom` devuelve `undefined`: el quiz quedaba «cancelado», `ask_user_question` con opciones también, y la aprobación del plan («Dale» / «Ajustar») nunca aparecía.
- **Decisión:** `extensions/comun/preguntar.ts`. Si la interfaz trae `ctx.ui.preguntar` y `ctx.mode !== "tui"`, `quiz.ts` y `ask-user-question.ts` le mandan la pregunta armada en lugar de dibujarla. El quiz manda el enunciado limpio, las opciones ya barajadas con su número, el modo, las correctas y la explicación. Ask manda las opciones y la etiqueta de «Otra». Todo lo demás queda igual: la normalización, el rechazo con menos de tres opciones, `cortable`, el `onUpdate` previo para md-log y `buildResult`. La interfaz es la que hace cumplir lo mismo que el popup. La app recibe la correcta y la explicación recién cuando el alumno respondió: la corrección la arma el proceso que corre pi, no la ventana (`app/host/interfaz.mjs`). Un corte cierra la pregunta como cancelada, salvo un quiz ya corregido, cuya respuesta se conserva (DA35).
- **Por qué:** sin esto, la app perdía la parte central de la clase. En la terminal el popup sigue siendo el de siempre.
- **Verifica:** `preguntar.test.mjs`: «Puente: el quiz llega a la app barajado, sin enlaces ni LaTeX en el enunciado, con la correcta y la explicación para después», «Puente: respuesta incorrecta, «No sé» con nota y multi-select se corrigen igual que en el popup», «Puente: cancelar en la app o mandar una respuesta vacía deja la pregunta cancelada, sin calificar», «Puente: ask_user_question con botones, «Otra» con texto, varias respuestas ordenadas y texto libre», «Puente: sin preguntar todo sigue como antes, y en la terminal manda el popup aunque haya preguntar», «Puente: un corte del turno con la pregunta abierta en la app la cierra como cancelada y termina el turno».

### DA43 — Una sola tabla de etiquetas para la terminal y la app

- **Contexto:** la terminal muestra cada tool del curso como una línea en español y nunca su resultado (DA18). La tabla vivía en `render.ts`, que importa pi-tui.
- **Decisión:** `extensions/curso/etiquetas.ts` (sin pi-tui) tiene `TOOLS_DEL_CURSO`, `etiquetaLlamada`, `etiquetaResultado` y `textoParcial`. `render.ts` y la app la usan.
- **Por qué:** una tool nueva sigue necesitando su fila, y queda igual en las dos interfaces.
- **Verifica:** `etiquetas.test.mjs`: «etiquetas: cubre cada tool del curso y nunca muestra el texto del resultado», «etiquetas: la terminal dibuja exactamente las mismas líneas», que compara con el `ToolExecutionComponent` real de pi.

### DA44 — La app de escritorio: Electron, un proceso aparte para pi y un filtro

- **Contexto:** hoy se usa sólo desde la terminal, recordando comandos (`/estudiar redes retardos`, `/simulacro`, `/fin`, `pi-learn -c`), y las notas se leen aparte en Obsidian.
- **Decisión:** `app/`, con Electron, React y TypeScript. pi no corre en la ventana sino en un proceso aparte (`app/host/inicio.mjs`), con el **Node del sistema** y la misma instalación de pi 1.4.0 que usa la terminal. Las extensiones, skills y settings son las del `.pi/` del vault, sin bifurcar, y se cargan como hace `pi-learn` (`noSkills` más `.pi/skills`, `PI_OFFLINE` si faltan los paquetes fijados).
  - **Filtro** (`app/host/filtro.mjs`): nada sale hacia la ventana salvo lo que se arma campo por campo. Nunca salen los args ni resultados de las tools del curso, la correcta o la explicación de un quiz antes de responder, los mensajes ocultos (`curso-orden`), el razonamiento ni el `SKILL.md` de una skill cargada.
  - **Panel de página:** aplica las reglas de `ver_pagina`: nunca una página con el reservado o una casi copia, y en evaluaciones y soluciones sólo la página que el tutor citó.
  - **Datos del curso:** salen de `sesion.py cargar`, en sólo lectura.
  - **Comandos de pi:** los que necesitan una pantalla (`/tree`, `/fork`, `/login`, `/model`…) tienen la suya. `/share`, `/bug` y `/llama` avisan que siguen en la terminal.
- **Por qué:** si pi trabaja o se cuelga, la ventana no se congela, y hay una sola pi para todo. Tauri se descartó porque en Linux usa WebKitGTK, con problemas conocidos en Wayland y NVIDIA (Omarchy).
- **Límites:** las pruebas automáticas usan el proveedor falso de pi-ai con guion. Con el modelo real se probó el 2026-10-26 con Claude Sonnet 5.5 (DA48); con `openai-codex` falta probarla en la app. Los instaladores no están firmados (SmartScreen avisa la primera vez).
- **Verifica:** `app/host/test/filtro.test.mjs`, `host.test.mjs`, `instancia.test.mjs` y las ocho pruebas de punta a punta de `app/e2e/app.test.mjs`, con Electron real en Windows y en Linux.

### DA45 — Subagentes en paneles de la app, sin tmux

- **Contexto:** `pi-interactive-subagents` (de un tercero, fijado en `c3e8b53`) exige tmux. En Windows no hay tmux, así que `visualize` (mermaid-maker, svg-maker), el researcher de `teach` fuera de un curso, scout y worker no andaban.
- **Decisión:** el paquete concentra en `tmux.ts` todo lo que hace con un panel. `app/subagentes/superficie.ts` exporta lo mismo y elige: si existe `globalThis.__piLearnSuperficie` (lo pone la app), usa sus paneles; si no, delega todo en `tmux.ts`, sin cambios. La app abre cada subagente en una terminal real (node-pty: ConPTY en Windows, PTY en Linux) con bash (Git Bash en Windows), lee la pantalla con `@xterm/headless` como `tmux capture-pane` y la dibuja con xterm.js. El alumno puede escribirle al subagente como en tmux. Lo que se escribe antes de que bash muestre su prompt se guarda y se manda después: Git Bash tarda más que los 300 ms que espera el paquete. Un panel que el alumno detiene cuenta como un fin con código 130, porque Windows da códigos negativos y el paquete sólo reconoce dígitos. Mientras el paquete no traiga la superficie, la app la agrega al checkout instalado en `.pi/git/` (`app/subagentes/aplicar.mjs`, reversible con `--quitar`; `.pi/git/` no se versiona). En la terminal no cambia nada.
- **Por qué:** el comportamiento con tmux queda intacto, y en la app los subagentes andan en las dos plataformas.
- **Decisión pendiente del dueño:** adoptar la superficie con un fork fijado del paquete o con un PR a su autor, y actualizar el pin en `.pi/settings.json`. Hasta entonces, la app aplica el parche local cada vez que abre (`PI_LEARN_SIN_PARCHE=1` lo evita).
- **Verifica:** `app/host/test/superficie.test.mjs`: «superficie: un panel corre bash, se lee como tmux capture-pane y avisa a la app», «parche de subagentes: agrega la superficie, es idempotente y se quita», «superficie.ts del paquete: con la app usa sus paneles; sin ella, tmux como siempre». `app/e2e/app.test.mjs`: «app: un subagente corre en su panel (sin tmux) y su resultado vuelve a la clase», con un `scout` real.

### DA46 — `visualize` dibuja en Windows y Linux, y sus dependencias se instalan

- **Contexto:** `extensions/visual-tools` buscaba Chrome sólo en rutas de macOS y unía el PATH con `:` (en Windows es `;`). Lanzaba `node_modules/.bin/mmdc`, que en Windows es un `.cmd` que Node no ejecuta sin shell. Y su `package-lock.json` traía una dependencia de desarrollo enlazada a la máquina de su autor (`/Users/amos/.nvm/…`), así que `npm ci` fallaba en cualquier otra (`EMISSINGTARGET`): los diagramas no se dibujaban fuera de esa máquina.
- **Decisión:** `chromeCandidates()` busca Chrome, Chromium y Edge en Windows, Linux y macOS, y `PI_VISUAL_CHROME` fija uno. `augmentedPath()` usa el separador de la plataforma. `render_mermaid` corre el `cli.js` de mermaid-cli con el Node de pi. `render_svg` suma un último recurso, `tools/svg-chrome.mjs`, que dibuja con ese navegador y el puppeteer que ya trae mermaid-cli, para cuando no hay `rsvg-convert` ni `magick` (lo normal en Windows). El lock se regeneró sin la entrada rota: las 196 dependencias de ejecución conservan su versión exacta y la de desarrollo pasa a `@earendil-works/pi-coding-agent` 1.4.0. Se instala con `PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --ignore-scripts --prefix .pi/extensions/visual-tools`, sin bajar otro navegador.
- **Por qué:** `visualize` es parte de learn (README) y no funcionaba en ninguna de las dos máquinas.
- **Límite:** necesita un Chrome, Chromium o Edge instalado. Windows 11 trae Edge; en Linux, si no hay ninguno, el doctor lo avisa.
- **Verifica:** `visual-tools.test.mjs`: «visualize: busca Chrome, Chromium o Edge en Windows, Linux y macOS», «visualize: el PATH de los renders usa el separador de la plataforma», «visualize: Mermaid se dibuja con mmdc, el Node de pi y el navegador encontrado», «visualize: un SVG se dibuja con el navegador cuando no hay rsvg-convert ni magick».

### DA47 — Los PDFs del curso, enteros, en su propia ventana

- **Contexto:** desde una cita, el panel de página muestra una sola página como imagen. Para leer el capítulo alrededor, buscar una palabra o seleccionar texto había que abrir el PDF afuera, y abierto afuera se ve todo: también la página del ejercicio guardado para el simulacro.
- **Decisión:** cada documento del curso se abre entero en una ventana propia, que se puede mover a otro monitor y cerrar (`app/src/main/visor.ts`). Se abre desde el panel de página («Abrir el PDF en una ventana», en la página citada) y desde *Curso → Material* («Abrir»). Si el documento ya tiene ventana, salta a la página pedida en vez de abrir otra.
  - **Las mismas reglas que el panel:** la ventana nunca recibe el PDF original si tiene páginas vedadas. El host arma una copia para leer (`host/paginas.mjs` `lectura`, con `host/lectura.py` y PyMuPDF): cada página con un ítem reservado para `/simulacro`, su solución o una casi copia pasa a ser una hoja en blanco del mismo tamaño que lo avisa. La numeración no cambia, así que una cita a la página N sigue cayendo en la N. Sin vedadas va el PDF tal cual. Los parciales, las soluciones y los documentos con soluciones integradas no se abren enteros: siguen en el panel, sólo con la página que citó el tutor.
  - **Lo vedado puede cambiar:** al volver a la ventana se pregunta de nuevo y, si cambió (se rindió o se reservó un ejercicio, cambió el material), se recarga en la misma página.
  - **El lector:** PDF.js (`pdfjs-dist` 6.4.299, Apache 2.0), con lectura continua, búsqueda sin distinguir tildes, texto seleccionable, zoom, miniaturas, el índice del PDF si lo trae y una página oscura para leer de noche. Sin red: el PDF, las fuentes estándar, los mapas de caracteres y los decodificadores wasm llegan por el proceso principal, empaquetados con la app. La ventana tiene su propio preload, mínimo, y no abre otras ventanas ni navega.
- **Por qué:** se puede leer el libro al lado de la clase sin salir de la app y sin ver lo que el simulacro necesita inédito.
- **Límites:** en un documento con vedadas, la copia se arma por tramos y pierde los enlaces internos de una página a otro tramo; el índice del PDF se conserva. Las copias ocupan disco en la carpeta de datos de la app (`lectura/`), una por documento.
- **Verifica:** `app/host/test/host.test.mjs`: «host: la ventana de PDF recibe el libro entero con la página vedada en blanco, y el parcial no se abre entero». `app/e2e/visor.test.mjs`: «ventana de PDF: el libro entero en la página citada, sin el problema reservado; se recarga y se cierra con la app», en Windows y en Linux. El curso de demostración (`app/e2e/curso_demo.py`) suma al libro la página 8 con el problema P29, casi copia de la pregunta reservada del parcial.

### DA48 — Cuánto se gasta y cuánto queda, por cuenta y por modelo

- **Contexto:** learn no mostraba cuánto consume, y cada cuenta mide distinto: una clave de API cobra por token, la suscripción de ChatGPT da un cupo por ventanas de tiempo y los planes gratis cuentan pedidos por día. Sin ese dato no se sabe hasta cuándo preguntar ni si conviene cambiar de modelo. Medido en la app con Claude Sonnet 5.5: una clase de 10 intervenciones con su cierre costó 0,19 USD, el verificador del tema 0,08 y una página de visión 0,01.
- **Decisión:**
  - **Registro local** (`scripts/lib/consumo.mjs`, `extensions/modelos.ts`): cada respuesta del modelo deja una línea en `<agente de pi>/learn/consumo.jsonl` con el origen (clase, preparación, verificador o subagente), el proveedor, el modelo, los tokens y el costo que calcula pi con su catálogo. Las llamadas de una misma respuesta del tutor quedan agrupadas como una consulta (un mensaje del alumno). La preparación del tema anota desde `ingesta.ts` y `preparacion.ts`, y el researcher carga la misma extensión con `LEARN_ORIGEN=verificador`. Nunca guarda texto de la clase y nunca corta a quien llama. Es por máquina: no va al vault.
  - **Cupos que informa el proveedor:** la extensión lee las cabeceras de cada respuesta (`after_provider_response`). De la suscripción de ChatGPT toma el % usado de las ventanas de 5 horas y semanal, con su renovación (`x-codex-*`, sin documentar), y mide cuánto de la ventana gasta cada consulta. De Groq toma los pedidos del día. Un 429 queda como agotado hasta su `retry-after`. El host consulta además el saldo de OpenRouter (`/api/v1/key` y `/api/v1/credits`, con los pedidos gratis del día) y de DeepSeek (`/user/balance`).
  - **El plan de cada cuenta** (Ajustes → Consumo): créditos del plan Max 20x o 5x de Claude, un presupuesto por mes, un saldo cargado, un plan gratis con pedidos por día o sin tope, con el día en que se renueva. Lo que queda sale del proveedor cuando lo informa y, si no, del plan menos lo anotado.
  - **Cuánto rinde cada modelo** (`app/host/consumo.mjs`): el costo de una consulta con los precios del catálogo de pi y los tokens promedio de las últimas consultas propias. Sin historia se usa lo medido en la clase real: 1,5 llamadas, unos 37 mil tokens de contexto y 712 de salida. De ahí salen las consultas por dólar y las que quedan con lo que hay en la cuenta.
  - **Por modelo y sin costo:** cada cuenta muestra lo usado con cada modelo (consultas, pedidos, tokens y costo). Los modelos gratis no tienen dólares que contar: su cuenta (DeepSeek, Qwen o GLM gratis por OpenRouter, NVIDIA, los gratis de OpenCode) muestra los pedidos y tokens de hoy y, si su plan gratis tiene un límite por día, cuántas consultas quedan. Los planes de tokens que no informan su cupo (Kimi, GLM, Qwen, Xiaomi) muestran lo usado y remiten a la página del proveedor.
  - **En la app:** la barra lateral muestra el modelo de la clase, lo que queda en su unidad (dólares, % de la ventana o pedidos) y cuántas consultas alcanzan. Un clic abre los modelos de las cuentas conectadas para cambiar. Con menos de 30 consultas, otra vez con menos de 10, o si el proveedor corta por cupo, un aviso propone el modelo que alcanza para bastante más, primero en la misma cuenta.
- **Por qué:** con una clave, una suscripción o un plan gratis, el alumno ve hasta dónde puede seguir y qué modelo le conviene, sin abrir la consola del proveedor.
- **Límites:** con una clave de Anthropic u OpenAI el saldo real no se puede consultar (hace falta una clave de administrador de la organización): se cuenta lo de esta máquina, y lo que la misma clave gaste en otro programa no se ve. Las cabeceras de ChatGPT y los saldos de OpenRouter y DeepSeek se probaron con respuestas armadas según sus clientes y su documentación, no con una cuenta real. La compactación de pi no pasa por `message_end` y no se anota. La estimación para otro modelo supone los mismos tokens que el medido.
- **Verifica:** `tests/modelos.test.mjs` (7), `app/host/test/consumo.test.mjs` (9), `app/src/lib/consumo.test.mjs` (4) y «app: el medidor de consumo muestra lo que queda según el plan, cuánto rinde cada modelo y suma la clase» en `app/e2e/app.test.mjs`, en Windows y en Linux. Las apps empaquetadas (instalador y AppImage) abren con el medidor. Una clase real con Claude Sonnet 5.5 en la app, con el registro comparado contra lo que respondió Anthropic (cifras en `informes/interfaz.md`).

### DA49 — El modelo principal de cada máquina

- **Contexto:** `.pi/settings.json` fija `openai-codex/gpt-6.1-sol`, y pi hace ganar los settings del proyecto sobre los globales. El modelo elegido con `/model` o en la app valía para esa sesión, pero cada sesión nueva, y cada vez que se abría la app, volvía al del repo. Con otra cuenta (por ejemplo, Claude) había que elegirlo cada vez.
- **Decisión:** `modelo_principal` en `curso.config.local.json` (se suma a las claves de DA40). Al arrancar o abrir una sesión nueva, `extensions/modelos.ts` cambia a ése si existe y tiene credenciales. No toca una sesión retomada ni bifurcada, un `--model` explícito, el researcher ni los subagentes. La app lo guarda cuando se elige el modelo en Ajustes → Modelos, en el menú de la barra lateral o en Consumo. El doctor revisa las credenciales de ese modelo.
- **Por qué:** cada máquina usa su cuenta sin tocar el repo, también en la terminal.
- **Límite:** los subagentes (scout, worker, mermaid-maker, svg-maker) siguen con el modelo de su `agents/*.md`; sin credenciales de `openai-codex` no arrancan.
- **Verifica:** `tests/modelos.test.mjs`: «modelo principal: una sesión nueva usa el de curso.config.local.json si tiene credenciales; una retomada o un --model, no» y «consumo: el verificador y los subagentes se anotan con su origen y no eligen modelo». La clase real con Claude arrancó con `modelo_principal` y nada más que lo eligiera. Los dos tests del doctor de `entorno-auditoria.test.mjs` no dependen de la configuración local: en una máquina con modelo principal propio esperaban el del repo y fallaban.

## Ingesta base más rápida — 2026-10-26

Propuesta de luchoberaza en el mismo PR. Una condición: no cambia nada de lo que sale, sólo cuánto tarda.

### DA50 — La ingesta base procesa varias páginas a la vez, según los hilos de cada máquina

- **Contexto:** la ingesta procesaba una página por vez con un solo hilo, y después de cada página reescribía `calidad.json` y `estructura.json` enteros y `estado-ingesta.json` dos veces, cada uno con su fsync. En una PC de 12 hilos, sobre PDFs sintéticos:
  - una página escaneada sin capa de texto tardaba 5,5 s en caliente;
  - un PDF digital de 300 páginas tardaba 40 s, y más de la mitad era escritura: 21 s, contra 18,7 s de extracción;
  - el mismo comando de OCR, con varias páginas a la vez, daba el mismo texto en 12 de 12 páginas.
- **Decisión:**
  - `ingestar.py procesar` (también el que lanza `iniciar`) usa `trabajadores_de_la_maquina()`: procesos para la mitad de los hilos (`os.process_cpu_count() // 2`, como mucho 61 por el límite de Windows) y, como cada OCR usa dos hilos, la mitad de eso en OCR a la vez (un semáforo). Con 12 hilos son 6 y 3; con 4 hilos, 2 y 1; con 2, una página por vez como antes.
  - `pipeline.ejecutar` decide primero qué páginas van de la caché y manda las nuevas a un `ProcessPoolExecutor` (spawn, para no heredar el bloqueo ni el estado de MuPDF). Cada proceso abre el PDF por su cuenta, comprueba la huella y corre `analizar_pagina`, el mismo código de antes, ahora sin escribir nada. El proceso principal guarda los resultados en orden de página, como antes.
  - `calidad.json`, `estructura.json` y `estado-ingesta.json` se guardan una vez por segundo como mucho, al terminar cada documento, al pausar y al cortarse. El registro de cada página en `cache/` se sigue guardando enseguida, y es lo que manda tras un corte (`recuperar_registro`).
  - La ingesta corre con prioridad baja (`almacen.bajar_prioridad`: BELOW_NORMAL en Windows, `nice` 10 en POSIX), y sus procesos y el OCR la heredan.
  - Si muere un proceso del grupo, esa página y las siguientes se procesan en el principal.
  - Un extractor inyectado (los tests) va de a una, igual que `ejecutar` sin `trabajadores`.
- **Por qué:** cada página se procesa sin depender de las otras, así que da lo mismo en qué orden y en qué proceso. Dejar media máquina libre mantiene usable la computadora, también la app, mientras se arma un curso. Se descartó todo lo que cambia el texto (otro motor de OCR, menos resolución) y lo que no ganaba nada: con `--output-type none` OCRmyPDF tardó 5,51 s contra 5,54.
- **Resultado**, con los archivos idénticos a los de antes (606 en el PDF digital y 54 en el escaneado):

  | 12 hilos, 6 y 3 trabajadores | Antes | Con DA50 |
  |---|---|---|
  | Windows 11, PDF digital de 300 páginas | 44,9 s | 12,9 s |
  | Windows 11, escaneado de 24 páginas sin capa de texto | 178,8 s | 54,5 s |
  | Ubuntu en WSL, PDF digital de 300 páginas | 61,4 s | 13,7 s |
  | Ubuntu en WSL, escaneado de 24 páginas sin capa de texto | 105,2 s | 33,1 s |

- **Límites:**
  - Con un corte duro (kill -9, apagón), `calidad.json` puede quedar hasta un segundo atrás. Las páginas de ese segundo tienen su registro en `cache/` y la próxima corrida las recupera sin reextraer.
  - Si se corta, los procesos que estaban con una página la terminan y salen solos: no escriben nada.
  - Si muere un proceso del grupo, `ProcessPoolExecutor` cierra también los otros. El OCR que tenían en curso puede dejar su carpeta `pi-ingesta-ocr-*` en el temporal del sistema, como pasa hoy con un kill durante el OCR.
  - Cuánto se gana depende de los hilos de cada máquina. Los tiempos se midieron con PDFs sintéticos; falta medir un libro real.
  - La preparación con el modelo de visión, en la primera clase de cada tema, sigue de a una página.
- **Verifica:** `tests/ingesta/test_paralelo.py`:
  - «varias a la vez dejan los mismos archivos que de a una», con una página escaneada por el OCR real y un parcial;
  - «una pausa a la vez no procesa de más y se reanuda igual»;
  - «calidad se guarda una vez por segundo y entera al cortar»;
  - «la mitad de los hilos y la mitad de eso para el OCR»;
  - «la ingesta baja su prioridad y la heredan sus procesos».

  Además, a mano: con un proceso del grupo matado en medio de una corrida, la ingesta terminó con los mismos archivos.

## Grabaciones de clase — 2026-10-26

Propuesta de luchoberaza en el mismo PR. Las grabaciones de las clases pasan a ser material del curso, transcriptas en local.

### DA51 — Las grabaciones de clase se transcriben en local, en tramos de cinco minutos que se citan al segundo

- **Contexto:** learn sólo tomaba PDFs, y una clase grabada (video o audio) es a menudo el material que mejor sigue lo que se evalúa. Mandar el audio a un modelo cada vez gasta créditos y repite trabajo. Pasarlo a texto una sola vez, en la computadora, sigue la idea de la ingesta base: texto que se reusa en todas las clases.
- **Decisión:**
  - **Motor:** faster-whisper 1.2.1 en el venv de la ingesta, con el modelo `modelo_transcripcion` de `curso.config.json` (`large-v3-turbo` por defecto; una máquina puede pisarlo en `curso.config.local.json`). Se descarga la primera vez, unos 1,6 GB, a la caché de Hugging Face o a `carpeta_modelos` de `curso.config.local.json` (otro disco, por ejemplo). Precisión int8: en turbo da el mismo error que float16 (benchmark de faster-whisper, issue #1030). Va por tandas (`BatchedInferencePipeline`), con el filtro de voz Silero: los silencios y la música no llegan al modelo, que es donde Whisper inventa frases. Usa la mitad de los hilos de la máquina, como DA50, y una placa NVIDIA si están CUDA 12 y cuDNN 9; si no, el procesador. PyAV queda en 18.1.0: la 19 quitó `metadata_errors` de `av.open`, que faster-whisper 1.2.1 todavía pasa.
  - **Tramos como páginas:** una grabación es un documento de tipo `bibliografia` u `otros` (no hay parciales grabados). Sus «páginas» son tramos de 5 minutos; un resto de menos de un minuto se suma al último. `paginas` es la cantidad de tramos, y los rangos del índice son tramos, así que la búsqueda, el índice, `leer_paginas`, el researcher y `/curso-check` funcionan sin cambios de fondo. `cursos.py inventario` da páginas o tramos, duración y SHA-256 de lo que hay en `_entrada/`.
  - **Cortes en silencios:** el tramo k termina en el primer silencio desde el minuto 5·k, como mucho un minuto después; sin pausa, en el nominal y el tramo lo avisa. Así ningún tramo empieza antes de su minuto nominal, y su cita (`#t=` del inicio nominal) nunca cae después de lo que dice. Cortes e idioma, detectado una vez por grabación, quedan en `grabacion.json`: al reanudar, los tramos son los mismos.
  - **Texto y citas:** cada párrafo dura hasta un minuto, se corta en las pausas y empieza con su hora (`[12:05] …`). `leer_paginas` le suma a cada párrafo el enlace a su segundo (`[[cursos/<curso>/fuentes/<tipo>/clase.mp4#t=725]]`) y avisa que es una transcripción automática: puede confundir nombres, términos y fórmulas dichas en voz alta, y lo escrito en el pizarrón no está. Los segmentos con poca confianza de Whisper (`avg_logprob` < −1 o compresión > 2,4) quedan como «audio dudoso» en los avisos del tramo.
  - **Fuera de la visión:** ningún tramo va al modelo de visión. `ver_pagina` y `transcribir_paginas` rechazan una grabación con un mensaje claro, y la preparación por tema no la encola.
  - **Ingesta:** cada tramo se guarda como una página, con caché por tramo y la misma pausa y reanudación. La barra muestra «Transcribiendo clase-3: tramo 2 de 9» y, la primera vez, la descarga del modelo.
  - **App:** «Crear curso» y «Agregar material» aceptan grabaciones. Una cita `#t=` es una nota al margen con «Escuchar desde 12:05», que abre la grabación en su propia ventana, en ese segundo. La ventana pide el archivo por `learn-medio://<permiso>`: un protocolo propio que sólo sirve lo que abrió la ventana principal, con rangos de bytes para adelantar. Otra cita de la misma grabación salta en la ventana abierta.
- **Por qué:** el texto se paga una vez, en la computadora, y después cuesta lo mismo que un PDF. Los tramos como páginas evitan un segundo sistema de material. Turbo es entre 2 y 3 veces más rápido que large-v3 con casi el mismo error (YouTube Commons: 13,4 % contra 13,2 %); las versiones «distil» son sólo inglés.
- **Límites:**
  - Obsidian abre el video desde el principio: `#t=` sólo lo respetan complementos como Video Notes. La app sí salta al segundo.
  - Sin placa NVIDIA con CUDA, transcribir lleva tiempo: en una notebook Ryzen 5 4600H, con 6 hilos, unos 57 s por cada 108 s de audio; una grabación de 41 minutos, 23 minutos con otras pruebas corriendo a la vez. La primera vez se suma la descarga del modelo.
  - El audio decodificado entero queda en memoria mientras se transcribe: unos 230 MB por hora de grabación.
  - Chromium no reproduce todos los .mkv o .mov. La transcripción no depende de eso, y la ventana lo avisa.
  - Los rangos por tema de una grabación se asignan después de la ingesta, leyendo la transcripción.
  - Sin memoria para cargar el modelo, cada tramo queda pendiente con el aviso «no hubo memoria para el modelo de transcripción», sin guardar un idioma que no se detectó; la próxima corrida lo reintenta.
- **Verifica:**
  - `tests/ingesta/test_grabaciones.py`, con un WAV sintético y un transcriptor falso:
    - «tramos de cinco minutos y horas»;
    - «cada corte cae en la primera pausa desde el inicio nominal»;
    - «párrafos de hasta un minuto cortados en las pausas»;
    - «una grabación se ingiere en tramos con su hora y su cita»;
    - «una pausa se reanuda sin retranscribir ni recalcular los cortes»;
    - «un tramo que falla queda pendiente y la próxima corrida lo reintenta»;
    - «sin memoria para el modelo los tramos quedan pendientes sin inventar el idioma»;
    - «una grabación no es ejercicio ni pasa por visión»;
    - «el inventario da páginas y tramos y el curso valida los tramos».
  - Con el modelo real, si está descargado y `LEARN_GRABACION_REAL` apunta a una grabación: «faster-whisper transcribe el primer tramo en español». Con 108 s de Wikipedia hablada en español (dominio público), detectó el idioma y transcribió bien; erró nombres propios («Nobel» por Novell). Pasa también en Linux, con el modelo que bajó Windows a `carpeta_modelos`.
  - Una grabación de 41 minutos de punta a punta, con `ingestar.py procesar` y la descarga del modelo: 9 tramos, los 8 cortes en pausas, idioma español y ningún tramo dudoso; erró términos poco comunes («coronario» por corolario).
  - `tests/grabaciones.test.mjs`: la cita al segundo, `leer_paginas` con el enlace de cada párrafo y lo que falta, el dossier, las etiquetas, la barra y las anclas del researcher.
  - `app/src/lib/texto.test.mjs`: «el momento de una grabación se reconoce aparte de una página».
  - `app/e2e/grabacion.test.mjs`: la cita abre la grabación en su segundo, se puede adelantar (rangos de bytes), otra cita reusa la ventana, `learn-medio://` no sirve un permiso ajeno y la ventana se cierra con la principal.

### DA52 — El tutor no da nada por sabido, el tema se encara de tres formas y el alumno elige la mezcla de preguntas

- **Contexto:** el autor del curso notó que el tutor empeoró después de DA7. Antes preguntaba mucho para ubicar al alumno; ahora a veces usa definiciones que el alumno no vio. El learn original (`amosblomqvist/learn`, del que este repo es fork) no tiene tope en el probe: `teach` pide, en cada hebra que va a usar la lección, un piso (algo que acierta) y un techo (algo que falla) antes de planear, y confirmar cada raíz con el alumno.
  - DA7 puso un tope de 4 preguntas en un tema nuevo (3 con borde previo), con el nivel de las evaluaciones desde la primera.
  - DA7 aceptó «techo no localizado» y verificó las raíces del plan contra el material, no contra el alumno.
  - F1 (`7935ca0`) sumó leer la definición del libro antes de cada nodo.
  - Con eso el tutor no sabía qué bases tenía el alumno y enseñaba con el vocabulario del libro.
  - Una clase real con Claude Sonnet 5.5 mostró una causa más, que viene de antes de DA52 (la clase real del 26-oct con el `modo-curso.md` anterior hace lo mismo).
    - El tutor escribía la explicación en su razonamiento («Expliqué el concepto…», «Te doy una analogía con una canilla…») y preguntaba como si la hubiera dado.
    - El alumno no ve el razonamiento: veía sólo preguntas seguidas y, después de responder, la explicación del quiz.
    - La regla «nunca dos quizzes seguidos sin texto de clase en el medio» ya estaba y no alcanzó.
  - Además, el alumno pidió repasar un tema de cero, trabajar sólo lo flojo y elegir cuántas preguntas son de múltiple opción y cuántas de desarrollo.
- **Decisión:**
  - **Probe sin tope** (`modo-curso.md`): el de `teach`.
    - Arranca desde la base de cada hebra, no desde el nivel del parcial, y sigue hasta tener piso y techo en cada hebra que usa la clase.
    - Sube fuerte tras un acierto y no repregunta lo que ya quedó claro.
    - Para que no canse, primero un `ask_user_question` de selección múltiple, «¿Qué de esto ya viste?», con los conceptos base. Sólo se verifica lo marcado; lo no marcado se enseña sin preguntarlo.
    - «Explicame» sigue cortando el probe (H12), pero lo que quedó sin medir se comprueba al llegar a su nodo.
    - «Techo no localizado» vale sólo si el alumno acertó lo más difícil del tema.
    - Con borde previo, el probe empieza por lo que fallaba.
  - **Ningún término sin presentar:** antes de usar un término, un símbolo o una definición (también la del libro), el tutor comprueba que el alumno lo tiene: lo acertó en la clase, figura en «domina» o se lo enseñó. Si no, lo presenta primero, con un ejemplo y, si el tema se apoya en él, una pregunta. Las raíces del plan son lo que el probe mostró que el alumno tiene y que consta en el material.
  - **Modos** (`extensions/comun/estudio.ts`): `/estudiar <curso> <tema> [desde-cero|fortalecer]`.
    - **Desde cero:** sin la lista de lo que ya vio, probe desde la base y objetivo y plan nuevos. Se enseñan todos los nodos, también lo dominado; lo registrado no se borra.
    - **Fortalecer lo flojo:** el probe y el plan van sobre lo que el progreso registra como falla, errores abiertos y ejercicios fallados, y sobre sus bases, con práctica en cada nodo y `falla_resuelta`. Sin fallas registradas, sigue como desde cero.
    - El modo queda en el estado de la clase (sobrevive `pi -c`) y cambia la orden de arranque.
    - En la app, la página del tema suma «Desde cero» y «Fortalecer lo flojo»; el segundo, sólo si hay algo guardado que falle.
  - **Mezcla de preguntas:** automático (el predeterminado), sólo múltiple opción, más múltiple opción (3 de cada 4), mitad y mitad, más desarrollo (3 de cada 4 de desarrollo) o sólo desarrollo.
    - Se guarda como `preguntas` en `curso.config.local.json`. Se elige con `/preguntas` en la terminal y en Ajustes → Cómo estudio en la app.
    - Con una mezcla fija, cada pregunta respondida suma al resultado, sólo para el modelo, el conteo de la clase y cuál toca después. Con 3 de cada 4: opción, opción, opción, desarrollo.
    - Automático usa múltiple opción en el probe y al verificar algo nuevo, y desarrollo cuando el alumno ya acertó ese concepto.
    - La práctica con ítems de evaluación sigue en el chat.
    - También vale en una clase de tema libre.
  - **Sección «Esta clase»:** el modo y la mezcla van en una sección propia del prompt, que sólo cambia si cambian ellos.
    - Así una mezcla nueva vale desde la pregunta siguiente sin romper la caché del prompt en cada turno.
    - Las reglas de cada modo sólo van cuando se usa.
  - **El alumno ve la explicación antes de cada pregunta:**
    - `quiz` y `pregunta_desarrollo` suman `clase`: la explicación que la pregunta verifica, escrita para el alumno. Se muestra justo antes de la pregunta: en la terminal, en el historial y con formato; en la app, como texto del tutor con sus citas al margen; en la nota, como texto del tutor.
    - **La guardia:** una pregunta de verificación se muestra sólo si, desde la pregunta respondida anterior, hay al menos 120 caracteres visibles entre el texto de los mensajes y su `clase`. Si no, vuelve al modelo con el motivo, sin que el alumno la vea (ni la app ni la nota).
    - Frena una sola vez seguida: un reintento igual pasa, para que no haya bucles.
    - Las del diagnóstico llevan `momento: "diagnostico"` y pueden ir seguidas.
    - Después de cada respuesta de verificación, el resultado le recuerda al modelo que primero va la explicación.
    - `modo-curso.md` lo dice: el alumno sólo ve el texto de los mensajes y `clase`, nunca el razonamiento ni los argumentos de las tools.
  - **`pregunta_desarrollo`:** pregunta con respuesta correcta que se responde escribiendo, con «No sé».
    - La respuesta esperada no se muestra ni se anota antes de responder; después se ve junto a lo escrito.
    - El tutor corrige en su mensaje siguiente, sin exigir las palabras exactas.
    - En la terminal es un popup, en la app una tarjeta y en la nota sus bloques.
  - El tope de `modo-curso.md` pasa de 11,5 a 13,5 KiB; hoy mide 13 507 B.
- **Por qué:**
  - Sin el borde de cada hebra no se puede enseñar en la zona de desarrollo próximo, y una definición con términos que el alumno no tiene no se fija: son los dos principios de `teach`.
  - Los programas que no avanzan hasta tener las bases rinden más, y más en los alumnos flojos (Kulik, Kulik y Bangert-Drowns, 1990, 108 evaluaciones).
  - Lo que ayuda a un principiante le estorba a quien ya sabe (Kalyuga y otros, 2003): por eso los modos.
  - Las dos formas de pregunta fijan lo aprendido, sin un ganador claro:
    - la múltiple opción, si las opciones incorrectas son creíbles (Little y Bjork);
    - la de desarrollo rinde menos mientras el alumno todavía falla mucho (van Wijk y otros, 2024);
    - practicar en el formato del examen da una ventaja chica.
    - De ahí el automático.
  - La lista de lo que ya vio baja la cantidad de preguntas sin dar nada por sabido: lo marcado se comprueba y lo no marcado se enseña.
  - Pedirle al modelo que escriba la explicación no alcanzó, ni con la guardia sola. El modelo sí completa bien los campos de las tools, así que la explicación viaja en la pregunta (`clase`).
- **Límites:**
  - Que la mezcla se cumpla depende del tutor, que recibe el conteo: el código no impide una pregunta del tipo que no toca.
  - La lista se responde de memoria y puede sobreestimar: por eso lo marcado se verifica. Lo no marcado se enseña aunque el alumno lo supiera.
  - Sin tope, el probe hace más preguntas que con DA7 y gasta más; «Explicame» lo corta.
  - La pregunta de desarrollo no admite foto: los ejercicios largos siguen en el chat.
  - La guardia mide cantidad, no calidad: 120 caracteres que no explican nada la pasan.
  - Si el reintento llega sin explicación, la pregunta pasa igual.
  - Con el modelo real se probó Claude Sonnet 5.5.
- **Verifica:**
  - `tests/estudio-modos.test.mjs`:
    - «el modo va al final de /estudiar, también «desde cero» en dos palabras, y el resto es el tema»;
    - «con una mezcla fija la próxima pregunta sale del conteo; automático la deja al tutor»;
    - «la sección «Esta clase» nombra el modo sólo si no es seguir, la mezcla y la primera pregunta»;
    - «/estudiar … desde-cero: el modo queda en el estado de la clase, en la orden de arranque y en «Esta clase»»;
    - «al retomar la sesión (pi -c) la clase conserva su modo; uno inválido se descarta»;
    - «cada pregunta respondida suma el conteo de la clase para el modelo»;
    - «tema libre (skill teach fuera de un curso): también lleva la mezcla de preguntas y su conteo, sin modo»;
    - «/preguntas: elige en la terminal, acepta el id o el nombre, guarda y automático no queda escrito»;
    - las tres de `pregunta_desarrollo` (terminal, «No sé» y app) y la de md-log.
  - `tests/pedagogia-auditoria.test.mjs`: «modo-curso: prevalece sobre teach con sus conflictos explícitos y trae las reglas de la auditoría», con las reglas nuevas, sin el tope y con 13,5 KiB.
  - `app/host/test/desarrollo.test.mjs`: el filtro y la interfaz no dejan pasar la respuesta esperada antes de responder.
  - `app/e2e/estudio.test.mjs`: «Cómo estudio guarda la mezcla, el tema ofrece los modos y la clase desde cero pregunta para escribir». El tutor falso comprueba que el modo, la mezcla y el conteo le llegan, y la explicación de la pregunta se ve antes que ella.
  - `tests/estudio-modos.test.mjs`, además: «guardia: una pregunta de verificación sin explicación visible desde la anterior no se muestra y vuelve al modelo» y «la explicación de la pregunta (clase) se dibuja en la terminal antes de la pregunta, viaja a la app y nunca lleva la respuesta».
  - **Con el modelo real**, cinco clases nuevas de retardos en la app (Claude Sonnet 5.5, mezcla «Mitad y mitad») con un alumno simulado sin bases: marca un solo concepto de la lista, contesta «No sé» y escribe respuestas incompletas. Costaron entre 0,35 y 0,52 USD cada una.
    - En todas, la clase arrancó con la lista, verificó sólo lo marcado, alternó múltiple opción y desarrollo según el conteo y no dio por cerrado un nodo con un «creo que lo entendí».
    - Sin `clase` ni guardia: la explicación quedaba en el razonamiento.
    - Con la guardia sola: aparecieron explicaciones largas, que presentan cada término antes de usarlo («un router (una estación intermedia que lo reenvía)»), pero el modelo reintentaba sin texto (hasta 10 frenos en una clase) y terminaba preguntando por el chat.
    - Con `clase`: cada pregunta de verificación llegó con su explicación o su corrección visible («Corrección: a medias. Lo que escribiste…») y la guardia frenó una sola vez.

## Eliminar un curso — 2026-10-27

Propuesta de luchoberaza en el mismo PR. Un curso se elimina desde la app.

### DA53 — Un curso se elimina desde su pantalla y va a la papelera del sistema

- **Contexto:** ni la terminal ni la app tenían cómo quitar un curso. Había que borrar `cursos/<slug>/` a mano, y quedaban su manifiesto y su propuesta en `_procesado/` de la raíz. El alumno pidió que la opción aparezca al entrar al curso.
- **Decisión:**
  - **Dónde:** «Eliminar el curso», en rojo, en la cabecera de la pantalla del curso, junto a «Agregar material». Sólo en la app: la terminal queda igual.
  - **A la papelera:** `cursos/<slug>/` entero (las copias del material, `_procesado/`, las notas de clase, el progreso y el índice) va a la papelera del sistema con `shell.trashItem` de Electron, y con él `_procesado/manifiesto-<slug>.json` y `_procesado/propuesta-<slug>.json`. Los PDFs de `_entrada/` no se tocan. Antes se cierran las ventanas de PDF y de grabación de ese curso.
  - **Cuándo no:** el host (`paraEliminar`, en `app/host/curso.mjs`) no deja eliminar un curso con:
    - una clase abierta del curso en la app;
    - una clase abierta del curso en otro pi (su `.sesion-activa.json`, con el proceso vivo);
    - la ingesta leyendo sus PDFs (`estado-ingesta.json` en curso, con el proceso vivo);
    - la preparación de un tema escribiendo (`.preparacion.lock` vigente, con el mismo criterio de antigüedad que `preparacion.ts`).

    Lo dice en un aviso, sin abrir la confirmación. El proceso principal vuelve a preguntarlo justo antes de eliminar.
  - **La confirmación** cuenta qué se va: las notas de clase, el progreso de los temas empezados y las copias del material. El botón de aceptar va en rojo y el foco arranca en «Cancelar», así que un Enter no elimina nada (`confirmarApp(…, peligro)`).
  - **Después:**
    - se vuelve a Inicio, y «Volver» ya no lleva a las pantallas del curso;
    - «Seguir donde quedaste» saltea las clases de un curso que ya no está y toma la anterior;
    - una sesión de ese curso sigue en «Todas las sesiones»; si se abre, `sesion.ts` avisa que no pudo restaurar el curso.
- **Por qué:** la papelera hace reversible un error sin que learn tenga una papelera propia. Frenar mientras corre la clase, la ingesta o la preparación evita que un proceso siga escribiendo en una carpeta que ya no está.
- **Límites:**
  - Sin papelera en el sistema (un Linux sin escritorio), no se elimina: el aviso lo dice y el curso queda como estaba.
  - Una propuesta guardada con otro nombre queda en `_procesado/`. El manifiesto y la propuesta van a la papelera por separado, y sólo hacen falta para volver a ingerir o ampliar el curso, que los escriben de nuevo.
  - El consumo del curso queda en `consumo.jsonl`: ya se gastó.
- **Verifica:**
  - `app/host/test/eliminar.test.mjs`: «cuenta las notas de clase y no deja con una clase abierta, la ingesta o la preparación corriendo». Un proceso muerto o un candado de más de 6 horas no frenan; un nombre inválido o un curso que no está, sí.
  - `app/e2e/eliminar.test.mjs`, sobre una copia del curso de demostración, con la papelera en una carpeta temporal:
    - con la clase abierta en la app y con otra en otro pi, avisa y no elimina;
    - la confirmación cuenta las notas y los documentos, arranca en «Cancelar» y Enter cancela;
    - al aceptar, el curso, su manifiesto y su propuesta van a la papelera, el curso sale de la barra lateral y se vuelve a Inicio;
    - «Seguir donde quedaste» retoma la clase anterior, de otro curso. Sin el arreglo, la prueba falla.
  - La papelera real, en Windows (la Papelera de reciclaje) y en Linux (`~/.local/share/Trash`), con una copia descartable del curso.
  - `app/e2e/app.test.mjs`, «una clase entera…», pasa por la confirmación de «Terminar la clase» y por «Volvé a…» en Inicio.

## Paneles, escala y pestañas — 2026-10-28

Pedido del dueño del repo, que probó la app, por medio de luchoberaza: «no podés ajustar el tamaño de los paneles ni cerrar la barra lateral», «debería tener una configuración para ajustar la escala de la interfaz, y que los paneles se puedan ajustar con el mouse» y «los PDF, estaría bueno que puedas abrir pestañas: que tengas las conversaciones o los PDF». Sobre el PDF, luchoberaza: «que tengas la opción, cuando le des clic a ver el PDF, de elegir pestaña o ventana».

### DA54 — La barra lateral se pliega, y ella y el panel de página se ensanchan con el mouse

- **Contexto:** la barra lateral medía siempre 256 px y no se podía cerrar: el usuario la había pedido siempre visible. El panel de página ocupaba el 34 % de la ventana, con un mínimo de 340 px. En una pantalla chica, o para leer la clase con el panel al lado, no había cómo repartir el lugar.
- **Decisión:**
  - **Plegar:** un botón arriba de la barra, junto a la marca, y Ctrl+B. Plegada queda una franja de 44 px con el botón para mostrarla, la búsqueda (Ctrl+K) y el latido si el tutor está trabajando. Sigue visible de entrada, como se había pedido.
  - **Arrastrar:** el borde de la barra lateral (de 200 a 420 px) y el del panel de página (desde 300 px hasta el 60 % de la ventana, dejando al menos 360 px a la pantalla). Doble clic sobre el borde vuelve al ancho de siempre. Con el teclado, el borde se enfoca y las flechas lo mueven de a 16 px.
  - **Mientras se arrastra** cambia sólo una variable CSS de la ventana, sin redibujar la app. Al soltar se guarda en los ajustes de la app (`lateral` y `anchoPanel`), junto con si la barra quedó plegada. Los cortes de las pantallas (`@container`) ya miden el lugar que queda, así que se acomodan solas.
  - Los avisos y el cajón de los subagentes siguen esos anchos.
- **Por qué:** cada uno reparte la pantalla según lo que esté haciendo, y lo encuentra igual al volver.
- **Límites:** el panel de página tiene un solo ancho, no uno por documento.
- **Verifica:** `app/src/lib/escala.test.mjs` (los topes de cada ancho) y `app/e2e/pestanas.test.mjs`:
  - «barra lateral plegable y con el ancho a mano…»: Ctrl+B y el botón, el arrastre con su tope, el doble clic, las flechas y lo guardado;
  - «PDF en una pestaña…»: el arrastre del panel de página.

### DA55 — La escala de la interfaz se elige en Ajustes o con Ctrl + y Ctrl −

- **Contexto:** el tamaño de letra y de los controles era fijo. Las combinaciones de zoom del menú de Electron cambiaban la escala sin guardarla, y al volver a abrir la app se perdía.
- **Decisión:**
  - **Ajustes → Apariencia → Tamaño de la interfaz:** 80, 90, 100, 110, 125 y 150 %, los pasos de un navegador. Ctrl + y Ctrl − pasan al siguiente o al anterior, y Ctrl 0 vuelve al 100 %.
  - **En todas las ventanas:** la principal, las de PDF y las de grabación. El proceso principal la aplica cada vez que una ventana carga su página, y a todas cuando cambia (`setZoomFactor`).
  - **En un PDF**, Ctrl + y Ctrl − siguen agrandando el documento, como en la ventana de PDF.
  - **El menú de la app** queda sin los atajos de zoom de Electron, que cambiaban la escala sin guardarla, y sin el de cerrar la ventana, porque Ctrl+W ahora cierra la pestaña (DA56). Siguen recargar, herramientas de desarrollo y pantalla completa.
  - Una escala guardada que no está en la lista se lleva a la más cercana (`app/src/lib/escala.ts`).
- **Por qué:** con la escala del sistema operativo no alcanza: puede convenir la app más grande que el resto, o más chica en una pantalla chica.
- **Verifica:** `app/src/lib/escala.test.mjs` y `app/e2e/pestanas.test.mjs`:
  - «barra lateral plegable…» comprueba los pasos con Ctrl + y Ctrl −, Ctrl 0 y Ajustes, contra el zoom real de la ventana;
  - «PDF en una pestaña…» comprueba que ahí Ctrl + agranda el documento y no la interfaz;
  - «al abrir vuelven…» comprueba que la escala guardada vale desde el arranque.

### DA56 — Pestañas: una conversación o un PDF en cada una; el PDF se abre en una pestaña o en su ventana

- **Contexto:** la ventana mostraba una pantalla por vez y pi tiene una sola conversación abierta. Para pasar de una clase a otra había que ir a Sesiones, y un PDF sólo se abría en su propia ventana (DA47).
- **Decisión:**
  - **Una barra de pestañas** arriba del contenido, como la de un navegador.
    - Cada pestaña tiene su pantalla y su historial, y la barra lateral navega en la pestaña activa. Con una sola pestaña, la app se usa como antes.
    - El + y Ctrl+T abren una en Inicio. Ctrl+W y el clic del medio cierran. Ctrl+Tab (con Shift, hacia atrás) pasa de una a otra. Arrastrando una pestaña se cambia el orden.
    - Cerrar una pestaña no borra su conversación: sigue en Sesiones. Si se cierra la última, queda una en Inicio.
  - **Cada conversación vive en su pestaña** y pi sigue con una sola abierta, como hasta ahora. La pestaña recuerda el archivo de su sesión.
    - Al volver a una pestaña con su clase, pi cambia a esa conversación (`abrir-sesion`, lo mismo que retomar desde Sesiones) y la clase se restaura como al retomarla.
    - Si el tutor está respondiendo, antes se pregunta: «Cortar y cambiar» o «Esperar». Pasar a una pestaña de Inicio, del curso o de un PDF no corta nada: el tutor sigue escribiendo y su pestaña late.
    - Lo que empieza una conversación en una pestaña que no tiene la abierta (estudiar un tema, Tema libre, Crear curso, sesión nueva) abre una nueva, y la de la otra pestaña queda intacta.
    - Retomar una sesión que ya está en una pestaña lleva a esa pestaña. En Sesiones y en «Otras clases» de Inicio, un botón (o Ctrl+clic, o el clic del medio) la abre en una pestaña nueva.
    - «Volver a la clase», desde la barra lateral o la paleta, lleva a la pestaña de la conversación.
  - **El PDF entero:** «Abrir el PDF entero», en el panel de página y en *Curso → Material*, ofrece «En una pestaña» o «En una ventana nueva».
    - La ventana es la de DA47.
    - La pestaña usa el mismo lector, con la misma copia para leer y las mismas páginas en blanco. Al volver a la pestaña pregunta si cambió lo vedado y, si cambió, recarga, igual que la ventana.
    - Pedir de nuevo un PDF que ya está en una pestaña lleva a esa pestaña, en la página pedida.
    - PDF.js y sus estilos se cargan con la primera pestaña de PDF, no al abrir la app.
  - **Lo que queda montado:** la pantalla de detrás y cada PDF quedan montados aunque no se vean, así que al volver la clase y el documento siguen donde estaban. Con un PDF a la vista, la barra lateral navega en la última pestaña usada (o en una nueva) y el PDF queda.
  - **Al abrir la app** vuelven las pestañas del mismo vault, cada una con su pantalla, su conversación y los PDF en la página donde quedaron. Las de un curso que ya no está vuelven a Inicio, y los PDF de ese curso se cierran. Al eliminar un curso (DA53) pasa lo mismo.
- **Por qué:** se puede tener la clase en una pestaña, el libro en otra y una consulta de otro tema en una tercera, y saltar entre ellas sin perder ninguna. Dos clases a la vez necesitarían dos pi andando, con el doble de memoria. Además, la nota y el progreso de un curso suponen una clase por vez.
- **Límites:**
  - Una conversación que espera en su pestaña no avanza: el tutor responde sólo en la abierta.
  - Pasar a la pestaña de otra conversación tarda lo que tarda retomarla desde Sesiones.
  - Una conversación sin mensajes no se guarda. Si se deja su pestaña y se vuelve, empieza otra.
  - Una pestaña no se puede pasar a una ventana después de abierta: se cierra y se abre el PDF en su ventana.
- **Verifica:** `app/e2e/pestanas.test.mjs`:
  - «cada una con su conversación…»: dos conversaciones en dos pestañas. Cada una vuelve a la suya y sigue ahí mismo. También comprueba retomar desde Sesiones, abrir en una pestaña nueva, el clic del medio, arrastrar, Ctrl+W y lo guardado;
  - «con el tutor respondiendo…»: la pestaña late, y la pregunta deja esperar o cortar;
  - «la clase de otro tema, empezada en otra pestaña…»: cada pestaña conserva su clase y su tema;
  - «PDF en una pestaña…»: el menú, el libro sin la página reservada, la clase intacta al volver, el mismo PDF pedido otra vez y la barra lateral con un PDF a la vista;
  - «al abrir vuelven…»: las pestañas guardadas, con el PDF en su página y la de un curso que ya no está en Inicio.

  `app/e2e/visor.test.mjs` sigue probando la ventana de PDF, ahora elegida en el menú.

### DA57 — Lo que vio un alumno nuevo en Windows: el Python de esta máquina, las páginas dudosas y la pregunta sin respuesta

- **Contexto:** un amigo del usuario instaló la app en su PC con Windows y armó un curso con la skill `curso-nuevo`. Se vieron tres problemas en sus capturas:
  - **El Python:** `CURSOS.md`, de donde la skill toma «los comandos exactos», los escribe con `.pi/.venv/bin/python`, que es la ruta de Linux. En Windows uv deja el Python en `.pi/.venv/Scripts/python.exe`. El tutor copió el comando, falló y salió a buscar otro Python: `which python`, `py`, `where.exe python`, `uv`. En un Windows nuevo, `python` es el atajo de la Microsoft Store y `py` no existe, porque uv instala su propio Python. `ls .pi` no muestra `.venv`. En la PC del usuario pasó lo mismo el 27-oct, pero ese modelo listó `.pi/.venv/*` y siguió. Sólo `/curso-check` daba la ruta de Windows, con `PYTHON_TEXTO`.
  - **Las páginas dudosas:** el informe de la ingesta marca las figuras y los diagramas («la estructura visual no fue transcrita»). El tutor se lo contó al alumno como algo que no pudo procesar, cuando la preparación por tema las pasa por visión la primera vez que se estudia el tema (`CURSOS.md`).
  - **La pregunta sin respuesta:** el alumno preguntó por qué. El tutor cargó `teach` y le mandó un quiz sin explicación: la explicación apareció recién al corregir. La guardia de DA52 mide el texto visible desde la última pregunta respondida y, si no hay ninguna, deja pasar la pregunta. En esa sesión no había ninguna.
- **Decisión:**
  - **El Python de esta máquina:** fuera de una clase, en Windows, el prompt suma la sección `python`: «Esta computadora es Windows: el Python de learn es `.pi/.venv/Scripts/python.exe`. Donde CURSOS.md u otro texto diga `.pi/.venv/bin/python`, usá esa ruta; no busques otro Python.».
    - En una clase no va, porque no hay bash, y en Linux no se agrega nada.
    - El doctor la suma a su lista blanca.
    - `CURSOS.md` y `SETUP.md` también nombran la ruta de Windows.
  - **Las dudosas no son una falla:** `curso-nuevo` y `curso-agregar` piden presentarlas así. La ingesta sólo extrae texto, y la preparación por tema pasa por visión las figuras, los diagramas y los escaneos de su bibliografía la primera vez que se estudia el tema.
  - **La guardia también corta en el mensaje del alumno:** la pregunta de verificación necesita 120 caracteres visibles desde la pregunta respondida anterior o desde el último mensaje del alumno, lo que esté más cerca. Lo escrito antes de que el alumno hable no le responde.
    - Sigue igual: sin pregunta ni mensaje anterior no se exige, las del diagnóstico pasan y frena una sola vez.
    - El aviso al modelo agrega que, si el alumno preguntó algo, empiece por responderle.
- **Por qué:** el primer contacto de alguien nuevo es armar un curso, y ahí el tutor gastaba consultas buscando Python, contaba una falla que no era y no respondía una pregunta.
- **Límites:**
  - Si el modelo marca la pregunta como del diagnóstico (`momento: "diagnostico"`), la guardia no la mira, como en DA52.
  - Después de un «dale» del alumno, una pregunta sin texto nuevo frena una vez y vuelve con su explicación: cuesta una llamada más.
- **Verifica:**
  - `tests/estudio-modos.test.mjs`, «guardia: …»: frena con un mensaje del alumno en el medio y sin pregunta anterior; pasa con la explicación en el mensaje o en `clase`, y con `momento: "diagnostico"`.
  - `tests/entorno-auditoria.test.mjs`, «DA57: …»: el proyecto cargado como lo abre pi tiene la sección en Windows y no la tiene en Linux. La auditoría de la lista blanca del doctor y el doctor completo cubren la sección nueva.

### DA58 — learn anda con la clave que tenga el alumno: sin credenciales para el modelo configurado, va el de la conversación

- **Contexto:** el repo fija `openai-codex/gpt-6-luna` para la visión (`modelo_vision` en `curso.config.json`), para el researcher y para los subagentes de `agents/*.md`. La conversación ya andaba con cualquier clave: sin credenciales para el modelo de `settings.json`, pi abre con el primero que las tenga. Pero con una clave de otro proveedor, como la de Anthropic de un alumno que no usa ChatGPT:
  - la preparación de cada tema cortaba con «no hay credenciales para openai-codex; ejecutá /login»;
  - `investigar_tema` decía «Verificación externa no disponible»;
  - los subagentes se lanzaban con un `--model` sin credenciales;
  - «Preparar la computadora» marcaba en rojo la visión y el researcher.
  - Se podía cambiar a mano en *Ajustes → Modelo de visión* (`curso.config.local.json`), pero nada le avisaba a alguien nuevo que tenía que hacerlo. En la PC del usuario andaba porque ese archivo se armó a mano el 26-oct.
- **Decisión:** si el modelo configurado no tiene credenciales (o no está en el catálogo), se usa el de la conversación.
  - **Visión** (`modeloVision`, en la preparación por tema y en `transcribir_paginas`): sólo si el modelo de la conversación acepta imágenes. El aviso dice con cuál transcribe, y la caché y `calidad.json` llevan ese modelo, no el configurado que no sirvió. Si tampoco acepta imágenes, no llama y dice qué le falta al configurado, como antes.
  - **Researcher:** se lanza con el de la conversación, y la nota de la verificación lleva ese modelo.
  - **Subagentes:** un `tool_call` sobre `subagent` (en `extensions/modelos.ts`) cambia el modelo de la llamada, el pedido o el del frontmatter de su agente, si no tiene credenciales. Un modelo con credenciales, o un agente sin modelo, no se toca.
  - **El doctor:** sin credenciales para el configurado pero con un modelo de conversación que sí las tiene, la línea pasa de ✗ a «!» y dice cuál se usa. El ping de visión y del researcher va al modelo que se usa de verdad. Sólo queda en rojo si no hay ningún modelo con credenciales (o, para la visión, ninguno que acepte imágenes).
  - El repo conserva sus modelos: quien tiene ChatGPT sigue usándolos, y `curso.config.local.json` sigue pisándolos.
- **Por qué:** learn tiene que andar con la clave que tenga quien lo instala. El modelo del repo es una preferencia de su autor, no un requisito.
- **Límites:**
  - La visión con el modelo de la conversación cuesta lo que cuesta ese modelo. En la primera clase de un tema, la preparación puede pasar hasta 150 páginas.
  - Si la conversación usa un modelo sin imágenes (como DeepSeek), la visión sigue sin andar hasta elegir uno en Ajustes.
  - Un agente que no está en `.pi/agents/`, como uno global del usuario, no se mira.
- **Verifica:**
  - `tests/vision-auditoria.test.mjs`, «DA58: …» (2): transcribe con el de la conversación y lo dice; sin imágenes, no llama.
  - `tests/researcher-auditoria.test.mjs`, «DA58: …»: el hijo recibe `--model` con el de la conversación.
  - `tests/modelos.test.mjs`, «DA58: …»: el subagente cambia de modelo sólo si el suyo no tiene credenciales.
  - `tests/entorno-auditoria.test.mjs`, el doctor de una máquina nueva: sin claves, ✗; con una clave de Anthropic, «!» con el modelo que se usa en cada rol.
