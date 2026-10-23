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
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const QA_TOOLS = new Set(["quiz", "ask_user_question"]);
const SIN_CONVERSOR = "es HEIC o BMP y no hay ImageMagick para convertirla; mandala en JPEG o PNG.";

// La extensión puede mentir (un PNG guardado como .jpg) y el celular manda HEIC: decide la firma.
function formato(bytes: Buffer): string | undefined {
	if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
	if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
	if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "gif";
	if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
	if (bytes.subarray(0, 2).toString("ascii") === "BM") return "bmp";
	if (bytes.subarray(4, 8).toString("ascii") === "ftyp" && /^(hei[cmsx]|hev[cmsx]|mif1|msf1)$/.test(bytes.subarray(8, 12).toString("ascii"))) return "heic";
	return undefined;
}
type Nota = { ino: number; dev: number; nacimiento: number };
type Vinculo = { file: string | null; origen?: string } & Partial<Nota>;

export default function mdLog(pi: ExtensionAPI) {
	let logFile: string | null = null;
	// Ruta con la que se vinculó (la que conoce quien pide desvincular) e identidad del archivo, que sobrevive a un renombre.
	let origen: string | null = null;
	let nota: Nota | undefined;
	let contexto: ExtensionContext | undefined;

	// --- State restoration on session restart ---

	const restaurar = async (_event: unknown, ctx: ExtensionContext) => {
		contexto = ctx;
		logFile = null;
		ctx.ui.setStatus("md-log", undefined);
		let lastLinkData: Vinculo | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "md-log") {
				lastLinkData = entry.data as Vinculo | undefined;
			}
		}
		// Si la nota ya no está en su ruta, la próxima escritura la busca o la recrea.
		if (lastLinkData?.file && (!fs.existsSync(lastLinkData.file) || fs.lstatSync(lastLinkData.file).isFile())) {
			logFile = lastLinkData.file;
			origen = lastLinkData.origen ?? logFile;
			nota = lastLinkData.ino === undefined ? undefined : { ino: lastLinkData.ino, dev: lastLinkData.dev!, nacimiento: lastLinkData.nacimiento! };
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

	const identidad = (file: string): Nota => { const s = fs.statSync(file); return { ino: s.ino, dev: s.dev, nacimiento: s.birthtimeMs }; };
	// Busca la nota renombrada o movida en Obsidian: primero en su carpeta, después en todo el vault (sin carpetas ocultas).
	function buscar(id: Nota, dir: string, profundo: boolean): string | undefined {
		let entradas: fs.Dirent[] = [];
		try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return undefined; }
		for (const e of entradas) {
			if (e.name.startsWith(".")) continue;
			const ruta = path.join(dir, e.name);
			if (e.isFile() && e.name.endsWith(".md")) {
				const n = identidad(ruta);
				if (n.ino === id.ino && n.dev === id.dev && n.nacimiento === id.nacimiento) return ruta;
			} else if (profundo && e.isDirectory()) {
				const encontrada = buscar(id, ruta, true);
				if (encontrada) return encontrada;
			}
		}
		return undefined;
	}
	function relocalizar(): void {
		if (!logFile || fs.existsSync(logFile)) return;
		const anterior = logFile;
		const nueva = nota && (buscar(nota, path.dirname(anterior), false) ?? (contexto?.cwd ? buscar(nota, contexto.cwd, true) : undefined));
		if (nueva) logFile = nueva;
		else {
			// Si también se borró su carpeta, sin recrearla el aviso se repetiría en cada mensaje.
			fs.mkdirSync(path.dirname(anterior), { recursive: true });
			fs.writeFileSync(anterior, "", { flag: "wx" });
			nota = identidad(anterior);
			contexto?.ui.notify(`La nota del log no estaba; la recreé en ${path.basename(anterior)} y sigo escribiendo ahí.`, "warning");
		}
		pi.appendEntry("md-log", { file: logFile, origen, ...nota });
		contexto?.ui.setStatus("md-log", `🗒 ${path.basename(logFile)}`);
		if (nueva) pi.events.emit("md-log:movido", { anterior, actual: nueva });
	}

	function appendToFile(text: string): void {
		if (!logFile) return;
		try {
			relocalizar();
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

	function guardarImagen(image: any, timestamp: number, numero: number): string {
		if (!logFile) throw new Error("No hay nota vinculada.");
		let bytes: Buffer;
		if (typeof image === "string") {
			const fd = fs.openSync(image, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
			try {
				if (!fs.fstatSync(fd).isFile()) throw new Error("La imagen debe ser un archivo regular.");
				bytes = fs.readFileSync(fd);
			} finally { fs.closeSync(fd); }
		} else {
			if (typeof image.data !== "string") throw new Error("Base64 inválido.");
			bytes = Buffer.from(image.data, "base64");
			if (!bytes.length || bytes.toString("base64") !== image.data) throw new Error("Base64 inválido.");
		}
		// shortcut: sólo se valida la firma; usar un decodificador si se exige certificar integridad del formato.
		let extension = formato(bytes);
		if (typeof image !== "string") {
			const formatos: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
			const mime = String(image.mimeType).split(";")[0].trim().toLowerCase();
			if (!Object.hasOwn(formatos, mime)) throw new Error("Formato no compatible.");
			if (formatos[mime] !== extension) throw new Error("La firma no coincide con el formato.");
		}
		if (extension === "heic" || extension === "bmp") {
			// shortcut: sólo ImageMagick (convierte los dos); sumar heif-convert o sips si otra máquina no lo tiene.
			const destino = extension === "heic" ? "jpg" : "png";
			try { bytes = execFileSync("magick", [`${extension}:-`, "-auto-orient", `${destino}:-`], { input: bytes, timeout: 30000, maxBuffer: 2 ** 28, stdio: ["pipe", "pipe", "ignore"] }); }
			catch { throw new Error(SIN_CONVERSOR); }
			extension = destino;
		}
		if (!extension) throw new Error("Formato no compatible.");
		const directorio = path.join(fs.realpathSync(path.dirname(logFile)), "adjuntos");
		try { fs.mkdirSync(directorio, { mode: 0o700 }); } catch (e: any) { if (e.code !== "EEXIST") throw e; }
		if (!fs.lstatSync(directorio).isDirectory()) throw new Error("Adjuntos debe ser un directorio, no un enlace.");
		const hash = createHash("sha256").update(bytes).digest("hex");
		const nombre = `${timestamp}-${numero}-${hash}.${extension}`;
		const destino = path.join(directorio, nombre);
		try { fs.writeFileSync(destino, bytes, { flag: "wx", mode: 0o600 }); }
		catch (e: any) {
			if (e.code !== "EEXIST" || !fs.lstatSync(destino).isFile() || !fs.readFileSync(destino).equals(bytes)) {
				throw new Error("El adjunto existente se preservó o no se pudo escribir.");
			}
		}
		const relativo = path.relative(contexto?.cwd ?? path.dirname(logFile), destino);
		const enlace = relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo) ? `adjuntos/${nombre}` : relativo.split(path.sep).join("/");
		return `![[${enlace}]]`;
	}

	// Mismo camino para eventos e historial; el hash reutiliza sólo copias idénticas.
	function userBlock(msg: any): string | null {
		const contenido = typeof msg.content === "string" ? [{ type: "text", text: msg.content }] : msg.content;
		if (!Array.isArray(contenido)) return null;
		let numero = 0;
		const timestamp = Number.isFinite(msg.timestamp) && msg.timestamp >= 0 ? Math.trunc(msg.timestamp) : 0;
		const insertarImagen = (image: any): string => {
			numero++;
			try { return guardarImagen(image, timestamp, numero); }
			catch (e) {
				contexto?.ui.notify(e instanceof Error && e.message === SIN_CONVERSOR ? `La imagen ${numero} ${SIN_CONVERSOR}` : `No se pudo guardar la imagen ${numero} en el log; el chat continúa. Revisala en la sesión de pi.`, "warning");
				// En su propio párrafo: la ruta puede venir en medio de una línea de texto.
				return `\n\n> [!warning] Imagen ${numero} no guardada\n> Revisá el adjunto original en la sesión de pi; no se reemplazaron archivos existentes.\n\n${typeof image === "string" ? image : ""}`;
			}
		};
		const partes = contenido.map((c: any) => {
			if (c.type === "image") return insertarImagen(c);
			if (c.type !== "text") return "";
			return stripSkillBlocks(c.text.trim()).split("\n").map((linea: string) => {
				const adjuntoExplicito = linea.trim().startsWith("@");
				let ruta = linea.trim().replace(/^@/, "");
				if ((ruta.startsWith('"') && ruta.endsWith('"')) || (ruta.startsWith("'") && ruta.endsWith("'"))) ruta = ruta.slice(1, -1);
				if ((adjuntoExplicito || /^(?:\/|~\/|\.{1,2}\/)/.test(ruta)) && /\.(?:png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(ruta)) {
					return insertarImagen(path.resolve(contexto?.cwd || ".", ruta.startsWith("~/") ? path.join(homedir(), ruta.slice(2)) : ruta));
				}
				// Pi 1.3 pega una ruta en el editor, también en medio de una respuesta.
				return linea.replace(/\/[^\s"'`<>]*\bpi-clipboard-[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif)(?=$|[\s"'`<>),;:])/gi, ruta => insertarImagen(ruta));
			}).join("\n");
		}).filter(Boolean);
		return partes.length ? `> [!quote] VOS\n\n${partes.join("\n\n")}` : null;
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

	// Lo que el tutor muestra con ver_pagina también queda en la nota, como enlace a la página.
	function paginaMostrada(content: any): string | null {
		const cita = Array.isArray(content) ? content.find((c: any) => c.type === "text")?.text?.trim() : undefined;
		return cita ? callout("info", "Página mostrada", [cita]) : null;
	}

	function assistantBlock(text: string): string {
		return `> [!abstract] PI\n\n${text}`;
	}

	// Misma limpieza que quiz.ts (D5): la página citada puede traer la respuesta, así que antes de responder no van enlaces.
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
	// quiz ya manda details.context limpio; args.details sólo para logs anteriores.
	const contextoQuiz = (details: any, args: any): string | undefined => details?.context ?? (sinEnlaces(args.details?.trim() ?? "") || undefined);

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
			const sel = answers.map((a) => `${a.index}. ${a.label}`).join(", ") || "(ninguna)";
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
			await withLock(() => { const block = userBlock(msg); if (block) appendToFile(block); });
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
		const question: string = sinEnlaces(input.question || "");
		const context = contextoQuiz((event as any).partialResult?.details, input);
		const options = shuffled.map((o) => ({ label: o.label }));
		const block = questionCallout("Quiz", question, context, options);
		await withLock(() => appendToFile(block));
	});

	pi.on("tool_result", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (toolName === "ver_pagina") {
			const bloque = (event as any).isError ? null : paginaMostrada((event as any).content);
			if (bloque) await withLock(() => appendToFile(bloque));
			return;
		}
		if (!QA_TOOLS.has(toolName)) return;
		const details = (event as any).details;
		// Rechazado por forma antes de mostrarse: el alumno no vio ninguna pregunta.
		if (toolName === "quiz" && details?.status === "unavailable" && !loggedQuizQuestion.has((event as any).toolCallId)) return;
		const block = toolName === "quiz"
			? answerCalloutQuiz(details)
			: answerCalloutAsk(details);
		await withLock(() => appendToFile(block));
	});

	// El bus necesita acuse: emit() no espera promesas ni propaga errores de listeners.
	function vincular(file: string, ctx: ExtensionContext, rellenar: boolean) {
		if (!fs.lstatSync(file).isFile()) throw new Error("El log debe ser un archivo regular, no un enlace.");
		logFile = file;
		origen = file;
		nota = identidad(file);
		pi.appendEntry("md-log", { file, origen, ...nota });
		const written = rellenar ? backfill(ctx) : 0;
		ctx.ui.setStatus("md-log", `🗒 ${path.basename(file)}`);
		return written;
	}
	function desvincular() {
		logFile = null;
		origen = null;
		nota = undefined;
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
	pi.events.on("md-log:unlink", async (data) => {
		const d = data as { file?: string; onComplete?: (error?: string) => void } | undefined;
		try {
			await withLock(() => {
				// Ya desvinculado cuenta como éxito; la nota renombrada se reconoce por su ruta de origen.
				if (!logFile) return;
				if (d?.file && logFile !== d.file && origen !== d.file) throw new Error("El log activo cambió; se preservó su vínculo.");
				desvincular();
			});
			d?.onComplete?.();
		} catch (e) { d?.onComplete?.(e instanceof Error ? e.message : "No se pudo cerrar el log."); }
	});

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

			// ui.confirm de pi dibuja «Yes»/«No»; Esc vale como no.
			const si = "Sí, reemplazar la nota";
			if (fs.statSync(resolved).size > 0 && (!ctx.hasUI || await ctx.ui.select("Reemplazar nota con el historial\nLa nota tiene contenido. ¿Confirmás reemplazarlo con la rama activa? Si querés conservarlo, elegí otra nota vacía.", [si, "No"]) !== si)) {
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
				const block = userBlock(msg);
				if (block) blocks.push(block);
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
				const pagina = msg.toolName === "ver_pagina" && !msg.isError ? paginaMostrada(msg.content) : null;
				if (pagina) blocks.push(pagina);
				if (!QA_TOOLS.has(msg.toolName)) continue;
				// Un quiz no disponible nunca llegó a mostrarse.
				if (msg.toolName === "quiz" && msg.details?.status === "unavailable") continue;
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
					blocks.push(tc.name === "quiz"
						? questionCallout(label, sinEnlaces(a.question || ""), contextoQuiz(msg.details, a), options)
						: questionCallout(label, a.question || "", a.details?.trim() || undefined, options));
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
