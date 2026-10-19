# Verificación de la base — Fase 0

Fecha: 2026-10-19.

## Resultado

Las pruebas técnicas de los componentes funcionan. La nota de Obsidian conserva una **prueba parcial de enseñanza**, no una lección completa: se interrumpió durante el probe. No se afirma que se hayan ejercitado el plan y toda la fase de enseñanza.

El usuario confirmó expresamente la opción «1»: acepta este smoke técnico como criterio suficiente para cerrar Fase 0. Se repitieron los 11 tests y el doctor dentro de tmux, con todo en verde, para realizar el único commit de cierre. No se afirma que la lección se haya completado. No se inició Fase 1.

## Evidencia de la sesión del usuario

Se leyó `prueba-base.md` sin modificarla:

- Carga de `teach` registrada.
- Pregunta de objetivo, opciones y selección registradas.
- Primer quiz: pregunta, orden de opciones y devolución correctos en el log; incluye LaTeX.
- Dos quizzes posteriores cancelados por el usuario: consta su cancelación, no un fallo de la herramienta.
- Imagen pegada: el log conserva la ruta temporal PNG; el agente reconoció en su pregunta la expresión de la imagen. Esto confirma recepción e interpretación inicial, no valida OCR de material del curso.
- No aparece todavía un plan, un resultado de researcher ni una explicación completa, porque la sesión no avanzó hasta esas fases.
- La falta de un adjunto embebido en el log es la limitación esperada de md-log original; se implementa en Fase 5, no se corrigió por anticipado.

La sesión de implementación también corre ahora dentro del servidor tmux `pi-learn`.

## Prueba autónoma del researcher

Como no se alcanzó esa parte de `teach`, se ejecutó una prueba de integración separada:

```bash
.pi/scripts/probar-researcher
```

Esta prueba usa LLM y red; no forma parte de la suite sin LLM. Crea una sesión padre temporal, lanza el researcher real en un panel de tmux y recibe su resultado mediante la entrega automática de la extensión. No hace polling de los archivos del hijo para detectar su finalización. Solo después de la entrega lee el registro de prueba para comprobar las herramientas utilizadas.

Resultado observado:

- Researcher iniciado con `openai/gpt-6-luna`.
- `web_search` y `web_fetch` ejecutadas correctamente en el hijo restringido.
- Informe en español con enlace a OpenStax.
- Proceso terminado correctamente y resultado entregado al padre: **17 segundos** en esta ejecución.
- El padre de prueba no genera una respuesta LLM adicional; se captura la entrega en `before_agent_start` y se aborta esa continuación.
- No se tocó el log de Obsidian del usuario ni se modificaron sus sesiones.

Artefactos temporales de esta ejecución: `/tmp/pi-learning-researcher-E8h6qz` (no forman parte del repositorio ni son almacenamiento permanente).

## Comprobaciones automáticas

- `node --test .pi/tests/*.test.mjs`: **11/11 aprobados**.
- `.pi/scripts/doctor`: **todo en verde**, ejecutado desde la sesión tmux actual. Incluye texto e imagen con `gpt-6-luna`, búsqueda y lectura web.
- `skills/teach/SKILL.md` permanece idéntico a la base.

## Siguiente checkpoint

Fase 0 aceptada y preparada para su único commit en `.pi/`. Después del commit, mostrar el resumen y esperar el OK específico de Fase 1. La respuesta «1» no aprobó sustituir la muestra de parcial escaneado por una copia rasterizada.

Para el benchmark posterior harán falta tres muestras reales en `_entrada/muestras/`: capítulo digital con fórmulas, capítulo escaneado y parcial/práctico escaneado, idealmente con algo manuscrito. Los originales no se modificarán ni se borrarán.
