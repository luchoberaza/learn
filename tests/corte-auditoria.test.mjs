import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { agentDir, importPi, vaultDir, importDependenciaPi } from "../scripts/lib/pi-sdk.mjs";
import { cortarTurno } from "../extensions/comun/corte.ts";
// Las llamadas simuladas anotan su consumo en una carpeta temporal, no en el registro real de la máquina (DA48).
const consumoTemporal = process.env.LEARN_CONSUMO_DIR = mkdtempSync(join(tmpdir(), "learn-consumo-"));
process.on("exit", () => rmSync(consumoTemporal, { recursive: true, force: true }));

// pi 1.4.0 real con faux: como con un proveedor real, la llamada que arranca con la señal abortada falla al resolver
// credenciales (pi-ai auth/resolve.js:15) y lazyStream la da por error (api/lazy.js:57-63): «Error: This operation was aborted».
async function sesion(t) {
  const sdk = await importPi();
  const ai = await importDependenciaPi("@earendil-works/pi-ai");
  const faux = ai.fauxProvider({ provider: "faux", models: [{ id: "faux-1", contextWindow: 200000, maxTokens: 8000 }] });
  let pi;
  const settingsManager = sdk.SettingsManager.create(vaultDir, agentDir, { projectTrusted: true });
  const loader = new sdk.DefaultResourceLoader({ cwd: vaultDir, agentDir, settingsManager, noSkills: true, extensionFactories: [api => { pi = api; api.registerProvider(faux.provider); }] });
  await loader.reload();
  const { session } = await sdk.createAgentSession({ cwd: vaultDir, agentDir, settingsManager, resourceLoader: loader, sessionManager: sdk.SessionManager.inMemory(), model: faux.getModel(), thinkingLevel: "off" });
  t.after(async () => { await session.extensionRunner.emit({ type: "session_shutdown" }); session.dispose(); });
  let abiertos = 0, teclas = [];
  const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
  const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
  const custom = factory => new Promise(res => { const c = factory(tui, theme, {}, res); for (const k of teclas) c.handleInput(k); abiertos++; });
  await session.bindExtensions({ uiContext: { custom, notify() {}, setStatus() {}, setWorkingMessage() {}, setWorkingVisible() {}, setWorkingIndicator() {}, setHiddenThinkingLabel() {}, setWidget() {}, setTitle() {} }, mode: "tui" });
  if (session.model?.provider !== "faux") await session.setModel(faux.getModel());
  settingsManager.applyOverrides({ retry: { enabled: false } });
  // Como /fin con la pregunta a la vista: corta el turno con el ctx de un comando.
  const cortar = async (herramienta, args, motivo, conTeclas = []) => {
    teclas = conTeclas; const antes = abiertos;
    faux.setResponses([ai.fauxAssistantMessage([ai.fauxToolCall(herramienta, args)], { stopReason: "toolUse" })]);
    const turno = session.prompt("Sigamos");
    for (let i = 0; i < 100 && abiertos === antes; i++) await new Promise(r => setTimeout(r, 20));
    assert.equal(abiertos, antes + 1, "la pregunta llegó a mostrarse");
    // Sin motivo, un aborto ajeno a /fin, /estudiar y /simulacro.
    if (motivo) await cortarTurno(pi, { isIdle: () => session.isIdle, abort: () => { void session.abort(); }, waitForIdle: () => session.waitForIdle() }, motivo);
    else await session.abort();
    await turno;
    const mensajes = session.messages.slice(session.messages.findLastIndex(m => m.role === "user"));
    return { mensajes, resultado: mensajes.find(m => m.role === "toolResult") };
  };
  return { cortar };
}
// Con su explicación en clase: tras el «Sigamos» del alumno, una pregunta sin texto visible no se muestra (DA57).
const quiz = { question: "¿Qué retardo depende de L/R?", options: [{ label: "Transmisión" }, { label: "Propagación" }, { label: "Cola" }], correctAnswer: "Transmisión", explanation: "d_trans = L/R",
  clase: "El retardo de transmisión es lo que tarda el router en poner todos los bits del paquete en el enlace: L bits a R bits por segundo, d_trans = L/R." };

test("P2: cortar el turno con una pregunta abierta no arranca otra llamada ni muestra «Error: This operation was aborted»", async t => {
  const s = await sesion(t);
  for (const [herramienta, args, motivo] of [["quiz", quiz, "al cerrar la clase"], ["ask_user_question", { question: "¿Seguimos?", options: [{ label: "Sí" }, { label: "Más tarde" }] }, "al cambiar de tema"],
    ["quiz", { ...quiz, multiSelect: true, correctAnswer: ["Transmisión"] }, "al empezar el simulacro"], ["quiz", quiz, undefined]]) {
    const { mensajes, resultado } = await s.cortar(herramienta, args, motivo);
    assert.deepEqual(mensajes.filter(m => m.role === "assistant").map(m => m.stopReason), ["toolUse"], `${herramienta}: ${JSON.stringify(mensajes.at(-1))}`);
    assert.equal(resultado.details.status, "cancelled");
    assert.equal(resultado.details.motivo, motivo ?? "al interrumpirse el turno");
  }
});

test("P2: la respuesta ya corregida se conserva al cortar, también sin otra llamada", async t => {
  const s = await sesion(t);
  const { mensajes, resultado } = await s.cortar("quiz", quiz, "al cerrar la clase", ["\r"]);
  assert.equal(resultado.details.status, "answered");
  assert.equal(resultado.details.answers.length, 1);
  assert.equal(mensajes.at(-1), resultado);
});

test("P5: la nota distingue la pregunta cortada por /fin, /estudiar o /simulacro del Esc del alumno", async t => {
  const { default: mdLog } = await import("../extensions/md-log.ts");
  const dir = mkdtempSync(join(tmpdir(), "pi-corte-nota-")), file = join(dir, "clase.md"), handlers = new Map(), bus = new Map();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(file, "");
  mdLog({ on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h), emit() {} }, registerCommand() {}, appendEntry() {} });
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => [] }, ui: { setStatus() {}, notify() {} } };
  await handlers.get("session_start")({}, ctx);
  await new Promise(r => bus.get("md-log:link")({ file, backfill: false, onComplete: r }));
  for (const [toolName, motivo] of [["quiz", "al cerrar la clase"], ["quiz", undefined], ["ask_user_question", "al cambiar de tema"], ["ask_user_question", undefined]])
    await handlers.get("tool_result")({ toolName, toolCallId: "x", details: { status: "cancelled", motivo } }, ctx);
  const nota = readFileSync(file, "utf8");
  for (const linea of ["(cortado al cerrar la clase)", "(omitido por el usuario)", "(cortada al cambiar de tema)", "(omitida por el usuario)"]) assert.ok(nota.includes(linea), linea);
});
