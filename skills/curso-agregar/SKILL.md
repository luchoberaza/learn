---
name: curso-agregar
description: Ampliar un curso con PDFs nuevos, preservando la curación manual y mostrando el diff antes de guardar. Usar cuando llega otro práctico, parcial o material para un curso existente.
---

# Ampliar un curso

1. Leé `../../scripts/ingesta/CURSOS.md`, `curso.md`, el `indice.yaml` completo y el informe del curso pedido. Si no existe, pedí crear el curso primero. El progreso existente es de sólo lectura para este flujo.
2. Inventariá los archivos indicados; sin lista explícita, examiná `_entrada/` y elegí sólo material de este curso aún no incorporado. Compará SHA-256. Conservá ids, nombres de fuentes, referencias y comentarios manuales. Ante clasificación dudosa, consultá las dudas juntas con `ask_user_question`.
3. Armá una propuesta completa basada en los textos actuales, agregando documentos/temas/referencias sin eliminar lo existente. En `origenes`, declarás únicamente los PDFs nuevos. Guardá la propuesta en `_procesado/`. El formato conserva el YAML como texto para que los comentarios no desaparezcan por una reserialización automática.
4. Usá `guardar_curso`: el diff se muestra al usuario y requiere su confirmación interactiva. Un rechazo o un cambio concurrente conserva el curso; releé y volvé a proponer. Sin UI dejá el diff/propuesta para revisar, sin aplicar por bash ni añadir una bandera de autoaprobación.
5. Prepará solamente páginas/documentos nuevos con la ingesta en segundo plano. Toda página seleccionada de ejercicios, evaluaciones y soluciones pasa por `transcribir_paginas`; segmentá con `guardar_items`. Si cambió el PDF de un documento existente, conservá el anterior y agregá otro id/archivo.
6. Completá las referencias de la propuesta con los ítems reales, revisá el nuevo diff y guardá con la misma confirmación. Corré `validar` e `informe` y mostrale al usuario las diferencias, los pendientes y la tabla tema → material. Una página sin procesar o una asociación dudosa sigue pendiente; no se presume revisada por tener puntaje alto.
