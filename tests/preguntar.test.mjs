import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

// Puente con la app de escritorio (extensions/comun/preguntar.ts): con ctx.ui.preguntar la pregunta llega armada y la app
// la dibuja; sin él, cada tool sigue con su popup de la terminal.
let p, quiz, ask;
before(async () => {
  p = await loadProject();
  quiz = p.session.extensionRunner.getToolDefinition("quiz");
  ask = p.session.extensionRunner.getToolDefinition("ask_user_question");
});
after(() => p?.close());

const base = { question: "¿Qué retardo depende de la distancia del enlace? [[cursos/redes/fuentes/bibliografia/k.pdf#page=54]]", details: "Con $d = 2\\,\\text{km}$.",
  options: [{ label: "Retardo de propagación", value: "prop" }, { label: "Retardo de transmisión", value: "trans" }, { label: "Retardo de cola", value: "cola" }],
  correctAnswer: "prop", explanation: "$d_{prop} = d/s$ depende de la distancia [[cursos/redes/fuentes/bibliografia/k.pdf#page=54]]." };
// Una app falsa que anota cada pedido y contesta con lo que le pase la prueba.
function app(responder, modo = "rpc") {
  const pedidos = [];
  return { pedidos, ctx: { hasUI: true, mode: modo, ui: { custom: () => assert.fail("con app no se abre el popup de la terminal"), preguntar: async (pedido, signal) => { pedidos.push(pedido); return responder(pedido, signal); } } } };
}
const correcta = pedido => pedido.opciones.find(o => o.label === "Retardo de propagación").indice;

