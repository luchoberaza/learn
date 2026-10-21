# Fase 4 — sesión de estudio

**Fase 4 aprobada por el usuario con «Aprobado; continuá», cerrada en `c757542`.** Fase 3 cerrada en `3616e71`, con la propuesta de Redes aprobada y aplicada. La autorización posterior permite iniciar Fase 5; no convierte el smoke en una clase completa ni en revisión individual de materiales.

## Qué se agregó

- `/estudiar <curso> [tema]` y `/cursos`. Resolución por id, nombre, alias y aproximación sin tildes; selector para ambigüedades y, sin tema, prioridad a temas en curso y prerequisitos dominados. Sin coincidencia, búsqueda bibliográfica y modo ad hoc, sin escribir un tema inventado al índice.
- Autocompletado de los dos argumentos: pi 1.3.0 entrega el prefijo completo de argumentos y reemplaza ese prefijo completo, por lo que la sugerencia devuelve `curso tema`, no sólo el segundo argumento. Caché de autocompletado invalidada por mtime del índice.
- Tools siempre registradas: `leer_paginas`, `buscar_material`, `leer_items`, `ver_pagina`. Sin curso activo devuelven error claro. Texto acotado, páginas PDF base 1 y citas Obsidian; soluciones únicamente al pedirlas y si están explícitamente vinculadas. Los resultados de lectura no se escriben al log del estudiante.
- Dossier como mapa, sin volcar transcripciones: contrato, objetivos, prerequisitos, referencias, un renglón por ítem, progreso existente y verificación previa si existe. Límite por estimación bytes UTF-8 / 4, como Fase 3; no se afirma conteo exacto de tokens. Contrato fuera de presupuesto se señala, sin inventar rúbrica.
- Inyección de `teach`, `modo_curso` y `curso` mediante las secciones mutables de `before_agent_start`, sin reemplazar el prompt de pi ni perder secciones ajenas. Se reinyecta en cada arranque, incluso después de compactar.
- `{curso, tema, log}` persistido con `appendEntry`, con el mapa ad hoc si corresponde. Restauración desde la rama activa en `session_start` y `session_tree`. No se leen ramas abandonadas para elegir estado.
- Logs nuevos del curso con creación exclusiva y sufijo si ya existe la nota del día. `md-log:link`/`unlink` reutilizan el logger; el vínculo para cursos no rellena la historia de programación ni sustituye notas anteriores. Acuse explícito porque `pi.events.emit()` devuelve void y no espera callbacks asíncronos.
- `md-log` restaura sin depender de un tema TUI en procesos headless, usa append en lugar de reescribir toda la nota, conserva las citas y no califica un quiz abortado/sin respuesta como incorrecto. Los rótulos del log están en español. El comando manual pide confirmación antes de rellenar una nota no vacía.

El YAML se lee con el parser seguro existente en un proceso Python asíncrono al activar/restaurar/autocompletar, sin OCR. Las lecturas y BM25 son TypeScript puro. El validador rápido se ejecuta al activar; sus errores/avisos dan un aviso y se continúa con lo identificable. `ver_pagina` es el único render PDF en estudio: local, máximo 1800 px, caché compatible con Fase 2, hashes y preservación de renders editados. No llama a visión ni modifica el PDF.

## Prueba real con el modelo principal

Se ejecutó `/estudiar redes retardos` en una sesión independiente con **`openai/gpt-6.1-sol`** y seis tools de lectura/preguntas. El comando envió su mensaje de arranque automáticamente y el modelo emitió un **quiz a los 20,08 s**, sin otra orden del usuario. Se detuvo la ejecución antes de responder: no se inventó un intento del alumno, no se calificó y no se escribió progreso.

Sobre esa misma sesión:

