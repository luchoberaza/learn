import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";

// Remates de integración: md-log, sesión y progreso reales sobre un bus de eventos, backend Python real, sin modelos.
async function clase(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-remates-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of [join(recursos, "skills/teach"), join(raiz, "sesiones")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(raiz, "indice.yaml"), "documentos: []\ntemas:\n- {id: derivacion}\n"); writeFileSync(join(raiz, "progreso.yaml"), "version: 1\ntemas: {}\nhistorial: []\n");
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
