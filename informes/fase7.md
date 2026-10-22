# Fase 7 — progreso persistente y reanudación desde el borde

**Aprobada por el usuario con «Aprobado, continuá», commit `29cdb0c`; autorizó Fase 8.** Este informe conserva los resultados históricos; el piloto humano se registra en [[fricciones]]. El usuario aprobó Fase 6 (`f9aeea7`) con «Aprobado, continuá». El plan original y `skills/teach/SKILL.md` permanecen intactos.

## Contra el plan

| Requisito de Fase 7 | Resultado |
|---|---|
| `registrar_progreso` | Validación, fusión sin duplicados exactos, bloqueo y guardado atómico con `.bak` byte a byte |
| `/fin` | Guarda, muestra resumen y próximo paso, y recién entonces cierra el log con acuse |
| `/progreso [curso]` | Estados por tema y sugerencia que exige prerequisitos dominados |
| Reconstrucción desde log sin cierre | Lectura acotada/SHA, propuesta con confirmación humana real y etiqueta en historial; sin modificar el log |
| Segunda sesión confirma el borde en ≤3 preguntas | **3 preguntas** en el ensayo con modelo real y alumno virtual aislado; piloto humano pendiente |
| Tests, doctor, commit y checkpoint | Tests/doctor en verde; un único commit de fase, seguido de este checkpoint |

Sin dependencias nuevas, servicios, BD, planificador de repasos ni cambios a PDFs o al skill teach. La ingesta y los materiales parcialmente preparados no se rellenaron como parte de esta fase.

## Persistencia y fallos

`progreso.py` reutiliza YAML seguro, rutas seguras, bloqueo del curso y temporal/fsync/rename existentes. Valida tema, estados, fechas, bancos de ítems y rutas de log. Conserva otros temas; listas por igualdad exacta, errores por descripción y borde mediante movimientos explícitos entre domina/falla. Cada tema/log tiene una entrada de historial; `cierre:false` para probe/práctica y `cierre:true` para cierre final. El historial anterior sin flag sigue siendo compatible.

Antes de escribir conserva la versión previa exacta como `progreso.yaml.bak`. Si el YAML es inválido y el respaldo es válido, restaura con aviso visible y conserva los bytes inválidos por SHA bajo `_procesado/`. Sin respaldo válido, continúa con material sin guardar hasta reparar; tampoco pisa un backup existente inválido. Tests cubren UTF-8 inválido, symlinks, cortes, bloqueos, concurrencia e idempotencia. No se probó dañando progreso real de Redes.

La extensión refresca el dossier después de guardar. `/fin` y el cierre natural sólo desvinculan después de un registro final exitoso y un mensaje completo con texto, sin aborto/error/llamadas pendientes. md-log usa su mismo lock para resumen y cierre, comprueba el archivo esperado y devuelve acuse. Si falla guardado o vínculo, el curso sigue abierto. Ad hoc no crea temas ni progreso ficticios.

Al detectar el último log del tema sin registro final, ofrece reconstrucción. `leer_sesion_anterior` devuelve texto limitado y SHA; `registrar_progreso` exige confirmación interactiva y verifica que el log no cambió. Se conserva el log y se identifica la reconstrucción en historial sin cerrar la sesión actual. Preguntas no respondidas y pruebas técnicas no acreditan errores o dominio del usuario.

## Ensayo con modelo real, sin escribir progreso del usuario

Evidencia: `_procesado/fase7/prueba-1792672775843/resultado.json` y sus dos JSONL.

- Modelo: **`openai-codex/gpt-6.1-sol`**, sin retries automáticos ni compactación.
- Curso `prueba-progreso`, exclusivamente bajo `_procesado/fase7/…/vault`; material digital generado como fixture y rotulado sintético, sin escaneos falsos ni mezcla con Redes.
- Alumno virtual programado: primer quiz correcto, siguientes «no sé». No representa respuestas ni capacidades del usuario.
- Primera sesión: **3 preguntas**; piso en definición de transmisión y techo en propagación/efecto de duplicar tamaño. Guarda tras el probe y otra vez al cerrar.
- Segunda sesión: loader/sesión nuevos sobre la misma fixture. Su mensaje de sistema contiene el borde previo, cotejado en JSONL. **3 preguntas** dirigidas a ese piso y esas fallas; conserva el borde, sin remapear otro tema.
- Ambos `/fin` registran cierre y conservan el resumen final en sus logs antes de desvincular. Historial: dos entradas, no cuatro por los guardados intermedios.
- Sin researcher ni visión en este ensayo; no hay clase completa, práctica tipo evaluación ni escala inventada. Reconstrucción/confirmación se ejercitan con fixtures sin modelo, no con clic humano real.

### Iteraciones conservadas

Se preservan siete carpetas de ensayo, incluidos los fallos:

