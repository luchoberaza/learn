// extensions/modelos.ts y scripts/lib/consumo.mjs (DA48, DA49): el registro de consumo, los cupos que informan los
// proveedores y el modelo principal de la máquina, con un pi simulado y carpetas temporales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarModelos } from "../extensions/modelos.ts";
import { agotadoDeCabeceras, anotarConsumo, cupoDeCabeceras, duracion, leerConsumo, leerCupos } from "../scripts/lib/consumo.mjs";

const USO = { input: 12, output: 480, cacheRead: 21000, cacheWrite: 900, cost: { total: 0.0105 } };
const CODEX = { provider: "openai-codex", id: "gpt-6.1-sol" };

// Las carpetas temporales de estos tests se borran al terminar.
const temporales = [];
const temporal = prefijo => { const d = mkdtempSync(join(tmpdir(), prefijo)); temporales.push(d); return d; };
process.on("exit", () => { for (const d of temporales) rmSync(d, { recursive: true, force: true }); });

// Un pi con lo justo: los manejadores registrados y el modelo que se eligió.
function piSimulado(recursos) {
  const manejadores = new Map();
  const pi = { elegido: undefined, on: (evento, f) => manejadores.set(evento, f), setModel: async m => { pi.elegido = m; return true; } };
  registrarModelos(pi, recursos);
  return { pi, h: (evento, ...args) => manejadores.get(evento)?.(...args) };
}
function carpetaNueva() {
  process.env.LEARN_CONSUMO_DIR = temporal("learn-consumo-");
  return process.env.LEARN_CONSUMO_DIR;
}

test("consumo: cada respuesta del modelo queda anotada con su consulta; lo demás no", async () => {
  carpetaNueva();
  const { h } = piSimulado();
  await h("agent_start", {}, { model: CODEX });
  await h("message_end", { message: { role: "user", content: "hola" } });
  await h("message_end", { message: { role: "assistant", provider: "anthropic", model: "claude-sonnet-5-5", usage: USO } });
  await h("message_end", { message: { role: "assistant", provider: "anthropic", model: "claude-sonnet-5-5", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } } });
  await h("message_end", { message: { role: "assistant", provider: "anthropic", model: "claude-sonnet-5-5", usage: USO } });
  const [marca, ...filas] = leerConsumo();
  assert.deepEqual({ ...marca, t: undefined, consulta: undefined }, { t: undefined, consulta: undefined, origen: "clase", proveedor: "openai-codex", modelo: "gpt-6.1-sol", marca: true });
  assert.equal(filas.length, 2);
  assert.equal(filas[0].consulta, marca.consulta);
  assert.deepEqual({ ...filas[0], t: undefined }, { t: undefined, origen: "clase", proveedor: "anthropic", modelo: "claude-sonnet-5-5", consulta: filas[0].consulta,
    entrada: 12, salida: 480, cacheLeida: 21000, cacheEscrita: 900, costo: 0.0105 });
  assert.ok(filas[0].consulta && filas[0].consulta === filas[1].consulta, "las dos llamadas son de la misma consulta");
  // Una línea cortada por un apagón no rompe la lectura.
  writeFileSync(join(process.env.LEARN_CONSUMO_DIR, "learn", "consumo.jsonl"), "{\"t\":\"2026", { flag: "a" });
  assert.equal(leerConsumo().length, 3);
});

test("consumo: responder un quiz o una pregunta abre una consulta nueva dentro del mismo turno; otra tool, no", async () => {
  carpetaNueva();
  const { h } = piSimulado();
  const ctx = { model: CODEX };
  const respuesta = () => h("message_end", { message: { role: "assistant", provider: "openai-codex", model: "gpt-6.1-sol", usage: USO } });
  await h("agent_start", {}, ctx);
  await respuesta();
  for (const toolName of ["quiz", "quiz", "leer_paginas", "ask_user_question"]) await h("tool_execution_end", { toolName, isError: false }, ctx);
  await h("tool_execution_end", { toolName: "quiz", isError: true }, ctx);
  await respuesta();
  await h("agent_end", {});
  const filas = leerConsumo();
  const consultas = new Set(filas.map(f => f.consulta));
  assert.equal(filas.filter(f => f.marca).length, 4, "el mensaje, dos quizzes y la pregunta");
  assert.equal(consultas.size, 4);
  assert.equal(filas.at(-1).consulta, filas.filter(f => f.marca).at(-1).consulta, "la respuesta del tutor queda en la consulta de la pregunta");
});

