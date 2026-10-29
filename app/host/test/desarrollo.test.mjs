import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { crearFiltro } from "../filtro.mjs";
import { crearInterfaz } from "../interfaz.mjs";
import { PI_DIR } from "./ayuda.mjs";

// Pregunta de desarrollo (DA52): la respuesta esperada nunca llega a la ventana antes de que el alumno conteste.
const etiquetas = await import(pathToFileURL(join(PI_DIR, "extensions/curso/etiquetas.ts")).href);
const texto = m => JSON.stringify(m);
const args = { pregunta: "¿Por qué no depende de L?", detalles: "Con d = 2 km.", respuesta_esperada: "ESPERADA: depende de d y s" };

test("filtro: la pregunta de desarrollo arranca como tarjeta sin args y termina con lo escrito y la esperada", () => {
  const f = crearFiltro({ etiquetas });
  assert.deepEqual(f.evento({ type: "tool_execution_start", toolCallId: "d1", toolName: "pregunta_desarrollo", args }), [{ tipo: "qa-inicio", id: "d1", nombre: "pregunta_desarrollo" }]);
  assert.deepEqual(f.evento({ type: "tool_execution_update", toolCallId: "d1", toolName: "pregunta_desarrollo", args, partialResult: { details: { tipo: "desarrollo", question: args.pregunta } } }), []);
  const details = { status: "answered", tipo: "desarrollo", question: args.pregunta, context: args.detalles, clase: "Explicación previa.", answer: "por la distancia", dontKnow: false, expected: args.respuesta_esperada };
  const fin = f.evento({ type: "tool_execution_end", toolCallId: "d1", toolName: "pregunta_desarrollo", result: { content: [{ type: "text", text: "para el modelo" }], details } });
  assert.deepEqual(fin, [{ tipo: "item", item: { tipo: "desarrollo", id: "d1", pregunta: args.pregunta, contexto: args.detalles, explicacionPrevia: "Explicación previa.", estado: "respondido", resultado: { noSe: false, texto: "por la distancia", esperada: args.respuesta_esperada } } }, { tipo: "qa-fin", id: "d1" }]);
  // Descartada por forma (sin pregunta): una línea, como el quiz rechazado.
  const descartada = f.evento({ type: "tool_execution_end", toolCallId: "d2", toolName: "pregunta_desarrollo", result: { details: { status: "unavailable", tipo: "desarrollo", question: "", message: "Pregunta descartada; ya viene otra." } } });
  assert.equal(descartada[0].item.tipo, "aviso-linea");
});

test("filtro: en la transcripción guardada la llamada no deja ver respuesta_esperada; cancelada o «No sé» se ven como tales", () => {
  const f = crearFiltro({ etiquetas });
  const t = f.transcripcion([
    { type: "message", id: "e1", message: { role: "assistant", content: [{ type: "text", text: "Probemos." }, { type: "toolCall", id: "d1", name: "pregunta_desarrollo", arguments: args }] } },
    { type: "message", id: "e2", message: { role: "toolResult", toolCallId: "d1", toolName: "pregunta_desarrollo", details: { status: "cancelled", tipo: "desarrollo", question: args.pregunta, motivo: "al cambiar de tema" } } },
    { type: "message", id: "e3", message: { role: "assistant", content: [{ type: "toolCall", id: "d2", name: "pregunta_desarrollo", arguments: args }] } },
    { type: "message", id: "e4", message: { role: "toolResult", toolCallId: "d2", toolName: "pregunta_desarrollo", details: { status: "answered", tipo: "desarrollo", question: args.pregunta, dontKnow: true, expected: "Algo" } } },
  ]);
  assert.doesNotMatch(texto(t.filter(i => i.id !== "d2")), /ESPERADA|respuesta_esperada/);
  assert.deepEqual(t.map(i => [i.tipo, i.estado]), [["tutor", undefined], ["desarrollo", "cancelado"], ["desarrollo", "respondido"]]);
  assert.equal(t[1].motivo, "al cambiar de tema");
  assert.deepEqual(t[2].resultado, { noSe: true, esperada: "Algo" });
});

test("interfaz: la tarjeta toma el id de la tool, recibe la esperada recién al responder y termina al seguir", async () => {
  const enviados = [], i = crearInterfaz({ enviar: m => enviados.push(m) });
  i.inicioQA("d1", "pregunta_desarrollo");
  const promesa = i.uiContext.preguntar({ tipo: "desarrollo", pregunta: args.pregunta, contexto: args.detalles, esperada: args.respuesta_esperada, clase: "La propagación depende de d." });
  const [pedido] = enviados;
  // En la app «clase» es la clase del pedido: la explicación previa viaja aparte.
  assert.deepEqual(pedido, { tipo: "pedido", id: "d1", clase: "desarrollo", pregunta: args.pregunta, contexto: args.detalles, explicacionPrevia: "La propagación depende de d." });
  assert.doesNotMatch(texto(enviados), /ESPERADA/);
  assert.equal(i.responder("d1", { noSe: false, texto: "  por la distancia  " }), true);
  assert.deepEqual(enviados.at(-1), { tipo: "correccion", id: "d1", noSe: false, texto: "por la distancia", esperada: args.respuesta_esperada });
  i.responder("d1", { seguir: true });
  assert.deepEqual(await promesa, { noSe: false, texto: "por la distancia" });
});

test("interfaz: vacía o null cancela; «No sé» vale; un corte después de ver la esperada conserva la respuesta", async () => {
  // Sin aviso de la tool, la interfaz inventa el id: se toma del pedido enviado.
  for (const vacia of [null, { noSe: false, texto: "   " }, { noSe: false }]) {
    let pedido;
    const j = crearInterfaz({ enviar: m => { if (m.tipo === "pedido") pedido = m; } });
    const q = j.uiContext.preguntar({ tipo: "desarrollo", pregunta: "¿?", esperada: "x" });
    j.responder(pedido.id, vacia);
    assert.equal(await q, null, JSON.stringify(vacia));
  }
  let pedido;
  const k = crearInterfaz({ enviar: m => { if (m.tipo === "pedido") pedido = m; } }), corte = new AbortController();
  const r = k.uiContext.preguntar({ tipo: "desarrollo", pregunta: "¿?", esperada: "x" }, corte.signal);
  k.responder(pedido.id, { noSe: true });
  corte.abort();
  assert.deepEqual(await r, { noSe: true });
});

test("filtro: una pregunta que la guardia no mostró (faltaba la explicación) no llega a la ventana, ni en vivo ni guardada", () => {
  const f = crearFiltro({ etiquetas });
  for (const toolName of ["quiz", "pregunta_desarrollo"]) {
    const details = { status: "unavailable", interno: true, question: "¿Qué retardo depende de la distancia?" };
    assert.deepEqual(f.evento({ type: "tool_execution_end", toolCallId: "g1", toolName, result: { content: [{ type: "text", text: "Pregunta no mostrada: …" }], details } }), [{ tipo: "qa-fin", id: "g1" }]);
    const t = f.transcripcion([{ type: "message", id: "e1", message: { role: "toolResult", toolCallId: "g1", toolName, details } }]);
    assert.deepEqual(t, [], toolName);
  }
});
