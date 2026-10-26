import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { getEventListeners } from "node:events";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { loadProject, piDir, pythonDelVenv, vaultDir } from "../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "../extensions/curso/ingesta.ts";
import { registrarPreparacion } from "../extensions/curso/preparacion.ts";
import { guardarCurso, registrarCuracion } from "../extensions/curso/curacion.ts";
// Las llamadas simuladas anotan su consumo en una carpeta temporal, no en el registro real de la máquina (DA48).
process.env.LEARN_CONSUMO_DIR = mkdtempSync(join(tmpdir(), "learn-consumo-"));

// Remates de integración: md-log, sesión y progreso reales sobre un bus de eventos, backend Python real, sin modelos.
// retomar: el vault de una clase anterior, que otro pi retoma desde session_start (sin /estudiar).
async function clase(t, anterior = false, retomar) {
  const vault = retomar ?? mkdtempSync(join(tmpdir(), "pi-remates-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of [join(recursos, "skills/teach"), join(raiz, "sesiones")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(raiz, "indice.yaml"), "documentos: []\ntemas:\n- {id: derivacion}\n"); writeFileSync(join(raiz, "progreso.yaml"), "version: 1\ntemas: {}\nhistorial: []\n");
  if (anterior) writeFileSync(join(raiz, "sesiones/2026-01-01-derivacion.md"), "> [!quote] VOS\n\nCreo que es la regla de la cadena.\n");
  const d = { curso: "ejemplo", nombre: "Ejemplo", contrato: "Contrato", documentos: [], temas: [{ id: "derivacion", nombre: "Derivación", unidad: 1, alias: [], objetivos: [], prerequisitos: [] }], items: {}, progreso: { temas: {}, historial: [] }, avisos: [] };
  const handlers = new Map(), bus = new Map(), comandos = new Map(), entradas = [], avisos = [], ordenes = [], selects = [];
  const pi = { d, on: (n, h) => handlers.set(n, [...(handlers.get(n) || []), h]), registerCommand: (n, c) => comandos.set(n, c), registerTool: () => {},
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {}, sendMessage: m => ordenes.push(m.content),
    getAllTools: () => [], getActiveTools: () => [], setActiveTools: () => {}, exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "", killed: false }),
    events: { on: (n, h) => bus.set(n, [...(bus.get(n) || []), h]), emit: (n, p) => { for (const h of bus.get(n) || []) h(p); } } };
  const ctx = { cwd: vault, hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "prueba" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: () => {}, select: async (titulo, opciones) => (selects.push([titulo, opciones]), opciones[0]), confirm: assert.fail } };
  mdLog(pi);
  const sesion = registrarSesion(pi, vault, recursos), progreso = registrarProgreso(pi, sesion, vault);
  const emitir = async (n, ev = {}) => { for (const h of handlers.get(n) || []) await h(ev, ctx); };
  await emitir("session_start", { type: "session_start", reason: "startup" });
  if (!retomar) await comandos.get("estudiar").handler("ejemplo derivacion", ctx);
  const final = async texto => { const message = { role: "assistant", stopReason: "stop", content: [{ type: "text", text: texto }] }; await emitir("message_end", { message }); entradas.push({ type: "message", message }); };
  const guardar = extra => progreso.registrar("prueba", { resumen: "Probe", borde: { domina: ["Derivar un polinomio"] }, ...extra }, undefined, undefined, ctx);
  return { vault, raiz, pi, ctx, comandos, entradas, avisos, ordenes, selects, sesion, progreso, emitir, final, guardar };
}
const historial = e => readFileSync(join(e.raiz, "progreso.yaml"), "utf8").match(/log: .*/g);

// progreso.py ata el historial al nombre AAAA-MM-DD-<tema>[-N].md (fecha y orden de H29): el curso conserva ese nombre y md-log sigue la nota por inode.
test("H04: con la nota renombrada en Obsidian, /fin guarda con el nombre de la sesión, escribe en la nota movida y cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Clase renombrada.md";
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Pregunta 1.");
  await e.comandos.get("fin").handler("", e.ctx);
  const r = await e.guardar({ cierre: true });
  assert.doesNotMatch(r.content[0].text, /no está|se renombró o movió en Obsidian/);
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.deepEqual(historial(e), [`log: ${log.slice("cursos/ejemplo/".length)}`]);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Pregunta 1\.[\s\S]*Resumen final\./);
  assert.ok(!existsSync(join(e.raiz, ".sesion-activa.json")));
  assert.deepEqual(e.avisos, [["info", "Sesión cerrada. El log se conserva en Obsidian."]]);
});