test("consumo: el verificador y los subagentes se anotan con su origen y no eligen modelo", async () => {
  carpetaNueva();
  for (const [variable, origen] of [["LEARN_ORIGEN", "verificador"], ["PI_SUBAGENT_NAME", "subagente"]]) {
    process.env[variable] = variable === "LEARN_ORIGEN" ? "verificador" : "scout";
    try {
      const recursos = temporal("learn-recursos-");
      writeFileSync(join(recursos, "curso.config.local.json"), JSON.stringify({ modelo_principal: "anthropic/claude-sonnet-5-5" }));
      const { pi, h } = piSimulado(recursos);
      await h("session_start", { reason: "startup" }, { model: CODEX, modelRegistry: { find: (p, id) => ({ provider: p, id }), hasConfiguredAuth: () => true } });
      assert.equal(pi.elegido, undefined, origen);
      await h("message_end", { message: { role: "assistant", provider: "openai-codex", model: "gpt-6-luna", usage: USO } });
    } finally { delete process.env[variable]; }
  }
  assert.deepEqual(leerConsumo().map(f => f.origen), ["verificador", "subagente"]);
});

test("cupos: la suscripción de ChatGPT informa sus dos ventanas, Groq los pedidos del día y un 429 queda como agotado", () => {
  const ahora = Date.UTC(2026, 9, 26, 15, 0, 0);
  const codex = cupoDeCabeceras("openai-codex", { "X-Codex-Primary-Used-Percent": "34.5", "x-codex-primary-window-minutes": "300", "x-codex-primary-reset-after-seconds": "3600",
    "x-codex-secondary-used-percent": "12", "x-codex-secondary-window-minutes": "10080", "x-codex-secondary-reset-at": String(ahora / 1000 + 86400), "x-codex-plan-type": "plus" }, ahora);
  assert.deepEqual(codex, { tipo: "ventanas", plan: "plus", ventanas: [
    { minutos: 300, usado: 34.5, renueva: ahora + 3600000 }, { minutos: 10080, usado: 12, renueva: ahora + 86400000 }] });
  assert.deepEqual(cupoDeCabeceras("groq", { "x-ratelimit-limit-requests": "1000", "x-ratelimit-remaining-requests": "990", "x-ratelimit-reset-requests": "2m59.56s" }, ahora),
    { tipo: "pedidos", periodo: "día", limite: 1000, quedan: 990, renueva: ahora + 179560 });
  // Las cabeceras por minuto de Anthropic u OpenAI no son un cupo del plan.
  assert.equal(cupoDeCabeceras("anthropic", { "anthropic-ratelimit-requests-remaining": "999" }, ahora), undefined);
  assert.equal(cupoDeCabeceras("openai", { "x-ratelimit-limit-requests": "500", "x-ratelimit-remaining-requests": "499" }, ahora), undefined);
  assert.equal(duracion("1h2m"), 3720000);
  assert.equal(duracion("350ms"), 350);
  assert.deepEqual(agotadoDeCabeceras({ "Retry-After": "30" }, ahora), { tipo: "agotado", desde: ahora, hasta: ahora + 30000 });
  assert.deepEqual(agotadoDeCabeceras({}, ahora), { tipo: "agotado", desde: ahora });
});

test("cupos: la extensión guarda el último cupo, el agotado y cuánto de la ventana gasta cada consulta", async () => {
  carpetaNueva();
  const { h } = piSimulado();
  const ctx = { model: CODEX };
  const respuesta = usado => h("after_provider_response", { status: 200, headers: { "x-codex-primary-used-percent": String(usado), "x-codex-primary-window-minutes": "300",
    "x-codex-primary-reset-at": "1792987200" } }, ctx);
  // La primera consulta no tiene con qué compararse; las siguientes, sí.
  for (const usado of [10, 12.5, 13]) {
    await h("agent_start", {}, ctx);
    await respuesta(usado);
    await h("agent_end", {});
  }
  let cupo = leerCupos()["openai-codex/gpt-6.1-sol"];
  assert.equal(cupo.ventanas[0].usado, 13);
  assert.deepEqual(cupo.porConsulta, [2.5, 0.5]);
  await h("after_provider_response", { status: 429, headers: { "retry-after": "120" } }, ctx);
  cupo = leerCupos()["openai-codex/gpt-6.1-sol"];
  assert.ok(cupo.agotado?.hasta > Date.now(), "el 429 queda anotado");
  assert.equal(cupo.ventanas[0].usado, 13, "sin perder lo anterior");
  await respuesta(14);
  assert.equal(leerCupos()["openai-codex/gpt-6.1-sol"].agotado, undefined, "una respuesta buena lo levanta");
});

