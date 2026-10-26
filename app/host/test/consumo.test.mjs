// host/consumo.mjs (DA48): períodos del plan, perfil de una consulta, costo por modelo, lo que queda en cada cuenta y la
// sugerencia de otro modelo. Sin pi ni red: filas, cupos y respuestas de los proveedores armadas a mano.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ciclo, costoConsulta, crearConsumo, estimar, fechado, medianocheEn, PERFIL_MEDIDO, perfil, resumenCuenta, saldoRemoto, sugerir } from "../consumo.mjs";

const SONNET = { provider: "anthropic", id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", input: ["text", "image"], reasoning: true, cost: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 } };
const HAIKU = { provider: "anthropic", id: "claude-haiku-5-5", name: "Claude Haiku 5.5", input: ["text", "image"], reasoning: true, cost: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 } };
const OPUS = { provider: "anthropic", id: "claude-opus-5-5", name: "Claude Opus 5.5", input: ["text", "image"], reasoning: true, cost: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } };
const fila = (t, extra = {}) => ({ t: new Date(t).toISOString(), origen: "clase", proveedor: "anthropic", modelo: "claude-sonnet-5-5", entrada: 3, salida: 700, cacheLeida: 30000, cacheEscrita: 3000, costo: 0.02, ...extra });

test("consumo: el período del plan va del día de renovación al mismo día del mes siguiente", () => {
  const plan = { tipo: "mensual", monto: 200, dia: 15 };
  assert.deepEqual(ciclo(plan, new Date(2026, 9, 10)), { desde: new Date(2026, 8, 15).getTime(), hasta: new Date(2026, 9, 15).getTime() });
  assert.deepEqual(ciclo(plan, new Date(2026, 9, 20)), { desde: new Date(2026, 9, 15).getTime(), hasta: new Date(2026, 10, 15).getTime() });
  assert.deepEqual(ciclo({ tipo: "mensual", dia: 31 }, new Date(2026, 1, 28, 12)).desde, new Date(2026, 1, 28).getTime(), "el día se acota a 28");
  assert.deepEqual(ciclo({ tipo: "saldo", monto: 10, desde: "2026-10-01" }), { desde: Date.parse("2026-10-01") });
  assert.deepEqual(ciclo(undefined, new Date(2026, 9, 26)), { desde: new Date(2026, 9, 1).getTime(), hasta: new Date(2026, 10, 1).getTime() });
  const ahora = new Date();
  const m = medianocheEn("America/Los_Angeles", ahora);
  assert.ok(m <= ahora.getTime() && m > ahora.getTime() - 86400000);
});

test("consumo: la consulta promedio sale de las propias, y sin historia de lo medido en la clase real", () => {
  assert.deepEqual(perfil([], "anthropic/claude-sonnet-5-5"), PERFIL_MEDIDO);
  const filas = [];
  for (let i = 0; i < 6; i++) filas.push(fila(Date.now() - i * 1000, { consulta: `c${i}` }), fila(Date.now() - i * 1000, { consulta: `c${i}`, salida: 300, cacheLeida: 20000 }));
  filas.push(fila(Date.now(), { origen: "preparación", salida: 99999 }));
  const p = perfil(filas, "anthropic/claude-sonnet-5-5");
  assert.equal(p.muestras, 6);
  assert.equal(p.llamadas, 2);
  assert.equal(p.salida, 1000, "la preparación no cuenta como consulta");
  assert.equal(p.cacheLeida, 50000);
  // Tres quizzes contestados juntos: tres marcas y una sola llamada después. El promedio es por acción del alumno.
  const marca = (consulta, t) => ({ t: new Date(t).toISOString(), origen: "clase", proveedor: "anthropic", modelo: "claude-sonnet-5-5", consulta, marca: true });
  const juntas = [marca("q1", 1), marca("q2", 2), marca("q3", 3), fila(4, { consulta: "q3", salida: 900 })];
  const pj = perfil(juntas, "anthropic/claude-sonnet-5-5");
  assert.equal(pj.muestras, 3);
  assert.equal(pj.salida, 300);
  assert.equal(pj.llamadas, 1 / 3);
  assert.ok(fechado("claude-opus-4-5-20251101") && !fechado("claude-opus-4-5"));
});

