/**
 * md-log — mirror the session to a markdown file for comfortable reading.
 *
 * Designed for long teaching/learning sessions where the terminal is hard on
 * the eyes and markdown/math/code don't render. The linked .md file is meant
 * to be viewed rendered (e.g. in Obsidian), so assistant text with $...$ math,
 * code blocks, and markdown all render natively — no rendering work here.
 *
 * Captures only reading-relevant content:
 *   - user prompts
 *   - assistant text (lesson prose)
 *   - quiz / ask_user_question Q&A blocks
 * Other tools (bash, read, write, edit, ...) are omitted.
 *
 * Quiz/ask questions are written BEFORE the user answers (on tool_call), so the
 * reader sees the question appear live; the answer + feedback are appended on
 * tool_result. The question block NEVER contains the correct answer or
 * explanation (the user reads this file live).
 *
 * Commands:
 *   /md-log <filepath>  — Link a markdown file and backfill the session.
 *   /md-unlog           — Stop logging.
 *
 * Append-only. No send-back-to-agent functionality (that lived in the old
 * .md-link extension this was modeled on).
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const QA_TOOLS = new Set(["quiz", "ask_user_question"]);

export default function mdLog(pi: ExtensionAPI) {
	let logFile: string | null = null;
	let contexto: ExtensionContext | undefined;

	// --- State restoration on session restart ---

	const restaurar = async (_event: unknown, ctx: ExtensionContext) => {
		contexto = ctx;
		logFile = null;
		ctx.ui.setStatus("md-log", undefined);
		let lastLinkData: { file: string | null } | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "md-log") {
				lastLinkData = entry.data as { file: string | null } | undefined;
			}
		}
		if (lastLinkData?.file && fs.existsSync(lastLinkData.file) && fs.lstatSync(lastLinkData.file).isFile()) {
			logFile = lastLinkData.file;
			ctx.ui.setStatus("md-log", `🗒 ${path.basename(logFile)}`);
		}
	};
	pi.on("session_start", restaurar);
	pi.on("session_tree", restaurar);

	// --- Serialization: events can fire close together; keep appends ordered ---

	let writeLock: Promise<void> = Promise.resolve();
	function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
		const prev = writeLock;
		let release: () => void;
		writeLock = new Promise<void>((r) => {
			release = r;
		});
		return prev.then(fn).finally(() => release!());
	}

	function appendToFile(text: string): void {
		if (!logFile) return;
		try {
			if (!fs.lstatSync(logFile).isFile()) throw new Error("El log dejó de ser un archivo regular.");
			const prefix = fs.statSync(logFile).size > 0 ? "\n\n" : "";
			fs.appendFileSync(logFile, prefix + text + "\n", "utf-8");
		} catch {
			contexto?.ui.notify("No se pudo escribir el log; el chat continúa y no se reemplazó la nota.", "warning");
		}
	}

	// --- Formatting ---

	function callout(type: string, title: string, bodyLines: string[]): string {
		const lines = [`> [!${type}] ${title}`];
		for (const line of bodyLines) {
			lines.push(line.length === 0 ? ">" : `> ${line}`);
		}
		return lines.join("\n");
	}

	function userBlock(text: string): string {
		return `> [!quote] VOS\n\n${text}`;
	}

	// Skill declarations (`<skill name="..." ...> ...whole SKILL.md... </skill>`)
	// are system-injected context, not user prose. Replace each with a compact
	// callout noting the skill was loaded, so the log keeps the signal without
	// the noise. Runs on already-trimmed text.
	function stripSkillBlocks(text: string): string {
		return text.replace(
			/<skill\b([^>]*)>[\s\S]*?<\/skill>/g,
			(_match, attrs: string) => {
				const name = /name="([^"]+)"/.exec(attrs)?.[1];
				return `> [!note] Skill cargada: ${name ?? "(desconocida)"}`;
			},
		);
	}

	function assistantBlock(text: string): string {
		return `> [!abstract] PI\n\n${text}`;
	}

	function optionsList(options: Array<{ label: string }>): string[] {
		return options.map((o, i) => `${i + 1}. ${o.label}`);
	}

	function questionCallout(label: string, question: string, context: string | undefined, options: Array<{ label: string }>): string {
		const body: string[] = [];
		for (const line of question.split("\n")) body.push(line);
		if (context) {
			body.push("");
			for (const line of context.split("\n")) body.push(line);
		}
		if (options.length > 0) {
			body.push("");
			body.push(...optionsList(options));
		}
		return callout("question", label, body);
	}

	function answerCalloutQuiz(details: any): string {
		const status = details?.status;
		if (!status) return callout("warning", "Quiz sin respuesta", ["La herramienta no registró una respuesta; no se califica."]);
		if (status === "cancelled") {
			return callout("warning", "Quiz — cancelado", ["(omitido por el usuario)"]);
		}
		if (status === "unavailable") {
			return callout("warning", "Quiz — no disponible", [details?.message || ""]);
		}
		// "I don't know" is neither correct nor incorrect — it's a distinct signal,
		// so it never renders as a red ✗.
		const dontKnow = details?.dontKnow === true;
		const correct = details?.correct === true;
		const type = dontKnow ? "question" : correct ? "success" : "failure";
		const title = dontKnow
			? "Quiz — No sé"
			: correct
				? "Quiz — correcto ✓"
				: "Quiz — incorrecto ✗";
		const body: string[] = [];

		if (dontKnow) {
			body.push("Tu respuesta: No sé");
		} else {
			const answers: any[] = details?.answers || [];
			const sel = answers.map((a) => `${a.index}. ${a.label}`).join(", ") || "(none)";
			body.push(`Tu respuesta: ${sel}`);
		}

		const correctIndices: number[] = details?.correctIndices || [];
		const correctStr = correctIndices.map((i) => `${i}`).join(", ");
		body.push(`Respuesta correcta: ${correctStr}`);

		// Optional free-text note the user typed in the always-present note field.
		// Only present (in details) when non-empty, so no guard for empty strings.
		if (details?.note) {
			body.push("");
			const noteLines = String(details.note).split("\n");
			body.push(`Nota: ${noteLines[0]}`);
			for (let i = 1; i < noteLines.length; i++) body.push(noteLines[i]);
		}

		if (details?.explanation) {
			body.push("");
			for (const line of String(details.explanation).split("\n")) body.push(line);
		}
		return callout(type, title, body);
	}

	function answerCalloutAsk(details: any): string {
		const status = details?.status;
		if (status === "cancelled") {
			return callout("warning", "Pregunta — cancelada", ["(omitida por el usuario)"]);
		}
		if (status === "unavailable") {
			return callout("warning", "Pregunta — no disponible", [details?.message || ""]);
		}
		const answers: any[] = details?.answers || [];
		const body: string[] = answers.map((a) => {
			if (a.type === "other") return `Otra: ${a.label}`;
			if (a.type === "text") return a.label;
			return `${a.index}. ${a.label}`;
		});
		if (body.length === 0) body.push("(sin respuesta)");
		return callout("example", "Respuesta", body);
	}

	// --- Event handlers ---

	pi.on("message_end", async (event, _ctx) => {
		if (!logFile) return;
		const msg = event.message;
		if (!msg || !("role" in msg)) return;

		if (msg.role === "user") {
			const text = typeof msg.content === "string"
				? msg.content
				: Array.isArray(msg.content)
					? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
					: "";
			const trimmed = stripSkillBlocks(text.trim());
			if (!trimmed) return;
			await withLock(() => appendToFile(userBlock(trimmed)));
			return;
		}

		if (msg.role === "assistant") {
			const textParts = (msg.content || [])
				.filter((c: any) => c.type === "text")
				.map((c: any) => (c.text as string).trim())
				.filter((t: string) => t.length > 0);
			if (textParts.length === 0) return;
			await withLock(() => appendToFile(assistantBlock(textParts.join("\n\n"))));
			return;
		}
		// toolResult messages are handled by the tool_result event (for QA tools).
	});

	// ask_user_question never shuffles its options, so the tool_call args are
	// already the true display order — safe to write the question live, before
	// the user answers.
	pi.on("tool_call", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (toolName !== "ask_user_question") return;
		const input = (event as any).input || {};
		const question: string = input.question || "";
		const context: string | undefined = input.details?.trim() || undefined;
		const options: Array<{ label: string }> = Array.isArray(input.options) ? input.options : [];
		const block = questionCallout("Pregunta", question, context, options);
		await withLock(() => appendToFile(block));
	});

	// quiz DOES shuffle its options inside execute(), so the tool_call args are
	// the pre-shuffle author order — NOT what the user is shown. quiz emits an
	// onUpdate() with the true (post-shuffle) order before it blocks on the
	// user's answer; wait for that instead so the logged order always matches
	// what's on screen. Guard against duplicate writes if multiple updates fire
	// for the same call.
	const loggedQuizQuestion = new Set<string>();
	pi.on("tool_execution_update", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (toolName !== "quiz") return;
		const toolCallId = (event as any).toolCallId;
		if (loggedQuizQuestion.has(toolCallId)) return;
		const shuffled = (event as any).partialResult?.details?.options as Array<{ index: number; label: string }> | undefined;
		if (!shuffled || shuffled.length === 0) return;
		loggedQuizQuestion.add(toolCallId);
		const input = (event as any).args || {};
		const question: string = input.question || "";
		const context: string | undefined = input.details?.trim() || undefined;
		const options = shuffled.map((o) => ({ label: o.label }));
		const block = questionCallout("Quiz", question, context, options);
		await withLock(() => appendToFile(block));
	});

	pi.on("tool_result", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (!QA_TOOLS.has(toolName)) return;
		const details = (event as any).details;
		const block = toolName === "quiz"
			? answerCalloutQuiz(details)
			: answerCalloutAsk(details);
		await withLock(() => appendToFile(block));
	});

	// El bus necesita acuse: emit() no espera promesas ni propaga errores de listeners.
	function vincular(file: string, ctx: ExtensionContext, rellenar: boolean) {
		if (!fs.lstatSync(file).isFile()) throw new Error("El log debe ser un archivo regular, no un enlace.");
		logFile = file;
		pi.appendEntry("md-log", { file });
		const written = rellenar ? backfill(ctx) : 0;
		ctx.ui.setStatus("md-log", `🗒 ${path.basename(file)}`);
		return written;
	}
	function desvincular() {
		logFile = null;
		pi.appendEntry("md-log", { file: null });
		contexto?.ui.setStatus("md-log", undefined);
	}
	pi.events.on("md-log:link", async (data) => {
		const d = data as { file: string; backfill?: boolean; onComplete?: (error?: string) => void };
		try {
			if (!contexto) throw new Error("md-log no tiene una sesión activa.");
			if (d.backfill !== false && fs.statSync(d.file).size > 0) throw new Error("El bus sólo rellena notas vacías; la nota existente se preservó.");
			await withLock(() => vincular(d.file, contexto!, d.backfill !== false));
			d.onComplete?.();
		} catch (e) { d.onComplete?.(e instanceof Error ? e.message : "No se pudo vincular el log."); }
	});
	pi.events.on("md-log:unlink", async () => { await withLock(desvincular); });

	// --- Commands ---

	pi.registerCommand("md-log", {
		description: "Vincular una nota Markdown y rellenarla con la rama activa",
		handler: async (args, ctx: any) => {
			const filepath = args.trim();
			if (!filepath) {
				ctx.ui.notify("Uso: /md-log <ruta>", "warning");
				return;
			}
			if (typeof ctx.isIdle === "function" && !ctx.isIdle()) {
				ctx.ui.notify("Esperá a que termine el agente antes de vincular.", "warning");
				return;
			}

			const resolved = path.isAbsolute(filepath) ? filepath : path.resolve(ctx.cwd, filepath);

			// The file must already exist — /md-log links into an existing note,
			// it never creates one. This avoids silently scattering new files
			// (and parent directories) around the vault from a typo'd path.
			if (!fs.existsSync(resolved)) {
				ctx.ui.notify(`La nota no existe: ${resolved}`, "error");
				return;
			}
			if (!fs.statSync(resolved).isFile()) {
				ctx.ui.notify(`No es un archivo: ${resolved}`, "error");
				return;
			}

			if (fs.statSync(resolved).size > 0 && (!ctx.hasUI || !await ctx.ui.confirm("Reemplazar nota con el historial", "La nota tiene contenido. ¿Confirmás reemplazarlo con la rama activa? Si querés conservarlo, elegí otra nota vacía."))) {
				ctx.ui.notify("Nota preservada; no se cambió el vínculo.", "info");
				return;
			}
			const written = await withLock(() => vincular(resolved, ctx, true));

			ctx.ui.notify(`Nota vinculada: ${resolved} (${written} entradas recuperadas)`, "success");
		},
	});

	pi.registerCommand("md-unlog", {
		description: "Dejar de registrar la sesión en la nota Markdown",
		handler: async (_args, ctx) => {
			if (!logFile) {
				ctx.ui.notify("No hay una nota vinculada", "warning");
				return;
			}
			const name = path.basename(logFile);
			await withLock(desvincular);
			ctx.ui.notify(`Nota desvinculada: ${name}`, "info");
		},
	});

	// --- Backfill ---

	function backfill(ctx: any): number {
		if (!logFile) return 0;
		const chain: any[] = ctx.sessionManager.getBranch();

		// Track tool-call args from assistant messages so we can pair with results.
		const toolCallArgs = new Map<string, { name: string; args: any }>();

		const blocks: string[] = [];
		let count = 0;
		for (const entry of chain) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (!msg || !("role" in msg)) continue;
			count++;

			if (msg.role === "user") {
				const text = typeof msg.content === "string"
					? msg.content
					: Array.isArray(msg.content)
						? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
						: "";
				const trimmed = stripSkillBlocks(text.trim());
				if (trimmed) blocks.push(userBlock(trimmed));
				continue;
			}

			if (msg.role === "assistant") {
				// Index tool calls for later pairing.
				for (const c of msg.content || []) {
					if (c.type === "toolCall" && QA_TOOLS.has(c.name)) {
						toolCallArgs.set(c.id, { name: c.name, args: c.arguments });
					}
				}
				const textParts = (msg.content || [])
					.filter((c: any) => c.type === "text")
					.map((c: any) => (c.text as string).trim())
					.filter((t: string) => t.length > 0);
				if (textParts.length > 0) blocks.push(assistantBlock(textParts.join("\n\n")));
				continue;
			}

			if (msg.role === "toolResult") {
				if (!QA_TOOLS.has(msg.toolName)) continue;
				const tc = toolCallArgs.get(msg.toolCallId);
				// Question block. For quiz, use the persisted result's `details.options`
				// — the TRUE post-shuffle display order the user actually saw — rather
				// than the original tool-call args, which are the pre-shuffle author
				// order and can mismatch what's on screen. ask_user_question never
				// shuffles, so its tool-call args are already the true order.
				if (tc) {
					const a = tc.args || {};
					const label = tc.name === "quiz" ? "Quiz" : "Pregunta";
					const shuffled = msg.toolName === "quiz"
						? (msg.details?.options as Array<{ index: number; label: string }> | undefined)
						: undefined;
					const options = shuffled && shuffled.length > 0
						? shuffled.map((o) => ({ label: o.label }))
						: (Array.isArray(a.options) ? a.options : []);
					blocks.push(questionCallout(label, a.question || "", a.details?.trim() || undefined, options));
				}
				if (msg.toolName === "quiz") {
					blocks.push(answerCalloutQuiz(msg.details));
				} else {
					blocks.push(answerCalloutAsk(msg.details));
				}
				continue;
			}
		}

		if (blocks.length > 0) {
			try {
				fs.writeFileSync(logFile, blocks.join("\n\n") + "\n", "utf-8");
			} catch {
				// ignore
			}
		}
		return count;
	}
}
