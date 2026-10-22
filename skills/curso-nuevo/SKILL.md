---
name: curso-nuevo
description: Crear un curso desde PDFs de _entrada/, con contrato, índice curado y revisión del material. Usar cuando el usuario pide preparar un curso nuevo.
---

# Crear un curso

1. Tomá el slug pedido por el usuario. Si ya existe `cursos/<slug>/`, usá el flujo de ampliación de `../curso-agregar/SKILL.md`. Leé `../../scripts/ingesta/CURSOS.md` para el formato de propuesta y los comandos exactos.
2. Inventariá los PDFs de `_entrada/` sin modificarlos: tipo, páginas y SHA-256. Leé programa, portada/edición e índices antes de elegir qué pertenece al curso. Mostrá la selección; ante clasificaciones dudosas, resolvelas juntas con `ask_user_question`. Una muestra externa o material de otra materia queda fuera, salvo pedido explícito.
3. Redactá `curso.md` y un primer `indice.yaml` según las fuentes. Los objetivos llevan ids; pesos, umbrales y rúbricas llevan cita y fecha de la fuente, o dicen «no consta». Conservá las diferencias entre ediciones. Los rangos son páginas PDF base 1, inclusivas. Una asociación no verificada queda pendiente, no inventada.
4. Escribí la propuesta JSON en `_procesado/` de la raíz del vault (nunca en `cursos/<slug>/_procesado/`) y usá `guardar_curso`. Para la creación inicial podés dejar listas de referencias vacías mientras se preparan los ítems. El código inicializa `progreso.yaml` vacío; el modelo trabaja únicamente en contrato e índice.
5. Lanzá la ingesta base con `iniciar`, en segundo plano, usando un manifiesto de selección explícita. Mientras corre, trabajá con lo disponible. Consultá el estado. Procesá primero programa, índices y páginas necesarias; declaralo si no es el documento completo.
6. Usá `transcribir_paginas` en todo ejercicio/evaluación/solución seleccionado y en páginas dudosas; respetá la confirmación de gasto de la tool. Leé los resultados y segmentá con `guardar_items`. Vinculá soluciones sólo si existen; el enunciado de un ítem no incluye su solución.
7. Completá la propuesta de índice con secciones, prerequisitos y los ids reales de ítems. Conservá el borrador existente y mostrale al usuario el diff mediante `guardar_curso` antes de reemplazarlo. Si no hay UI, dejá la propuesta sin aplicar para revisión; no eludas la confirmación por bash.
8. Corré `validar` e `informe`. Resolvé errores estructurales; los avisos de preparación/fidelidad permanecen visibles. Mostrá `cursos/<slug>/informe-ingesta.md`, temas sin material, ítems sin asignar y páginas dudosas. El curso queda como borrador hasta que el usuario revise la tabla tema → material. Todavía no inicies una clase.
