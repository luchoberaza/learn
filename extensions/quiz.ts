import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import {
	Container,
	Editor,
	type EditorTheme,
	Key,
	Markdown,
	Spacer,
	Text,
	matchesKey,
	truncateToWidth,
	wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { cortable } from "./comun/corte.ts";
import { preguntarConApp } from "./comun/preguntar.ts";

// ────────────────────────────────────────────────────────────────────────────
// quiz — a GRADED sibling of ask_user_question.
//
// Where ask_user_question collects a preference/decision with no notion of
// right or wrong, `quiz` poses a question that HAS a correct answer, grades the
// user's selection instantly, and shows tight feedback (✓/✗ + the correct
// answer + an optional explanation) to both the user and the agent.
//
// It is intentionally options-only: single-select or multi-select. There is no
// free-text mode and no "Other" option, because a free-text answer can't be
// graded against a correct index.
// ────────────────────────────────────────────────────────────────────────────

interface QuizOption {
	label: string;
	value: string;
	description?: string;
}

interface DisplayOption extends QuizOption {
	id: string;
	index: number;
	isSubmit?: boolean;
}

interface OptionAnswer {
	label: string;
	value: string;
	index: number; // 1-based, matches the number shown to the user
}

// The always-present "I don't know" choice. It is NOT a real option: it never
// participates in shuffling, has no correct-answer value, and produces a
// distinct signal (dontKnow) rather than a right/wrong grade — so an honest
// "I don't know" is never confused with a lucky or unlucky guess.
const DONT_KNOW_VALUE = "__dont_know__";
const DONT_KNOW_LABEL = "No sé";
const DONT_KNOW_INDEX = 0; // real options are 1-based; submit uses -1

// Unified response from either ask* component. answers holds the real
// selections (empty when dontKnow); note is the optional free-text the user
// typed in the always-present note field (kept only when non-empty).
interface QuizResponse {
	dontKnow: boolean;
	note?: string;
	answers: OptionAnswer[];
}

type QuizStatus = "answered" | "cancelled" | "unavailable";
type QuizMode = "single-select" | "multi-select";

interface DisplayedOption {
	index: number; // 1-based, in the final (possibly shuffled) display order
	label: string;
}

interface QuizResultDetails {
	status: QuizStatus;
	question: string;
	context?: string;
	mode: QuizMode;
	answers: OptionAnswer[];
	correctIndices: number[];
	options?: DisplayedOption[]; // full option list in display order, for the transcript
	correct?: boolean;
	dontKnow?: boolean; // user selected "I don't know" instead of guessing
	note?: string; // optional free-text from the always-present note field (any answer)
	explanation?: string;
	message?: string;
	interno?: boolean; // no se mostró: faltaba la explicación (DA52); sólo lo ve el modelo
	clase?: string; // la explicación que se mostró antes de la pregunta (DA52)
}

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the answer option." }),
	value: Type.Optional(
		Type.String({ description: "Optional machine-readable value returned for the option. Defaults to the label." }),
	),
	description: Type.Optional(Type.String({ description: "Optional extra detail shown below the option. Give one to every option or to none; otherwise all are dropped." })),
});

const QuizParams = Type.Object({
	question: Type.String({
		description: "The single quiz question to ask. Ask exactly one question per tool call.",
	}),
	details: Type.Optional(
		Type.String({ description: "Optional conditions of the problem, shown under the question BEFORE the answer: never links or citations (they are removed; cite in explanation)." }),
	),
	options: Type.Array(OptionSchema, {
		description:
			"The real answer options: at least 3 for single-select (fewer is rejected), 2 or more for multi-select. Options only — there is no free-text mode. Give each option a stable `value`; you reference the correct one by that value in correctAnswer.",
		minItems: 2,
	}),
	multiSelect: Type.Optional(
		Type.Boolean({ description: "Set to true when more than one option is correct and the user must select all of them." }),
	),
	correctAnswer: Type.Union([Type.String(), Type.Array(Type.String())], {
		description:
			'REQUIRED. The correct answer as the option value(s) — the `value` field of the option you intend. Single-select: a single string (e.g. "mercury"). Multi-select: an array of strings (e.g. ["belize", "niue"]); the user is only correct if their selection matches this set exactly. Always pass the value, not a position number — this is self-checking and prevents miscounting.',
	}),
	explanation: Type.String({
		description:
			"REQUIRED. Explanation revealed AFTER the user answers (shown whether they got it right or wrong). Use it to reinforce why the correct answer is correct.",
	}),
	shuffle: Type.Optional(
		Type.Boolean({
			description:
				"Options are always randomly reordered before display. false is honored only when every option is a number (optionally with a unit, e.g. '1,2 ms'): they are then shown in ascending order.",
		}),
	),
	momento: Type.Optional(
		Type.Union([Type.Literal("diagnostico"), Type.Literal("verificacion")], {
			description:
				'"diagnostico" for a question of the initial diagnosis (probe), which may follow another question directly. Otherwise ("verificacion", the default) it checks something you explained, and that explanation must be in the visible text of your messages since the previous question: the learner never sees your reasoning or tool arguments. A verification question with no explanation since the previous one is not shown and comes back to you.',
		}),
	),
	clase: Type.Optional(
		Type.String({
			description:
				"The explanation this question checks, written for the learner and shown BEFORE the question (chat history, the app card and the note). Use it whenever you go straight to the question: the learner never sees your reasoning. Markdown and LaTeX allowed; never the answer to this question.",
		}),
	),
});

const SUPERINDICES: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺" };
const SUBINDICES: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋", "+": "₊" };
const SIMBOLOS: Record<string, string> = { times: "×", cdot: "·", to: "→", rightarrow: "→", le: "≤", leq: "≤", ge: "≥", geq: "≥", approx: "≈", neq: "≠", ne: "≠", pm: "±" };

