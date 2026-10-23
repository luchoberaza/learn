import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { getEventListeners } from "node:events";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "../extensions/curso/ingesta.ts";
import { guardarCurso } from "../extensions/curso/curacion.ts";

// Remates de integración: md-log, sesión y progreso reales sobre un bus de eventos, backend Python real, sin modelos.
async function clase(t, anterior = false) {
  const vault = mkdtempSync(join(tmpdir(), "pi-remates-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of [join(recursos, "skills/teach"), join(raiz, "sesiones")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(raiz, "indice.yaml"), "documentos: []\ntemas:\n- {id: derivacion}\n"); writeFileSync(join(raiz, "progreso.yaml"), "version: 1\ntemas: {}\nhistorial: []\n");
  if (anterior) writeFileSync(join(raiz, "sesiones/2026-01-01-derivacion.md"), "> [!quote] VOS\n\nCreo que es la regla de la cadena.\n");
  const d = { curso: "ejemplo", nombre: "Ejemplo", contrato: "Contrato", documentos: [], temas: [{ id: "derivacion", nombre: "Derivación", unidad: 1, alias: [], objetivos: [], prerequisitos: [] }], items: {}, progreso: { temas: {}, historial: [] }, avisos: [] };
  const handlers = new Map(), bus = new Map(), comandos = new Map(), entradas = [], avisos = [], ordenes = [], selects = [];
  const pi = { on: (n, h) => handlers.set(n, [...(handlers.get(n) || []), h]), registerCommand: (n, c) => comandos.set(n, c), registerTool: () => {},
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
  await comandos.get("estudiar").handler("ejemplo derivacion", ctx);
  const final = async texto => { const message = { role: "assistant", stopReason: "stop", content: [{ type: "text", text: texto }] }; await emitir("message_end", { message }); entradas.push({ type: "message", message }); };
  const guardar = extra => progreso.registrar("prueba", { resumen: "Probe", borde: { domina: ["Derivar un polinomio"] }, ...extra }, undefined, undefined, ctx);
  return { vault, raiz, ctx, comandos, entradas, avisos, ordenes, selects, sesion, progreso, emitir, final, guardar };
}
const historial = e => readFileSync(join(e.raiz, "progreso.yaml"), "utf8").match(/log: .*/g);

// progreso.py ata el historial al nombre AAAA-MM-DD-<tema>[-N].md (fecha y orden de H29): el curso conserva ese nombre y md-log sigue la nota por inode.
test("H04: con la nota renombrada en Obsidian, /fin guarda con el nombre de la sesión, escribe en la nota movida y cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Clase renombrada.md";
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Pregunta 1.");
  await e.comandos.get("fin").handler("", e.ctx);
  const r = await e.guardar({ cierre: true });
  assert.match(r.content[0].text, /se renombró o movió en Obsidian/);
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.deepEqual(historial(e), [`log: ${log.slice("cursos/ejemplo/".length)}`]);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Pregunta 1\.[\s\S]*Resumen final\./);
  assert.ok(!existsSync(join(e.raiz, ".sesion-activa.json")));
  assert.deepEqual(e.avisos, [["info", "Sesión cerrada. El log se conserva en Obsidian."]]);
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

test("H45: sin el venv, las operaciones locales fallan en español y remiten al doctor", async t => {
  const real = childProcess.spawn;
  mock.method(childProcess, "spawn", (_programa, args, opciones) => real("/no/existe/python", args, opciones)); syncBuiltinESMExports();
  t.after(() => { mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(() => python("trabajo", {}, undefined, "preparacion.py"), { message: "Falta el entorno de ingesta (Python): corré .pi/scripts/doctor." });
});
