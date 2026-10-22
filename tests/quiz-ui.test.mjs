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

test("H46: el popup y el render del quiz muestran texto plano en lugar de LaTeX", async () => {
  const vistas = [];
  let parcial;
  const r = await quiz.execute("l1", {
    question: "Un paquete de $1200\\,\\text{bytes}$ sale a $8\\times10^6\\,\\text{bits/s}$ por $A\\to\\text{router}\\to B$. ¿Cuánto tarda $d_{\\text{trans}}$ si $x_1 = 2^{-3}$?",
    details: "Usá $1\\,\\text{byte}=8\\,\\text{bits}$ y $a\\cdot b$; dejá $\\alpha$.",
    options: [{ label: "$1{,}2\\,\\text{ms}$", value: "ok" }, { label: "$\\tfrac{1}{3}\\,\\text{s}$", value: "b" }, { label: "$\\frac{a+b}{c}$", value: "c" }],
    correctAnswer: "ok", explanation: "$L/R$",
  }, undefined, u => { parcial ??= u; }, ui(["enter", "enter"], vistas));
  const fino = " ";
  const popup = vistas[0];
  assert.ok(popup.includes(`Un paquete de 1200${fino}bytes sale a 8×10⁶${fino}bits/s por A→router→B. ¿Cuánto tarda d_trans si x₁ = 2⁻³?`), popup);
  assert.ok(popup.includes(`Usá 1${fino}byte=8${fino}bits y a·b; dejá \\alpha.`), popup);
  for (const o of [`1,2${fino}ms`, `1/3${fino}s`, "(a+b)/c"]) assert.ok(popup.includes(o), o);
  assert.doesNotMatch(popup, /\$|\\text|\{,\}|\\times|\\frac/);
  assert.deepEqual(parcial.details.options.map(o => o.label).sort(), [`1,2${fino}ms`, `1/3${fino}s`, "(a+b)/c"].sort());
  assert.doesNotMatch(r.content[0].text.split("\nExplicación")[0], /\$/);
  assert.doesNotMatch(render(quiz.renderCall({ question: "¿$2^{10}$?", options: [] }, theme)), /\$/);
  assert.match(quiz.description + JSON.stringify(quiz.parameters), /plain text|Unicode/i);
});

test("H47: single-select con 2 opciones se rechaza en español sin abrir el popup; con 3 o multi-select se acepta", async () => {
  let abrio = false, logueo = false;
  const ctx = { hasUI: true, ui: { custom: () => { abrio = true; return Promise.resolve(null); } } };
  const dos = { ...base, options: base.options.slice(0, 2) };
  const r = await quiz.execute("d1", dos, undefined, () => { logueo = true; }, ctx);
  assert.equal(r.details.status, "unavailable");
  assert.match(r.content[0].text, /3 opciones/);
  assert.equal(abrio, false); assert.equal(logueo, false);
  const multi = await quiz.execute("d2", { ...dos, multiSelect: true, correctAnswer: ["prop"] }, undefined, () => {}, ctx);
  assert.equal(multi.details.status, "cancelled");
  const tres = await quiz.execute("d3", base, undefined, () => {}, ctx);
  assert.equal(tres.details.status, "cancelled");
});

test("H47: descriptions asimétricas se descartan; parejas se muestran", async () => {
  const una = [], todas = [];
  await quiz.execute("e1", { ...base, options: base.options.map((o, i) => i === 0 ? { ...o, description: "PISTA d/s" } : o) }, undefined, () => {}, ui(["esc"], una));
  assert.ok(!una[0].includes("PISTA"), una[0]);
  await quiz.execute("e2", { ...base, options: base.options.map((o, i) => ({ ...o, description: `DESC${i}` })) }, undefined, () => {}, ui(["esc"], todas));
  for (const i of [0, 1, 2]) assert.ok(todas[0].includes(`DESC${i}`));
});