test("modelo principal: una sesión nueva usa el de curso.config.local.json si tiene credenciales; una retomada o un --model, no", async () => {
  carpetaNueva();
  const recursos = temporal("learn-recursos-");
  const config = modelo => writeFileSync(join(recursos, "curso.config.local.json"), JSON.stringify({ modelo_principal: modelo }));
  const ctx = (credenciales = true) => ({ model: CODEX, modelRegistry: { find: (p, id) => p === "inexistente" ? undefined : { provider: p, id }, hasConfiguredAuth: () => credenciales } });
  config("anthropic/claude-sonnet-5-5");
  for (const reason of ["startup", "new"]) {
    const { pi, h } = piSimulado(recursos);
    await h("session_start", { reason }, ctx());
    assert.deepEqual(pi.elegido, { provider: "anthropic", id: "claude-sonnet-5-5" }, reason);
  }
  for (const [reason, c, nombre] of [["resume", ctx(), "anthropic/claude-sonnet-5-5"], ["fork", ctx(), "anthropic/claude-sonnet-5-5"], ["startup", ctx(false), "anthropic/claude-sonnet-5-5"],
    ["startup", ctx(), "inexistente/x"], ["startup", ctx(), "sin-barra"], ["startup", ctx(), "openai-codex/gpt-6.1-sol"]]) {
    config(nombre);
    const { pi, h } = piSimulado(recursos);
    await h("session_start", { reason }, c);
    assert.equal(pi.elegido, undefined, `${reason} ${nombre}`);
  }
  const argv = process.argv;
  process.argv = [...argv, "--model", "openai-codex/gpt-6-luna"];
  try {
    config("anthropic/claude-sonnet-5-5");
    const { pi, h } = piSimulado(recursos);
    await h("session_start", { reason: "startup" }, ctx());
    assert.equal(pi.elegido, undefined, "--model explícito");
  } finally { process.argv = argv; }
});

test("consumo: sin datos de uso o sin carpeta escribible no corta a quien llama", () => {
  carpetaNueva();
  assert.doesNotThrow(() => anotarConsumo({ origen: "clase", proveedor: "anthropic", modelo: "x", usage: undefined }));
  assert.doesNotThrow(() => anotarConsumo({ origen: "clase", proveedor: "anthropic", modelo: "x", usage: USO }, join(process.env.LEARN_CONSUMO_DIR, "\0invalida")));
  assert.equal(leerConsumo().length, 0);
});

// DA58: los subagentes de agents/*.md fijan un modelo de openai-codex; learn tiene que andar con la clave del alumno.
test("DA58: un subagente cuyo modelo no tiene credenciales va con el de la conversación; si las tiene o no fija modelo, no se toca", () => {
  const recursos = temporal("learn-agentes-");
  mkdirSync(join(recursos, "agents"));
  writeFileSync(join(recursos, "agents/scout.md"), "---\nname: scout\nmodel: openai-codex/gpt-6-luna\n---\nCuerpo.\n");
  writeFileSync(join(recursos, "agents/libre.md"), "---\nname: libre\n---\nSin modelo.\n");
  const { h } = piSimulado(recursos);
  const ctx = (conCodex = false) => ({ model: { provider: "anthropic", id: "claude-sonnet-5-5" },
    modelRegistry: { find: (provider, id) => ({ provider, id }), hasConfiguredAuth: m => m.provider === "anthropic" || (conCodex && m.provider === "openai-codex") } });
  const llamada = (input, c = ctx()) => { const evento = { toolName: "subagent", input: { task: "x", ...input } }; h("tool_call", evento, c); return evento.input.model; };
  assert.equal(llamada({ agent: "scout" }), "anthropic/claude-sonnet-5-5");
  assert.equal(llamada({ agent: "scout" }, ctx(true)), undefined);
  assert.equal(llamada({ agent: "libre" }), undefined);
  assert.equal(llamada({ agent: "scout", model: "openai-codex/gpt-6-luna:high" }), "anthropic/claude-sonnet-5-5");
  assert.equal(llamada({ agent: "scout", model: "anthropic/claude-opus-5-5" }), "anthropic/claude-opus-5-5");
  const otra = { toolName: "bash", input: { command: "ls" } };
  h("tool_call", otra, ctx());
  assert.deepEqual(otra.input, { command: "ls" });
});