test("H04: la ruta nueva de la nota queda en el curso activo: un pi que retoma sólo con el registro propio (X01) la revincula y /fin cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Clase renombrada.md";
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Pregunta 1.");
  const cursos = e.entradas.filter(x => x.customType === "curso").map(x => x.data);
  assert.deepEqual(cursos.at(-1), { ...cursos[0], nota: nueva });
  assert.equal(JSON.parse(readFileSync(join(e.raiz, ".sesion-activa.json"), "utf8")).nota, nueva);
  // pi se corta y su archivo de sesión perdió las entradas (disco lleno): queda el registro propio.
  const f = await clase(t, false, e.vault);
  await f.emitir("before_agent_start", { systemPromptOptions: { sections: {} } });
  await f.final("Pregunta 2.");
  await f.comandos.get("fin").handler("", f.ctx);
  await f.guardar({ cierre: true });
  await f.final("Resumen final.");
  await f.emitir("agent_settled", {});
  assert.equal(f.sesion.actual(), undefined);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Pregunta 1\.[\s\S]*Pregunta 2\.[\s\S]*Resumen final\./);
  assert.deepEqual(historial(f), [`log: ${log.slice("cursos/ejemplo/".length)}`]);
  assert.deepEqual(f.avisos, [["info", "Sesión cerrada. El log se conserva en Obsidian."]]);
});

test("H04: registrar_progreso recibe la ruta actual de la nota y sólo avisa mientras no se la encuentra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Clase renombrada.md";
  renameSync(join(e.vault, log), join(e.vault, nueva));
  // Todavía nada siguió el renombre: la ruta conocida no está.
  assert.match((await e.guardar()).content[0].text, /El log sesiones\/[^ ]+ no está \(¿se renombró o movió en Obsidian\?\)/);
  await e.final("Pregunta 1.");
  assert.equal(e.sesion.actual().a.nota, nueva);
  assert.doesNotMatch((await e.guardar()).content[0].text, /no está/);
});

test("H16: una clase sin nota no repite en cada guardado que falta el log", { skip: process.platform === "win32" && "Windows ignora chmod de carpetas: no se puede simular sesiones/ sin permiso" }, async t => {
  const e = await clase(t), elegir = { ...e.ctx, ui: { ...e.ctx.ui, select: async (_t, opciones) => opciones.find(o => o === "Cambiar sin guardar") ?? opciones[0] } };
  chmodSync(join(e.raiz, "sesiones"), 0o555);
  try { await e.comandos.get("estudiar").handler("ejemplo derivacion", elegir); } finally { chmodSync(join(e.raiz, "sesiones"), 0o755); }
  assert.match(e.avisos.at(-1)[1], /seguimos sin nota/);
  for (const extra of [{}, { cierre: true }]) assert.doesNotMatch((await e.guardar(extra)).content[0].text, /no está|se renombró o movió en Obsidian/);
  assert.equal(historial(e).length, 1);
});

test("H04: una nota movida fuera de sesiones/ no invalida el curso al retomar y /fin la cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, movida = "cursos/ejemplo/Movida.md";
  renameSync(join(e.vault, log), join(e.vault, movida));
  await e.final("Pregunta 1.");
  await e.emitir("session_start", { type: "session_start", reason: "resume" });
  assert.ok(e.sesion.actual());
  await e.comandos.get("fin").handler("", e.ctx);
  await e.guardar({ cierre: true });
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.match(readFileSync(join(e.vault, movida), "utf8"), /Pregunta 1\.[\s\S]*Resumen final\./);
});

test("H04: si el renombre se nota recién con el mensaje final, igual cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Movida.md";
  await e.comandos.get("fin").handler("", e.ctx);
  await e.guardar({ cierre: true });
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Resumen final\./);
});

