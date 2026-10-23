import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs, { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { resolverTemas } from "../extensions/curso/material.ts";
import { registrarCuracion } from "../extensions/curso/curacion.ts";
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
const TODAS = ["read", "bash", "edit", "write", "ask_user_question", "leer_sesion_anterior", "registrar_progreso", "investigar_tema", "leer_paginas", "buscar_material", "leer_items", "ver_pagina",
  "guardar_curso", "transcribir_paginas", "guardar_items", "quiz", "subagent", "subagents_list", "web_search", "fetch_content"];
function entorno(t, d = datos()) {
  const vault = mkdtempSync(join(tmpdir(), "pi-sesion-aud-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/calculo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  mkdirSync(join(raiz, "sesiones"), { recursive: true });
  mkdirSync(join(recursos, "skills/teach"), { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH");
  writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  const comandos = new Map(), eventos = new Map(), entradas = [], avisos = [], ordenes = [], usuario = [], estados = {};
  let activas = [...TODAS];
  const pi = { on: (n, h) => eventos.set(n, h), registerCommand: (n, c) => comandos.set(n, c),
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {},
    sendUserMessage: m => usuario.push(m), sendMessage: (m, o) => ordenes.push({ ...m, ...o }),
    getAllTools: () => TODAS.map(name => ({ name })), getActiveTools: () => [...activas], setActiveTools: n => { activas = n; },
    exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "", killed: false }),
    events: { emit: (_n, p) => p.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "sesion-1" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: (k, v) => { estados[k] = v; }, select: async (_t, o) => o.includes("Cambiar sin guardar") ? "Cambiar sin guardar" : o[0], confirm: async () => true } };
  return { vault, raiz, pi, ctx, get activas() { return activas; }, set activas(v) { activas = v; }, comandos, eventos, entradas, avisos, ordenes, usuario, estados, sesion: registrarSesion(pi, vault, recursos),
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
  e.ctx.ui.select = async (_t, o) => o.includes("Cambiar sin guardar") ? "Cambiar sin guardar" : (opciones = o, o[0]);
  await e.estudiar("calculo cadena sustitucion");
  assert.match(opciones[0], /^Integración \[integracion\]/); assert.match(opciones[1], /^Derivación \[derivacion\]/); assert.match(opciones.at(-1), /ad hoc/);
  assert.equal(e.entradas.at(-1).data.tema, "integracion");
});
const colgado = async () => ({ code: 0, killed: true, stdout: "", stderr: "" });
const roto = async () => ({ code: 1, killed: false, stdout: "", stderr: "Traceback (most recent call last):\nModuleNotFoundError: No module named 'yaml'" });
test("H03: Python colgado o roto sin copia previa: una línea en español que remite al doctor, sin curso a medias", async t => {
  for (const exec of [colgado, roto]) {
    const e = entorno(t); e.pi.exec = exec;
    await e.estudiar("calculo derivacion");
    assert.equal(e.entradas.length, 0);
    assert.deepEqual(readdirSync(join(e.raiz, "sesiones")), []);
    assert.match(e.avisos.at(-1)[1], /^El entorno de ingesta \(Python\) .*corré \.pi\/scripts\/doctor/);
  }
});
test("H03: con una carga previa, /estudiar y la restauración siguen con la copia y lo avisan una vez", async t => {
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  e.pi.exec = roto; e.avisos.length = 0;
  await e.estudiar("calculo derivacion");
  assert.equal(e.entradas.filter(x => x.customType === "curso").length, 2);
  assert.deepEqual(e.avisos.map(([, m]) => m), ["Material desde la última carga; el entorno de ingesta no respondió: corré .pi/scripts/doctor."]);
  const tiempos = []; e.pi.exec = async (_p, _a, o) => (tiempos.push(o.timeout), colgado()); e.avisos.length = 0;
  await e.eventos.get("session_start")({ type: "session_start", reason: "startup" }, e.ctx);
  assert.deepEqual(tiempos, [30000]);
  assert.match(e.avisos[0][1], /^Material desde la última carga/);
  const evento = { systemPromptOptions: { sections: {}, skills: [] } };
  e.eventos.get("before_agent_start")(evento);
  for (const s of ["teach", "modo_curso", "curso"]) assert.ok(evento.systemPromptOptions.sections[s], s);
});
test("H03: ver_pagina con el render colgado falla en español", async t => {
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  e.pi.exec = colgado;
  await assert.rejects(() => e.sesion.ver_pagina({ doc: "libro", pagina: 1 }), /^Error: El entorno de ingesta \(Python\) no respondió/);
});
test("H03: /curso-check y /curso-estado no muestran JSON roto y /curso-estado informa error, interrupción y editadas", async () => {
  const comandos = new Map(), avisos = [], estados = {};
  const pi = { registerCommand: (n, c) => comandos.set(n, c), exec: colgado, sendMessage: () => {} };
  const ctx = { ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: (k, v) => { estados[k] = v; } } };
  registrarCuracion(pi);
  for (const c of ["curso-check", "curso-estado"]) {
    await comandos.get(c).handler("calculo", ctx);
    assert.match(avisos.at(-1)[1], /^El entorno de ingesta \(Python\) no respondió/, c);
  }
  pi.exec = async () => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ estado: "interrumpida", procesadas: 3, solicitadas: 9, pendientes: 2,
    aviso: "El proceso ya no mantiene el bloqueo; podés reanudar con el mismo manifiesto.", error: "El proceso terminó al arrancar: sin memoria", editadas: ["libro/0002.md", "libro/0003.md"] }) });
  await comandos.get("curso-estado").handler("calculo", ctx);
  assert.equal(estados["curso-ingesta"], "calculo: interrumpida · 3/9 · pendientes: 2 · editadas: 2");
  assert.match(avisos.at(-1)[1], /terminó al arrancar: sin memoria\nEl proceso ya no mantiene el bloqueo/);
});
test("H17: el autocompletado no se ofrece sobre un texto exacto y no vuelve a llamar a Python", async t => {
  const e = entorno(t), completar = e.comandos.get("estudiar").getArgumentCompletions;
  let llamadas = 0; const exec = e.pi.exec; e.pi.exec = (...a) => (llamadas++, exec(...a));
  assert.deepEqual((await completar("calculo deriv")).map(o => o.value), ["calculo derivacion"]);
  assert.equal(llamadas, 1);
  for (const texto of ["calculo", "calculo derivacion", "calculo Derivación", "calculo derivada"]) assert.equal(await completar(texto), null, texto);
  assert.deepEqual((await completar("calc")).map(o => o.value), ["calculo "]);
  await e.estudiar("calculo derivacion");
  assert.deepEqual((await completar("calculo d")).map(o => o.value), ["calculo derivacion"]);
  assert.equal(llamadas, 2);
});
const real = "> [!quote] VOS\n\nCreo que es L/R.\n\n> [!success] Quiz — correcto ✓\n> Tu respuesta: 1. Transmisión\n";
const dossierDe = e => { const evento = { systemPromptOptions: { sections: {}, skills: [] } }; e.eventos.get("before_agent_start")(evento); return evento.systemPromptOptions.sections.curso; };
test("H06: con el progreso no disponible, inválido o desde la copia no se ofrece reconstruir", async t => {
  for (const aviso of ["Progreso no disponible: Ya hay una ingesta escribiendo en esta salida.; se sigue con el material.", "Progreso inválido restaurado desde .bak; el contenido inválido se conservó en _procesado/.", "Material desde la última carga; el entorno de ingesta no respondió: corré .pi/scripts/doctor."]) {
    const d = datos(); d.avisos = [aviso];
    const e = entorno(t, d);
    writeFileSync(join(e.raiz, "sesiones/2026-01-01-derivacion.md"), real);
    await e.estudiar("calculo derivacion");
    assert.doesNotMatch(dossierDe(e), /Ofrecé reconstruirla/, aviso);
    assert.equal(e.sesion.actual().pendiente, undefined);
  }
});
test("H15: sólo se ofrece reconstruir una sesión real, una sola vez", async t => {
  const e = entorno(t), log = n => join(e.raiz, `sesiones/${n}`);
  writeFileSync(log("2026-01-01-derivacion.md"), real);
  writeFileSync(log("2026-01-02-derivacion.md"), "> [!quote] VOS\n\nEmpecemos con «Derivación» (calculo). Iniciá el probe con la primera pregunta.\n\n> [!abstract] PI\n\n¿Qué es una derivada?\n");
  writeFileSync(log("2026-01-03-derivacion.md"), "> [!quote] VOS\n\nPrueba técnica de Fase 6, no es una respuesta del estudiante.\n");
  writeFileSync(log("2026-01-04-derivacion.md"), "");
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().pendiente, "sesiones/2026-01-01-derivacion.md");
  assert.match(dossierDe(e), /Ofrecé reconstruirla/);
  e.sesion.refrescar();
  assert.equal(e.sesion.actual().pendiente, "sesiones/2026-01-01-derivacion.md");
  assert.doesNotMatch(dossierDe(e), /Ofrecé reconstruirla/);
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().pendiente, undefined);
});
test("H15: no se ofrece el ad hoc, el log vivo de otra sesión ni el de otro tema con sufijo", async t => {
  const d = datos(); d.temas.push({ ...d.temas[0], id: "derivacion-2", nombre: "Derivación II", alias: [] });
  const e = entorno(t, d);
  writeFileSync(join(e.raiz, "sesiones/2026-01-01-derivacion-2.md"), real);
  writeFileSync(join(e.raiz, "sesiones/2026-01-01-ad-hoc.md"), real);
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().pendiente, undefined);
  await e.estudiar("calculo electricidad");
  assert.equal(e.sesion.actual().pendiente, undefined);
  writeFileSync(join(e.raiz, "sesiones/2026-01-02-derivacion.md"), real);
  writeFileSync(join(e.raiz, ".sesion-activa.json"), JSON.stringify({ sesion: "otra", pid: process.ppid, curso: "calculo", tema: "derivacion", log: "cursos/calculo/sesiones/2026-01-02-derivacion.md" }));
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().pendiente, undefined);
  writeFileSync(join(e.raiz, ".sesion-activa.json"), JSON.stringify({ sesion: "otra", pid: 2 ** 22 + 1, curso: "calculo", tema: "derivacion", log: "cursos/calculo/sesiones/2026-01-02-derivacion.md" }));
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().pendiente, "sesiones/2026-01-02-derivacion.md");
});
test("H16: si md-log no confirma o sesiones/ no se puede escribir, la clase sigue sin nota y sin .md vacío", async t => {
  const e = entorno(t), eventos = [];
  e.pi.events.emit = (n, p) => eventos.push([n, p]);
  await e.estudiar("calculo derivacion");
  assert.deepEqual(readdirSync(join(e.raiz, "sesiones")), []);
  assert.equal(e.entradas.at(-1).data.sinLog, true);
  assert.equal(e.ordenes.length, 1);
  assert.deepEqual(e.avisos.at(-1), ["warning", "No se pudo crear la nota de la clase en Obsidian; seguimos sin nota."]);
  assert.ok(eventos.some(([n, p]) => n === "md-log:unlink" && !p.file));
  await e.sesion.cerrar(e.ctx);
  assert.equal(e.sesion.actual(), undefined);
  const f = entorno(t);
  chmodSync(join(f.raiz, "sesiones"), 0o555);
  await f.estudiar("calculo derivacion");
  chmodSync(join(f.raiz, "sesiones"), 0o755);
  assert.equal(f.sesion.actual().a.tema, "derivacion");
  assert.deepEqual(f.avisos.at(-1), ["warning", "No se pudo crear la nota de la clase en Obsidian (sin permiso para escribir en sesiones/); seguimos sin nota."]);
});
test("H02: sin modelo o sin credenciales no se crea nada y se dice qué hacer en una línea", async t => {
  const e = entorno(t);
  e.ctx.model = undefined;
  await e.estudiar("calculo derivacion");
  assert.deepEqual(e.avisos.at(-1), ["error", "No hay un modelo elegido: elegí uno con /model y repetí /estudiar."]);
  e.ctx.model = { provider: "prueba", id: "modelo" };
  e.ctx.modelRegistry = { hasConfiguredAuth: () => false, getProviderAuth: async () => undefined };
  await e.estudiar("calculo derivacion");
  assert.deepEqual(e.avisos.at(-1), ["error", "Sin credenciales para prueba/modelo: ejecutá /login y repetí /estudiar."]);
  assert.deepEqual([e.entradas.length, e.ordenes.length, readdirSync(join(e.raiz, "sesiones")).length], [0, 0, 0]);
  e.ctx.modelRegistry.getProviderAuth = async () => ({ type: "api_key" });
  await e.estudiar("calculo derivacion");
  assert.equal(e.ordenes.length, 1);
});
test("H02: un turno que termina en error del proveedor agrega una línea en español con la causa y qué hacer", async t => {
  const e = entorno(t), turno = errorMessage => e.entradas.push({ type: "message", message: { role: "assistant", stopReason: "error", errorMessage, content: [] } });
  const settled = (aborted = false) => e.eventos.get("agent_settled")({ type: "agent_settled", aborted }, e.ctx);
  turno("fetch failed"); await settled();
  assert.equal(e.avisos.length, 0, "sin curso activo no es una clase");
  await e.estudiar("calculo derivacion");
  for (const [error, causa] of [["fetch failed", /^Sin conexión con el proveedor/], ["429 You have reached your Subscription Sharing usage limit", /^El proveedor rechazó el pedido por cuota/],
    ['No API key found for "openai-codex"', /^Faltan o vencieron las credenciales del modelo: ejecutá \/login/], ["Internal server error", /^El modelo devolvió un error/],
    ["ENOSPC: no space left on device, write", /^Disco lleno: liberá espacio;/]]) {
    e.avisos.length = 0; turno(error); await settled();
    assert.equal(e.avisos.length, 1); assert.match(e.avisos[0][1], causa); assert.match(e.avisos[0][1], /escribí «seguí» para reintentar o \/fin para guardar\.$/);
  }
  e.avisos.length = 0; await settled(true);
  assert.equal(e.avisos.length, 0);
});
test("X01: con menos de 200 MB libres /estudiar no arranca; con menos de 1 GB avisa y sigue", async t => {
  let mb = 150;
  const disco = mock.method(fs, "statfsSync", () => ({ bsize: 4096, bavail: mb * 1e6 / 4096 })); syncBuiltinESMExports();
  t.after(() => { disco.mock.restore(); syncBuiltinESMExports(); });
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  assert.deepEqual(e.avisos, [["error", "Disco casi lleno (150 MB libres): liberá espacio y repetí /estudiar."]]);
  assert.deepEqual([e.entradas.length, readdirSync(join(e.raiz, "sesiones")).length], [0, 0]);
  mb = 800; e.avisos.length = 0;
  await e.estudiar("calculo derivacion");
  assert.deepEqual(e.avisos, [["warning", "Queda poco disco (800 MB libres): liberá espacio pronto para no perder la sesión."]]);
  assert.equal(e.ordenes.length, 1);
});
test("X01: un registro propio restaura curso, tema y log si pi perdió sus entradas; se borra al cerrar", async t => {
  const e = entorno(t), registro = join(e.raiz, ".sesion-activa.json"), eventos = [];
  e.pi.events.emit = (n, p) => { eventos.push(n); p.onComplete?.(); };
  await e.estudiar("calculo derivacion");
  const estado = e.entradas.at(-1).data;
  assert.deepEqual(JSON.parse(readFileSync(registro, "utf8")), { sesion: "sesion-1", pid: process.pid, ...estado });
  e.entradas.length = 0;
  await e.eventos.get("session_tree")({ type: "session_tree" }, e.ctx);
  assert.equal(e.sesion.actual(), undefined, "navegar el árbol a antes del curso no lo restaura");
  e.ctx.sessionManager.getSessionId = () => "otra";
  await e.eventos.get("session_start")({ type: "session_start", reason: "resume" }, e.ctx);
  assert.equal(e.sesion.actual(), undefined, "el registro es de otra sesión");
  e.ctx.sessionManager.getSessionId = () => "sesion-1";
  await e.eventos.get("session_start")({ type: "session_start", reason: "startup" }, e.ctx);
  assert.deepEqual(e.sesion.actual().a, estado);
  assert.deepEqual(e.entradas.map(x => x.customType), ["curso"]);
  eventos.length = 0; dossierDe(e);
  assert.deepEqual(eventos, ["md-log:link"]);
  await e.sesion.cerrar(e.ctx);
  assert.ok(!existsSync(registro));
});
test("X01: un disco lleno al anotar el curso se informa en español, sin el error crudo", async t => {
  const e = entorno(t);
  e.pi.appendEntry = () => { throw Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC", syscall: "write" }); };
  await e.estudiar("calculo derivacion");
  assert.deepEqual(e.avisos.at(-1), ["error", "Disco lleno: liberá espacio y repetí /estudiar."]);
});
test("H26: /estudiar con el agente ocupado corta el turno y sigue; con una pregunta abierta, antes confirma", async t => {
  const e = entorno(t), orden = [];
  let ocupado = true, eleccion = "Seguir con la pregunta";
  Object.assign(e.ctx, { isIdle: () => !ocupado, abort: () => orden.push("abort"), waitForIdle: async () => { orden.push("espera"); ocupado = false; } });
  e.ctx.ui.select = async (titulo, o) => titulo === "Hay una pregunta abierta" ? (orden.push("confirma"), eleccion) : o.includes("Cambiar sin guardar") ? "Cambiar sin guardar" : o[0];
  await e.estudiar("calculo derivacion");
  assert.deepEqual(orden, ["abort", "espera"]);
  assert.equal(e.ordenes.length, 1);
  await e.sesion.cerrar(e.ctx);
  ocupado = true; orden.length = 0;
  e.eventos.get("tool_execution_start")({ toolName: "quiz", toolCallId: "q1" });
  await e.estudiar("calculo derivacion");
  assert.deepEqual(orden, ["confirma"]); assert.equal(e.ordenes.length, 1);
  eleccion = "Cortarla y cambiar de tema"; orden.length = 0;
  await e.estudiar("calculo derivacion");
  assert.deepEqual(orden, ["confirma", "abort", "espera"]); assert.equal(e.ordenes.length, 2);
  ocupado = true; orden.length = 0;
  await e.estudiar("calculo derivacion");
  assert.deepEqual(orden, ["abort", "espera"], "con un tema activo, elegir «Cambiar sin guardar» ya confirma");
  e.eventos.get("tool_execution_end")({ toolName: "quiz", toolCallId: "q1" });
});
test("H26/H25: cancelar el cambio de tema o el selector no corta el turno en curso", async t => {
  const d = datos(); d.temas.push({ id: "integracion", nombre: "Integración", alias: [], unidad: 2, prerequisitos: [], objetivos: [], bibliografia: [] });
  const e = entorno(t, d);
  await e.estudiar("calculo derivacion");
  let cortes = 0;
  Object.assign(e.ctx, { isIdle: () => false, abort: () => cortes++, waitForIdle: async () => {} });
  e.ctx.ui.select = async (_t, o) => o.includes("Cancelar") ? "Cancelar" : o[0];
  await e.estudiar("calculo integracion");
  e.ctx.ui.select = async () => undefined;
  await e.estudiar("calculo");
  assert.equal(cortes, 0);
  assert.equal(e.sesion.actual().a.tema, "derivacion");
});
test("H25: con un tema activo, /estudiar ofrece guardar y cambiar, cambiar sin guardar o cancelar", async t => {
  const d = datos();
  d.temas.push({ id: "integracion", nombre: "Integración", alias: [], unidad: 2, prerequisitos: [], objetivos: [], bibliografia: [] });
  const e = entorno(t, d);
  let eleccion = "Guardar y cambiar", titulo;
  e.ctx.ui.select = async (t, o) => o.includes(eleccion) ? (titulo = t, eleccion) : o[0];
  e.ctx.waitForIdle = async () => {};
  await e.estudiar("calculo derivacion");
  const viejo = e.sesion.actual().a.log;
  await e.estudiar("calculo integracion");
  assert.equal(titulo, "Estás en «Derivación»");
  assert.deepEqual(e.entradas.at(-1), { type: "custom", customType: "curso-cierre", data: { log: viejo, adHoc: false } });
  assert.match(e.ordenes.at(-1).content, /registrar_progreso con cierre:true/);
  assert.deepEqual(e.avisos.at(-1), ["warning", "No se confirmó el guardado: seguís en «Derivación»; repetí /estudiar o elegí «Cambiar sin guardar»."]);
  assert.equal(e.sesion.actual().a.tema, "derivacion");
  e.ctx.waitForIdle = () => e.sesion.cerrar(e.ctx);
  await e.estudiar("calculo integracion");
  assert.equal(e.sesion.actual().a.tema, "integracion");
  assert.match(e.ordenes.at(-1).content, /^Empecemos con «Integración»/);
  eleccion = "Cancelar";
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().a.tema, "integracion");
  eleccion = "Cambiar sin guardar";
  const abandonado = e.sesion.actual().a.log;
  writeFileSync(join(e.vault, abandonado), real);
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().a.tema, "derivacion");
  await e.estudiar("calculo integracion");
  assert.equal(e.sesion.actual().pendiente, undefined, "lo abandonado a propósito no se ofrece reconstruir");
});
test("H63: si pi se cortó antes de responder al alumno, al reanudar se avisa y el tutor lo responde sin duplicarlo", async t => {
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  e.entradas.push({ type: "message", id: "m1", message: { role: "user", content: [{ type: "text", text: "se me colgó todo, ¿seguimos?" }] } });
  mock.timers.enable({ apis: ["setTimeout"] }); t.after(() => mock.timers.reset());
  await e.eventos.get("session_start")({ type: "session_start", reason: "startup" }, e.ctx);
  assert.deepEqual(e.avisos.at(-1), ["info", "La clase se cortó antes de responder tu último mensaje: el tutor lo responde ahora."]);
  assert.equal(e.ordenes.length, 1, "en session_start la terminal todavía no escucha: el turno espera");
  mock.timers.tick(1500);
  assert.equal(e.ordenes.length, 2);
  assert.deepEqual([e.ordenes[1].display, e.ordenes[1].triggerTurn], [false, true]);
  assert.match(e.ordenes[1].content, /sin repetirlo/);
  assert.deepEqual(e.usuario, []);
  e.ctx.isIdle = () => false;
  await e.eventos.get("session_start")({ type: "session_start", reason: "startup" }, e.ctx);
  mock.timers.tick(1500);
  assert.equal(e.ordenes.length, 2, "si el alumno ya escribió otra cosa, no se agrega nada");
});
test("H44/H43: con un curso activo sólo quedan las tools del estudio, sin skills; al cerrar vuelve el set anterior", async t => {
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  assert.deepEqual([...e.activas].sort(), ["ask_user_question", "buscar_material", "investigar_tema", "leer_items", "leer_paginas", "leer_sesion_anterior", "quiz", "read", "registrar_progreso", "ver_pagina"]);
  assert.deepEqual(e.entradas.at(-1).data.herramientas, TODAS);
  const evento = { systemPromptOptions: { sections: {}, skills: [{ name: "teach" }, { name: "visualize" }] } };
  e.eventos.get("before_agent_start")(evento, e.ctx);
  assert.deepEqual(evento.systemPromptOptions.skills, []);
  const leer = path => e.eventos.get("tool_call")({ toolName: "read", input: { path } }, { cwd: e.vault });
  assert.equal(leer("/tmp/pi-clipboard-1234.png"), undefined);
  for (const p of ["cursos/calculo/_procesado/libro/render/0001.png", "~/../../" + e.vault.slice(1) + "/cursos/calculo/progreso.yaml", ".pi/skills/teach/SKILL.md"]) assert.equal(leer(p)?.block, true, p);
  e.activas = [...TODAS];
  await e.eventos.get("session_start")({ type: "session_start", reason: "resume" }, e.ctx);
  assert.equal(e.activas.includes("bash"), false);
  await e.sesion.cerrar(e.ctx);
  assert.deepEqual(e.activas, TODAS);
  assert.equal(leer(".pi/skills/teach/SKILL.md"), undefined);
  const sinCurso = { systemPromptOptions: { sections: {}, skills: [{ name: "teach" }] } };
  e.eventos.get("before_agent_start")(sinCurso, e.ctx);
  assert.deepEqual(sinCurso.systemPromptOptions.skills, [{ name: "teach" }]);
});
test("H16: una sesión sin nota no deja su nombre libre: la siguiente no hereda su cierre ni su historial", async t => {
  const d = datos(), e = entorno(t, d), confirma = e.pi.events.emit, fecha = new Date().toLocaleDateString("sv-SE");
  registrarProgreso(e.pi, e.sesion, e.vault);
  e.pi.events.emit = () => {};
  await e.estudiar("calculo derivacion");
  const sinNota = e.sesion.actual().a.log;
  e.entradas.push({ type: "custom", customType: "curso-cierre", data: { log: sinNota, adHoc: false } }, { type: "custom", customType: "curso-progreso", data: { log: sinNota, cierre: true } },
    { type: "message", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Resumen final." }] } });
  await e.eventos.get("agent_settled")({ type: "agent_settled", aborted: false }, e.ctx);
  assert.equal(e.sesion.actual(), undefined);
  e.pi.events.emit = confirma;
  d.progreso.historial = [{ log: `sesiones/${fecha}-derivacion-2.md`, tema: "derivacion", cierre: true }];
  await e.estudiar("calculo derivacion");
  assert.equal(e.sesion.actual().a.log, `cursos/calculo/sesiones/${fecha}-derivacion-3.md`);
  e.entradas.push({ type: "message", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "¿Qué es una derivada?" }] } });
  e.avisos.length = 0;
  await e.eventos.get("agent_settled")({ type: "agent_settled", aborted: false }, e.ctx);
  assert.equal(e.sesion.actual()?.a.tema, "derivacion", "la primera pregunta no cierra la sesión nueva");
  assert.deepEqual(e.avisos, []);
});
test("H44: una tool que se registra tarde (reanudar sin el registro de pi, web, MCP) no queda activa durante el estudio", async t => {
  const e = entorno(t);
  await e.estudiar("calculo derivacion");
  const estudio = [...e.activas];
  e.activas = [...e.activas, "web_search", "fetch_content"];
  e.eventos.get("before_agent_start")({ systemPromptOptions: { sections: {}, skills: [] } }, e.ctx);
  assert.deepEqual(e.activas, estudio);
});
test("H71: sin cursos/ todavía, /estudiar remite a /curso-nuevo en vez de un errno", async t => {
  const e = entorno(t);
  rmSync(join(e.vault, "cursos"), { recursive: true });
  await e.estudiar("redes retardos");
  assert.deepEqual(e.avisos.at(-1), ["warning", "No hay cursos preparados; usá /curso-nuevo."]);
});
