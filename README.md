# learn

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

My AI learning system from this video: [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

This is a personal system I built for myself, shared as-is. Built as a pi configuration: the teaching philosophy encoded in a skill, a few small extensions, and agent definitions.

## Modo curso (este fork)

Este fork suma un modo curso para estudiar una materia con su propio material, dentro de un vault de Obsidian (`~/Projects/pi-learning`). `teach` queda intacto; mientras hay un curso activo, `modo-curso.md` prevalece sobre él en lo que regula y declara cada conflicto (probe con tope, objetivo propuesto por el curso, plan aprobado con botones, popups sin LaTeX).

- **Crear o ampliar un curso:** `/curso-nuevo <slug>` y `/curso-agregar <slug>` arman contrato e índice desde los PDFs de `_entrada/` (todo cambio a un curso ya guardado, con diff y confirmación) e ingieren todas las páginas en local, sin modelo.
- **Estudiar:** `/estudiar <curso> <tema>` abre la clase con su nota en Obsidian, citas a la página del PDF y quizzes en español. La primera vez que se estudia un tema, su material se prepara solo en segundo plano con el modelo de visión (transcripción, ítems de parciales y prácticos, asignación por tema). `/simulacro` rinde, como en el examen, una pregunta de parcial del tema que se reservó para eso. `/fin` guarda el progreso; `/progreso` sugiere el próximo tema.
- **Componentes:** `extensions/curso/` (comandos y tools), `scripts/ingesta/` (ingesta y backend en Python), `skills/curso-nuevo/`, `skills/curso-agregar/`, `scripts/doctor` y `config/` (lanzador `pi-learn` y tmux).

Se abre con `pi-learn`, no con `pi` a secas: así el tutor sólo ve las skills del proyecto. El researcher del curso corre como un `pi -p` propio y no necesita subagentes. Instalación, dependencias (también las globales), uso, doctor y pruebas: [`SETUP.md`](SETUP.md). Por qué cada cosa es como es: [`DECISIONES.md`](DECISIONES.md). Para este fork no uses el `git clone` de «Install»: seguí `SETUP.md`.

## What's in it

- `skills/teach/` — the philosophy and the process
- `skills/visualize/` — adds a correct, minimal diagram to a lesson when an idea is clearer as a picture
- `extensions/ask-user-question.ts` — the agent asks you questions through a UI popup
- `extensions/quiz.ts` — graded questions with instant feedback (✓/✗, correct answer, explanation)
- `extensions/md-log.ts` — link a markdown file to the session
- `extensions/visual-tools/` — tools for visualization subagents
- `agents/` — `researcher`, `svg-maker`, `mermaid-maker`: the subagents the system delegates to

## Install

This repo **is** a `.pi` directory. From your learning project's root:

```bash
git clone https://github.com/amosblomqvist/learn .pi
```

Then open pi in that directory. (Or copy the pieces you want into your existing project config.)

## Requirements

- [pi](https://github.com/earendil-works/pi)
- A subagent implementation, so the system can spawn the researcher and the visual makers. Recommended: [pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents) (tmux only). With it, everything works out of the box. Any other implementation works too, but expect to adapt the agent definitions in `agents/`.
- `ask-user-question` — use the copy bundled here. If your setup already has an `ask-user-question` extension, use **this** one in its place. Popups from different extensions serialize through a shared UI lock, which only works when it's the same implementation.

## Notes

You can run the system without subagents. The main session does the teaching. You just lose the researcher (truth verification) and the generated visuals.

The teaching skill is written for one learner (me). Edit the skill to fit how you learn best.