test("H26/H25: cortar el turno (/fin, /estudiar) cierra un quiz o una pregunta abiertos sin Esc", async () => {
  const p = await loadProject();
  const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
  const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
  const quiz = { question: "¿Qué retardo depende de la distancia?", options: [{ label: "Propagación", value: "prop" }, { label: "Transmisión", value: "trans" }, { label: "Cola", value: "cola" }], correctAnswer: "prop", explanation: "d/s" };
  const ask = { question: "¿Seguimos?", options: [{ label: "Sí" }, { label: "Más tarde" }] };
  try {
    for (const [nombre, args] of [["quiz", quiz], ["quiz", { ...quiz, multiSelect: true, correctAnswer: ["prop"] }], ["ask_user_question", ask], ["ask_user_question", { ...ask, multiSelect: true }]]) {
      for (const antes of [false, true]) {
        // antes: el corte llegó mientras esperaba el turno de otro popup.
        const corte = new AbortController(), tool = p.session.extensionRunner.getToolDefinition(nombre);
        const ctx = { hasUI: true, ui: { custom: factory => new Promise(res => { if (antes) corte.abort(); factory(tui, theme, {}, res); setTimeout(() => corte.abort(), 10); }) } };
        const r = await Promise.race([tool.execute("x", args, corte.signal, () => {}, ctx), new Promise(res => setTimeout(() => res({ details: { status: "abierto" } }), 1500))]);
        assert.equal(r.details.status, "cancelled", `${nombre} ${JSON.stringify(args.multiSelect ?? false)} ${antes}`);
      }
    }
    // El signal dura toda la corrida: los popups respondidos no le dejan listeners (Node avisa desde 11, y el aviso ensucia la terminal).
    const corrida = new AbortController(), quizTool = p.session.extensionRunner.getToolDefinition("quiz");
    const responder = { hasUI: true, ui: { custom: factory => new Promise(res => { const c = factory(tui, theme, {}, r => { c.dispose?.(); res(r); }); c.handleInput("\r"); c.handleInput("\r"); }) } };
    for (let i = 0; i < 12; i++) assert.notEqual((await quizTool.execute("q", quiz, corrida.signal, () => {}, responder)).details.status, "cancelled");
    assert.equal(getEventListeners(corrida.signal, "abort").length, 0);
  } finally { await p.close(); }
});

test("H26/H25: un corte con el quiz ya corregido conserva la respuesta (el alumno ya vio la correcta)", async () => {
  const p = await loadProject();
  const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
  const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
  const quiz = { question: "¿Qué retardo depende de la distancia?", options: [{ label: "Propagación", value: "prop" }, { label: "Transmisión", value: "trans" }, { label: "Cola", value: "cola" }], correctAnswer: "prop", explanation: "d/s" };
  try {
    for (const args of [quiz, { ...quiz, multiSelect: true, correctAnswer: ["prop"] }]) {
      const corte = new AbortController(), tool = p.session.extensionRunner.getToolDefinition("quiz"), pantallas = [];
      // Responde la primera opción (en múltiple: la marca y baja hasta Enviar) y el corte llega con la corrección a la vista.
      const ctx = { hasUI: true, ui: { custom: factory => new Promise(res => {
        const c = factory(tui, theme, {}, res);
        for (const tecla of args.multiSelect ? [" ", "\x1b[B", "\x1b[B", "\x1b[B", "\x1b[B", "\r"] : ["\r"]) c.handleInput(tecla);
        pantallas.push(c.render(100).join("\n")); setTimeout(() => corte.abort(), 10);
      }) } };
      const r = await Promise.race([tool.execute("x", args, corte.signal, () => {}, ctx), new Promise(res => setTimeout(() => res({ details: { status: "abierto" } }), 1500))]);
      assert.match(pantallas[0], /Enter o Esc para seguir/);
      assert.equal(r.details.status, "answered", JSON.stringify(args.multiSelect ?? false));
      assert.equal(r.details.answers.length, 1);
    }
  } finally { await p.close(); }
});

