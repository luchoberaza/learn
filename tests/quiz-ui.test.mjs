import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

let p, quiz, ask;
before(async () => {
  p = await loadProject();
  quiz = p.session.extensionRunner.getToolDefinition("quiz");
  ask = p.session.extensionRunner.getToolDefinition("ask_user_question");
});
after(() => p?.close());

const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
const K = { enter: "\r", down: "\x1b[B", esc: "\x1b", tab: "\t", space: " " };
// UI falsa: renderiza el popup real antes de cada tecla y después de la última.
function ui(teclas, pantallas = []) {
  return { hasUI: true, ui: {
    editor: async t => { pantallas.push(t); return "x"; },
    custom: factory => new Promise(res => {
      const c = factory(tui, theme, {}, res);
      const foto = () => pantallas.push(c.render(100).join("\n"));
      foto();
      for (const k of teclas) { c.handleInput(K[k] ?? k); foto(); }
    }),
  } };
}
const render = (comp) => comp.render(100).map(l => l.trimEnd()).join("\n");
const base = { question: "¿Qué retardo depende de la distancia del enlace?", options: [
  { label: "Retardo de propagación", value: "prop" }, { label: "Retardo de transmisión", value: "trans" }, { label: "Retardo de cola", value: "cola" }],
  correctAnswer: "prop", explanation: "d_prop = d/s depende de la distancia." };

test("H45: popups, renders y respuestas al modelo de quiz y ask en español", async () => {
  const vistas = [], modelo = [];
  const r1 = await quiz.execute("q1", base, undefined, () => {}, ui(["enter", "enter"], vistas));
  const r2 = await quiz.execute("q2", base, undefined, () => {}, ui(["down", "down", "down", "tab", ..."ni idea", "enter", "enter", "enter"], vistas));
  const r3 = await quiz.execute("q3", { ...base, multiSelect: true, correctAnswer: ["prop"] }, undefined, () => {}, ui(["space", "down", "down", "down", "down", "enter", "enter"], vistas));
  const r4 = await quiz.execute("q4", base, undefined, () => {}, ui(["tab", "esc", "esc"], vistas));
  for (const r of [r1, r2, r3, r4]) { modelo.push(r.content[0].text); vistas.push(render(quiz.renderResult(r, {}, theme))); }
  vistas.push(render(quiz.renderCall({ ...base, multiSelect: true }, theme)));
  const a1 = await ask.execute("a1", { question: "¿Seguimos?", options: [{ label: "Sí" }, { label: "No" }] }, undefined, () => {}, ui(["down", "down", "enter", ..."otra cosa", "enter"], vistas));
  const a2 = await ask.execute("a2", { question: "¿Qué repasamos?", multiSelect: true, options: [{ label: "A" }, { label: "B" }] }, undefined, () => {}, ui(["space", "down", "down", "enter", ..."C", "enter", "down", "enter"], vistas));
  const a3 = await ask.execute("a3", { question: "¿Algo más?", options: [{ label: "Sí" }, { label: "No" }] }, undefined, () => {}, ui(["esc"], vistas));
  const a4 = await ask.execute("a4", { question: "Contame tu objetivo" }, undefined, () => {}, ui([], vistas));
  for (const r of [a1, a2, a3, a4]) { modelo.push(r.content[0].text); vistas.push(render(ask.renderResult(r, {}, theme))); }
  vistas.push(render(ask.renderCall({ question: "¿Seguimos?", multiSelect: true, options: [{ label: "Sí" }, { label: "No" }] }, theme)));
  const ingles = /\b(I don't know|Note|Correct|Incorrect|Submit|Other|navigate|toggle|select|cancel|continue|Write your|Recommended|response|You said|Your note|Type note|newline|back|unknown|Awaiting|User|ask_user_question|Options?|empty)\b/;
  for (const linea of vistas.join("\n").split("\n")) assert.doesNotMatch(linea, ingles, linea);
  for (const t of modelo) assert.doesNotMatch(t, /User|Selected|Correct:|Explanation|I don't know|Other/, t);
  assert.match(vistas.join("\n"), /No sé/);
  assert.match(modelo[1], /No sé/); assert.match(modelo[1], /ni idea/);
  for (const texto of [ask.promptGuidelines.join("\n"), JSON.stringify(ask.parameters)]) assert.doesNotMatch(texto, /Recommended/);
});

test("H45: renderResult de un resultado parcial no lanza y dice que espera", () => {
  const parcial = { content: [{ type: "text", text: "Esperando respuesta…" }], details: { options: [{ index: 1, label: "A" }] } };
  assert.equal(render(quiz.renderResult(parcial, { expanded: false, isPartial: true }, theme)), "Esperando respuesta…");
});