test("consumo: el costo de una consulta usa los precios del catálogo, con la caché a su precio", () => {
  // Lo medido con Sonnet 5.5 da los 0,019 USD por consulta de la clase real.
  assert.equal(Math.round(costoConsulta(PERFIL_MEDIDO, SONNET.cost) * 1e5), 1886);
  assert.equal(Math.round(costoConsulta(PERFIL_MEDIDO, OPUS.cost) * 1e5), 3773);
  // Sin precio de caché, la caché cuenta como entrada.
  assert.equal(costoConsulta({ entrada: 0, salida: 0, cacheLeida: 1e6, cacheEscrita: 0 }, { input: 3, output: 15 }), 3);
  assert.equal(costoConsulta(PERFIL_MEDIDO, undefined), undefined);
});

test("consumo: cada cuenta dice cuánto queda en su unidad (dólares del plan, ventanas, pedidos) o que no tiene límite", () => {
  const ahora = new Date(2026, 9, 26, 12).getTime();
  const filas = [fila(new Date(2026, 9, 20), { costo: 30 }), fila(new Date(2026, 9, 26, 9), { costo: 12.5, origen: "verificador" }), fila(new Date(2026, 8, 30), { costo: 99 })];
  const dinero = resumenCuenta({ proveedor: "anthropic", nombre: "Anthropic", filas, plan: { tipo: "mensual", monto: 200, dia: 3, preset: "max20" }, ahora });
  assert.equal(dinero.tipo, "dinero");
  assert.equal(dinero.gastado, 42.5, "sólo lo del período");
  assert.equal(dinero.queda, 157.5);
  assert.equal(dinero.porOrigen.verificador, 12.5);
  assert.equal(dinero.renueva, new Date(2026, 10, 3).getTime());
  assert.equal(dinero.porDia.length, 14);
  assert.equal(dinero.porDia.at(-1).costo, 12.5);

  const cupos = { "openai-codex/gpt-6.1-sol": { tipo: "ventanas", ventanas: [{ minutos: 300, usado: 40, renueva: ahora + 3600000 }], t: new Date(ahora).toISOString() } };
  const ventanas = resumenCuenta({ proveedor: "openai-codex", filas: [], cupos, ahora });
  assert.equal(ventanas.tipo, "ventanas");
  assert.equal(ventanas.ventanas[0].usado, 40);
  assert.equal(resumenCuenta({ proveedor: "openai-codex", filas: [], ahora }).tipo, "sin-dato");

  const google = resumenCuenta({ proveedor: "google", filas: [fila(ahora - 60000, { proveedor: "google" }), fila(ahora - 120000, { proveedor: "google" })], plan: { tipo: "gratis", pedidosDia: 20 }, ahora });
  assert.equal(google.tipo, "pedidos");
  assert.equal(google.pedidos.quedan, 18);

  assert.equal(resumenCuenta({ proveedor: "ollama", filas: [], local: true, ahora }).tipo, "local");
  assert.equal(resumenCuenta({ proveedor: "openai", filas: [], ahora }).tipo, "sin-tope");
  const remoto = resumenCuenta({ proveedor: "openrouter", filas: [], remoto: { queda: 7.25, limite: 10, pedidos: { quedan: 40, limite: 50, gratis: true } }, ahora });
  assert.equal(remoto.tipo, "dinero");
  assert.equal(remoto.fuente, "el proveedor");

  const agotado = resumenCuenta({ proveedor: "anthropic", filas, plan: { tipo: "mensual", monto: 200, dia: 3 },
    cupos: { "anthropic/claude-sonnet-5-5": { agotado: { tipo: "agotado", desde: ahora - 1000, hasta: ahora + 60000 } } }, ahora });
  assert.equal(agotado.agotado.hasta, ahora + 60000);
});

