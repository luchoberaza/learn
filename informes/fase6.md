# Fase 6 — researcher anclado, modos y caché

**Aprobada por el usuario con «Aprobado, continuá», commit `f9aeea7`; autorizó sólo Fase 7.** Este informe conserva los resultados y proveedor históricos. En Fase 7 se autorizó pasar a `openai-codex`: la caché anterior se preserva, pero ya no tiene la huella vigente. La Fase 5 quedó aprobada con «Confirmado, avanzá»: imagen recuperada confirmada en Obsidian. Se adoptó explícitamente la instalación existente de **pi 1.4.0**, sin reinstalarla ni modificar preferencias personales.

## Qué cambia

- `investigar_tema(modo, afirmaciones)` recibe 1–3 afirmaciones y despacha el `subagent` researcher existente, con el modelo de config. No hay otro ejecutor, servidor, cola o dependencia.
- **Alcance:** mapa, raíces, motivaciones, errores comunes y ejemplos. Se guarda y reutiliza por tema. **Verificar:** contraste puntual; no reemplaza ese mapa. Ad hoc admite verificar sin inventar un tema persistente.
- El contexto incluye contrato completo, páginas preparadas con citas PDF base 1 y enunciados curados de ejercicios, sin soluciones. Se limita a 50 transcripciones/200000 bytes, 2000 posiciones inspeccionadas y 100 archivos de huella. El hijo declara huecos y calidad pendiente. No hace OCR, visión ni modificación del PDF.
- El informe distingue afirmación recibida, veredicto, versión corregida, evidencia del curso y externa; extensiones rotuladas «fuera del material del curso». La preparación silenciosa usa la tool antes del probe y continúa sin esperar al hijo.
- La publicación comprueba correlación de nombre/tarea en la rama activa, éxito, vigencia de fuentes, formato y citas admitidas. La caché lleva fecha/modelo/control de integridad y revisión humana pendiente. El extracto del dossier conserva su presupuesto y se trata como datos externos, no instrucciones.

## Caché y preservación

La primera publicación usa `notas/verificaciones/<tema>.md`; ante nuevas fuentes/prompts usa `<tema>-<huella>.md`. El dossier enlaza la generación vigente. Temporal privado, fsync y hardlink exclusivo permiten publicación atómica sin sobrescribir archivos. Se conservan notas manuales, incompletas y generaciones anteriores; no hay limpieza automática.

La huella incorpora tema, contrato, enunciados, modelo/config, prompt, índice y preparados consultados. **No incluye progreso:** avanzar no invalida las fuentes. Cambio de material durante la investigación impide guardar el resultado como vigente. Inicio/fin se reconstruyen desde `getBranch()`, no desde ramas abandonadas. No se sondea al hijo. Un despacho sin entrega tras reinicio se puede retomar explícitamente por nombre; no se duplica automáticamente. Un resultado de otro tema no cambia el activo.

## Prueba real final

Evidencia: `_procesado/fase6/prueba-1792630409914/resultado.json`, su JSONL y las sesiones de los hijos referidas allí.

| Comprobación | Resultado observado |
|---|---|
| Principal / researcher | `openai/gpt-6.1-sol` / `openai/gpt-6-luna` |
| `/estudiar redes retardos` → primera pregunta | **20,62 s**; quiz detenido sin respuesta |
| Alcance en segundo plano | **68 s**, sin esperar para empezar el probe |
| Lectura local / web, alcance | 2 `safe_bash`, 1 `web_search`, 1 `web_fetch` correctos |
| Verificación puntual | **57 s**; 2 lecturas locales, 1 búsqueda y 2 fetches correctos |
| A1: tamaño de paquete duplicaría propagación | **discrepa** |
| A2: tamaño duplicado duplicaría transmisión con tasa fija | **concuerda** |
| A3: distancia duplicada duplicaría transmisión con tamaño/tasa fijos | **discrepa** |
| Segundo `/estudiar` del mismo tema | Primera pregunta en **7,42 s**; **cero hijos adicionales** |
| Progreso, contrato, índice, teach y plan | Intactos |

Los tres controles son del script, no errores ni respuestas del estudiante. Se cotejó su correspondencia A1/A2/A3 en el informe real; los valores esperados no se pasaron al researcher. Los tiempos son un smoke, no garantía ni comparación causal aislada de rendimiento.

