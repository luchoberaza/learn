# Preparar cursos

Backend local de `guardar_curso`, `/curso-check` y las skills de creación/ampliación. Usa el Python y PyYAML ya instalados. Contrato e índice son borradores editables por el usuario; `progreso.yaml` sólo se inicializa vacío al crear el curso. Su actualización usa `registrar_progreso` y el backend `progreso.py` desde Fase 7 (ver `../../SETUP.md`, sección Progreso persistente); nunca se reescribe desde la curación. Un tema entra en él recién cuando se guarda su progreso: quitar o renombrar a mano en `indice.yaml` un tema sin estudiar no invalida el progreso (la ampliación nunca quita temas).

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
- Cada ítem de `items.yaml` lleva `id`, `paginas` y `enunciado`. La solución oficial integrada en el mismo PDF (típico en parciales) es otro ítem con `solucion_de: '<id del enunciado>'`; una solución en un documento aparte de tipo `soluciones` se vincula con `solucion: {doc, id}`. Los temas referencian sólo enunciados, nunca un ítem de solución. `puntos` (opcional) guarda el puntaje oficial: un número ≥ 0 o un texto de hasta 40 caracteres (`8`, `10 (a: 4, b: 6)`).
- El código preserva el texto YAML exacto de la propuesta: quien la redacta conserva los comentarios y cambios manuales. Reemplazar archivos existentes requiere diff y confirmación en `guardar_curso`. Se comparan las huellas de la propuesta y de los archivos revisados antes de aplicar; no se reescribe progreso ni se renombran/reemplazan PDFs existentes.
- Crear se hace una sola vez: el curso se arma en `cursos/.<slug>.nuevo/` y recién completo pasa a `cursos/<slug>/`. Cada PDF se copia a un temporal oculto, se verifica su SHA-256 y sólo entonces toma su nombre final. Un corte (Esc, disco lleno) no deja curso ni PDFs a medias: repetí `guardar_curso`. Una carpeta `cursos/<slug>/` sin `indice.yaml` (ajena o de un corte anterior) se informa y no se toca: movela fuera de `cursos/`.

## Comandos locales