test("consumo: los modelos gratis y los planes de tokens se cuentan en pedidos y tokens, por modelo", () => {
  const ahora = new Date(2026, 9, 26, 12).getTime();
  const gratis = (modelo, hace, extra = {}) => fila(ahora - hace, { proveedor: "nvidia", modelo, costo: 0, ...extra });
  const filas = [gratis("deepseek-v4", 60000, { consulta: "a" }), gratis("deepseek-v4", 50000, { consulta: "a" }), gratis("qwen-3.8", 40000, { consulta: "b" }),
    { t: new Date(ahora - 45000).toISOString(), origen: "clase", proveedor: "nvidia", modelo: "deepseek-v4", consulta: "a", marca: true },
    gratis("deepseek-v4", 3 * 86400000)];
  const c = resumenCuenta({ proveedor: "nvidia", filas, gratis: true, ahora });
  assert.equal(c.tipo, "gratis");
  assert.equal(c.gastado, 0);
  assert.deepEqual(c.uso.hoy, { pedidos: 3, tokens: 3 * 33703 }, "la marca de consulta no es un pedido");
  assert.equal(c.uso.periodo.pedidos, 4);
  assert.deepEqual(c.porModelo.map(m => [m.modelo, m.pedidos, m.consultas]), [["deepseek-v4", 3, 1], ["qwen-3.8", 1, 1]]);
  // Con el límite diario de su plan gratis, se ve cuánto queda.
  assert.equal(resumenCuenta({ proveedor: "nvidia", filas, gratis: true, plan: { tipo: "gratis", pedidosDia: 40 }, ahora }).pedidos.quedan, 37);
  // Un plan de tokens (Qwen, Xiaomi, Kimi, GLM) no informa su cupo: se muestra lo usado, no «después de la primera respuesta».
  assert.equal(resumenCuenta({ proveedor: "qwen-token-plan", filas: [], ahora }).tipo, "suscripcion");
  assert.equal(resumenCuenta({ proveedor: "openai-codex", filas: [], ahora }).tipo, "sin-dato");
  // DeepSeek directo, con el saldo regalado al registrarse, informa lo que queda.
  assert.equal(resumenCuenta({ proveedor: "deepseek", filas: [], remoto: { queda: 4.2, moneda: "USD" }, ahora }).queda, 4.2);
});

test("consumo: una cuenta de modelos gratis aparece con su uso aunque no tenga gasto", async () => {
  const ahora = new Date(2026, 9, 26, 12).getTime();
  const LIBRE = { provider: "nvidia", id: "deepseek-v4", name: "DeepSeek V4", input: ["text"], reasoning: true, cost: { input: 0, output: 0 } };
  const consumo = crearConsumo({ lib: { leerConsumo: () => [fila(ahora - 1000, { proveedor: "nvidia", modelo: "deepseek-v4", costo: 0, consulta: "x" })], leerCupos: () => ({}) },
    ahora: () => ahora, modelos: async () => [SONNET, LIBRE], actual: () => LIBRE, claveApi: async () => undefined });
  const r = await consumo.resumen({});
  const nvidia = r.cuentas.find(c => c.proveedor === "nvidia");
  assert.equal(nvidia.tipo, "gratis");
  assert.equal(nvidia.uso.hoy.pedidos, 1);
  assert.equal(r.actual.gratis, true);
  assert.equal(r.cuentas.find(c => c.proveedor === "anthropic").tipo, "sin-tope", "con precio, no es gratis");
});

test("consumo: lo que rinde cada modelo y cuándo conviene sugerir otro", () => {
  const cuenta = { tipo: "dinero", queda: 0.5, moneda: "USD" };
  const sonnet = estimar({ modelo: SONNET, perfilConsulta: PERFIL_MEDIDO, cuenta });
  assert.equal(sonnet.quedan, 26);
  assert.equal(Math.round(sonnet.porDolar), 53);
  const haiku = estimar({ modelo: HAIKU, perfilConsulta: PERFIL_MEDIDO, cuenta });
  assert.equal(haiku.quedan, 449);
  const local = estimar({ modelo: { ...HAIKU, provider: "ollama", baseUrl: "http://localhost:11434/v1", cost: { input: 0, output: 0 } }, perfilConsulta: PERFIL_MEDIDO, cuenta: { tipo: "local" } });
  assert.equal(local.gratis, true);
  // Un proxy en localhost que cobra (el registrador de las pruebas, una pasarela) no es un modelo local.
  assert.equal(estimar({ modelo: { ...HAIKU, baseUrl: "http://127.0.0.1:18431" }, perfilConsulta: PERFIL_MEDIDO, cuenta }).gratis, false);
  // Ventanas: con al menos tres consultas medidas, lo que queda de la ventana corta dividido lo que gasta cada una.
  const v = estimar({ modelo: { ...SONNET, provider: "openai-codex", id: "gpt-6.1-sol" }, perfilConsulta: PERFIL_MEDIDO,
    cuenta: { tipo: "ventanas", ventanas: [{ minutos: 300, usado: 70 }] }, cupos: { "openai-codex/gpt-6.1-sol": { porConsulta: [2, 3, 1] } } });
  assert.equal(v.quedan, 15);
  // Pedidos gratis: una consulta son ~1,5 llamadas.
  assert.equal(estimar({ modelo: SONNET, perfilConsulta: PERFIL_MEDIDO, cuenta: { tipo: "pedidos", pedidos: { quedan: 30 } } }).quedan, 20);
  assert.equal(estimar({ modelo: SONNET, perfilConsulta: PERFIL_MEDIDO, cuenta: { tipo: "dinero", queda: 9, agotado: { desde: 1 } } }).quedan, 0);

  const tabla = [{ clave: "anthropic/claude-sonnet-5-5", proveedor: "anthropic", quedan: 26, imagenes: true, razona: true },
    { clave: "anthropic/claude-haiku-5-5", proveedor: "anthropic", quedan: 449, imagenes: true, razona: true, nombre: "Claude Haiku 5.5" },
    { clave: "google/gemini", proveedor: "google", gratis: true, imagenes: true, razona: true }];
  assert.equal(sugerir(tabla[0], tabla).clave, "anthropic/claude-haiku-5-5", "primero la misma cuenta");
  assert.equal(sugerir({ ...tabla[0], quedan: 200 }, tabla), undefined, "con margen no sugiere");
  assert.equal(sugerir(tabla[0], [tabla[0], tabla[2]]).clave, "google/gemini");
});