Caché vigente al cierre de Fase 6 (histórica tras cambiar de proveedor en Fase 7):
[[cursos/redes/notas/verificaciones/retardos-d82cec69f080858c4efc921aab36b35c84bd5123d73186f99721eaddd2c5fdc7.md]]

## Fallos conservados y límite de confianza

Hubo **cinco iteraciones técnicas**, conservadas en `_procesado/fase6/`:

1. `prueba-1792629115851`: el researcher modificó condiciones para etiquetar una afirmación falsa como «concuerda»; el harness falló.
2. `prueba-1792629327914`: pasó el control de entonces; después se amplió el contexto con enunciados, que el hijo no había recibido.
3. `prueba-1792629730023`: pasó el control; se incluyó luego el contrato completo, porque el hijo no había usado correctamente su ruta.
4. `prueba-1792630057935`: volvió a confundir concordancia entre fuentes con verdad de la afirmación recibida; no se aceptó como contraste correcto.
5. `prueba-1792630409914`: formato de veredicto explícito con ejemplo, contexto completo y tres controles correctos. No se cambiaron modelo ni respuestas esperadas para aceptar un fallo.

**Tres controles correctos no certifican fiabilidad general.** El código valida integridad, procedencia prevista, formato y citas permitidas; no demuestra verdad semántica, autoría de una fuente, validez de todas las URLs ni fidelidad de cada transcripción. Se conservan los fallos, las salidas intermedias y sus generaciones de caché. Los informes siguen con revisión humana pendiente y el material del curso conserva prioridad.

Uso de los cinco ensayos, incluyendo diez hijos y todos los turnos del principal: costo de catálogo reportado **0,3807107**, no factura; excluye doctor. Principal: 119419 tokens nuevos de entrada, 3562 salida y 426496 de lectura de caché. Researcher: 405076 nuevos de entrada, 19311 salida y 1344000 de lectura de caché. No confundir tokens nuevos con total de contexto procesado.

## Tests, doctor y API

- Reapertura adicional con SDK real **sin llamadas al modelo**: caché vigente, `investigar_tema` devuelve `cache: true`; dossier de **11461 bytes**, dentro de 12000.
- **71 tests Node**, incluida la suite de **56 Python**, sin LLM. Cubren caché, generaciones, enunciados sin soluciones, cambio concurrente de fuentes, notas manuales/symlinks, límites/rangos, entrega ajena, rama activa, duplicados y fallos.
- Doctor completo en verde con pi **1.4.0**, nuevos tools, modelos/web y guardado de fotos. Dependencias y comando exacto en `.pi/SETUP.md`.
- APIs verificadas en instalación: `ExtensionToolContext.executeTool`, `AgentToolCallOutcome`, hooks y secciones. Se reutilizan permisos/validación del ejecutor anidado, no APIs privadas de producto. SDK y formatos se verificaron contra la versión instalada.
- **18 PDFs originales y 17 copias** cotejados por SHA-256; plan sin cambios (`ba3ab49513e1fee2ec7c4e3ab60638fb28fb2e58460f3c24af785b987277b5fa`). Sin curación/progreso escritos ni fotos ajenas importadas.

## Cómo probar

1. En una sesión de pi dentro de tmux: `/reload` y `/estudiar redes retardos`.
2. Con el proveedor/config de este ensayo, Retardos reutilizaba su caché sin otro alcance. Tras el cambio autorizado a `openai-codex` en Fase 7, la próxima consulta puede lanzar un alcance nuevo; la generación anterior se conserva.
3. Para contraste nuevo, pedí verificar 1–3 afirmaciones; el principal usa `modo: "verificar"` y recibe el informe asíncrono. Revisá etiquetas, fuentes y separación de extensiones.
4. Ensayo repetible opcional: `node .pi/scripts/probar-researcher-curso` — consume modelos/web y genera notas técnicas nuevas, sin responder por vos.

La reapertura se probó con alcance ya guardado; no se hizo un corte real del padre antes de la entrega del hijo. Al cerrar Fase 6 no se había hecho una clase completa ni implementado `/fin`, `/progreso`, fusión/reconstrucción o escritura de progreso. Redes conserva **268 páginas referidas pendientes**. La aprobación posterior autoriza Fase 7, no convierte los ensayos en progreso del usuario ni modifica las revisiones humanas pendientes.