test("H26/H25, H45: la respuesta libre de ask_user_question se cierra al cortar el turno y dibuja sus atajos en español", async () => {
  const p = await loadProject();
  const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
  const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
  try {
    const tool = p.session.extensionRunner.getToolDefinition("ask_user_question"), corte = new AbortController(), pantallas = [];
    // Como pi 1.4.0: ui.editor no recibe el signal y sólo se cierra con Esc (interactive-mode.js:2192-2200).
    const ctx = { hasUI: true, ui: { editor: () => new Promise(() => {}),
      custom: factory => new Promise(res => { pantallas.push(factory(tui, theme, {}, res).render(100).join("\n")); setTimeout(() => corte.abort(), 10); }) } };
    const r = await Promise.race([tool.execute("x", { question: "Contame tu objetivo" }, corte.signal, () => {}, ctx), new Promise(res => setTimeout(() => res({ details: { status: "abierto" } }), 1500))]);
    assert.equal(r.details.status, "cancelled");
    assert.match(pantallas[0], /Contame tu objetivo[\s\S]*Enter enviar • Ctrl\+J nueva línea • Esc cancelar/);
    // En RPC custom no existe (devuelve undefined): sigue el editor del cliente.
    const rpc = await tool.execute("y", { question: "Contame tu objetivo" }, undefined, () => {}, { hasUI: true, mode: "rpc", ui: { editor: async () => "Aprobar el parcial", custom: async () => undefined } });
    assert.equal(rpc.content[0].text, "Respuesta del alumno: Aprobar el parcial");
  } finally { await p.close(); }
});

test("H45: las confirmaciones se dibujan en español y Esc o un corte valen como no", async t => {
  const vistas = [], si = respuesta => async (titulo, opciones) => (vistas.push([titulo.split("\n")[0], opciones]), respuesta === "si" ? opciones[0] : respuesta);
  // Reconstrucción del progreso (la ve el alumno en clase).
  const e = await clase(t, true), { r } = e.sesion.actual();
  const leido = await e.progreso.leerAnterior(), huella = leido.content[0].text.match(/SHA-256: (\w+)/)[1];
  const reconstruir = () => e.guardar({ reconstruir_log: e.sesion.actual().pendiente, huella_log: huella });
  e.ctx.ui.select = si(undefined);
  await assert.rejects(reconstruir, /Reconstrucción sin confirmar/);
  e.ctx.ui.select = si("si");
  assert.equal((await reconstruir()).details.guardado, true);
  // /md-log sobre una nota con contenido.
  const nota = join(r, "sesiones/otra.md"); writeFileSync(nota, "contenido previo");
  e.ctx.ui.select = si(undefined);
  await e.comandos.get("md-log").handler(nota, e.ctx);
  assert.equal(readFileSync(nota, "utf8"), "contenido previo");
  // Tanda de visión sobre el límite y guardado de un curso existente.
  const modelRegistry = { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true };
  const tanda = await transcribir({ hasUI: true, modelRegistry, ui: { select: si("No") } }, { vault: e.vault, salida: r, doc: "libro", paginas: [1, 2] }, { modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 });
  assert.equal(tanda.resumen.cancelada, true);
  const pi = { exec: async () => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ diff: "+Un tema", copias: [], nuevo: false }) }), sendMessage: () => {} };
  assert.equal((await guardarCurso(pi, { curso: "ejemplo", propuesta: "_procesado/propuesta.json" }, { hasUI: true, ui: { select: si(undefined) } })).details.cancelada, true);
  assert.deepEqual(vistas, [["Reconstruir el progreso de la clase anterior", ["Sí, guardar la reconstrucción", "No"]], ["Reconstruir el progreso de la clase anterior", ["Sí, guardar la reconstrucción", "No"]],
    ["Reemplazar nota con el historial", ["Sí, reemplazar la nota", "No"]], ["Confirmar gasto de visión", ["Sí, transcribir", "No"]], ["Guardar cambios del curso", ["Sí, guardar los cambios", "No"]]]);
});

