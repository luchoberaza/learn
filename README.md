# learn — modo curso

Tutor con IA para estudiar una materia universitaria **con su propia bibliografía** y practicar **como en los parciales**, dentro de un vault de Obsidian. Es una configuración de [pi](https://github.com/earendil-works/pi) (un directorio `.pi/`).

Fork de [amosblomqvist/learn](https://github.com/amosblomqvist/learn), el sistema del video [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU). La filosofía de enseñanza original (`skills/teach/`) queda intacta; este fork le suma el modo curso.

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

**¿Ya está instalado? Empezá por [`GET_STARTED.md`](GET_STARTED.md): cómo se usa, paso a paso.**

## Qué hace

- **Crear un curso.** `/curso-nuevo <slug>` arma el contrato y el índice de temas desde los PDFs que pongas en `_entrada/` (bibliografía, prácticos, parciales con solución) e indexa todas las páginas en local, sin modelo. `/curso-agregar <slug>` suma material; todo cambio a un curso guardado muestra un diff y pide confirmación.
- **Estudiar.** `/estudiar <curso> <tema>` abre una clase en español. La primera pregunta llega en segundos, sin escribir nada más. El tutor enseña a partir del material del curso, cita la página exacta del PDF (`[[libro.pdf#page=N]]`, clicable en Obsidian), marca lo que no sale del material y puede mostrar la página con `ver_pagina`. Cada clase deja su nota en `cursos/<curso>/sesiones/`.
- **Preparación por tema.** La primera vez que se estudia un tema, su material se prepara solo en segundo plano con un modelo de visión: transcribe páginas escaneadas o con fórmulas, separa los ítems de parciales y prácticos y los asigna a temas. La clase no espera a que termine.
- **Practicar como en el examen.** Los ejercicios son ítems reales del curso, corregidos con sus criterios, y la solución nunca se muestra antes del intento. Un ítem de parcial por tema queda reservado: `/simulacro` lo toma como en el examen, y ni ese ítem ni sus casi copias aparecen antes.
- **No perder nada.** `/fin` guarda el progreso en `cursos/<curso>/progreso.yaml` y `/progreso` sugiere el próximo tema. Un `/compact`, un `/resume` o cerrar la ventana no pierden la clase: `pi-learn -c` la retoma donde quedó.
- **Si falla algo externo** (red, cuota, Python, visión), la clase sigue con un aviso de una línea.

## Cómo está armado

| Parte | Qué es |
|---|---|
| `extensions/curso/` | comandos y tools del curso: sesión, material, progreso, preparación, researcher anclado, simulacro, presentación |
| `extensions/comun/` | selector en español y corte de turno, compartidos por las extensiones (pi no lo carga como extensión) |
| `extensions/quiz.ts`, `ask-user-question.ts`, `md-log.ts` | quizzes con nota, preguntas en popup y nota de la clase en Obsidian |
| `scripts/ingesta/` | ingesta, visión, segmentación de ítems y progreso, en Python (`uv`) |
| `skills/` | `teach` (original), `visualize`, `curso-nuevo`, `curso-agregar` |
| `modo-curso.md` | reglas del tutor con un curso activo; prevalece sobre `teach` en lo que regula y declara cada conflicto |
| `scripts/doctor` | chequeo de la instalación, sin red ni gasto de modelo |
| `config/` | lanzador fish `pi-learn` y configuración de tmux |
| `tests/` | suites Node (`node --test`) y Python (`unittest`) |

## Instalación

**Seguí [`SETUP.md`](SETUP.md); no alcanza con clonar.** En resumen:

1. Requisitos: pi `1.4.0`, Node.js, fish, tmux, uv, Tesseract con `spa` y `eng`. La lista completa, con versiones y qué pasa si falta cada una, está en SETUP.
2. El vault tiene que estar en `~/Projects/pi-learning`: el lanzador y la configuración lo suponen.
3. Clonar este repo como `.pi/` del vault, en la rama `cursos`:
   ```bash
   cd ~/Projects/pi-learning
   git clone -b cursos https://github.com/santi-esquerre/learn .pi
   ```
4. Instalar los paquetes de pi del proyecto, el venv de Python y el lanzador (comandos en SETUP), y apuntar `ruta_tesseract` de `curso.config.json` a tu Tesseract.
5. Comprobar con `node .pi/scripts/doctor`.
6. Abrir con `pi-learn`, no con `pi` a secas: así el tutor ve sólo las skills del proyecto. Desde ahí, seguí [`GET_STARTED.md`](GET_STARTED.md).

## Documentación

- [`GET_STARTED.md`](GET_STARTED.md): cómo se usa, de crear un curso a rendir el simulacro.
- [`SETUP.md`](SETUP.md): instalación, dependencias, uso de cada comando, doctor y pruebas.
- [`DECISIONES.md`](DECISIONES.md): por qué cada cosa es como es.
- [`informes/`](informes/): informes de cada fase de la implementación.

Algunos documentos citados en SETUP (`AUDITORIA.md`, `PRUEBA-MANUAL.md`, `fricciones.md`) viven en la raíz del vault y no en este repo, porque mezclan datos del curso propio.
