import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";

// Vault falso con la nota de la sesión en cursos/redes/sesiones, como la crea /estudiar.
function entorno(t) {
  const dir = mkdtempSync(join(tmpdir(), "pi-md-auditoria-")), sesiones = join(dir, "cursos/redes/sesiones");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(sesiones, { recursive: true });
  const file = join(sesiones, "2026-10-22-retardos.md"), handlers = new Map(), bus = new Map(), emitidos = [], entradas = [], avisos = [], estados = [];
  writeFileSync(file, "");
  const pi = { on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h), emit: (n, d) => emitidos.push([n, d]) }, registerCommand: () => {},
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }) };
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => entradas }, ui: { setStatus: (_k, v) => estados.push(v), notify: (...a) => avisos.push(a) } };
  mdLog(pi);
  const enviar = texto => handlers.get("message_end")({ message: { role: "user", content: texto } }, ctx);
  const vincular = () => new Promise(r => bus.get("md-log:link")({ file, backfill: false, onComplete: r }));
  const desvincular = file => new Promise(r => bus.get("md-log:unlink")({ file, onComplete: r }));
  return { dir, sesiones, file, handlers, emitidos, entradas, avisos, estados, ctx, enviar, vincular, desvincular };
}

test("H04: renombrar la nota en Obsidian no pierde entradas, no avisa y /fin la cierra", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx);
  assert.equal(await e.vincular(), undefined);
  await e.enviar("Antes del renombre");
  const nueva = join(e.sesiones, "Clase retardos (renombrada).md");
  renameSync(e.file, nueva);
  await e.enviar("Primera tras renombrar"); await e.enviar("Segunda tras renombrar");
  const texto = readFileSync(nueva, "utf8");
  for (const m of ["Antes del renombre", "Primera tras renombrar", "Segunda tras renombrar"]) assert.match(texto, new RegExp(m));
  assert.ok(!existsSync(e.file), "no debe recrear la ruta vieja");
  assert.deepEqual(e.avisos, []);
  assert.equal(e.estados.at(-1), "🗒 Clase retardos (renombrada).md");
  assert.deepEqual(e.emitidos, [["md-log:movido", { anterior: e.file, actual: nueva }]]);
  assert.equal(e.entradas.at(-1).data.file, nueva);
  // sesion.ts pide cerrar con la ruta original.
  assert.equal(await e.desvincular(e.file), undefined);
  assert.equal(await e.desvincular(e.file), undefined, "ya desvinculado cuenta como éxito");
  await e.enviar("Fuera del log");
  assert.doesNotMatch(readFileSync(nueva, "utf8"), /Fuera del log/);
});

test("H04: una nota movida a otra carpeta del vault se encuentra por inode; una ajena con el mismo nombre no", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const archivo = join(e.dir, "Archivo/redes"), ajena = join(e.dir, "Otra/2026-10-22-retardos.md");
  mkdirSync(archivo, { recursive: true }); mkdirSync(join(e.dir, "Otra")); writeFileSync(ajena, "AJENA\n");
  renameSync(e.file, join(archivo, "retardos.md"));
  await e.enviar("Sigue en la movida");
  assert.match(readFileSync(join(archivo, "retardos.md"), "utf8"), /Sigue en la movida/);
  assert.equal(readFileSync(ajena, "utf8"), "AJENA\n");
});

test("H04: si la nota se borró, se recrea en su ruta con un solo aviso", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  rmSync(e.file);
  await e.enviar("Uno"); await e.enviar("Dos");
  assert.match(readFileSync(e.file, "utf8"), /Uno[\s\S]*Dos/);
  assert.equal(e.avisos.length, 1); assert.match(e.avisos[0][0], /^La nota del log no estaba; la recreé en 2026-10-22-retardos\.md/);
});

test("H04: tras /resume con la nota renombrada se sigue escribiendo en ella", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const nueva = join(e.sesiones, "renombrada.md"); renameSync(e.file, nueva);
  // /resume: restaura desde la entrada que se guardó al vincular, con la ruta vieja.
  await e.handlers.get("session_start")({}, e.ctx);
  await e.enviar("Retomado");
  assert.match(readFileSync(nueva, "utf8"), /Retomado/);
  assert.deepEqual(e.avisos, []);
  assert.equal(await e.desvincular(e.file), undefined);
});