test("Puente: el quiz llega a la app barajado, sin enlaces ni LaTeX en el enunciado, con la correcta y la explicación para después", async () => {
  const a = app(pedido => ({ noSe: false, elegidas: [correcta(pedido)] })), parciales = [];
  const r = await quiz.execute("q1", base, undefined, u => parciales.push(u), a.ctx);
  const [pedido] = a.pedidos;
  assert.equal(pedido.tipo, "quiz"); assert.equal(pedido.modo, "single-select");
  assert.doesNotMatch(pedido.pregunta, /\[\[|page=/); assert.equal(pedido.contexto, "Con d = 2 km.");
  assert.deepEqual(pedido.opciones.map(o => o.indice), [1, 2, 3]);
  assert.deepEqual(pedido.correctas, [correcta(pedido)]);
  assert.match(pedido.explicacion, /d_\{prop\}/);
  // md-log sigue recibiendo el orden barajado antes de que la app espere la respuesta.
  assert.deepEqual(parciales[0].details.options.map(o => o.label), pedido.opciones.map(o => o.label));
  assert.equal(r.details.status, "answered"); assert.equal(r.details.correct, true);
  assert.match(r.content[0].text, /^El alumno respondió bien\./);
});

test("Puente: respuesta incorrecta, «No sé» con nota y multi-select se corrigen igual que en el popup", async () => {
  const mal = await quiz.execute("q2", base, undefined, () => {}, app(pedido => ({ noSe: false, elegidas: [pedido.opciones.find(o => o.label === "Retardo de cola").indice] })).ctx);
  assert.equal(mal.details.correct, false); assert.equal(mal.details.answers[0].label, "Retardo de cola");
  const nose = await quiz.execute("q3", base, undefined, () => {}, app(() => ({ noSe: true, elegidas: [], nota: "  confundo los dos  " })).ctx);
  assert.equal(nose.details.dontKnow, true); assert.equal(nose.details.note, "confundo los dos"); assert.deepEqual(nose.details.answers, []);
  assert.match(nose.content[0].text, /«No sé»: no intentó responder/);
  const multi = await quiz.execute("q4", { ...base, multiSelect: true, correctAnswer: ["prop", "cola"] }, undefined, () => {},
    app(pedido => ({ noSe: false, elegidas: pedido.opciones.filter(o => o.label !== "Retardo de transmisión").map(o => o.indice).reverse() })).ctx);
  assert.equal(multi.details.correct, true); assert.equal(multi.details.mode, "multi-select");
  assert.deepEqual(multi.details.answers.map(x => x.index), [...multi.details.answers.map(x => x.index)].sort((x, y) => x - y));
});

test("Puente: cancelar en la app o mandar una respuesta vacía deja la pregunta cancelada, sin calificar", async () => {
  for (const respuesta of [null, { noSe: false, elegidas: [] }, { noSe: false, elegidas: [99] }]) {
    const r = await quiz.execute("q5", base, undefined, () => {}, app(() => respuesta).ctx);
    assert.equal(r.details.status, "cancelled", JSON.stringify(respuesta)); assert.equal(r.details.correct, undefined);
  }
  for (const respuesta of [null, [], [{ tipo: "option", indice: 7 }], [{ tipo: "other", texto: "  " }]]) {
    const r = await ask.execute("a0", { question: "¿Seguimos?", options: [{ label: "Dale" }, { label: "Ajustar" }] }, undefined, () => {}, app(() => respuesta).ctx);
    assert.equal(r.details.status, "cancelled", JSON.stringify(respuesta));
  }
});

test("Puente: ask_user_question con botones, «Otra» con texto, varias respuestas ordenadas y texto libre", async () => {
  const plan = { question: "¿Aprobás el plan?", details: "Cuatro nodos.", options: [{ label: "Dale", description: "Empezamos" }, { label: "Ajustar" }] };
  const a = app(() => [{ tipo: "option", indice: 1 }]);
  const r1 = await ask.execute("a1", plan, undefined, () => {}, a.ctx);
  assert.deepEqual(a.pedidos[0], { tipo: "ask", pregunta: "¿Aprobás el plan?", contexto: "Cuatro nodos.", modo: "single-select", etiquetaOtra: "Otra",
    opciones: [{ indice: 1, label: "Dale", value: "Dale", description: "Empezamos" }, { indice: 2, label: "Ajustar", value: "Ajustar" }] });
  assert.equal(r1.content[0].text, "El alumno eligió: 1. Dale");
  const r2 = await ask.execute("a2", plan, undefined, () => {}, app(() => [{ tipo: "other", texto: " Más ejemplos primero " }]).ctx);
  assert.equal(r2.content[0].text, "El alumno eligió: Otra: Más ejemplos primero");
  const r3 = await ask.execute("a3", { ...plan, multiSelect: true }, undefined, () => {}, app(() => [{ tipo: "other", texto: "Y repaso" }, { tipo: "option", indice: 2 }, { tipo: "option", indice: 1 }, { tipo: "option", indice: 1 }]).ctx);
  assert.equal(r3.content[0].text, "El alumno eligió:\n- 1. Dale\n- 2. Ajustar\n- Otra: Y repaso");
  const r4 = await ask.execute("a4", { question: "Contame tu objetivo" }, undefined, () => {}, app(() => [{ tipo: "text", texto: "Aprobar el parcial " }]).ctx);
  assert.equal(r4.content[0].text, "Respuesta del alumno: Aprobar el parcial");
  assert.equal(r4.details.mode, "text");
});

test("Puente: sin preguntar todo sigue como antes, y en la terminal manda el popup aunque haya preguntar", async () => {
  // RPC sin app: custom no existe (devuelve undefined) y el quiz queda cancelado, como en pi 1.4.0.
  const rpc = await quiz.execute("q6", base, undefined, () => {}, { hasUI: true, mode: "rpc", ui: { custom: async () => undefined } });
  assert.equal(rpc.details.status, "cancelled");
  // En la terminal (mode tui) el popup es el de siempre; preguntar no se llama.
  let llamadas = 0;
  const tui = await quiz.execute("q7", base, undefined, () => {}, { hasUI: true, mode: "tui", ui: { preguntar: async () => { llamadas++; return null; }, custom: factory => new Promise(res => {
    const c = factory({ requestRender() {} }, { fg: (_c, s) => s, bold: s => s }, {}, res); c.handleInput("\r"); c.handleInput("\r"); }) } });
  assert.equal(llamadas, 0); assert.equal(tui.details.status, "answered");
});

test("Puente: un corte del turno con la pregunta abierta en la app la cierra como cancelada y termina el turno", async () => {
  const corte = new AbortController();
  const a = app((_pedido, signal) => new Promise(res => { signal.addEventListener("abort", () => res(null), { once: true }); setTimeout(() => corte.abort(), 10); }));
  const r = await quiz.execute("q8", base, corte.signal, () => {}, a.ctx);
  assert.equal(r.details.status, "cancelled"); assert.equal(r.terminate, true);
  assert.equal(a.pedidos.length, 1);
});
