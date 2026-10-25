import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { transcribir } from "../extensions/curso/ingesta.ts";
import { piDir, loadProject, pythonDelVenv } from "../scripts/lib/pi-sdk.mjs";

const temporal = mkdtempSync(join(tmpdir(), "pi-vision-test-"));
const python = pythonDelVenv(piDir);
const config = { modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 50, umbral_calidad_pagina: 0.6 };
const texto = "El ejercicio solicita calcular la derivada de una función y justificar el procedimiento. ".repeat(3) + "$f(x)=x^2$.";
const uso = { input: 7, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 12, cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 } };
let numero = 0, solicitud, llamadas, ctx, project;
before(async () => { project = await loadProject(); });
beforeEach(() => {
  const vault = join(temporal, String(++numero));
  const resultado = spawnSync(python, ["-c", `from pathlib import Path
import sys
from test_ingesta import crear_pdf
from pipeline import ejecutar
v=Path(sys.argv[1]); v.mkdir()
crear_pdf(v/'muestra.pdf')
ejecutar({'version':1,'motores':{c:'pymupdf' for c in ['digital','escaneada','mixta']},'documentos':[{'id':'practico','titulo':'Práctico','tipo':'ejercicios','archivo':'muestra.pdf','paginas':[1,2,3]}]},v,v/'_procesado/prueba')`, vault],
    { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta") }, timeout: 10000 });
  assert.equal(resultado.status, 0, resultado.stderr);
  solicitud = { vault, salida: join(vault, "_procesado/prueba"), doc: "practico", paginas: [1, 3] };
  llamadas = [];
  ctx = { hasUI: true, ui: { select: async (_t, o) => o[0] }, modelRegistry: {
    find: () => ({ input: ["text", "image"] }), hasConfiguredAuth: () => true,
    streamSimple: (_modelo, contexto, opciones) => {
      llamadas.push({ contexto, opciones });
      return { result: async () => ({ stopReason: "stop", content: [{ type: "text", text: texto }], usage: structuredClone(uso) }) };
    },
  } };
});
after(async () => { await project?.close(); rmSync(temporal, { recursive: true, force: true }); });

function calidad(n = 1) { return JSON.parse(readFileSync(join(solicitud.salida, "practico/calidad.json"), "utf8")).paginas[String(n)]; }

test("pi registra las tools de visión e ítems sin cambios a teach", () => {
  assert.deepEqual(project.errors, []);
  for (const nombre of ["transcribir_paginas", "guardar_items"]) assert.ok(project.session.getActiveToolNames().includes(nombre));
});
test("la llamada aislada recibe solo prompt e imagen, persiste texto y suma uso", async () => {
  const resultado = await transcribir(ctx, solicitud, config);
  assert.equal(resultado.resumen.transcritas, 2);
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[0].contexto.messages.length, 1);
  assert.deepEqual(llamadas[0].contexto.messages[0].content.map(c => c.type), ["text", "image"]);
  assert.equal(llamadas[0].contexto.messages[0].content[1].mimeType, "image/png");
  assert.equal(llamadas[0].opciones.maxRetries, 0);
  assert.equal(resultado.usage.totalTokens, 24);
  assert.equal(resultado.usage.cost.total, 0.006);
  assert.equal(calidad().ruta, "vision");
  assert.doesNotMatch(JSON.stringify(resultado.resumen), /justificar/);
});
test("deduplica páginas y reutiliza caché sin nuevas llamadas", async () => {
  solicitud.paginas = [1, 1];
  assert.equal((await transcribir(ctx, solicitud, config)).resumen.transcritas, 1);
  assert.equal((await transcribir(ctx, solicitud, config)).resumen.cache, 1);
  assert.equal(llamadas.length, 1);
});
test("más de 50 páginas pide permiso antes de renderizar o llamar al modelo", async () => {
  solicitud.paginas = Array.from({ length: 51 }, (_, i) => i + 1);
  ctx.ui.select = async titulo => { assert.match(titulo, /51/); return "No"; };
  assert.equal((await transcribir(ctx, solicitud, config)).resumen.cancelada, true);
  assert.equal(llamadas.length, 0);
});
test("la aprobación interactiva permite la tanda sobre el límite configurado", async () => {
  let confirmaciones = 0;
  ctx.ui.select = async (_t, o) => { confirmaciones++; return o[0]; };
  const resultado = await transcribir(ctx, solicitud, { ...config, max_paginas_vision_sin_confirmar: 1 });
  assert.equal(confirmaciones, 1);
  assert.equal(resultado.resumen.transcritas, 2);
});
test("sin UI una tanda grande se rechaza, sin confirmar desde argumentos del modelo", async () => {
  ctx.hasUI = false;
  solicitud.paginas = Array.from({ length: 51 }, (_, i) => i + 1);
  await assert.rejects(() => transcribir(ctx, solicitud, config), /confirmación interactiva/);
  assert.equal(llamadas.length, 0);
});
test("respuesta truncada conserva la extracción y no impide procesar otra página", async () => {
  const archivo = join(solicitud.salida, "practico/paginas/0001.md");
  const antes = readFileSync(archivo, "utf8");
  const buena = ctx.modelRegistry.streamSimple;
  let n = 0;
  ctx.modelRegistry.streamSimple = (...args) => {
    const r = buena(...args);
    if (++n === 1) return { result: async () => ({ stopReason: "length", content: [{ type: "text", text: "Texto cortado" }], usage: structuredClone(uso) }) };
    return r;
  };
  const resultado = await transcribir(ctx, solicitud, config);
  assert.deepEqual(resultado.resumen.fallidas, [1]);
  assert.equal(resultado.resumen.transcritas, 1);
  assert.equal(readFileSync(archivo, "utf8"), antes);
  assert.equal(calidad().error_vision, true);
  assert.equal(calidad(3).ruta, "vision");
  assert.equal(resultado.usage.totalTokens, 24);
});
test("modelo no disponible deja pendiente sin elegir otro ni enviar imágenes", async () => {
  ctx.modelRegistry.find = () => undefined;
  const resultado = await transcribir(ctx, solicitud, config);
  assert.deepEqual(resultado.resumen.fallidas, [1, 3]);
  assert.equal(calidad().ruta, "pendiente");
  assert.equal(llamadas.length, 0);
});
test("cancelar detiene la tanda y deja recuperable la página actual", async () => {
  const control = new AbortController();
  const buena = ctx.modelRegistry.streamSimple;
  ctx.modelRegistry.streamSimple = (...args) => {
    const r = buena(...args);
    return { result: async () => { const mensaje = await r.result(); control.abort(); return mensaje; } };
  };
  const resultado = await transcribir(ctx, solicitud, config, control.signal);
  assert.equal(resultado.resumen.cancelada, true);
  assert.equal(llamadas.length, 1);
  assert.equal(calidad().error_vision, undefined);
});
test("una anotación manual nunca se reemplaza ni llega al modelo", async () => {
  writeFileSync(join(solicitud.salida, "practico/paginas/0001.md"), "Mis anotaciones");
  solicitud.paginas = [1];
  const resultado = await transcribir(ctx, solicitud, config);
  assert.deepEqual(resultado.resumen.fallidas, [1]);
  assert.match(resultado.resumen.avisos.join(" "), /editada|cambios ajenos/);
  assert.equal(llamadas.length, 0);
});