test("H45: en la terminal, el selector de temas, el cambio de tema y las confirmaciones se dibujan con la ayuda en español", async t => {
  const e = await clase(t, true), { r } = e.sesion.actual(), vistas = [];
  const kb = { matches: (dato, id) => ({ "tui.select.cancel": "\x1b" })[id] === dato, getKeys: id => [({ "tui.select.confirm": "enter", "tui.select.cancel": "escape" })[id]] };
  // Cada respuesta son las teclas del alumno: j baja, \n elige.
  const teclas = [];
  const ui = { select: assert.fail, custom: factory => new Promise(res => {
    const c = factory({ requestRender() {} }, { fg: (_c, s) => s, bold: s => s }, kb, res);
    vistas.push(c.render(100).join("\n"));
    for (const k of teclas.shift()) c.handleInput(k);
  }) };
  const tc = { ...e.ctx, mode: "tui", ui: { ...e.ctx.ui, ...ui } };
  teclas.push(["\n"], ["j", "j", "\n"]);
  await e.comandos.get("estudiar").handler("ejemplo", tc);
  const leido = await e.progreso.leerAnterior(), huella = leido.content[0].text.match(/SHA-256: (\w+)/)[1];
  teclas.push(["j", "\n"]);
  await assert.rejects(() => e.progreso.registrar("x", { resumen: "Probe", reconstruir_log: e.sesion.actual().pendiente, huella_log: huella }, undefined, undefined, tc), /Reconstrucción sin confirmar/);
  const nota = join(r, "sesiones/otra.md"); writeFileSync(nota, "contenido previo");
  teclas.push(["\x1b"]);
  await e.comandos.get("md-log").handler(nota, tc);
  assert.equal(readFileSync(nota, "utf8"), "contenido previo");
  const modelRegistry = { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true };
  teclas.push(["j", "\n"]);
  const tanda = await transcribir({ hasUI: true, mode: "tui", modelRegistry, ui }, { vault: e.vault, salida: r, doc: "libro", paginas: [1, 2] }, { modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 });
  assert.equal(tanda.resumen.cancelada, true);
  const pi = { exec: async () => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ diff: "+Un tema", copias: [], nuevo: false }) }), sendMessage: () => {} };
  teclas.push(["\x1b"]);
  assert.equal((await guardarCurso(pi, { curso: "ejemplo", propuesta: "_procesado/propuesta.json" }, { hasUI: true, mode: "tui", ui })).details.cancelada, true);
  assert.deepEqual(vistas.map(v => v.split("\n")[2]), [" Temas: en curso, prerequisitos firmes, restantes", " Estás en «Derivación»", " Reconstruir el progreso de la clase anterior",
    " Reemplazar nota con el historial", " Confirmar gasto de visión", " Guardar cambios del curso"]);
  for (const v of vistas) { assert.match(v, /\n ↑↓ moverse {2}enter elegir {2}escape cancelar\n/); assert.doesNotMatch(v, /navigate|select\b|cancel\b|Yes/); }
  assert.equal(e.sesion.actual().a.tema, "derivacion");
});

