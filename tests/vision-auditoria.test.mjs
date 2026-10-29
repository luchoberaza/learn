import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { registrarCuracion } from "../extensions/curso/curacion.ts";
import { transcribir } from "../extensions/curso/ingesta.ts";
import { piDir, pythonDelVenv } from "../scripts/lib/pi-sdk.mjs";
// Las llamadas simuladas anotan su consumo en una carpeta temporal, no en el registro real de la máquina (DA48).
const consumoTemporal = process.env.LEARN_CONSUMO_DIR = mkdtempSync(join(tmpdir(), "learn-consumo-"));
process.on("exit", () => rmSync(consumoTemporal, { recursive: true, force: true }));

const temporal = mkdtempSync(join(tmpdir(), "pi-vision-auditoria-"));
const config = { modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 };
const uso = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
let numero = 0, solicitud, llamadas, confirmaciones, ctx;
beforeEach(() => {
  const vault = join(temporal, String(++numero));
  const r = spawnSync(pythonDelVenv(piDir), ["-c", `from pathlib import Path
import sys
from test_ingesta import crear_pdf
from pipeline import ejecutar
v=Path(sys.argv[1]); v.mkdir()
crear_pdf(v/'muestra.pdf')
ejecutar({'version':1,'motores':{c:'pymupdf' for c in ['digital','escaneada','mixta']},'documentos':[{'id':'libro','titulo':'Libro','tipo':'bibliografia','archivo':'muestra.pdf','paginas':[1,2,3]}]},v,v/'_procesado/prueba')`, vault],
    { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta") }, timeout: 10000 });
  assert.equal(r.status, 0, r.stderr);
  solicitud = { vault, salida: join(vault, "_procesado/prueba"), doc: "libro", paginas: [3] };
  llamadas = []; confirmaciones = 0;
  ctx = { hasUI: true, ui: { select: async (_t, o) => { confirmaciones++; return o[0]; } }, modelRegistry: {
    find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true, getProviderAuth: async () => undefined,
    streamSimple: (...args) => { llamadas.push(args); return { result: async () => ({ stopReason: "error", errorMessage: "401 Unauthorized: token vencido", content: [], usage: structuredClone(uso) }) }; },
  } };
});
after(() => rmSync(temporal, { recursive: true, force: true }));
const calidad = n => JSON.parse(readFileSync(join(solicitud.salida, "libro/calidad.json"), "utf8")).paginas[String(n)];

function cursoCheck(validacion) {
  const comandos = new Map(), mensajes = [];
  registrarCuracion({ registerCommand: (n, d) => comandos.set(n, d), sendMessage: m => mensajes.push(m),
    exec: async () => ({ code: 0, stdout: JSON.stringify({ ok: true, errores: [], avisos: [], pendientes: [], ...validacion }), stderr: "" }) });
  return comandos.get("curso-check").handler("redes", { ui: { notify: assert.fail } }).then(() => mensajes[0].content);
}

test("H05: /curso-check da los comandos para transcribir sin modelo las páginas que faltan", async () => {
  const faltan = [{ doc: "kurose-7", pagina: 179 }, { doc: "kurose-7", pagina: 180 }];
  const texto = await cursoCheck({ pendientes: faltan, sin_transcripcion: faltan });
  assert.match(texto, /2 sin transcripción/);
  assert.match(texto, /cursos\.py manifiesto --curso redes --pendientes\n.*ingestar\.py iniciar --manifiesto _procesado\/manifiesto-redes\.json --salida cursos\/redes\/_procesado/);
  assert.doesNotMatch(await cursoCheck({ pendientes: faltan, sin_transcripcion: [] }), /manifiesto/);
});

test("H39: un 401 dice el error real y no degrada una página digital buena", async () => {
  assert.equal(calidad(3).ruta, "digital");
  for (const fallar of [null, () => { throw new Error("401 Unauthorized: token vencido"); }]) {
    if (fallar) ctx.modelRegistry.streamSimple = fallar;
    const { resumen } = await transcribir(ctx, solicitud, config);
    assert.deepEqual(resumen.fallidas, [3]);
    assert.match(resumen.avisos.join(" "), /PDF 3: Visión no disponible: 401 Unauthorized: token vencido/);
    assert.equal(calidad(3).ruta, "digital");
    assert.equal(calidad(3).pendiente, false);
  }
});
test("H39: cancelar con Esc no registra la página como fallida", async () => {
  const control = new AbortController();
  ctx.modelRegistry.streamSimple = () => ({ result: async () => { control.abort(); return { stopReason: "aborted", errorMessage: "Request was aborted", content: [], usage: structuredClone(uso) }; } });
  solicitud.paginas = [1];
  const antes = calidad(1);
  const { resumen } = await transcribir(ctx, solicitud, config, control.signal);
  assert.equal(resumen.cancelada, true);
  assert.deepEqual(resumen.fallidas, []);
  assert.deepEqual(calidad(1), antes);
});
test("H39: sin credenciales de visión no pide confirmar, no llama y dice qué hacer", async () => {
  ctx.modelRegistry.hasConfiguredAuth = () => false;
  solicitud.paginas = [1, 3];
  const antes = [calidad(1), calidad(3)];
  const { resumen } = await transcribir(ctx, solicitud, config);
  assert.equal(confirmaciones, 0);
  assert.equal(llamadas.length, 0);
  assert.deepEqual(resumen.fallidas, [1, 3]);
  assert.match(resumen.avisos.join(" "), /Visión no disponible: .*\/login/);
  assert.deepEqual([calidad(1), calidad(3)], antes);
});
test("H39: un snapshot de credenciales viejo no bloquea la visión si pi resuelve la autenticación", async () => {
  ctx.modelRegistry.hasConfiguredAuth = () => false;
  ctx.modelRegistry.getProviderAuth = async () => ({ auth: { apiKey: "x" } });
  const { resumen } = await transcribir(ctx, solicitud, config);
  assert.equal(llamadas.length, 1);
  assert.doesNotMatch(resumen.avisos.join(" "), /no hay credenciales/);
});
// DA58: el repo fija un modelo de visión de openai-codex; learn tiene que andar con la clave que tenga el alumno.
test("DA58: sin credenciales para el modelo de visión, transcribe con el de la conversación si acepta imágenes y lo dice", async () => {
  ctx.model = { provider: "anthropic", id: "claude-sonnet-5-5", input: ["text", "image"] };
  ctx.modelRegistry.hasConfiguredAuth = m => m.provider === "anthropic";
  const { resumen } = await transcribir(ctx, solicitud, config);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0][0], ctx.model);
  assert.equal(resumen.avisos[0], "Visión con anthropic/claude-sonnet-5-5, el modelo de la conversación: openai/gpt-6-luna no tiene credenciales o no acepta imágenes.");
});
test("DA58: si el de la conversación no acepta imágenes, no llama y dice qué falta del configurado", async () => {
  ctx.model = { provider: "deepseek", id: "deepseek-chat", input: ["text"] };
  ctx.modelRegistry.hasConfiguredAuth = m => m.provider === "deepseek";
  const { resumen } = await transcribir(ctx, solicitud, config);
  assert.equal(llamadas.length, 0);
  assert.deepEqual(resumen.fallidas, [3]);
  assert.deepEqual(resumen.avisos, ["Visión no disponible: no hay credenciales para openai; ejecutá /login."]);
});
