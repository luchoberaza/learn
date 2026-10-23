import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { agentDir, importPi, vaultDir } from "../scripts/lib/pi-sdk.mjs";
import { cortarTurno } from "../extensions/comun/corte.ts";

// pi 1.4.0 real con faux: como con un proveedor real, la llamada que arranca con la señal abortada falla al resolver
// credenciales (pi-ai auth/resolve.js:15) y lazyStream la da por error (api/lazy.js:57-63): «Error: This operation was aborted».
async function sesion(t) {
  const sdk = await importPi(), raiz = process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install");
  const ai = await import(pathToFileURL(join(raiz, "releases", readFileSync(join(raiz, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-ai/dist/index.js")).href);
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
    await cortarTurno(pi, { isIdle: () => session.isIdle, abort: () => { void session.abort(); }, waitForIdle: () => session.waitForIdle() }, motivo);
    await turno;
    const mensajes = session.messages.slice(session.messages.findLastIndex(m => m.role === "user"));
    return { mensajes, resultado: mensajes.find(m => m.role === "toolResult") };
  };
  return { cortar };
}
const quiz = { question: "¿Qué retardo depende de L/R?", options: [{ label: "Transmisión" }, { label: "Propagación" }, { label: "Cola" }], correctAnswer: "Transmisión", explanation: "d_trans = L/R" };

test("P2: cortar el turno con una pregunta abierta no arranca otra llamada ni muestra «Error: This operation was aborted»", async t => {
  const s = await sesion(t);
  for (const [herramienta, args, motivo] of [["quiz", quiz, "al cerrar la clase"], ["ask_user_question", { question: "¿Seguimos?", options: [{ label: "Sí" }, { label: "Más tarde" }] }, "al cambiar de tema"],
    ["quiz", { ...quiz, multiSelect: true, correctAnswer: ["Transmisión"] }, "al empezar el simulacro"]]) {
    const { mensajes, resultado } = await s.cortar(herramienta, args, motivo);
    assert.deepEqual(mensajes.filter(m => m.role === "assistant").map(m => m.stopReason), ["toolUse"], `${herramienta}: ${JSON.stringify(mensajes.at(-1))}`);
    assert.equal(resultado.details.status, "cancelled");
    assert.equal(resultado.details.motivo, motivo);
  }
});

test("P2: la respuesta ya corregida se conserva al cortar, también sin otra llamada", async t => {
  const s = await sesion(t);
  const { mensajes, resultado } = await s.cortar("quiz", quiz, "al cerrar la clase", ["\r"]);
  assert.equal(resultado.details.status, "answered");
  assert.equal(resultado.details.answers.length, 1);
  assert.equal(mensajes.at(-1), resultado);
});
