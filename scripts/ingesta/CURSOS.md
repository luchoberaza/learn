# Preparar cursos

Backend local de `guardar_curso`, `/curso-check` y las skills de creación/ampliación. Usa el Python y PyYAML ya instalados. Contrato e índice son borradores editables por el usuario; `progreso.yaml` sólo se inicializa vacío al crear el curso. Su actualización usa `registrar_progreso` y el backend `progreso.py` desde Fase 7 (ver `../../SETUP.md`, sección Progreso persistente); nunca se reescribe desde la curación.

## Propuesta

Archivo JSON en `_procesado/` de la raíz del vault, nunca en `cursos/<slug>/_procesado/` (esa carpeta es la salida de la ingesta):

```json
{
  "curso_md": "---\nnombre: Ejemplo\nslug: ejemplo\n---\n# Objetivos\n- O1.1: Objetivo fundamentado en el programa.\n",
  "indice_yaml": "version: 1\ndocumentos:\n  - id: programa\n    titulo: Programa\n    tipo: programa\n    archivo: fuentes/programa/programa.pdf\n    paginas: 2\ntemas: []\n",
  "origenes": {
    "programa": {"archivo": "_entrada/programa.pdf", "sha256": "SHA-256 completo del original"}
  }
}
```

- Tipos: `programa`, `bibliografia`, `ejercicios`, `evaluaciones`, `soluciones`, `otros`.
- Cada documento lleva `id`, `titulo`, `tipo`, `archivo` y `paginas` (total real del PDF). Bibliografía agrega `prioridad: principal|complementaria`; `soluciones` puede referir otro documento de ese tipo.
- Cada tema lleva `id`, `nombre`, `unidad` positiva, `alias`, `prerequisitos` y `objetivos` como listas. Los objetivos corresponden a bullets `- O1.1: ...` del contrato. Prerequisitos: ids de otros temas, sin ciclos.
- `bibliografia: [{doc, seccion, paginas: [desde, hasta]}]`: rango PDF inclusivo base 1. `ejercicios` y `evaluaciones`: `[{doc, items: ["1", "2"]}]`, con ids existentes en `_procesado/<doc>/items.yaml`.
- El código preserva el texto YAML exacto de la propuesta: quien la redacta conserva los comentarios y cambios manuales. Reemplazar archivos existentes requiere diff y confirmación en `guardar_curso`. Se comparan las huellas de la propuesta y de los archivos revisados antes de aplicar; no se reescribe progreso ni se renombran/reemplazan PDFs existentes.
- Crear se hace una sola vez: el curso se arma en `cursos/.<slug>.nuevo/` y recién completo pasa a `cursos/<slug>/`. Cada PDF se copia a un temporal oculto, se verifica su SHA-256 y sólo entonces toma su nombre final. Un corte (Esc, disco lleno) no deja curso ni PDFs a medias: repetí `guardar_curso`. Una carpeta `cursos/<slug>/` sin `indice.yaml` (ajena o de un corte anterior) se informa y no se toca: movela fuera de `cursos/`.

## Comandos locales

Desde la raíz del vault:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py revisar --curso ejemplo --propuesta _procesado/propuesta.json
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py validar --curso ejemplo
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py informe --curso ejemplo
```

`aplicar --base <huella devuelta> --huella <huella propuesta>` es la operación interna usada por `guardar_curso` tras la confirmación. No es un atajo del agente para eludirla. El CLI sirve también al usuario local, que ya tiene permisos de edición del vault.

El validador es de sólo lectura. `ok` significa estructura/referencias válidas; `listo_estudio` exige además cero avisos. Páginas referidas sin preparar o pendientes de calidad son avisos explícitos, no errores de instalación. Un informe puede decir «estructura válida, preparación incompleta» sin certificar fidelidad ni ocultar esos pendientes. Los errores de esquema, rangos, ids, ciclos o referencias a ítems inexistentes sí hacen fallar la validación. El tamaño de `curso.md` usa la estimación conservadora bytes UTF-8 / 4 y se avisa si supera el presupuesto; no se instala un tokenizer.

## Ingesta en segundo plano

El manifiesto JSON también va en `_procesado/` de la raíz del vault, nunca dentro de la salida `cursos/<slug>/_procesado/`. Conserva el formato base; `archivo` es relativo al vault, no al curso:

```json
{"version":1,"documentos":[{"id":"programa","titulo":"Programa","tipo":"programa","archivo":"cursos/ejemplo/fuentes/programa/programa.pdf","paginas":[1,2]}]}
```

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto _procesado/manifiesto.json --salida cursos/ejemplo/_procesado
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py estado --salida cursos/ejemplo/_procesado
```

En pi, `/curso-estado ejemplo` consulta el mismo estado y actualiza su indicador en la barra. Sin daemon ni sondeo permanente. Una selección parcial nunca se presenta como un PDF completo procesado. Tras preparar o agregar ítems, regenerá el informe visible con `informe`; conserva cualquier informe editado manualmente y pide intervención en vez de pisarlo.
