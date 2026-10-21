# Fase 3 — creación y curación de cursos

**Fase 3 aprobada y cerrada.** El usuario confirmó «Aprobado; continuá»: se aplicó la propuesta exacta revisada, se incorporaron las tres diapositivas complementarias y se asignaron los 15 ítems. Curso final: **17 PDFs / 987 páginas, 8 temas**; estructura válida, **268 páginas referidas pendientes**, ningún ítem segmentado sin asignar. Se conservaron contrato, progreso y PDFs existentes. La aprobación no certifica transcripciones. Fase 2 cerrada en `6409acd`; este cierre autoriza continuar luego con Fase 4.

## Implementación

- Skills `curso-nuevo` y `curso-agregar`, con formatos y comandos compartidos en `scripts/ingesta/CURSOS.md`.
- Alias `/curso-nuevo` y `/curso-agregar` al mecanismo nativo `/skill:…` de pi 1.3.0; `/curso-check` y `/curso-estado`, sin iniciar una clase.
- `guardar_curso`: propuesta explícita en `_procesado/`, validación y copia de PDFs nuevos desde `_entrada/`, sin mover originales. Para actualizar un curso existente muestra el diff y requiere confirmación real; sin UI se rechaza. El modelo no tiene una bandera de autoaprobación.
- Huellas de propuesta/índice/contrato/progreso para rechazar ediciones concurrentes. Se preservan PDFs y progreso existentes. Se conserva el YAML exacto de la propuesta, incluidos los comentarios que retuvo su autor; no hay reserialización ciega de un índice manual.
- Validador de esquema, ids duplicados, rutas/symlinks, archivos, páginas, objetivos, ítems, soluciones y prerequisitos circulares. Lee el esquema de progreso sin escribirlo ni restaurarlo. Comprueba fuentes/transcripciones preparadas contra sus hashes y marca páginas referidas pendientes o sin preparar.
- Informe visible: tabla tema → material, temas sin material, ítems sin asignar, preparación por documento, porcentajes y enlaces PDF. Preserva ediciones manuales del informe; recupera un corte entre su registro y el Markdown.
- `doctor` valida cada curso. Estructura válida no equivale a preparación terminada ni fidelidad: los avisos se imprimen sin presentarlos como una dependencia rota.

No se agregaron dependencias, GPU, servidor, cola persistente ni un segundo segmentador LLM. No se modificó `teach`, md-log ni el researcher. La escritura de progreso estudiantil, `/estudiar` y la persistencia de sesiones siguen en sus fases respectivas.

## Piloto real: Redes

- **14 PDFs / 754 páginas** copiados desde la bandeja, con SHA-256 idénticos. Índice actual: **8 temas** derivados del programa, sin asignaciones ficticias de ítems aún no preparados.
- Ingesta base real en segundo plano sobre **52 páginas seleccionadas**: programa 6, libro 39, Práctico 1: 3 y parcial 26/09/2024: 4. No se declara preparado el documento completo.
- **23 páginas con visión real** mediante la tool registrada, `openai/gpt-6-luna`: 23 transcritas, cero fallos de llamada y 5 pendientes heurísticos conservados. No se eludió el límite de 50 ni se hicieron reintentos automáticos.
- **15 ítems guardados**: diez del Práctico 1 y cinco preguntas del parcial. El ejercicio 7 une páginas 2–3; la pregunta 5 del parcial, 3–4. Los enunciados no contienen las soluciones integradas del PDF; no se inventó otro documento de soluciones.
- Repetición real: **52 aciertos de caché base y 23 de visión, cero llamadas nuevas**. No se degradaron las transcripciones a OCR.
- Propuesta revisada y aprobada: se incorporaron **3 PDFs de diapositivas complementarias**, alcanzando 17 PDFs / 987 páginas. Antes de aplicarla se comprobaron las huellas de propuesta y base registradas en el checkpoint. El cierre local usa la autorización explícita en el chat, sin simular una UI ni modificar el rechazo de la tool sin UI.
- Validación medida con el curso real: aproximadamente **88 ms** en una ejecución en caliente; no es una garantía de latencia. Comandos `/curso-check`, `/curso-estado` y `guardar_curso` sin cambios probados con el runtime instalado, sin turno de enseñanza.

**Antes de la aprobación:** 14 documentos, 261 páginas referidas pendientes y 15 ítems sin asignar. **Después de aplicar la propuesta aprobada:** 17 documentos, **268 pendientes**, los 15 ítems asignados. El curso no está preparado entero: las diapositivas sólo se copiaron, sin lanzar OCR/visión adicionales.

## Diferencias documentadas en las fuentes

El programa aprobado en 2017 recomienda la quinta edición de Kurose/Ross; la disponible es la séptima, complementaria según el programa. Sus capítulos de red/enlace no tienen la misma numeración. Las diapositivas de capítulos 3–5 son en inglés y datan de 2016: no son copias del libro. El Práctico 7 es de 2025, los primeros seis de 2026. Las reglas de evaluación del programa se citan con su fecha, sin afirmar vigencia para 2026. Broadcast/multicast y circuitos virtuales requieren referencias específicas; no se eliminan del programa por faltar en el libro disponible. GRIMALDI y Limric se mantienen fuera de Redes.

La tabla/diagrama de la solución en la página 4 del parcial requiere cotejo humano; el puntaje heurístico no garantiza su alineación. Se conserva revisión humana pendiente en todas las salidas de visión/ítems.

## Revisar y probar

En Obsidian: **[[cursos/redes/revision-inicial|Revisión inicial de Redes]]**, [[cursos/redes/indice-propuesto.yaml|Índice propuesto]] y [[cursos/redes/cambios-propuestos.diff|Diff]]. El informe del índice actual está en [[cursos/redes/informe-ingesta]].

Después de `/reload`:

```text
/curso-check redes
/curso-estado redes
```

Propuesta aprobada y aplicada: `_procesado/fase3/propuesta-redes-curada.json`. Se repiten los chequeos y se cierra Fase 3 en un único commit antes de implementar Fase 4. `/estudiar` todavía no pertenece a este cierre.

## Evidencia y pruebas

`informes/verificacion-fase3.json` resume procedencia, hashes, selecciones y uso sin enunciados. Los materiales y pruebas reales están en `cursos/redes/` y `_procesado/fase3/`, fuera de Git.

**34 tests Node y 52 tests Python sin LLM** cubren registro de comandos/skills, alias nativos, confirmación/rechazo/sin UI, validación, creación/ampliación, idempotencia, comentarios, PDFs/progreso intactos, ediciones concurrentes, referencias, pendientes, YAML inválido y recuperación del informe. Doctor completo en verde dentro de tmux, con aviso explícito de preparación incompleta del curso. Una ejecución intermedia falló únicamente porque `web_search` no devolvió resultados válidos; la repetición completa pasó sin cambiar código ni configuración. Se registra como fallo transitorio del servicio, no como un chequeo omitido. Los 18 PDF originales y `teach` conservan sus hashes.
