import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { acotar, dossier, leerItems, leerPaginas, ordenarTemas, resolverTemas, rutaSegura } from "../extensions/curso/material.ts";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

function datos() {
  const tema = { id: "derivacion", nombre: "Derivación", alias: ["derivada"], unidad: 1, prerequisitos: [], objetivos: ["O1.1"],
    bibliografia: [{ doc: "libro", seccion: "Derivadas", paginas: [1, 2] }], ejercicios: [{ doc: "practico", items: ["1"] }] };
  return { curso: "calculo", nombre: "Cálculo", contrato: "# Objetivos\n- O1.1: Comprender la derivación.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" },
      { id: "practico", titulo: "Práctico", tipo: "ejercicios", archivo: "fuentes/ejercicios/practico.pdf", paginas: 2 },
      { id: "soluciones", titulo: "Soluciones", tipo: "soluciones", archivo: "fuentes/soluciones/sol.pdf", paginas: 2 }],
    items: { practico: [{ id: "1", paginas: [1], enunciado: "Derivá $f(x)=x^2$.", solucion: { doc: "soluciones", id: "1" } }],
      soluciones: [{ id: "1", paginas: [2], enunciado: "SOLUCIÓN RESERVADA $f'(x)=2x$." }] },
    progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
}
function entorno(t, d = datos(), entradas = []) {
  const vault = mkdtempSync(join(tmpdir(), "pi-sesion-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/calculo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of ["sesiones", "_procesado/libro/paginas"]) mkdirSync(join(raiz, p), { recursive: true });
  mkdirSync(join(recursos, "skills/teach"), { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "PROCESO TEACH ORIGINAL");
  writeFileSync(join(recursos, "modo-curso.md"), "PROTOCOLO DEL CURSO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(raiz, "_procesado/libro/paginas/0001.md"), "<!-- p. PDF 1 · impresa 7 -->\nDerivación $f(x)$.");
  const comandos = new Map(), eventos = new Map(), mensajes = [], avisos = [], vinculos = [];
  const pi = { on: (n, h) => eventos.set(n, h), registerCommand: (n, d) => comandos.set(n, d),
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: n => mensajes.push({ nombre: n }),
    sendUserMessage: m => mensajes.push({ usuario: m }),
    exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "" }),
    events: { emit: (n, payload) => { vinculos.push([n, payload]); payload.onComplete?.(); } } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: assert.fail },
    ui: { notify: (...m) => avisos.push(m), setStatus: () => {}, select: async (_titulo, opciones) => opciones[0] } };
  const tools = registrarSesion(pi, vault, recursos);
  return { pi, ctx, comandos, eventos, mensajes, avisos, vinculos, tools, raiz, vault, recursos, entradas };
}

test("resuelve ids, alias, tildes, errores leves y conserva ambigüedades", () => {
  const d = datos(), otro = { ...d.temas[0], id: "otra-derivacion", nombre: "Derivación parcial" };
  for (const q of ["derivacion", "Derivación", "derivada", "derivacon"]) assert.equal(resolverTemas(d.temas, q)[0].id, "derivacion");
  assert.equal(resolverTemas([...d.temas, otro], "derivada").length, 2);
  assert.equal(resolverTemas(d.temas, "electricidad").length, 0);
  d.temas.push({ ...otro, prerequisitos: ["derivacion"] });
  d.progreso.temas[otro.id] = { estado: "en_curso" };
  assert.equal(ordenarTemas(d)[0].id, otro.id);
});
test("el dossier está acotado, conserva contrato y mapa sin soluciones", t => {
  const e = entorno(t), d = datos();
  const r = dossier(e.raiz, d, d.temas[0], 3000, 1500);
  assert.ok(r.includes(d.contrato)); assert.match(r, /PDF 1–2/); assert.match(r, /#page=1/);
  assert.ok(!r.includes("SOLUCIÓN RESERVADA"));
  d.temas[0].nombre = "Á😀".repeat(4000);
  assert.ok(Buffer.byteLength(dossier(e.raiz, d, d.temas[0], 100, 1500)) <= 400);
  assert.ok(Buffer.byteLength(acotar("😀".repeat(100), 100)) <= 100);
});
test("lecturas tienen límites, citas y soluciones sólo si se piden", t => {
  const e = entorno(t), d = datos();
  assert.match(leerPaginas(e.raiz, d, "libro", 1, 2), /sin transcripción utilizable/);
  assert.throws(() => leerPaginas(e.raiz, d, "libro", 0, 4), /Rango/);
  assert.ok(!leerItems(d, "practico", ["1"]).includes("SOLUCIÓN RESERVADA"));
  assert.match(leerItems(d, "practico", ["1"], true), /SOLUCIÓN RESERVADA/);
  writeFileSync(join(e.raiz, "_procesado/libro/paginas/0001.md"), "x".repeat(100000));
  assert.ok(Buffer.byteLength(leerPaginas(e.raiz, d, "libro", 1, 3)) <= 32000);
  assert.throws(() => rutaSegura(e.vault, "../otro"));
  symlinkSync("/tmp", join(e.raiz, "enlace"));
  assert.throws(() => rutaSegura(e.raiz, "enlace/no-existe"), /simbólico/);
});
test("las cuatro tools de lectura rechazan el estado sin curso activo", async t => {
  const e = entorno(t);
  for (const f of [() => e.tools.leer_paginas({ doc: "libro", desde: 1, hasta: 1 }), () => e.tools.leer_items({ doc: "practico", ids: ["1"] }), () => e.tools.buscar_material({ consulta: "derivación" })]) assert.throws(f, /No hay curso activo/);
  await assert.rejects(() => e.tools.ver_pagina({ doc: "libro", pagina: 1 }), /No hay curso activo/);
});
test("activar enlaza un log nuevo sin historial anterior y arranca solo", async t => {
  const e = entorno(t), fecha = new Date().toISOString().slice(0, 10);
  const viejo = join(e.raiz, "sesiones", `${fecha}-derivacion.md`);
  writeFileSync(viejo, "NOTA DEL USUARIO");
  await e.comandos.get("estudiar").handler("calculo derivada", e.ctx);
  assert.equal(readFileSync(viejo, "utf8"), "NOTA DEL USUARIO");
  assert.equal(e.vinculos[0][1].backfill, false);
  assert.match(e.entradas.at(-1).data.log, /-2\.md$/);
  assert.equal(e.mensajes.filter(m => m.usuario).length, 1);
  assert.match(e.mensajes[0].nombre, /Cálculo/);
  const evento = { systemPromptOptions: { sections: { ajena: "conservar" } } };
  e.eventos.get("before_agent_start")(evento);
  assert.equal(evento.systemPromptOptions.sections.teach, "PROCESO TEACH ORIGINAL");
  assert.match(evento.systemPromptOptions.sections.curso, /Última sesión sin registro/);
  assert.equal(evento.systemPromptOptions.sections.ajena, "conservar");
});
test("autocompleta ambos argumentos completos y respeta cancelación/busy", async t => {
  const e = entorno(t), c = e.comandos.get("estudiar");
  writeFileSync(join(e.raiz, "indice.yaml"), "Índice de la prueba de completado");
  const opciones = await c.getArgumentCompletions("calculo derivación");
  assert.equal(opciones[0].value, "calculo derivacion");
  e.ctx.isIdle = () => false; await c.handler("calculo derivacion", e.ctx);
  e.ctx.isIdle = () => true; e.ctx.ui.select = async () => undefined;
  await c.handler("calculo", e.ctx);
  assert.equal(e.entradas.length, 0); assert.equal(e.mensajes.length, 0);
});
test("estado de rama se restaura e inyecta incluso tras compactar", async t => {
  const e = entorno(t);
  await e.comandos.get("estudiar").handler("calculo derivacion", e.ctx);
  const estado = e.entradas.at(-1);
  e.entradas.push({ type: "compaction", summary: "Resumen sin curso" });
  await e.eventos.get("session_start")({}, e.ctx);
  const evento = { systemPromptOptions: { sections: {} } };
  e.eventos.get("before_agent_start")(evento);
  assert.match(evento.systemPromptOptions.sections.curso, /derivacion/);
  assert.equal(e.entradas.filter(x => x.customType === "curso").length, 1);
  assert.equal(e.entradas.find(x => x.customType === "curso"), estado);
  e.entradas.length = 0;
  await e.eventos.get("session_tree")({}, e.ctx);
  e.eventos.get("before_agent_start")(evento);
  assert.equal(evento.systemPromptOptions.sections.curso, undefined);
});
test("modo ad hoc continúa sin BM25 y no escribe el índice ni progreso", async t => {
  const e = entorno(t);
  await e.comandos.get("estudiar").handler("calculo electricidad", e.ctx);
  assert.equal(e.entradas.at(-1).data.tema, "ad-hoc");
  assert.equal(e.entradas.at(-1).data.adHoc.nombre, "electricidad");
  assert.deepEqual(readdirSync(e.raiz).sort(), ["_procesado", "sesiones"]);
});
test("runtime instalado registra comandos y tools de sesión sin modificar teach", async () => {
  const p = await loadProject();
  try {
    assert.deepEqual(p.errors, []);
    for (const n of ["leer_paginas", "ver_pagina", "buscar_material", "leer_items", "investigar_tema"]) assert.ok(p.session.getActiveToolNames().includes(n));
    for (const n of ["estudiar", "cursos"]) assert.ok(p.session.extensionRunner.getRegisteredCommands().some(c => c.name === n));
  } finally { await p.close(); }
});