// El popup es texto plano: el LaTeX común pasa a Unicode y lo que no se reconoce queda como está.
function textoPlano(texto: string): string {
	const operando = (x: string) => (/^[\p{L}\p{N}.,]+$/u.test(x) ? x : `(${x})`);
	const mapear = (tabla: Record<string, string>) => (_: string, llaves?: string, digito?: string) =>
		[...(llaves ?? digito ?? "")].map((c) => tabla[c]).join("");
	return texto
		.replace(/\$\$?([^$]+?)\$\$?/g, "$1")
		.replace(/\{,\}/g, ",")
		.replace(/\\(?:displaystyle|left|right)\b\s*/g, "")
		.replace(/\\(min|max)\b/g, (_, f) => (f === "min" ? "mín" : "máx"))
		.replace(/\\([{}])/g, "$1")
		.replace(/\s*\\([a-zA-Z]+)\s*/g, (m, c) => SIMBOLOS[c] ?? m)
		.replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, "$1")
		.replace(/\^(?:\{([-+]?\d+)\}|(\d))/g, mapear(SUPERINDICES))
		.replace(/_(?:\{([-+]?\d+)\}|(\d))/g, mapear(SUBINDICES))
		.replace(/_\{([\p{L}]+)\}/gu, "_$1")
		.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${operando(a)}/${operando(b)}`)
		.replace(/\\,/g, "\u2009")
		.replace(/\\%/g, "%");
}

// D5: antes de responder no se muestran enlaces (la página citada puede traer la respuesta); se conserva
// el texto visible de [[x|alias]], [texto](url) y [[nota]], y se descarta la línea que queda como rótulo vacío.
function sinEnlaces(texto: string): string {
	return texto
		.split("\n")
		.map((linea) => {
			const visible = linea
				.replace(/\[\[[^\]|]*\|([^\]]*)\]\]|\[([^\]]*)\]\([^)]*\)/g, "$1$2")
				.replace(/(?<!!)\[\[([^\]#/]+)\]\]/g, "$1");
			const resto = visible.replace(/!?\[\[[^\]]*\]\]|https?:\/\/\S+/g, "");
			if (resto === visible) return visible;
			const limpia = resto.replace(/\s{2,}/g, " ").trim();
			return /^(\p{L}+\s?){0,3}:?$/u.test(limpia) ? null : limpia;
		})
		.filter((linea) => linea !== null)
		.join("\n")
		.trim();
}

// shortcut: "1.200" se lee 1,2 (sólo afecta el orden mostrado); si aparece, aceptar separador de miles.
function valorNumerico(label: string): number | undefined {
	const m = /^(-?\d+(?:[.,]\d+)?)(?:\s\D*)?$/.exec(label);
	return m ? Number(m[1].replace(",", ".")) : undefined;
}

function normalizeOptions(
	options: Array<{ label: string; value?: string; description?: string }> | undefined,
): QuizOption[] {
	const seen = new Set<string>();
	return (options || [])
		.map((option) => ({
			label: textoPlano(option.label.trim()).trim(),
			value: option.value?.trim() || option.label.trim(),
			description: textoPlano(option.description?.trim() ?? "").trim() || undefined,
		}))
		.filter((option) => {
			if (option.label.length === 0) return false;
			if (seen.has(option.value)) throw new Error(`value repetido "${option.value}"`);
			seen.add(option.value);
			return true;
		});
}

// Fisher-Yates shuffle over a copy. Safe to reorder for display because
// correctAnswer is keyed by value, not position — indices are resolved AFTER
// shuffling, so grading always matches what the user actually sees.
function shuffleOptions(options: QuizOption[]): QuizOption[] {
	const out = [...options];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// Resolve author-supplied option value(s) to 1-based indices. Keying by value
// (not position) makes the correct answer self-documenting: the author writes
// `correctAnswer: "mercury"` and a typo becomes a hard error instead of a
// silent wrong grade.
// The harness sometimes delivers a multi-select `correctAnswer` array as a
// JSON-stringified string (e.g. '["a", "b"]') instead of a real array, because
// the schema union lists String first. Detect that case and parse it back into
// an array so grading resolves against real option values. A plain single value
// is wrapped as-is.
function coerceCorrectAnswer(correctAnswer: string | string[]): string[] {
	if (Array.isArray(correctAnswer)) return correctAnswer;
	const trimmed = correctAnswer.trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) return parsed.map((v) => String(v));
		} catch {
			// Not valid JSON — fall through and treat as a single literal value.
		}
	}
	return [correctAnswer];
}

function resolveCorrect(
	correctAnswer: string | string[] | undefined,
	options: QuizOption[],
): { indices: number[]; error?: string } {
	if (correctAnswer === undefined) return { indices: [], error: "falta correctAnswer" };
	const arr = coerceCorrectAnswer(correctAnswer);
	if (arr.length === 0) return { indices: [], error: "falta correctAnswer" };
	const byValue = new Map(options.map((o, i) => [o.value, i + 1]));
	const indices: number[] = [];
	for (const raw of arr) {
		const v = typeof raw === "string" ? raw.trim() : raw;
		const idx = byValue.get(v);
		if (idx === undefined) {
			const known = options.map((o) => `"${o.value}"`).join(", ");
			return { indices: [], error: `correctAnswer "${v}" no coincide con ningún value (${known})` };
		}
		indices.push(idx);
	}
	return { indices: Array.from(new Set(indices)).sort((a, b) => a - b) };
}

function createEditorTheme(theme: any): EditorTheme {
	return {
		borderColor: (s) => theme.fg("accent", s),
		selectList: {
			selectedPrefix: (t) => theme.fg("accent", t),
			selectedText: (t) => theme.fg("accent", t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		},
	};
}

function addWrapped(lines: string[], text: string, width: number, indent = ""): void {
	const contentWidth = Math.max(1, width - indent.length);
	for (const line of wrapTextWithAnsi(text, contentWidth)) {
		lines.push(truncateToWidth(`${indent}${line}`, width));
	}
}

function isCorrect(selectedIndices: number[], correctIndices: number[]): boolean {
	if (selectedIndices.length !== correctIndices.length) return false;
	const a = [...selectedIndices].sort((x, y) => x - y);
	const b = [...correctIndices].sort((x, y) => x - y);
	return a.every((v, i) => v === b[i]);
}

function buildStructuredResult(
	status: QuizStatus,
	question: string,
	mode: QuizMode,
	answers: OptionAnswer[],
	correctIndices: number[],
	correct: boolean | undefined,
	explanation: string | undefined,
	context?: string,
	message?: string,
	options?: DisplayedOption[],
	dontKnow?: boolean,
	note?: string,
): QuizResultDetails {
	return { status, question, context, mode, answers, correctIndices, options, correct, dontKnow, note, explanation, message };
}

function cancelledResult(question: string, mode: QuizMode, correctIndices: number[], context?: string) {
	const message = "Quiz cancelado sin respuesta.";
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("cancelled", question, mode, [], correctIndices, undefined, undefined, context, message),
	};
}

function unavailableResult(question: string, mode: QuizMode, message: string, correctIndices: number[], context?: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("unavailable", question, mode, [], correctIndices, undefined, undefined, context, message),
	};
}

function formatOptionRef(options: QuizOption[], index: number): string {
	const opt = options.find((o, i) => i + 1 === index);
	return `${index}. ${opt ? opt.label : "(desconocida)"}`;
}

// DA52: lo que el modelo lee justo antes de escribir. En una clase real, después de cada respuesta encadenaba otra pregunta
// sin texto, con la explicación sólo en su razonamiento; en el diagnóstico, en cambio, se sigue preguntando.
export const DESPUES_DE_RESPONDER = "Ahora, en el texto de tu mensaje (el alumno no ve tu razonamiento): qué estuvo bien o mal y la explicación que corresponda; recién después, otra pregunta.";

function buildResult(
	question: string,
	context: string | undefined,
	mode: QuizMode,
	options: QuizOption[],
	response: QuizResponse,
	correctIndices: number[],
	explanation: string | undefined,
	diagnostico = false,
) {
	const { dontKnow, note, answers } = response;
	const selectedIndices = answers.map((a) => a.index);
	// "I don't know" is never counted as correct — it's a distinct outcome.
	const correct = dontKnow ? false : isCorrect(selectedIndices, correctIndices);
	const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
	const displayedOptions: DisplayedOption[] = options.map((o, i) => ({ index: i + 1, label: o.label }));

	let text: string;
	if (dontKnow) {
		// Make the signal explicit for the agent: the user did NOT guess, so this
		// is a genuine knowledge gap, not a wrong answer to correct against.
		text = `El alumno eligió «No sé»: no intentó responder (es un hueco real, no un error).`;
		text += `\nCorrecta: ${correctStr}`;
		if (note) text += `\nNota del alumno: ${note}`;
	} else {
		const verdict = correct ? "bien" : "mal";
		const selectedStr = answers.map((a) => `${a.index}. ${a.label}`).join(", ");
		text = `El alumno respondió ${verdict}.\nEligió: ${selectedStr}\nCorrecta: ${correctStr}`;
		if (note) text += `\nNota del alumno: ${note}`;
	}
	if (explanation) text += `\nExplicación: ${explanation}`;
	if (!diagnostico) text += `\n${DESPUES_DE_RESPONDER}`;

	return {
		content: [{ type: "text" as const, text }],
		details: buildStructuredResult(
			"answered",
			question,
			mode,
			answers,
			correctIndices,
			correct,
			explanation,
			context,
			undefined,
			displayedOptions,
			dontKnow,
			note,
		),
	};
}

// Shared feedback block, rendered after the user submits.
function renderFeedback(
	lines: string[],
	theme: any,
	width: number,
	options: QuizOption[],
	selectedIndices: number[],
	correctIndices: number[],
	explanation: string | undefined,
	dontKnow = false,
	note?: string,
): void {
	const add = (text: string) => lines.push(truncateToWidth(text, width));
	const correct = !dontKnow && isCorrect(selectedIndices, correctIndices);
	const selectedSet = new Set(selectedIndices);
	const correctSet = new Set(correctIndices);

	lines.push("");
	for (let i = 0; i < options.length; i++) {
		const index = i + 1;
		const opt = options[i];
		const isSelected = selectedSet.has(index);
		const isKey = correctSet.has(index);
		let marker: string;
		let color: string;
		if (dontKnow) {
			// No guess was made — only reveal the correct answer(s); never show ✗.
			marker = isKey ? "✓" : " ";
			color = isKey ? "success" : "dim";
		} else if (isSelected && isKey) {
			marker = "✓";
			color = "success";
		} else if (isSelected && !isKey) {
			marker = "✗";
			color = "error";
		} else if (!isSelected && isKey) {
			// correct answer the user missed
			marker = "✓";
			color = "success";
		} else {
			marker = " ";
			color = "dim";
		}
		add(theme.fg(color, ` ${marker} ${index}. ${opt.label}`));
	}

	lines.push("");
	if (dontKnow) {
		add(theme.fg("warning", " · Respondiste: No sé"));
		const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
		addWrapped(lines, theme.fg("muted", `Respuesta correcta: ${correctStr}`), width, " ");
	} else if (correct) {
		add(theme.fg("success", " ✓ ¡Correcto!"));
	} else {
		add(theme.fg("error", " ✗ Incorrecto."));
		const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
		addWrapped(lines, theme.fg("muted", `Respuesta correcta: ${correctStr}`), width, " ");
	}
	if (note) {
		addWrapped(lines, theme.fg("muted", `Tu nota: ${note}`), width, " ");
	}
	if (explanation) {
		lines.push("");
		addWrapped(lines, theme.fg("text", textoPlano(explanation)), width, " ");
	}
	lines.push("");
	add(theme.fg("dim", " Enter o Esc para seguir"));
}

// Top border + question + optional context. Shared by both components.
function pushHeader(lines: string[], theme: any, width: number, question: string, context: string | undefined): void {
	lines.push(truncateToWidth(theme.fg("accent", "─".repeat(width)), width));
	addWrapped(lines, theme.fg("text", question), width, " ");
	if (context) {
		lines.push("");
		addWrapped(lines, theme.fg("muted", context), width, " ");
	}
}

// The "I don't know" row in the selection list — visually separated and dimmed
// so it reads as distinct from the real, gradable options.
function pushDontKnowRow(lines: string[], theme: any, width: number, focused: boolean): void {
	lines.push("");
	const prefix = focused ? theme.fg("accent", "> ") : "  ";
	const styled = focused ? theme.fg("accent", DONT_KNOW_LABEL) : theme.fg("dim", DONT_KNOW_LABEL);
	lines.push(truncateToWidth(`${prefix}${styled}`, width));
}

// Persistent, always-present note field rendered under the options during the
// select phase. Applies to ANY answer (including "I don't know") and is only
// surfaced to the agent when non-empty.
function pushNoteField(lines: string[], theme: any, width: number, editor: Editor, focused: boolean): void {
	lines.push("");
	const label = focused ? theme.fg("accent", "Nota (opcional):") : theme.fg("muted", "Nota (opcional):");
	addWrapped(lines, label, width, " ");
	for (const line of editor.render(width)) lines.push(line);
}

// Build the note Editor. `disableSubmit` is set because Enter must NOT submit
// here: the editor's submit path clears the buffer, which would wipe the note.
// Instead the host intercepts Enter to return focus to the options while
// keeping the text. Ctrl+J still inserts a newline (pi convention), so
// multi-line notes work.
function makeNoteEditor(tui: any, theme: any): Editor {
	const editor = new Editor(tui, createEditorTheme(theme));
	editor.focused = false;
	editor.disableSubmit = true;
	return editor;
}

async function askSingleChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: QuizOption[],
	correctIndices: number[],
	explanation: string | undefined,
	signal?: AbortSignal,
): Promise<QuizResponse | null> {
	const allOptions: DisplayOption[] = options.map((option, index) => ({
		...option,
		id: `option:${index}`,
		index: index + 1,
	}));
	const dontKnowNav = allOptions.length; // nav index of the "I don't know" row

	return ctx.ui.custom<QuizResponse | null>(
		(tui: any, theme: any, _kb: any, done: (result: QuizResponse | null) => void) => {
			let optionIndex = 0;
			let phase: "select" | "feedback" = "select";
			let focus: "options" | "note" = "options";
			let chosen: OptionAnswer | null = null;
			let dontKnow = false;
			const editor = makeNoteEditor(tui, theme);
			let cachedLines: string[] | undefined;
			let cachedWidth = -1;
			// /fin y /estudiar cortan el turno con ctx.abort(): el popup se cierra solo, como con Esc; una respuesta ya corregida se conserva.
			const cortar = () => done(phase === "feedback" ? response() : null);
			if (signal?.aborted) cortar();
			else signal?.addEventListener("abort", cortar, { once: true });

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function noteText(): string | undefined {
				const t = editor.getText().trim();
				return t.length ? t : undefined;
			}

			function toOptions() {
				focus = "options";
				editor.focused = false;
				refresh();
			}

			function response(): QuizResponse {
				const note = noteText();
				return dontKnow
					? { dontKnow: true, note, answers: [] }
					: { dontKnow: false, note, answers: chosen ? [chosen] : [] };
			}

			function handleInput(data: string) {
				if (phase === "feedback") {
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						done(response());
					}
					return;
				}

				// Tab toggles focus between the options list and the note field.
				if (matchesKey(data, Key.tab)) {
					focus = focus === "options" ? "note" : "options";
					editor.focused = focus === "note";
					refresh();
					return;
				}

				if (focus === "note") {
					// Enter and Esc both return to the options and keep the note text.
					// (Enter must be intercepted here: the editor's own submit clears
					// the buffer. Ctrl+J still reaches the editor as a newline.)
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						toOptions();
						return;
					}
					editor.handleInput(data);
					tui.requestRender();
					return;
				}

				// focus === "options"
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(dontKnowNav, optionIndex + 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					if (optionIndex === dontKnowNav) {
						dontKnow = true;
						chosen = null;
					} else {
						const selected = allOptions[optionIndex];
						chosen = { label: selected.label, value: selected.value, index: selected.index };
						dontKnow = false;
					}
					phase = "feedback";
					refresh();
					return;
				}
				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number): string[] {
				// The cache MUST be keyed on width: pi-tui calls requestRender() but NOT
				// invalidate() on terminal resize, so render() can be re-entered with a
				// new width. Returning stale wider lines trips the TUI width guard and
				// crashes the process.
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const add = (text: string) => lines.push(truncateToWidth(text, width));
				pushHeader(lines, theme, width, question, context);

				if (phase === "feedback") {
					renderFeedback(
						lines,
						theme,
						width,
						options,
						chosen ? [chosen.index] : [],
						correctIndices,
						explanation,
						dontKnow,
						noteText(),
					);
					add(theme.fg("accent", "─".repeat(width)));
					cachedLines = lines;
					cachedWidth = width;
					return lines;
				}

				lines.push("");
				for (let i = 0; i < allOptions.length; i++) {
					const option = allOptions[i];
					const selected = focus === "options" && i === optionIndex;
					const prefix = selected ? theme.fg("accent", "> ") : "  ";
					const label = `${option.index}. ${option.label}`;
					const styled = selected ? theme.fg("accent", label) : theme.fg("text", label);
					add(`${prefix}${styled}`);
					if (option.description) {
						addWrapped(lines, theme.fg("muted", option.description), width, "     ");
					}
				}

				pushDontKnowRow(lines, theme, width, focus === "options" && optionIndex === dontKnowNav);

				pushNoteField(lines, theme, width, editor, focus === "note");

				lines.push("");
				if (focus === "note") {
					add(theme.fg("dim", " Escribí la nota • Ctrl+J nueva línea • Enter o Esc vuelve a las opciones • Tab opciones"));
				} else {
					add(theme.fg("dim", " ↑↓ moverse • Enter responder • Tab nota • Esc cancelar"));
				}
				add(theme.fg("accent", "─".repeat(width)));
				// Not cached when the note is focused: the editor renders a live cursor.
				if (focus !== "note") {
					cachedLines = lines;
					cachedWidth = width;
				}
				return lines;
			}

			return {
				render,
				invalidate: () => {
					cachedLines = undefined;
					editor.invalidate();
				},
				handleInput,
				// El signal dura toda la corrida: cada popup cerrado suelta su listener.
				dispose: () => signal?.removeEventListener("abort", cortar),
			};
		},
	);
}

async function askMultiChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: QuizOption[],
	correctIndices: number[],
	explanation: string | undefined,
	signal?: AbortSignal,
): Promise<QuizResponse | null> {
	const DONT_KNOW_ID = "dont-know";
	const choiceItems: DisplayOption[] = options.map((option, index) => ({
		...option,
		id: `option:${index}`,
		index: index + 1,
	}));
	const dontKnowItem: DisplayOption = {
		id: DONT_KNOW_ID,
		label: DONT_KNOW_LABEL,
		value: DONT_KNOW_VALUE,
		index: DONT_KNOW_INDEX,
	};
	const submitItem: DisplayOption = { id: "submit", label: "Enviar", value: "__submit__", index: -1, isSubmit: true };
	const allItems: DisplayOption[] = [...choiceItems, dontKnowItem, submitItem];

	return ctx.ui.custom<QuizResponse | null>(
		(tui: any, theme: any, _kb: any, done: (result: QuizResponse | null) => void) => {
			let optionIndex = 0;
			let phase: "select" | "feedback" = "select";
			let focus: "options" | "note" = "options";
			const editor = makeNoteEditor(tui, theme);
			let cachedLines: string[] | undefined;
			let cachedWidth = -1;
			const selected = new Map<string, OptionAnswer>();
			// /fin y /estudiar cortan el turno con ctx.abort(): el popup se cierra solo, como con Esc; una respuesta ya corregida se conserva.
			const cortar = () => done(phase === "feedback" ? response() : null);
			if (signal?.aborted) cortar();
			else signal?.addEventListener("abort", cortar, { once: true });

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function noteText(): string | undefined {
				const t = editor.getText().trim();
				return t.length ? t : undefined;
			}

			function toOptions() {
				focus = "options";
				editor.focused = false;
				refresh();
			}

			const choseDontKnow = () => selected.has(DONT_KNOW_ID);
			const realAnswers = () =>
				sortAnswers(Array.from(selected.values()).filter((a) => a.index !== DONT_KNOW_INDEX));

			function response(): QuizResponse {
				const note = noteText();
				return choseDontKnow()
					? { dontKnow: true, note, answers: [] }
					: { dontKnow: false, note, answers: realAnswers() };
			}

			// "I don't know" is exclusive: choosing it clears real selections, and
			// choosing any real option clears "I don't know".
			function toggleOption(item: DisplayOption) {
				if (item.id === DONT_KNOW_ID) {
					if (selected.has(DONT_KNOW_ID)) {
						selected.delete(DONT_KNOW_ID);
					} else {
						selected.clear();
						selected.set(DONT_KNOW_ID, { label: item.label, value: item.value, index: item.index });
					}
				} else {
					selected.delete(DONT_KNOW_ID);
					if (selected.has(item.id)) {
						selected.delete(item.id);
					} else {
						selected.set(item.id, { label: item.label, value: item.value, index: item.index });
					}
				}
				refresh();
			}

			function submit() {
				if (selected.size === 0) return;
				phase = "feedback";
				refresh();
			}

			function handleInput(data: string) {
				if (phase === "feedback") {
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						done(response());
					}
					return;
				}

				// Tab toggles focus between the options list and the note field.
				if (matchesKey(data, Key.tab)) {
					focus = focus === "options" ? "note" : "options";
					editor.focused = focus === "note";
					refresh();
					return;
				}

				if (focus === "note") {
					// Enter and Esc both return to the options and keep the note text.
					// (Enter must be intercepted here: the editor's own submit clears
					// the buffer. Ctrl+J still reaches the editor as a newline.)
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						toOptions();
						return;
					}
					editor.handleInput(data);
					tui.requestRender();
					return;
				}

				// focus === "options"
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(allItems.length - 1, optionIndex + 1);
					refresh();
					return;
				}

				const current = allItems[optionIndex];
				if (matchesKey(data, Key.space)) {
					if (current.isSubmit) return;
					toggleOption(current);
					return;
				}

				if (matchesKey(data, Key.enter)) {
					if (current.isSubmit) {
						submit();
						return;
					}
					toggleOption(current);
					return;
				}

				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number): string[] {
				// The cache MUST be keyed on width: pi-tui calls requestRender() but NOT
				// invalidate() on terminal resize, so render() can be re-entered with a
				// new width. Returning stale wider lines trips the TUI width guard and
				// crashes the process.
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const add = (text: string) => lines.push(truncateToWidth(text, width));
				pushHeader(lines, theme, width, question, context);

				if (phase === "feedback") {
					renderFeedback(
						lines,
						theme,
						width,
						options,
						realAnswers().map((a) => a.index),
						correctIndices,
						explanation,
						choseDontKnow(),
						noteText(),
					);
					add(theme.fg("accent", "─".repeat(width)));
					cachedLines = lines;
					cachedWidth = width;
					return lines;
				}

				lines.push("");
				for (let i = 0; i < allItems.length; i++) {
					const item = allItems[i];
					const isFocused = focus === "options" && i === optionIndex;
					const prefix = isFocused ? theme.fg("accent", "> ") : "  ";

					if (item.isSubmit) {
						const label = selected.size > 0 ? `✓ ${item.label} (${selected.size} elegidas)` : `○ ${item.label}`;
						const styled = isFocused
							? theme.fg("accent", label)
							: theme.fg(selected.size > 0 ? "success" : "dim", label);
						add(`${prefix}${styled}`);
						continue;
					}

					if (item.id === DONT_KNOW_ID) {
						lines.push(""); // visual separation from the real options
						const checked = selected.has(item.id);
						const label = `${checked ? "[x]" : "[ ]"} ${item.label}`;
						const styled = isFocused ? theme.fg("accent", label) : theme.fg(checked ? "warning" : "dim", label);
						add(`${prefix}${styled}`);
						continue;
					}

					const checked = selected.has(item.id);
					const marker = checked ? "[x]" : "[ ]";
					const label = `${marker} ${item.index}. ${item.label}`;
					const styled = isFocused ? theme.fg("accent", label) : theme.fg(checked ? "success" : "text", label);
					add(`${prefix}${styled}`);
					if (item.description) {
						addWrapped(lines, theme.fg("muted", item.description), width, "     ");
					}
				}

				pushNoteField(lines, theme, width, editor, focus === "note");

				lines.push("");
				if (selected.size === 0) {
					add(theme.fg("warning", " Elegí al menos una respuesta antes de enviar."));
				}
				if (focus === "note") {
					add(theme.fg("dim", " Escribí la nota • Ctrl+J nueva línea • Enter o Esc vuelve a las opciones • Tab opciones"));
				} else {
					add(theme.fg("dim", " ↑↓ moverse • Espacio marcar • Enter enviar • Tab nota • Esc cancelar"));
				}
				add(theme.fg("accent", "─".repeat(width)));
				// Not cached when the note is focused: the editor renders a live cursor.
				if (focus !== "note") {
					cachedLines = lines;
					cachedWidth = width;
				}
				return lines;
			}

			return {
				render,
				invalidate: () => {
					cachedLines = undefined;
					editor.invalidate();
				},
				handleInput,
				// El signal dura toda la corrida: cada popup cerrado suelta su listener.
				dispose: () => signal?.removeEventListener("abort", cortar),
			};
		},
	);
}

function sortAnswers(answers: OptionAnswer[]): OptionAnswer[] {
	return [...answers].sort((a, b) => a.index - b.index);
}

// La app recibe las opciones en el orden ya barajado y la correcta para corregir en pantalla, como el popup; devuelve
// índices de ese mismo orden. Una respuesta sin opciones válidas (ni «No sé») vale como cancelada.
async function preguntarQuiz(
	app: NonNullable<ReturnType<typeof preguntarConApp>>,
	question: string,
	context: string | undefined,
	mode: QuizMode,
	options: QuizOption[],
	correctIndices: number[],
	explanation: string | undefined,
	signal?: AbortSignal,
	clase?: string,
): Promise<QuizResponse | null> {
	const r = await app({
		tipo: "quiz", pregunta: question, contexto: context, modo: mode, correctas: correctIndices, explicacion: explanation, ...(clase ? { clase } : {}),
		opciones: options.map((o, i) => ({ indice: i + 1, label: o.label, ...(o.description ? { description: o.description } : {}) })),
	}, signal);
	if (!r) return null;
	const answers = r.noSe ? [] : sortAnswers([...new Set(r.elegidas)].filter((i) => Number.isInteger(i) && i >= 1 && i <= options.length)
		.slice(0, mode === "single-select" ? 1 : undefined)
		.map((i) => ({ label: options[i - 1].label, value: options[i - 1].value, index: i })));
	if (!r.noSe && answers.length === 0) return null;
	const note = r.nota?.trim();
	return { dontKnow: r.noSe, ...(note ? { note } : {}), answers };
}

// Shared UI mutex. ctx.ui.custom()/editor can only handle one active call at
// a time, so ALL pop-up-style tools (quiz, ask_user_question, ...) must
// serialize against each other, not just against themselves. We stash one
// mutex on globalThis so separate extension files can share it without
// importing each other.
const SHARED_UI_LOCK_KEY = "__piSharedUiLock";
function getSharedUiLock() {
	const g = globalThis as any;
	if (!g[SHARED_UI_LOCK_KEY]) {
		let chain: Promise<void> = Promise.resolve();
		g[SHARED_UI_LOCK_KEY] = {
			withLock<T>(fn: () => T | Promise<T>): Promise<T> {
				const prev = chain;
				let release: () => void;
				chain = new Promise<void>((r) => { release = r; });
				return prev.then(fn).finally(() => release!());
			},
		};
	}
	return g[SHARED_UI_LOCK_KEY] as { withLock<T>(fn: () => T | Promise<T>): Promise<T> };
}
const sharedUiLock = getSharedUiLock();

function withUILock<T>(fn: () => Promise<T>): Promise<T> {
	return sharedUiLock.withLock(fn);
}

// DA52: el alumno no ve el razonamiento del modelo ni los argumentos de las tools. En una clase real el tutor escribía la
// explicación en su razonamiento («Te doy una analogía…») y preguntaba como si la hubiera dado. Una pregunta de
// verificación se muestra sólo si, desde la pregunta respondida anterior, el tutor escribió texto visible (también en el
// mensaje que la hace). Las del diagnóstico (momento: "diagnostico") pueden ir seguidas; sin pregunta anterior no se exige.
// Frena una sola vez seguida: en otra clase real el tutor reintentaba igual y terminaba preguntando por el chat.
// DA57: un mensaje del alumno también corta, porque lo escrito antes no le responde. Un alumno nuevo preguntó «¿por qué?»
// y recibió una pregunta sin explicación: en esa sesión no había ninguna respondida, y la guardia la dejaba pasar.
const PREGUNTAS = new Set(["quiz", "pregunta_desarrollo"]);
const MINIMO_EXPLICACION = 120;
// Devuelve cuánto texto visible hubo si no alcanza, o undefined si la pregunta se puede mostrar.
export function faltaExplicacion(ctx: any, toolCallId: string, clase = ""): number | undefined {
	let rama: any[];
	try {
		rama = ctx?.sessionManager?.getBranch?.() ?? [];
	} catch {
		return undefined;
	}
	let texto = clase.trim().length;
	for (let i = rama.length - 1; i >= 0; i--) {
		const m = rama[i]?.type === "message" ? rama[i].message : undefined;
		if (m?.role === "assistant") {
			for (const b of m.content ?? []) if (b?.type === "text" && typeof b.text === "string") texto += b.text.trim().length;
		} else if (m?.role === "user") {
			return texto < MINIMO_EXPLICACION ? texto : undefined;
		} else if (m?.role === "toolResult" && PREGUNTAS.has(m.toolName) && m.details?.interno) {
			return undefined;
		} else if (m?.role === "toolResult" && PREGUNTAS.has(m.toolName) && m.toolCallId !== toolCallId && m.details?.status === "answered") {
			return texto < MINIMO_EXPLICACION ? texto : undefined;
		}
	}
	return undefined;
}
const sinExplicacion = (caracteres: number) =>
	`Pregunta no mostrada: desde la pregunta anterior o el último mensaje del alumno escribiste ${caracteres} caracteres de texto visible, y el alumno no ve tu razonamiento ni los argumentos de las tools. Poné en el campo clase de esta misma herramienta la explicación de lo que esta pregunta verifica (si el alumno te preguntó algo, empezá por responderle), con el ejemplo y qué estuvo bien o mal en su respuesta (se le muestra al alumno antes de la pregunta), o escribila como texto antes de llamarla. No la pases al chat ni le cuentes al alumno de este aviso. Si es una pregunta del diagnóstico, pasá momento: "diagnostico".`;

// ────────────────────────────────────────────────────────────────────────────
// pregunta_desarrollo — la que se responde escribiendo (DA52). Tiene una respuesta correcta, como el quiz, pero no se
// corrige sola: el alumno escribe (o elige «No sé»), ve la respuesta esperada y el tutor lo corrige en su mensaje
// siguiente. La respuesta esperada nunca se muestra ni se anota antes de responder.
// ────────────────────────────────────────────────────────────────────────────

interface DesarrolloDetails {
	status: QuizStatus;
	tipo: "desarrollo";
	question: string;
	context?: string;
	answer?: string;
	dontKnow?: boolean;
	expected?: string;
	message?: string;
	interno?: boolean;
	clase?: string;
}

const DesarrolloParams = Type.Object({
	pregunta: Type.String({ description: "La pregunta, una sola por llamada. Se responde escribiendo." }),
	detalles: Type.Optional(
		Type.String({ description: "Condiciones del enunciado, debajo de la pregunta y ANTES de responder: nunca la respuesta, enlaces ni citas (se quitan; la cita va en respuesta_esperada)." }),
	),
	respuesta_esperada: Type.String({
		description: "OBLIGATORIA. La respuesta completa que esperás, con lo que no puede faltar. Se muestra DESPUÉS de que el alumno responde y es contra lo que lo corregís.",
	}),
	momento: Type.Optional(
		Type.Union([Type.Literal("diagnostico"), Type.Literal("verificacion")], {
			description:
				"«diagnostico» para una pregunta del diagnóstico inicial, que puede seguir a otra pregunta. Si no («verificacion», por defecto), verifica algo que explicaste, y esa explicación tiene que estar en el texto visible de tus mensajes desde la pregunta anterior: el alumno nunca ve tu razonamiento ni los argumentos de las tools. Sin explicación desde la anterior, la pregunta no se muestra y vuelve a vos.",
		}),
	),
	clase: Type.Optional(
		Type.String({
			description:
				"La explicación que esta pregunta verifica, escrita para el alumno: se muestra ANTES de la pregunta (en el historial, la tarjeta de la app y la nota). Usala siempre que vayas directo a la pregunta: el alumno nunca ve tu razonamiento. Admite Markdown y LaTeX; nunca la respuesta de esta pregunta.",
		}),
	),
});

type Desarrollo = { noSe: boolean; texto?: string };

async function askDesarrollo(ctx: any, question: string, context: string | undefined, expected: string, signal?: AbortSignal): Promise<Desarrollo | null> {
	return ctx.ui.custom<Desarrollo | null>((tui: any, theme: any, _kb: any, done: (result: Desarrollo | null) => void) => {
		let phase: "escribir" | "feedback" = "escribir";
		let focus: "editor" | "nose" = "editor";
		let respuesta: Desarrollo | null = null;
		const editor = new Editor(tui, createEditorTheme(theme));
		editor.focused = true;
		// Una respuesta ya mostrada con la esperada se conserva aunque corten el turno, como el quiz corregido.
		const cortar = () => done(phase === "feedback" ? respuesta : null);
		if (signal?.aborted) cortar();
		else signal?.addEventListener("abort", cortar, { once: true });
		const responder = (r: Desarrollo) => {
			respuesta = r;
			phase = "feedback";
			editor.focused = false;
			tui.requestRender();
		};
		// Enter manda lo escrito; vacío no cuenta como respuesta (para eso está «No sé»).
		editor.onSubmit = (value: string) => {
			if (value.trim()) responder({ noSe: false, texto: value.trim() });
		};

		function render(width: number): string[] {
			const lines: string[] = [];
			const add = (text: string) => lines.push(truncateToWidth(text, width));
			pushHeader(lines, theme, width, question, context);
			lines.push("");
			if (phase === "feedback" && respuesta) {
				if (respuesta.noSe) add(theme.fg("warning", " · Respondiste: No sé"));
				else {
					add(theme.fg("muted", " Tu respuesta:"));
					addWrapped(lines, theme.fg("text", respuesta.texto ?? ""), width, "   ");
				}
				lines.push("");
				add(theme.fg("muted", " Respuesta esperada:"));
				addWrapped(lines, theme.fg("text", textoPlano(expected)), width, "   ");
				lines.push("");
				add(theme.fg("dim", " El tutor te corrige ahora. Enter o Esc para seguir"));
			} else {
				for (const line of editor.render(Math.max(1, width - 2))) add(` ${line}`);
				lines.push("");
				const enNose = focus === "nose";
				add(`${enNose ? theme.fg("accent", "> ") : "  "}${enNose ? theme.fg("accent", DONT_KNOW_LABEL) : theme.fg("dim", DONT_KNOW_LABEL)}`);
				lines.push("");
				add(theme.fg("dim", enNose ? " Enter: No sé • Tab volver a escribir • Esc cancelar" : " Escribí tu respuesta • Enter enviar • Ctrl+J nueva línea • Tab «No sé» • Esc cancelar"));
			}
			add(theme.fg("accent", "─".repeat(width)));
			return lines;
		}

		return {
			render,
			invalidate: () => editor.invalidate(),
			handleInput(data: string) {
				if (phase === "feedback") {
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) done(respuesta);
					return;
				}
				if (matchesKey(data, Key.escape)) return done(null);
				if (matchesKey(data, Key.tab)) {
					focus = focus === "editor" ? "nose" : "editor";
					editor.focused = focus === "editor";
					tui.requestRender();
					return;
				}
				if (focus === "nose") {
					if (matchesKey(data, Key.enter)) responder({ noSe: true });
					return;
				}
				editor.handleInput(data);
				tui.requestRender();
			},
			dispose: () => signal?.removeEventListener("abort", cortar),
		};
	});
}

// La app dibuja la tarjeta y muestra la respuesta esperada recién después de responder (app/host/interfaz.mjs).
async function preguntarDesarrollo(
	app: NonNullable<ReturnType<typeof preguntarConApp>>,
	question: string,
	context: string | undefined,
	expected: string,
	signal?: AbortSignal,
	clase?: string,
): Promise<Desarrollo | null> {
	const r = await app({ tipo: "desarrollo", pregunta: question, contexto: context, esperada: expected, ...(clase ? { clase } : {}) }, signal);
	if (!r) return null;
	if (r.noSe) return { noSe: true };
	const texto = typeof r.texto === "string" ? r.texto.trim() : "";
	return texto ? { noSe: false, texto } : null;
}

// En la terminal la explicación de la pregunta queda en el historial, con formato, justo arriba de la pregunta (DA52).
// Llega a medias mientras el modelo escribe: se dibuja lo que haya. Sin tema de la terminal (pruebas), va como texto.
function conClase(clase: unknown, linea: Text) {
	if (typeof clase !== "string" || !clase.trim()) return linea;
	const c = new Container();
	try {
		// El tema de pi se resuelve al dibujar: se prueba acá, para no romper el dibujo de la llamada.
		const md = new Markdown(clase.trim(), 0, 0, getMarkdownTheme());
		md.render(80);
		c.addChild(md);
	} catch {
		c.addChild(new Text(clase.trim(), 0, 0));
	}
	c.addChild(new Spacer(1));
	c.addChild(linea);
	return c;
}

function resultadoDesarrollo(status: QuizStatus, base: Pick<DesarrolloDetails, "question" | "context" | "clase">, texto: string, extra: Partial<DesarrolloDetails> = {}) {
	return { content: [{ type: "text" as const, text: texto }], details: { status, tipo: "desarrollo", ...base, ...extra } as DesarrolloDetails };
}

export default function quiz(pi: ExtensionAPI) {
	pi.registerTool({
		name: "quiz",
		label: "quiz",
		description:
			"Ask the user a GRADED question with a known correct answer, then instantly grade and give feedback. Unlike ask_user_question (which collects preferences/decisions with no right answer), quiz always has a correct answer supplied by you, marks the user's selection right/wrong (✓/✗), reveals the correct answer, and can show an explanation. Use it to (1) assess what the learner already understands before teaching, and (2) run tight practice/retrieval loops after explaining, or probe understanding whenever you're unsure they've got it. Options-only: single-select or multi-select, plus an automatic 'No sé' (I don't know) choice so the user can signal a genuine gap instead of guessing. An always-present optional note field (Tab to focus it) lets the user attach a free-text note to ANY answer; it reaches you only when non-empty. No free-text answers — for non-graded questions use ask_user_question instead. The popup is plain text: write question, details and options in plain text with Unicode (1,2 ms; 8×10⁶ bit/s; d_prop), never LaTeX; LaTeX goes only in explanation.",
		promptSnippet:
			"Use the quiz tool to test the user with a graded multiple-choice or multi-select question (required correct answer + required explanation). For non-graded questions, use ask_user_question.",
		promptGuidelines: [
			"quiz is GRADED; ask_user_question is not. If the question has a correct answer, use quiz. If you just need a preference, decision, or open-ended input, use ask_user_question.",
			'correctAnswer is REQUIRED and is the option value, not a position number. Single-select: one string (e.g. "mercury"). Multi-select: an array of strings (e.g. ["belize", "niue"]).',
			"Always pass the option's `value` string as correctAnswer — it is self-checking and prevents miscounting positions. A value that matches no option is a hard error.",
			"explanation is REQUIRED — always say why the correct answer is correct.",
			"Multi-select is graded as an exact-set match: the user is correct only if they select every correct option and no incorrect ones.",
			"There is no free-text mode. A 'No sé' (I don't know) choice is ALWAYS added automatically, always last — provide ONLY the real, gradable options (at least three for single-select). Never add your own uncertainty/opt-out option like 'No sé', 'No estoy seguro', or 'Ni idea'; that is handled for you and a manual one would be redundant or gradable-as-wrong.",
			"If a result comes back as dontKnow, the user honestly did not know and did NOT guess — treat it as a genuine knowledge gap to teach into, not as a wrong answer.",
			"Any answer (right, wrong, or 'No sé') may carry an optional free-text `note` the user typed in the always-present note field. When present it reflects what they were thinking or unsure about — read it and let it steer your follow-up. It is omitted entirely when empty.",
			"Treat each wrong answer (distractor) as a diagnostic probe, not just filler: make it a specific, believable mistake the user might actually hold — a common misconception, or an adjacent/easily-confused concept — so that WHICH wrong answer they pick reveals WHICH nuance of their understanding is off. You learn far more from a targeted wrong choice than from a binary right/wrong, and the choice tells you exactly which gap to teach into next (and what the explanation should address).",
			"Guardrail: every distractor must be unambiguously wrong on the intended reading — tempting, but a real error, not a defensible alternative. Don't drift into trick questions.",
			"Anti-guessing hygiene: don't let the correct answer stand out by form (longest, most precise, most hedged, or the only one in the right format). Keep options similar in length, specificity, and phrasing so it can't be picked from shape alone.",
			"Set multiSelect: true only when more than one option is correct.",
			"Options are always shuffled before display, so don't worry about which position you list the correct answer in; shuffle: false only puts all-numeric options in ascending order. Don't use 'All/None of the above' options.",
			"To probe nuance, ask several quick quiz questions and adapt each one based on the previous answers, rather than writing one giant question.",
			'The learner sees only the visible text of your messages, never your reasoning nor tool arguments. Every explanation a question checks (motivation, the idea, the example, the connection) goes in the clase field of that question, shown right before it, or in the visible text of your message; the explanation field appears only after answering and does not replace teaching. Pass momento: "diagnostico" only for questions of the initial diagnosis.',
			"Don't leak the answer through formatting: keep option phrasing/length even and don't hint which is correct.",
		],
		parameters: QuizParams,

		execute: cortable(pi, async (_toolCallId, params, signal, onUpdate, ctx) => {
			const question = sinEnlaces(textoPlano(params.question));
			const context = sinEnlaces(textoPlano(params.details?.trim() ?? "")) || undefined;
			const explanation = params.explanation.trim();
			const mode: QuizMode = params.multiSelect ? "multi-select" : "single-select";
			const clase = typeof params.clase === "string" && params.clase.trim() ? params.clase.trim() : undefined;
			const escrito = params.momento === "diagnostico" ? undefined : faltaExplicacion(ctx, _toolCallId, clase);
			if (escrito !== undefined) {
				return {
					content: [{ type: "text" as const, text: sinExplicacion(escrito) }],
					details: { ...buildStructuredResult("unavailable", question, mode, [], [], undefined, undefined, context), interno: true },
				};
			}

			let options: QuizOption[];
			try {
				options = normalizeOptions(params.options);
			} catch (e) {
				return unavailableResult(question, mode, `quiz: ${(e as Error).message}`, [], context);
			}

			// D1, único rechazo: con 2 opciones se acierta al 50 % (las de rumbo van por ask_user_question).
			// details.message lo ven el alumno y el log; content, sólo el modelo.
			if (mode === "single-select" && options.length < 3) {
				return {
					...unavailableResult(question, mode, "Pregunta descartada por tener menos de 3 opciones; ya viene otra.", [], context),
					content: [{ type: "text" as const, text: "quiz: hacen falta al menos 3 opciones reales además de «No sé»; volvé a llamarlo con 3 o más." }],
				};
			}

			// D3: descriptions en todas o en ninguna; asimétricas delatan la correcta.
			if (!options.every((o) => o.description)) options = options.map((o) => ({ ...o, description: undefined }));

			// Shuffle for display BEFORE resolving correct indices, so grading matches
			// the order the user sees. D2: shuffle:false sólo ordena opciones numéricas.
			if (params.shuffle === false && options.every((o) => valorNumerico(o.label) !== undefined)) {
				options = [...options].sort((a, b) => valorNumerico(a.label)! - valorNumerico(b.label)!);
			} else {
				options = shuffleOptions(options);
			}

			// Emit the true (post-shuffle) display order immediately, before the UI
			// blocks on the user's answer. Listeners such as md-log rely on this to
			// show the question in the SAME order the user actually sees it, instead
			// of the pre-shuffle order the agent originally wrote in its tool call.
			// Deliberately omits correctIndices/explanation — this fires before the
			// user has answered and must not leak the answer.
			onUpdate?.({
				content: [{ type: "text", text: "Esperando respuesta…" }],
				details: { question, context, options: options.map((o, i) => ({ index: i + 1, label: o.label })), ...(clase ? { clase } : {}) },
			});

			const { indices: correctIndices, error: correctError } = resolveCorrect(
				params.correctAnswer as string | string[],
				options,
			);

			if (signal?.aborted) {
				return cancelledResult(question, mode, correctIndices, context);
			}

			if (options.length < 2) {
				return unavailableResult(
					question,
					mode,
					"quiz: hacen falta al menos dos opciones.",
					correctIndices,
					context,
				);
			}

			if (correctError) {
				return unavailableResult(question, mode, `quiz: ${correctError}`, correctIndices, context);
			}

			if (!ctx.hasUI) {
				return unavailableResult(question, mode, "quiz: hace falta la interfaz interactiva.", correctIndices, context);
			}

			return withUILock(async () => {
				// Con la app de escritorio la pregunta se dibuja allá; en la terminal, el popup de siempre.
				const app = preguntarConApp(ctx);
				const response = app
					? await preguntarQuiz(app, question, context, mode, options, correctIndices, explanation, signal, clase)
					: mode === "single-select"
						? await askSingleChoice(ctx, question, context, options, correctIndices, explanation, signal)
						: await askMultiChoice(ctx, question, context, options, correctIndices, explanation, signal);
				const r = response ? buildResult(question, context, mode, options, response, correctIndices, explanation, params.momento === "diagnostico") : cancelledResult(question, mode, correctIndices, context);
				return clase ? { ...r, details: { ...r.details, clase } } : r;
			});
		}),

		renderCall(args, theme) {
			// NOTE: never render correctAnswer or explanation here — it would leak
			// the answer into the transcript before the user responds. We also do NOT
			// enumerate the options here: they are shuffled at execute time, so any
			// order shown during streaming would be stale/misleading. The full option
			// list is rendered — in its true display order — by renderResult after the
			// user answers.
			// Los args llegan a medias durante el streaming ({} en la opción en curso): si esto lanzara, pi
			// mostraría los args crudos (LaTeX, enlaces y, expandido, la respuesta).
			const n = Array.isArray(args.options) ? args.options.filter((o: any) => o?.label?.trim?.()).length : 0;
			let text = theme.fg("toolTitle", theme.bold("quiz ")) + theme.fg("muted", sinEnlaces(textoPlano(args.question || "")));
			if (args.multiSelect) {
				text += theme.fg("dim", " [varias respuestas]");
			}
			if (n > 0) {
				text += theme.fg("dim", ` (${n} ${n === 1 ? "opción" : "opciones"})`);
			}
			return conClase(args.clase, new Text(text, 0, 0));
		},

		renderResult(result, _options, theme) {
			const details = result.details as QuizResultDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}
			// Resultado parcial (el onUpdate previo a la respuesta): sólo trae options.
			if (!details.answers) return new Text(theme.fg("dim", "Esperando respuesta…"), 0, 0);

			if (details.status === "cancelled") {
				return new Text(theme.fg("warning", details.message || "Cancelado"), 0, 0);
			}
			if (details.interno) return new Text(theme.fg("dim", "(la pregunta vuelve después de la explicación)"), 0, 0);
			if (details.status === "unavailable") {
				return new Text(theme.fg("warning", details.message || "Quiz no disponible"), 0, 0);
			}

			const correctSet = new Set(details.correctIndices);
			const selectedSet = new Set(details.answers.map((a) => a.index));
			const lines: string[] = [];

			// Full option list in the true (shuffled) display order, with ✓/✗ marks.
			// Falls back to just the selected answers for older results that predate
			// details.options.
			const displayed =
				details.options && details.options.length > 0
					? details.options
					: details.answers.map((a) => ({ index: a.index, label: a.label }));

			for (const opt of displayed) {
				const isSelected = selectedSet.has(opt.index);
				const isKey = correctSet.has(opt.index);
				let mark: string;
				let body: string;
				if (details.dontKnow) {
					// No guess — only reveal the correct answer(s); never show ✗.
					mark = isKey ? theme.fg("success", "✓ ") : "  ";
					body = isKey ? theme.fg("success", `${opt.index}. ${opt.label}`) : theme.fg("dim", `${opt.index}. ${opt.label}`);
				} else if (isSelected && isKey) {
					mark = theme.fg("success", "✓ ");
					body = theme.fg("accent", `${opt.index}. ${opt.label}`);
				} else if (isSelected && !isKey) {
					mark = theme.fg("error", "✗ ");
					body = theme.fg("error", `${opt.index}. ${opt.label}`);
				} else if (!isSelected && isKey) {
					mark = theme.fg("success", "✓ ");
					body = theme.fg("success", `${opt.index}. ${opt.label}`);
				} else {
					mark = "  ";
					body = theme.fg("dim", `${opt.index}. ${opt.label}`);
				}
				lines.push(`${mark}${body}`);
			}

			lines.push("");
			const verdict = details.dontKnow
				? theme.fg("warning", "No sé")
				: details.correct
					? theme.fg("success", "¡Correcto!")
					: theme.fg("error", "Incorrecto");
			lines.push(verdict);

			if (details.note) {
				lines.push(theme.fg("muted", `Nota: ${details.note}`));
			}

			if (details.explanation) {
				lines.push(theme.fg("muted", textoPlano(details.explanation)));
			}

			return new Text(lines.join("\n"), 0, 0);
		},
	});

	pi.registerTool({
		name: "pregunta_desarrollo",
		label: "pregunta de desarrollo",
		description:
			"Hacé una pregunta CON respuesta correcta que el alumno responde escribiendo con sus palabras, en vez de elegir entre opciones. Igual que quiz, sirve para el diagnóstico y para verificar o repasar lo enseñado; agrega un «No sé» automático. Después de que responde ve la respuesta esperada, y a vos te llega lo que escribió para que lo corrijas. La pregunta y los detalles son texto plano con Unicode (1,2 ms; 8×10⁶ bit/s; d_prop), nunca LaTeX; LaTeX sólo en respuesta_esperada.",
		promptSnippet: "Usá pregunta_desarrollo para una pregunta con respuesta correcta que se responde escribiendo (respuesta_esperada obligatoria). Para elegir entre opciones, quiz.",
		promptGuidelines: [
			"pregunta_desarrollo y quiz tienen respuesta correcta; ask_user_question no. Elegí entre quiz y pregunta_desarrollo según la mezcla de preguntas de la clase, si la hay.",
			"Una pregunta acotada, que se conteste en pocas líneas: definir con sus palabras, explicar por qué, aplicar a un caso no mostrado, calcular y decir el resultado con su unidad. Para un ejercicio largo con cuentas o dibujos, pedilo en el chat, donde puede mandar foto.",
			"respuesta_esperada es OBLIGATORIA y completa: lo que no puede faltar para que esté bien. Nunca la adelantes en pregunta ni en detalles.",
			"Después de responder, corregí en tu mensaje siguiente: decí si está bien, a medias o mal; qué está bien, citando su frase; qué falta o qué está mal y de qué concepto o nodo viene. Aceptá otras formas de decir lo mismo y no exijas las palabras exactas de respuesta_esperada.",
			"«No sé» es un hueco real, no un error: enseñalo. Nunca agregues vos un «No sé»: lo pone la herramienta.",
			"El alumno sólo ve el texto visible de tus mensajes, nunca tu razonamiento ni los argumentos de las tools: la explicación que la pregunta verifica va en clase, que se muestra justo antes, o en el texto de tu mensaje. momento: «diagnostico» sólo en el diagnóstico inicial.",
		],
		parameters: DesarrolloParams,

		execute: cortable(pi, async (_toolCallId, params, signal, onUpdate, ctx) => {
			const clase = typeof params.clase === "string" && params.clase.trim() ? params.clase.trim() : undefined;
			const base = { question: sinEnlaces(textoPlano(params.pregunta ?? "")).trim(), context: sinEnlaces(textoPlano(params.detalles?.trim() ?? "")) || undefined, ...(clase ? { clase } : {}) };
			const expected = typeof params.respuesta_esperada === "string" ? params.respuesta_esperada.trim() : "";
			if (!base.question || !expected) {
				return {
					...resultadoDesarrollo("unavailable", base, "", { message: "Pregunta descartada; ya viene otra." }),
					content: [{ type: "text" as const, text: "pregunta_desarrollo: hacen falta pregunta y respuesta_esperada; volvé a llamarla con las dos." }],
				};
			}
			const escrito = params.momento === "diagnostico" ? undefined : faltaExplicacion(ctx, _toolCallId, clase);
			if (escrito !== undefined) {
				return { content: [{ type: "text" as const, text: sinExplicacion(escrito) }], details: { status: "unavailable", tipo: "desarrollo", ...base, interno: true } as DesarrolloDetails };
			}
			// md-log anota la pregunta con lo que ve el alumno, sin la respuesta esperada.
			onUpdate?.({ content: [{ type: "text", text: "Esperando respuesta…" }], details: { tipo: "desarrollo", ...base } });
			const cancelada = () => resultadoDesarrollo("cancelled", base, "Pregunta de desarrollo cancelada sin respuesta.", { message: "Pregunta cancelada sin respuesta." });
			if (signal?.aborted) return cancelada();
			if (!ctx.hasUI) return resultadoDesarrollo("unavailable", base, "pregunta_desarrollo: hace falta la interfaz interactiva.", { message: "pregunta_desarrollo: hace falta la interfaz interactiva." });

			return withUILock(async () => {
				const app = preguntarConApp(ctx);
				const r = app ? await preguntarDesarrollo(app, base.question, base.context, expected, signal, clase) : await askDesarrollo(ctx, base.question, base.context, expected, signal);
				if (!r) return cancelada();
				const esperada = `\nRespuesta esperada: ${expected}`;
				if (r.noSe) {
					return resultadoDesarrollo("answered", base, `El alumno eligió «No sé»: no intentó responder (es un hueco real, no un error).${esperada}${params.momento === "diagnostico" ? "" : `\n${DESPUES_DE_RESPONDER}`}`, { dontKnow: true, expected });
				}
				return resultadoDesarrollo("answered", base,
					`El alumno respondió escribiendo:\n«${r.texto}»${esperada}\nCorregilo en el texto de tu mensaje siguiente (el alumno no ve tu razonamiento): bien, a medias o mal; qué está bien, qué falta y de qué nodo viene el error. Recién después, otra pregunta.`,
					{ answer: r.texto, dontKnow: false, expected });
			});
		}),

		renderCall(args, theme) {
			// Nunca respuesta_esperada: llega antes de que el alumno responda. Los args llegan a medias durante el streaming.
			const texto = sinEnlaces(textoPlano(typeof args.pregunta === "string" ? args.pregunta : ""));
			return conClase(args.clase, new Text(theme.fg("toolTitle", theme.bold("desarrollo ")) + theme.fg("muted", texto), 0, 0));
		},

		renderResult(result, _options, theme) {
			const d = result.details as DesarrolloDetails | undefined;
			if (!d?.status) return new Text(theme.fg("dim", "Esperando respuesta…"), 0, 0);
			if (d.interno) return new Text(theme.fg("dim", "(la pregunta vuelve después de la explicación)"), 0, 0);
			if (d.status !== "answered") return new Text(theme.fg("warning", d.message || "Cancelada"), 0, 0);
			const lines = [d.dontKnow ? theme.fg("warning", "No sé") : theme.fg("text", `Tu respuesta: ${d.answer ?? ""}`)];
			if (d.expected) lines.push(theme.fg("muted", `Respuesta esperada: ${textoPlano(d.expected)}`));
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