test("H04: un vínculo viejo sin inode cuya nota falta se recrea con aviso en vez de perderse en silencio", async t => {
  const e = entorno(t); rmSync(e.file); e.entradas.push({ type: "custom", customType: "md-log", data: { file: e.file } });
  await e.handlers.get("session_start")({}, e.ctx);
  await e.enviar("Después de /resume");
  assert.match(readFileSync(e.file, "utf8"), /Después de \/resume/);
  assert.equal(e.avisos.length, 1);
});

const pregunta = { question: "¿Qué cambia si se duplica R? Ver [[cursos/redes/fuentes/kurose-7.pdf#page=56|p. 56]]", details: "Referencia: [[cursos/redes/fuentes/kurose-7.pdf#page=56]]\nCon $L$ = 1000 bits", options: [{ label: "A" }, { label: "B" }, { label: "C" }], correctAnswer: "A", explanation: "d = L/R [[cursos/redes/fuentes/kurose-7.pdf#page=56]]" };
const opciones = [{ index: 1, label: "B" }, { index: 2, label: "A" }, { index: 3, label: "C" }];

test("H49: el callout del quiz va sin el enlace a la página con la respuesta, con el contexto limpio de quiz", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  await e.handlers.get("tool_execution_update")({ toolName: "quiz", toolCallId: "q1", args: pregunta, partialResult: { details: { question: "¿Qué cambia si se duplica R? Ver p. 56", context: "Con L = 1000 bits", options: opciones } } }, e.ctx);
  // Un log anterior a details.context: se limpia args.details.
  await e.handlers.get("tool_execution_update")({ toolName: "quiz", toolCallId: "q2", args: pregunta, partialResult: { details: { options: opciones } } }, e.ctx);
  const texto = readFileSync(e.file, "utf8");
  assert.doesNotMatch(texto, /#page=|\[\[/);
  assert.match(texto, /> \[!question\] Quiz\n> ¿Qué cambia si se duplica R\? Ver p\. 56\n>\n> Con L = 1000 bits\n>\n> 1\. B/);
  assert.match(texto, /> Con \$L\$ = 1000 bits/);
  // Después de responder, la explicación conserva su cita.
  await e.handlers.get("tool_result")({ toolName: "quiz", toolCallId: "q1", details: { status: "answered", answers: [], correctIndices: [2], explanation: pregunta.explanation } }, e.ctx);
  assert.match(readFileSync(e.file, "utf8"), /Tu respuesta: \(ninguna\)[\s\S]*#page=56/);
});

test("H49: un quiz rechazado por forma no deja «Quiz — no disponible» en la nota, ni en vivo ni al rellenar", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const rechazo = { status: "unavailable", message: "Pregunta descartada por tener menos de 3 opciones; ya viene otra." };
  await e.handlers.get("tool_result")({ toolName: "quiz", toolCallId: "q9", details: rechazo }, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), "");
  const asistente = (id, args) => ({ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id, name: "quiz", arguments: args }] } });
  e.entradas.push(asistente("q9", { ...pregunta, options: pregunta.options.slice(0, 2) }), { type: "message", message: { role: "toolResult", toolCallId: "q9", toolName: "quiz", details: rechazo } },
    asistente("q1", pregunta), { type: "message", message: { role: "toolResult", toolCallId: "q1", toolName: "quiz", details: { status: "answered", context: "Con L = 1000 bits", options: opciones, answers: [{ index: 2, label: "A" }], correctIndices: [2], correct: true } } });
  const comandos = new Map(); mdLog({ on: () => {}, events: { on: () => {} }, registerCommand: (n, c) => comandos.set(n, c), appendEntry: () => {} });
  e.ctx.hasUI = true; e.ctx.ui.confirm = async () => true;
  await comandos.get("md-log").handler(e.file, e.ctx);
  const texto = readFileSync(e.file, "utf8");
  assert.doesNotMatch(texto, /no disponible|descartada|#page=|\[\[/);
  assert.match(texto, /> \[!question\] Quiz\n> ¿Qué cambia si se duplica R\? Ver p\. 56\n>\n> Con L = 1000 bits\n>\n> 1\. B\n> 2\. A/);
  assert.match(texto, /Quiz — correcto ✓/);
});