- Compactación **real** con el modelo, no un resumen simulado.
- Disposición de la sesión y reapertura **real** de su archivo JSONL con un loader nuevo.
- Mismo curso, tema y log restaurados; `teach` idéntico al archivo original y dossier presente tras compactación y reapertura.
- Lectura de páginas con citas: **0,45 ms**; búsqueda BM25: **4,75 ms**.
- Render nativo medido además en una página sin caché: **388,6 ms**; repetición: **255,8 ms**. No se ocultó como “frío” un render ya preparado por visión.
- Dossier real: **6296 bytes** (1574 tokens estimados por bytes/4), por debajo de 12000 bytes. Las mediciones son de estas ejecuciones, no garantías de latencia.
- `progreso.yaml` intacto; las fotos y el researcher anclado no se ensayaron.

Evidencia durable: `_procesado/fase4/prueba-1792595021792/resultado.json` y JSONL; log técnico `cursos/redes/sesiones/2026-10-21-retardos-3.md`. Resumen sin preguntas/enunciados en `.pi/informes/verificacion-fase4.json`.

### Incidentes del harness, conservados

Hubo dos intentos anteriores, sin respuestas del usuario. El primero llegó al quiz y compactó pero no pasó el chequeo final de secciones; se corrigió el harness para recrear el loader al reabrir. Un chequeo headless aislado detectó además que el logger upstream exigía un tema TUI inicializado al restaurar: se eliminó esa dependencia y quedó cubierta por regresión. El segundo intento no pudo compactar porque `loader.reload()` recarga settings y había descartado los overrides del smoke: se aplican ahora después de reload. El tercer recorrido completo pasó.

El primer harness también usó settings combinados en `inMemory`, que reclasificó paquetes del proyecto como globales y provocó una descarga redundante de los mismos paquetes fijados en la caché de `~/.pi/agent/`. El harness final conserva el origen de settings con `SettingsManager.create` y usa sólo overrides efectivos sin persistirlos. No se cambiaron manifiestos/versiones, settings personales ni claves; no se borraron cachés a ciegas. No se agregaron reintentos automáticos al producto.

## Probar

Después de `/reload`, o en una sesión nueva:

```text
/cursos
/estudiar redes retardos
```

Sin tema, `/estudiar redes` muestra el selector. La pregunta debe aparecer sola y el log nuevo debe quedar en `cursos/redes/sesiones/`. Tras algunos intercambios puede usarse `/compact`; al salir, `/resume` permite retomar la sesión por su nombre. Las pruebas automatizadas verificaron el mecanismo con el SDK instalado, no hicieron clic en el selector de sesiones ni en Obsidian.

Opcional, con gasto de modelo y sin contestar por el usuario:

```bash
node .pi/scripts/probar-sesion
```

El smoke usa Redes/retardos, crea otra nota técnica sin pisar las anteriores, fuerza compactación de poca historia con overrides sólo de proceso y prueba reapertura. Conserva artefactos si falla.

## Alcance y pendientes

No se modificó `skills/teach/SKILL.md`. El modo conserva probe → plan → enseñanza y fuentes del curso, sin prometer APIs futuras. Las fotos persistentes son Fase 5; anclaje/caché del researcher, Fase 6; `registrar_progreso`, `/fin`, `/progreso`, fusión y reconstrucción automática, Fase 7. Por ahora el cierre se resume en chat/log, sin editar progreso a mano.

El curso sigue parcialmente preparado (268 páginas referidas pendientes). Leer derivados o aprobar estructura no certifica fidelidad. No se completó una clase, no hubo respuestas reales del alumno ni se validó manualmente el plan después del probe. Se verificó la sintaxis/conservación de citas y sus archivos, no un clic real en Obsidian.

**Pruebas sin LLM:** 46 tests Node y 56 Python. Cubren resolución/ambigüedad/tildes, orden, límites, soluciones, no curso activo, arranque, autocompletado, cancelación, rama/compactación, modo ad hoc, bus, notas preservadas, headless, YAML inválido y render/caché sin ingesta. Doctor completo al cierre, con avisos explícitos de la preparación incompleta.
