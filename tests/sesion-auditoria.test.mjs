import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { resolverTemas } from "../extensions/curso/material.ts";
import { tokenizar } from "../scripts/ingesta/bm25.ts";

// Regresiones de la auditoría de sesión: vault sintético, pi simulado, sin modelos.
function datos() {
  const tema = { id: "derivacion", nombre: "Derivación", alias: ["derivada"], unidad: 1, prerequisitos: [], objetivos: [],
    bibliografia: [{ doc: "libro", seccion: "Derivadas", paginas: [1, 2] }] };
  return { curso: "calculo", nombre: "Cálculo", contrato: "Contrato", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" }],
    items: {}, progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
}
// busqueda.json mínimo con una página de bibliografía por texto.
function indice(raiz, textos) {
  const df = {}, fragmentos = textos.map((texto, i) => {
    const frecuencias = {};
    for (const w of tokenizar(texto)) frecuencias[w] = (frecuencias[w] || 0) + 1;
    for (const w of Object.keys(frecuencias)) df[w] = (df[w] || 0) + 1;
    return { doc: "libro", titulo: "Libro", tipo: "bibliografia", pagina: i + 1, seccion: null, texto, cita: "", calidad: 1, pendiente: false, largo: tokenizar(texto).length, frecuencias };
  });
  mkdirSync(join(raiz, "_procesado"), { recursive: true });
  writeFileSync(join(raiz, "_procesado/busqueda.json"), JSON.stringify({ version: 1, normalizacion: "NFD-sin-tildes-v1", k1: 1.2, b: 0.75,
    cantidad: fragmentos.length, largo_promedio: fragmentos.reduce((s, f) => s + f.largo, 0) / fragmentos.length, df, fragmentos }));
}
function entorno(t, d = datos()) {
  const vault = mkdtempSync(join(tmpdir(), "pi-sesion-aud-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/calculo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  mkdirSync(join(raiz, "sesiones"), { recursive: true });
  mkdirSync(join(recursos, "skills/teach"), { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH");
  writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  const comandos = new Map(), eventos = new Map(), entradas = [], avisos = [], ordenes = [], usuario = [], estados = {};
  const pi = { on: (n, h) => eventos.set(n, h), registerCommand: (n, c) => comandos.set(n, c),
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {},
    sendUserMessage: m => usuario.push(m), sendMessage: (m, o) => ordenes.push({ ...m, ...o }),
    exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "", killed: false }),
    events: { emit: (_n, p) => p.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: (k, v) => { estados[k] = v; }, select: async (_t, o) => o[0], confirm: async () => true } };
  return { vault, raiz, pi, ctx, comandos, eventos, entradas, avisos, ordenes, usuario, estados, sesion: registrarSesion(pi, vault, recursos),
    estudiar: args => comandos.get("estudiar").handler(args, ctx) };
}

test("H53: de noche el log lleva la fecha local, no la de UTC", async t => {
  const tz = process.env.TZ;
  process.env.TZ = "America/Montevideo";
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-23T01:30:00Z") });
  t.after(() => { mock.timers.reset(); process.env.TZ = tz; });
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  assert.deepEqual(readdirSync(join(e.raiz, "sesiones")), ["2026-10-22-derivacion.md"]);
});

test("H54: /estudiar y /fin mandan sus órdenes ocultas, que disparan el turno y no quedan como mensaje del alumno", async t => {
  const e = entorno(t);
  registrarProgreso(e.pi, e.sesion, e.vault);
  await e.estudiar("calculo derivacion");
  await e.comandos.get("fin").handler("", e.ctx);
  assert.deepEqual(e.usuario, []);
  assert.equal(e.ordenes.length, 2);
  for (const o of e.ordenes) { assert.equal(o.display, false); assert.equal(o.triggerTurn, true); }
  assert.match(e.ordenes[0].content, /primera pregunta/); assert.doesNotMatch(e.ordenes[0].content, /dónde quedamos/);
  assert.match(e.ordenes[1].content, /registrar_progreso con cierre:true/);
});
test("H54: con progreso previo, el arranque pide una línea de dónde quedamos antes de la primera pregunta", async t => {
  const d = datos(); d.progreso.temas.derivacion = { estado: "en_curso", borde: { domina: ["Regla de la potencia"], falla: ["Cadena"] }, proximo_paso: "Regla de la cadena" };
  const e = entorno(t, d);
  await e.estudiar("calculo derivacion");
  assert.match(e.ordenes[0].content, /dónde quedamos/);
});
test("H55/H31: los avisos del curso van al dossier, no al alumno, y la barra es la misma al restaurar", async t => {
  const d = datos(); d.avisos = ["Ejercicio huérfano: practico/3 ya no está en el banco."]; d.validacion.avisos = ["Sin segmentación todavía: practico-2."];
  const e = entorno(t, d);
  await e.estudiar("calculo derivacion");
  const barra = e.estados.curso;
  assert.equal(barra, "📚 calculo › Derivación");
  assert.ok(!e.avisos.some(([, m]) => /Preparación parcial/.test(m)));
  const evento = { systemPromptOptions: { sections: {}, skills: [] } };
  e.eventos.get("before_agent_start")(evento);
  assert.match(evento.systemPromptOptions.sections.curso, /Ejercicio huérfano/);
  await e.eventos.get("session_start")({ type: "session_start", reason: "resume" }, e.ctx);
  assert.equal(e.estados.curso, barra);
});
test("H71: con un solo curso alcanza el tema, y el curso se acepta sin mayúsculas ni tildes", async t => {
  for (const args of ["derivada", "Calculo derivada", "Cálculo derivacion"]) {
    const e = entorno(t);
    await e.estudiar(args);
    assert.equal(e.entradas.at(-1)?.data.tema, "derivacion", args);
  }
  const e = entorno(t);
  registrarProgreso(e.pi, e.sesion, e.vault);
  await e.comandos.get("progreso").handler("Cálculo", e.ctx);
  assert.match(e.avisos.at(-1)[1], /Derivación: sin_empezar/);
  mkdirSync(join(e.vault, "cursos/fisica"));
  await e.estudiar("retardos");
  assert.match(e.avisos.at(-1)[1], /No hay un curso «retardos»: elegí uno de calculo, fisica/);
});
test("H24: un subtema que sólo encuentra BM25 resuelve al tema cuyo rango contiene esas páginas", async t => {
  const d = datos();
  d.documentos[0].paginas = 4;
  d.temas.push({ id: "integracion", nombre: "Integración", alias: [], unidad: 2, prerequisitos: [], objetivos: [], bibliografia: [{ doc: "libro", seccion: "Integrales", paginas: [3, 4] }] });
  assert.deepEqual(resolverTemas(d.temas, "regla de la cadena", [{ doc: "libro", pagina: 2 }]).map(t => t.id), ["derivacion"]);
  const e = entorno(t, d);
  indice(e.raiz, ["Derivadas de polinomios.", "La regla de la cadena deriva funciones compuestas.", "Sustitución: la regla de la cadena al revés.", "Integración por partes y sustitución."]);
  await e.estudiar("calculo funciones compuestas");
  assert.equal(e.entradas.at(-1).data.tema, "derivacion");
  let opciones;
  e.ctx.ui.select = async (_t, o) => (opciones = o, o[0]);
  await e.estudiar("calculo cadena sustitucion");
  assert.match(opciones[0], /^Integración \[integracion\]/); assert.match(opciones[1], /^Derivación \[derivacion\]/); assert.match(opciones.at(-1), /ad hoc/);
  assert.equal(e.entradas.at(-1).data.tema, "integracion");
});