test("H49: details no muestra enlaces antes de responder", async () => {
  const vistas = [];
  await quiz.execute("f1", { ...base, question: "¿Cuál? ver https://x.org/a", details: "Datos: d = 100 km.\nReferencia: [[cursos/redes/fuentes/Redes.pdf#page=56]]\nMás en [Kurose](https://kurose.net) y [[nota|alias]]." },
    undefined, () => {}, ui(["esc"], vistas));
  const encabezado = vistas[0];
  assert.doesNotMatch(encabezado, /\[\[|\]\]|\]\(|https?:|#page|Referencia|kurose\.net/);
  assert.match(encabezado, /Datos: d = 100 km\.\n Más en Kurose y alias\./);
  assert.doesNotMatch(render(quiz.renderCall({ ...base, question: "¿Cuál? [[x#page=5]]" }, theme)), /\[\[/);
});

test("H50: shuffle:false no fija la correcta salvo opciones numéricas, que se ordenan", async () => {
  const posiciones = new Set();
  for (let k = 0; k < 60; k++) {
    let orden;
    await quiz.execute("s" + k, { ...base, shuffle: false }, undefined, u => { orden ??= u.details.options; }, { hasUI: false });
    posiciones.add(orden.findIndex(o => o.label === "Retardo de propagación"));
  }
  assert.ok(posiciones.size > 1, "la correcta quedó siempre en la misma posición");
  const numericas = { ...base, shuffle: false, correctAnswer: "c", options: [
    { label: "$1200\\,\\text{ms}$", value: "a" }, { label: "$0{,}15\\,\\text{ms}$", value: "b" }, { label: "$1{,}2\\,\\text{ms}$", value: "c" }, { label: "8 ms", value: "d" }] };
  let orden;
  await quiz.execute("n1", numericas, undefined, u => { orden = u.details.options.map(o => o.label); }, { hasUI: false });
  assert.deepEqual(orden.map(l => l.split(" ")[0].split(" ")[0]), ["0,15", "1,2", "8", "1200"]);
  const mezcladas = new Set();
  for (let k = 0; k < 40; k++) await quiz.execute("m" + k, { ...numericas, shuffle: undefined }, undefined, u => { mezcladas.add(u.details.options[0].label); }, { hasUI: false });
  assert.ok(mezcladas.size > 1, "sin shuffle:false las numéricas también se barajan");
});

test("H49: quitar enlaces no borra condiciones del enunciado", async () => {
  const vistas = [];
  await quiz.execute("f2", { ...base, details: [
    "Considerá un enlace de [[propagacion|retardo de propagación]] alto",
    "Pensá en [[retardo de cola]] y en el tamaño del buffer",
    "Según el libro [[cursos/redes/fuentes/Redes.pdf#page=56]] calculá el retardo de cola",
    "![[cursos/redes/figuras/fig-1.png]]",
    "Ver [[cursos/redes/fuentes/Redes.pdf#page=56]]",
    "Sin propagación  ni cola",
  ].join("\n") }, undefined, () => {}, ui(["esc"], vistas));
  const encabezado = vistas[0];
  for (const l of ["Considerá un enlace de retardo de propagación alto", "Pensá en retardo de cola y en el tamaño del buffer", "Según el libro calculá el retardo de cola", "Sin propagación  ni cola"]) assert.ok(encabezado.includes(l), l);
  assert.doesNotMatch(encabezado, /\[\[|page=|^ *!$|^ *Ver$/m);
});

test("H46: fracciones con potencias y \\displaystyle quedan legibles", async () => {
  let parcial;
  await quiz.execute("l2", { ...base, question: "¿$\\frac{2^{10}}{8}$ y $\\displaystyle\\frac{dy}{du}=12u^2$ si $h\\ne0$ y $\\left(a+b\\right)$?" },
    undefined, u => { parcial ??= u; }, { hasUI: false });
  assert.equal(parcial.details.question, "¿2¹⁰/8 y dy/du=12u² si h≠0 y (a+b)?");
});