test("consumo: OpenRouter y DeepSeek informan su saldo; un error o sin red vale lo local", async () => {
  const respuestas = {
    "https://openrouter.ai/api/v1/key": { data: { limit: null, limit_remaining: null, free_model_daily_requests: { used: 12, limit: 50, remaining: 38 } } },
    "https://openrouter.ai/api/v1/credits": { data: { total_credits: 10, total_usage: 2.75 } },
    "https://api.deepseek.com/user/balance": { is_available: true, balance_infos: [{ currency: "USD", total_balance: "4.20" }] },
  };
  const vistos = [];
  const buscar = async (url, opciones) => { vistos.push(opciones.headers.Authorization); return { ok: true, json: async () => respuestas[url] }; };
  assert.deepEqual(await saldoRemoto("openrouter", "sk-or", buscar), { queda: 7.25, limite: 10, pedidos: { quedan: 38, limite: 50, usados: 12, gratis: true } });
  assert.deepEqual(await saldoRemoto("deepseek", "sk-ds", buscar), { queda: 4.2, moneda: "USD" });
  assert.ok(vistos.every(v => v === "Bearer sk-or" || v === "Bearer sk-ds"));
  assert.equal(await saldoRemoto("openrouter", "sk", async () => ({ ok: false, status: 401 })), undefined);
  assert.equal(await saldoRemoto("deepseek", "sk", async () => { throw new Error("sin red"); }), undefined);
  assert.equal(await saldoRemoto("anthropic", "sk", buscar), undefined);
});

test("consumo: el resumen junta cuentas conectadas, modelos sin versiones fechadas y la sugerencia", async () => {
  const ahora = new Date(2026, 9, 26, 12).getTime();
  const filas = [fila(new Date(2026, 9, 25), { costo: 199.6 })];
  const consumo = crearConsumo({ lib: { leerConsumo: () => filas, leerCupos: () => ({}) }, ahora: () => ahora,
    modelos: async () => [SONNET, HAIKU, { ...OPUS, id: "claude-opus-4-5-20251101" }], actual: () => SONNET, claveApi: async () => undefined, nombres: () => ({ anthropic: "Anthropic" }) });
  const r = await consumo.resumen({ anthropic: { tipo: "mensual", monto: 200, dia: 1 } });
  assert.deepEqual(r.modelos.map(m => m.id), ["claude-sonnet-5-5", "claude-haiku-5-5"]);
  assert.equal(r.actual.clave, "anthropic/claude-sonnet-5-5");
  assert.equal(r.cuentas[0].nombre, "Anthropic");
  assert.equal(Math.round(r.cuentas[0].queda * 100), 40);
  assert.equal(r.actual.quedan, 21);
  assert.equal(r.sugerido.id, "claude-haiku-5-5");
  assert.equal(r.hayRegistro, true);
});