test("H45: sin el venv, las operaciones locales fallan en español y remiten al doctor", async t => {
  const real = childProcess.spawn;
  mock.method(childProcess, "spawn", (_programa, args, opciones) => real("/no/existe/python", args, opciones)); syncBuiltinESMExports();
  t.after(() => { mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(() => python("trabajo", {}, undefined, "preparacion.py"), { message: "Falta el entorno de ingesta (Python): corré .pi/scripts/doctor." });
});

test("textos: la copia muestra el error limpio de Python y la nota se nombra en palabras del alumno", async t => {
  const e = await clase(t);
  e.pi.exec = async () => ({ code: 1, killed: false, stdout: "", stderr: "Disco lleno: no se pudo preparar el material; liberá espacio y reintentá.\n" });
  e.avisos.length = 0;
  await e.comandos.get("estudiar").handler("ejemplo derivacion", e.ctx);
  assert.deepEqual(e.avisos.filter(([, m]) => /Material/.test(m)), [["warning", "Material desde la última carga. Disco lleno: no se pudo preparar el material; liberá espacio y reintentá."]]);
  assert.equal(e.sesion.actual().pendiente, undefined);
  // Otra nota vinculada a mano durante la clase: el cierre no se confirma, se dice sin nombrar componentes y con lo que lo destraba (repetir /fin no alcanza).
  const otra = join(e.raiz, "sesiones/otra.md"); writeFileSync(otra, "");
  await e.comandos.get("md-log").handler(otra, e.ctx);
  await e.comandos.get("fin").handler("", e.ctx);
  await e.guardar({ cierre: true });
  await e.final("Resumen final.");
  e.avisos.length = 0;
  await e.emitir("agent_settled", {});
  assert.deepEqual(e.avisos, [["warning", "No se pudo cerrar la nota de la clase en Obsidian; la clase sigue abierta: hay otra nota vinculada, desvinculala con /md-unlog y repetí /fin."]]);
  assert.ok(e.sesion.actual());
  await e.comandos.get("md-unlog").handler("", e.ctx);
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
});

// Preparación por tema con la ingesta base real y un modelo simulado (como preparacion-auditoria): libro, parcial y práctico.
const CURSO = `from pathlib import Path
import sys, yaml, pymupdf
from test_ingesta import crear_pdf
from pipeline import ejecutar
v = Path(sys.argv[1]); raiz = v / "cursos/ejemplo"
for tipo in ["bibliografia", "evaluaciones", "ejercicios"]:
    (raiz / f"fuentes/{tipo}").mkdir(parents=True)
crear_pdf(raiz / "fuentes/bibliografia/libro.pdf")
for tipo, doc, texto in [("evaluaciones", "parcial", "Pregunta 1 (8 puntos) Calcule la derivada."), ("ejercicios", "practico", "Ejercicio 1. Derive la composición de funciones.")]:
    with pymupdf.open() as pdf:
        pdf.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 100, 450, 400), texto, fontsize=12)
        pdf.save(raiz / f"fuentes/{tipo}/{doc}.pdf")
docs = [{"id": "libro", "titulo": "Libro", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/libro.pdf", "paginas": 3, "prioridad": "principal"},
        {"id": "parcial", "titulo": "Parcial", "tipo": "evaluaciones", "archivo": "fuentes/evaluaciones/parcial.pdf", "paginas": 1},
        {"id": "practico", "titulo": "Práctico", "tipo": "ejercicios", "archivo": "fuentes/ejercicios/practico.pdf", "paginas": 1}]
tema = {"id": "derivacion", "nombre": "Derivación", "unidad": 1, "alias": [], "prerequisitos": [], "objetivos": ["O1.1"], "bibliografia": [{"doc": "libro", "seccion": "Derivadas", "paginas": [1, 2]}], "ejercicios": [], "evaluaciones": []}
(raiz / "indice.yaml").write_text(yaml.safe_dump({"version": 1, "documentos": docs, "temas": [tema]}, allow_unicode=True))
(raiz / "curso.md").write_text("---\\nnombre: Ejemplo\\nslug: ejemplo\\n---\\n# Objetivos\\n- O1.1: Derivar.\\n")
(raiz / "progreso.yaml").write_text("version: 1\\ntemas: {}\\nhistorial: []\\n")
ejecutar({"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
          "documentos": [{**d, "archivo": f"cursos/ejemplo/{d['archivo']}", "paginas": list(range(1, d["paginas"] + 1))} for d in docs]}, v, raiz / "_procesado")`;
const USO = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const respuesta = (texto, extra = {}) => ({ stopReason: "stop", content: texto ? [{ type: "text", text: texto }] : [], usage: structuredClone(USO), ...extra });
function preparacion(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-remates-prep-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const r = spawnSync(pythonDelVenv(piDir), ["-c", CURSO, vault], { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta"), PYTHONDONTWRITEBYTECODE: "1" }, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  mkdirSync(recursos);
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 }));
  const d = JSON.parse(spawnSync(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", "ejemplo"], { encoding: "utf8" }).stdout);
  const e = { activo: { a: { curso: "ejemplo", tema: "derivacion", log: "cursos/ejemplo/sesiones/1.md" }, d, r: raiz }, avisos: [], llamadas: [], eventos: new Map(), guion: {}, raiz };
  const pi = { on: (n, h) => e.eventos.set(n, h), sendMessage: () => {} };
  const ctx = { hasUI: true, ui: { setStatus: () => {}, notify: (m, tipo) => e.avisos.push([tipo, m]) },
    modelRegistry: { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true, getProviderAuth: async () => undefined,
      streamSimple: (_modelo, contexto) => ({ result: async () => {
        const pedido = contexto.messages[0].content, texto = pedido.map(b => b.text || "").join("");
        const tipo = pedido.some(b => b.type === "image") ? "vision" : contexto.systemPrompt.startsWith("Segmentás") ? "segmentar" : "clasificar";
        e.llamadas.push(tipo);
        const guionada = e.guion[tipo]?.(texto);
        if (guionada) return guionada;
        if (tipo === "vision") return respuesta("El ejercicio pide derivar una función compuesta y justificar cada paso del procedimiento. ".repeat(3));
        if (tipo === "segmentar") return respuesta(JSON.stringify({ items: [{ id: "1", paginas: [1], enunciado: texto.includes("Documento parcial") ? "Calcule la derivada." : "Derive la composición." }] }));
        const { items } = JSON.parse(texto.slice(0, texto.lastIndexOf("}") + 1));
        return respuesta(JSON.stringify({ asignaciones: items.map(i => ({ doc: i.doc, id: i.id, tema: "derivacion" })) }));
      } }) } };
  const prep = registrarPreparacion(pi, { actual: () => e.activo, refrescar: () => "" }, vault, recursos);
  let n = 0;
  e.turno = async () => { e.activo.a.log = `cursos/ejemplo/sesiones/${++n}.md`; await e.eventos.get("before_agent_start")({}, ctx); await prep.ultima(); };
  e.json = f => JSON.parse(readFileSync(join(raiz, "_procesado", f), "utf8"));
  return e;
}

test("preparación (a): una segmentación que falla siempre no gasta llamadas en cada /estudiar hasta mañana o hasta que cambien sus entradas", async t => {
  const e = preparacion(t);
  e.guion.segmentar = texto => texto.includes("Documento parcial") && respuesta("No encontré ítems.");
  await e.turno();
  assert.equal(e.llamadas.filter(x => x === "segmentar").length, 3);
  assert.deepEqual(e.avisos, [], "P4: una segmentación que espera no cambia lo que puede hacer el alumno");
  e.llamadas.length = 0;
  await e.turno();
  assert.deepEqual([e.llamadas, e.avisos.length, e.json("preparacion.json").temas.derivacion.estado], [[], 0, "incompleta"]);
  // Un día después se reintenta una vez más (2 llamadas) y vuelve a esperar.
  const prep = e.json("preparacion.json"); prep.fallos["segmentar/parcial"].fecha = "2000-01-01T00:00:00+00:00";
  writeFileSync(join(e.raiz, "_procesado/preparacion.json"), JSON.stringify(prep));
  await e.turno(); await e.turno();
  assert.deepEqual(e.llamadas, ["segmentar", "segmentar"]);
  // El mismo día, si cambian sus entradas (el índice usa un id de ese parcial), también.
  e.llamadas.length = 0; delete e.guion.segmentar;
  writeFileSync(join(e.raiz, "indice.yaml"), readFileSync(join(e.raiz, "indice.yaml"), "utf8").replace("evaluaciones: []", "evaluaciones: [{doc: parcial, items: ['1']}]"));
  await e.turno();
  assert.deepEqual(e.llamadas, ["segmentar"]);
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "completa");
});

test("preparación (b, c): red, cuota o credenciales cortan la tanda en la primera falla; un plazo vencido se dice en español", async t => {
  const e = preparacion(t);
  e.guion.vision = () => respuesta("", { stopReason: "error", errorMessage: "429 Too Many Requests: You have hit your usage limit" });
  await e.turno();
  assert.deepEqual(e.llamadas, ["vision"]);
  assert.deepEqual(e.avisos, [["warning", "Preparación del material no disponible: el proveedor rechazó el pedido por cuota o límite de uso; esperá o cambiá de modelo con /model; seguimos con lo que hay."]]);
  const f = preparacion(t);
  f.guion.segmentar = () => respuesta("", { stopReason: "error", errorMessage: "fetch failed" });
  await f.turno();
  assert.deepEqual(f.llamadas.filter(x => x !== "vision"), ["segmentar"]);
  assert.deepEqual(f.avisos, [["warning", "Preparación del material no disponible: sin conexión con el proveedor del modelo; revisá la red; seguimos con lo que hay."]]);
  assert.ok(!existsSync(join(f.raiz, "_procesado/preparacion.json")) || !f.json("preparacion.json").fallos, "una falla de red no deja el documento en espera");
  const g = preparacion(t);
  g.guion.segmentar = texto => texto.includes("Documento parcial") && respuesta("", { stopReason: "aborted", errorMessage: "Request was aborted" });
  await g.turno();
  // Un plazo vencido no es una falla de red: el parcial queda en espera, sin aviso, y la tanda sigue.
  assert.deepEqual(g.avisos, []);
  assert.ok(g.json("preparacion.json").fallos["segmentar/parcial"]);
});

test("H19: los fallos de la corrida quedan registrados aunque después la corte la red, y la próxima clase no los repite", async t => {
  const e = preparacion(t);
  // El parcial responde algo inválido dos veces (queda en espera); con el práctico se cae la red.
  e.guion.segmentar = texto => texto.includes("Documento parcial") ? respuesta("No encontré ítems.") : respuesta("", { stopReason: "error", errorMessage: "fetch failed" });
  await e.turno();
  assert.deepEqual(e.llamadas.filter(x => x !== "vision"), ["segmentar", "segmentar", "segmentar"]);
  assert.deepEqual(e.avisos, [["warning", "Preparación del material no disponible: sin conexión con el proveedor del modelo; revisá la red; seguimos con lo que hay."]]);
  assert.deepEqual(Object.keys(e.json("preparacion.json").fallos), ["segmentar/parcial"]);
  assert.equal(e.json("preparacion.json").temas, undefined, "el tema sigue sin preparar");
  e.llamadas.length = 0; delete e.guion.segmentar;
  await e.turno();
  assert.deepEqual(e.llamadas.filter(x => x === "segmentar"), ["segmentar"], "sólo el práctico");
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "incompleta");
});

test("preparación (b): un ítem inválido que habla de sockets o conexiones no corta la tanda como una falla de red", async t => {
  const e = preparacion(t);
  // El motivo del rechazo cita el ítem: en un curso de redes trae «socket», «connection» o «401» sin que falle el proveedor.
  e.guion.segmentar = texto => texto.includes("Documento parcial") && respuesta(JSON.stringify({ items: [{ id: "1", paginas: [9], enunciado: "Explique qué hace un socket TCP al cerrar la connection (HTTP 401)." }] }));
  await e.turno();
  assert.equal(e.llamadas.filter(x => x === "segmentar").length, 3);
  assert.deepEqual(e.avisos, []);
  assert.ok(e.json("preparacion.json").fallos["segmentar/parcial"]);
});

test("preparación (e, f): sólo se borra el lock propio y un pid reutilizado tras reiniciar no lo retiene", async t => {
  const e = preparacion(t), lock = join(e.raiz, "_procesado/.preparacion.lock");
  // El pid vive (este proceso) pero el lock es de otro arranque.
  writeFileSync(lock, JSON.stringify({ pid: process.pid, inicio: Date.now(), proceso: "otro-arranque:123" }));
  const ajeno = JSON.stringify({ pid: process.pid, inicio: Date.now(), proceso: "otra-instancia" });
  // A mitad de la tanda, otra instancia (tras /reload) toma el lock: el finally viejo no lo borra.
  e.guion.vision = () => { if (e.llamadas.length === 1) writeFileSync(lock, ajeno); };
  await e.turno();
  assert.equal(e.llamadas.filter(x => x === "vision").length, 4);
  assert.equal(readFileSync(lock, "utf8"), ajeno);
});

test("/curso-check suma una línea por tema con la preparación automática, y sin ella igual valida", { skip: !existsSync(join(vaultDir, "cursos/redes/indice.yaml")) && "necesita el curso real de Redes en el vault" }, async () => {
  const comandos = new Map(), mensajes = [];
  registrarCuracion({ registerCommand: (n, d) => comandos.set(n, d), sendMessage: m => mensajes.push(m.content),
    exec: async (_py, args) => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ ok: true, errores: [], avisos: ["Aviso de validar."], pendientes: args.includes("redes") ? [] : [{ doc: "libro", pagina: 3 }] }) }) });
  for (const curso of ["redes", "no-existe"]) await comandos.get("curso-check").handler(curso, { ui: { notify: assert.fail } });
  assert.match(mensajes[0], /Aviso de validar\.\n(Preparación de [a-z-]+: [^\n]+; \d+ ítems? asignados? automáticamente\.\n){2,}Informe:/);
  assert.match(mensajes[0], /^redes: estructura válida; 0 páginas referidas pendientes\./);
  assert.match(mensajes[1], /^no-existe: estructura válida; 1 página referida pendiente\.\nAviso de validar\.\nInforme:/);
  // El diálogo de guardar un curso también dice «1 PDF nuevo».
  let titulo;
  const pi = { exec: async () => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ diff: "+Un tema", copias: ["fuentes/bibliografia/nuevo.pdf"], nuevo: false }) }), sendMessage: () => {} };
  await guardarCurso(pi, { curso: "ejemplo", propuesta: "_procesado/propuesta.json" }, { hasUI: true, ui: { select: async t => { titulo = t; } } });
  assert.match(titulo, /\n1 PDF nuevo\./);
});