Desde la raíz del vault. En Windows, el Python es `.pi/.venv/Scripts/python.exe` en lugar de `.pi/.venv/bin/python`:

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py revisar --curso ejemplo --propuesta _procesado/propuesta.json
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py validar --curso ejemplo
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py informe --curso ejemplo
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py cruzar --curso ejemplo
```

`inventario` (sin `--curso`) lista los PDFs y las grabaciones de `_entrada/` con su SHA-256: de un PDF, sus páginas; de una grabación, su duración y sus tramos.

### Grabaciones de clase (DA51)

Un video o audio de una clase (mp4, mkv, webm, mov, m4v, mp3, m4a, wav, ogg, opus, flac, aac) es un documento más, de tipo `bibliografia` u `otros`. Sus «páginas» son tramos de 5 minutos: `paginas` es la cantidad de tramos que da `inventario`, y los rangos de `bibliografia` son tramos. La ingesta base los transcribe en local con faster-whisper (modelo `modelo_transcripcion` de `curso.config.json`, `large-v3-turbo` por defecto, que se descarga la primera vez: unos 1,6 GB), sin red ni costo. Cada tramo empieza en el primer silencio a partir de su minuto nominal. Cada párrafo trae la hora en que empieza, `[12:05] …`, y se cita al segundo con `[[cursos/<slug>/fuentes/<tipo>/clase.mp4#t=725]]`. Nada de una grabación va al modelo de visión. Los rangos por tema se asignan después de la ingesta, leyendo la transcripción.

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py inventario
```

`cruzar` toma, por tema, las siglas y los términos con guion de cada objetivo y de cada ítem asignado («ancho de banda-retardo», ICMP) y los busca en las páginas transcriptas de su bibliografía. Lista los que no aparecen, con las páginas del libro donde sí están, y los que el rango sólo menciona de pasada cuando el libro les dedica una sección numerada fuera del rango. `paginas_sin_texto` cuenta páginas del rango sin transcripción: con ellas el cruce es incompleto. Es una ayuda de curación, no un error de validación.

`aplicar --base <huella devuelta> --huella <huella propuesta>` es la operación interna usada por `guardar_curso` tras la confirmación. No es un atajo del agente para eludirla. El CLI sirve también al usuario local, que ya tiene permisos de edición del vault.

El validador es de sólo lectura. `ok` significa estructura/referencias válidas; `listo_estudio` exige además cero avisos. Páginas referidas sin preparar o pendientes de calidad son avisos explícitos, no errores de instalación; también lo son cada documento de ejercicios/evaluaciones/soluciones sin segmentar y, si el curso tiene evaluaciones, cada tema sin preguntas de evaluaciones asignadas (en el índice o en `_procesado/asignaciones.json`); los dos se resuelven solos con la preparación por tema. Un informe puede decir «estructura válida, preparación incompleta» sin certificar fidelidad ni ocultar esos pendientes. Los errores de esquema, rangos, ids, ciclos o referencias a ítems inexistentes sí hacen fallar la validación. El tamaño de `curso.md` usa la estimación conservadora bytes UTF-8 / 4 y se avisa si supera el presupuesto; no se instala un tokenizer.

## Ingesta en segundo plano

El manifiesto JSON también va en `_procesado/` de la raíz del vault, nunca dentro de la salida `cursos/<slug>/_procesado/`. Conserva el formato base; `archivo` es relativo al vault, no al curso:

```json
{"version":1,"documentos":[{"id":"programa","titulo":"Programa","tipo":"programa","archivo":"cursos/ejemplo/fuentes/programa/programa.pdf","paginas":[1,2]}]}
```

`manifiesto` lo arma desde el índice en `_procesado/manifiesto-<slug>.json`: el `id` de cada documento es el del índice, que es como lo encuentran `validar` y las tools. Al crear o ampliar un curso se ingiere sin modelo todo (`--todo`); la caché saltea lo ya preparado. `--pendientes` (predeterminado) toma sólo las páginas referidas por el índice que no tienen transcripción. La visión queda para ejercicios, evaluaciones, soluciones y páginas dudosas, y la hace sola la preparación por tema.

```bash
.pi/.venv/bin/python .pi/scripts/ingesta/cursos.py manifiesto --curso ejemplo --todo
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto _procesado/manifiesto-ejemplo.json --salida cursos/ejemplo/_procesado
.pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py estado --salida cursos/ejemplo/_procesado
```

## Preparación por tema

La ingesta base no usa modelo. El resto se prepara solo la primera vez que se estudia cada tema (o si su preparación quedó incompleta), en segundo plano, sin pedir confirmación ni disparar turnos: la primera pregunta no espera.

1. Transcribe con `modelo_vision` las páginas de la bibliografía del tema que siguen pendientes (`ruta: pendiente`, `requiere_vision` o `error_vision`); después las de parciales y prácticos sin segmentar (todas, porque sus preguntas pueden ser de cualquier tema). Tope de 150 páginas por corrida, con el tema primero; lo que queda sigue la próxima vez. Las páginas en caché o adoptadas a mano (`manual`) no van al modelo. Un documento sin ingesta base espera, sin aviso, a que `iniciar` lo procese; mientras, el tema queda incompleto. Apenas están las páginas del tema, el dossier se refresca.
2. Segmenta cada parcial y práctico transcripto en `items.yaml` con el contrato de arriba (`solucion_de`, `puntos`, ids como los numera el documento). Un parcial segmentado sin sus soluciones integradas se segmenta otra vez, una sola, salvo que su `items.yaml` se haya editado a mano. Conserva los ids que ya usa el índice. Un enunciado con un marcador de solución (el mismo de la búsqueda: «Solución», «Resolución», «Rta.:», «Respuesta:») se rechaza y se reintenta: la solución va en su propio ítem.
3. Clasifica con el mismo modelo cada enunciado que el índice no asigna y lo guarda en `_procesado/asignaciones.json` (`automatico: true`, versión y huella del enunciado por ítem; se reclasifica si cambia). `indice.yaml` no se toca y manda: lo que asigna el índice no se clasifica. El dossier marca esos ítems «asignado automáticamente».

Una respuesta inválida del modelo (JSON roto, ítem inválido, ids faltantes) se reintenta una vez con el motivo; si vuelve a fallar, esa segmentación o clasificación queda en espera 24 h o hasta que cambien sus entradas, sin aviso; mientras, `/curso-check` muestra el tema «incompleta». Red, cuota o credenciales, reconocidas por el error del proveedor, cortan la tanda en la primera falla; lo que ya había fallado en esa corrida queda en espera igual. Un plazo vencido (3 minutos por página de visión, 5 por segmentación o clasificación) cuenta como una falla de esa llamada y no corta la tanda.

`_procesado/preparacion.json` registra por tema `estado` (completa/incompleta), fecha, páginas pendientes y la huella del índice (si el índice cambia, se revisa otra vez); por documento, si quedó segmentado; y en `fallos`, lo que espera: `{"segmentar/<doc>" | "clasificar/<doc>/<id>": {entrada: <sha256 de lo enviado>, fecha}}`. `_procesado/.preparacion.lock` (`{pid, inicio, proceso}`) evita dos preparaciones del mismo curso: sólo lo borra quien lo tomó, y se reemplaza si su pid murió, si es de otro arranque u otro proceso con el mismo pid, o si tiene más de 6 h. Si la ingesta base está corriendo, espera al próximo turno sin avisar. Un kill no corrompe nada: cada escritura es atómica y la próxima vez sigue desde la caché. En la barra se ve «⏳ Preparando material de <tema>: 12/40 páginas»; al terminar, completa o a medias, la barra se limpia sin aviso y el tutor recibe el resultado en un mensaje oculto. Sólo una falla que corta la tanda (sin credenciales, red, cuota o sin Python) es una línea «Preparación del material no disponible: …; seguimos con lo que hay.» y la clase sigue. Mientras ese lock está vigente y alguna página que el researcher del curso usa de ancla sigue pendiente de visión, su alcance espera para lanzarse (ver `../../SETUP.md`, Fase 6).

Por tema, una pregunta segmentada de una evaluación queda reservada para `/simulacro` y no se usa para practicar: una que no se practicó, ni ella ni una casi copia suya; de preferencia sin casi copias en ejercicios o evaluaciones (al menos 10 términos en común y Jaccard ≥ 0,5), después con solución oficial y después con puntos. Sus casi copias, también un problema del libro, se ocultan con ella. Hasta que se segmenta el parcial no hay reserva. Si un tema tiene una sola, asignale otras en el índice.

En pi, `/curso-check ejemplo` suma una línea por tema: «Preparación de <tema>: sin preparar | completa | incompleta (N páginas pendientes) | incompleta (quedan ítems por separar o clasificar) | cambió el índice: se rehace al estudiarlo; N ítems asignados automáticamente.». `/curso-estado ejemplo` consulta el estado de la ingesta y actualiza su indicador en la barra. Sin daemon ni sondeo permanente. Una selección parcial nunca se presenta como un PDF completo procesado. Tras preparar o agregar ítems, regenerá el informe visible con `informe`; conserva cualquier informe editado manualmente y pide intervención en vez de pisarlo.