1. `prueba-1792636116750`: modelo predeterminado distinto del esperado; detención previa al probe.
2. `prueba-1792636295117`: el harness buscaba el backend/venv en la fixture; no inició el curso.
3. `prueba-1792636612356`: el modelo evitó prudentemente atribuir respuestas sintéticas al usuario; no se aceptó como borde confirmado.
4. `prueba-1792636786643`: el simulador respondió todo bien y no produjo techo; no se aceptó.
5. `prueba-1792672185762`: divergencia de proveedor `openai-codex` frente al anterior `openai`.
6. `prueba-1792672223350`: intento con `openai` sin credenciales; se añadió guardia temprana y se pidió decisión al usuario.
7. `prueba-1792672775843`: alumno virtual explícitamente separado del humano, controles de piso/techo y dos sesiones correctas con el proveedor autorizado.

Uso registrado en JSONL de todos los ensayos, sin doctor/pings: **54873** tokens de entrada nueva, **3199** de salida y **172544** de lectura de caché. Costo de catálogo **0,1589904**, no factura; el ensayo final representa 0,0980644. Las carpetas sin JSONL no tienen uso registrado; no se presenta eso como contabilidad del proveedor.

También se detectó una regresión determinista: guardar `cierre:true` podía desvincular sin mensaje final; test rojo y corrección para exigir final completo y `agent_settled.aborted === false`. Otra regresión asegura aviso explícito de restauración de `.bak`, no sólo «preparación parcial». Se corrigió además una coincidencia por sufijo que ofrecía el log de `otra-derivacion` al estudiar `derivacion`: test rojo→verde y coincidencia del nombre completo. Una fixture de test se corrigió para editar el snapshot activo, en vez del objeto previo a su serialización.

## Proveedor autorizado y cachés

Al retomar, `openai` ya no tenía autenticación configurada; doctor falló los dos pings Luna. Se informó al usuario, que eligió **«Usar openai-codex»**. Antes de adoptarlo respondieron Sol por texto y Luna por texto/PNG.

Se cambió únicamente la configuración del proyecto, frontmatter del researcher y las expectativas de sus scripts de ensayo: principal **`openai-codex/gpt-6.1-sol`**, visión/researcher **`openai-codex/gpt-6-luna`**. No se modificaron credenciales, login ni preferencias personales. Pi sigue fijado en **1.4.0**; no hubo reinstalación.

Modelo/config forman parte de las claves: las cachés anteriores se conservan pero no se presentan como vigentes con el nuevo proveedor. El próximo estudio puede lanzar un nuevo alcance en paralelo; la visión sólo se repite si se solicita preparación. No se regeneraron en esta fase para rellenar cachés. Los informes anteriores conservan sus modelos históricos. Pings no certifican calidad de visión ni funcionamiento completo de los ensayos históricos bajo el proveedor nuevo.

## Validación e integridad

- **83 tests Node**, incluida una suite de **67 Python**, sin LLM; ejecución Python independiente también en verde.
- **Doctor completo en verde** con pi 1.4.0, nuevas tools/comandos activos, Luna texto/imagen y web reales.
- APIs contrastadas con la instalación: `AgentSettledEvent`, mensajes/árbol de sesión, registro de tools y runtime de modelos. Sin API privada nueva en producto.
- **18 originales y 17 copias de Redes** cotejados por SHA-256. Contrato/índice comparados con la propuesta aplicada y progreso vacío original conservado; los ensayos sólo escriben progreso de fixtures.
- Plan SHA-256: `ba3ab49513e1fee2ec7c4e3ab60638fb28fb2e58460f3c24af785b987277b5fa`. Teach sin cambios contra upstream.

## Cómo probar

En pi, dentro de tmux:

```text
/reload
/progreso redes
/estudiar redes retardos
```

Respondé realmente el probe; el registro debe describir sólo tus respuestas. Usá `/fin` y comprobá en Obsidian el resumen final; `/progreso redes` debe mostrar estado y próximo paso. En otra sesión del mismo tema, debería confirmar el borde en hasta tres preguntas si sigue válido. Si aparece un log técnico viejo, podés rechazar reconstrucción: no cuenta como tu progreso.

Ensayo opcional aislado, **consume modelo y genera nuevos artefactos**: `node .pi/scripts/probar-progreso`. No hace falta repetirlo para estudiar.

**Límites pendientes:** el juicio semántico del modelo y la confirmación del borde no tienen garantía universal; deduplicación textual, no semántica. Los bloqueos protegen procesos cooperativos, no un editor externo que cambie archivos en el último instante. No hubo piloto humano de 3–5 sesiones ni reconstrucción aceptada por un humano real. Materiales/informes siguen con revisión humana pendiente y Redes conserva 268 páginas referidas pendientes. La aprobación posterior autoriza el piloto de Fase 8, pero no lo convierte en realizado ni modifica las revisiones humanas pendientes.
