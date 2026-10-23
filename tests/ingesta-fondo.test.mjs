import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linea, registrarIngestaFondo } from "../extensions/curso/ingesta-fondo.ts";

// Barra de la ingesta base y turno del agente al terminar, con pi falso y estado-ingesta.json escrito a mano.
function armar(t, entradas = []) {
  const vault = mkdtempSync(join(tmpdir(), "pi-ingesta-fondo-")), salida = join(vault, "cursos/aa/_procesado");
  mkdirSync(salida, { recursive: true });
  const handlers = new Map(), widgets = new Map(), avisos = [], mensajes = [];
  const pi = { on: (n, h) => handlers.set(n, [...(handlers.get(n) || []), h]), appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }),
    sendMessage: (m, o) => mensajes.push([m, o]) };
  const ctx = { cwd: vault, sessionManager: { getBranch: () => entradas },
    ui: { setWidget: (k, v) => v ? widgets.set(k, v) : widgets.delete(k), notify: (m, tipo) => avisos.push([tipo, m]) } };
  registrarIngestaFondo(pi, vault, 10);
  const emitir = (n, ev = {}) => { for (const h of handlers.get(n) || []) h(ev, ctx); };
  t.after(() => { emitir("session_shutdown"); rmSync(vault, { recursive: true, force: true }); });
  const estado = e => writeFileSync(join(salida, "estado-ingesta.json"), JSON.stringify({ version: 1, pid: process.pid, solicitadas: 10, procesadas: 0, pendientes: 0, ...e }));
  const bash = (command, isError = false) => emitir("tool_result", { toolName: "bash", isError, input: { command } });
  return { vault, salida, widgets, avisos, mensajes, entradas, estado, bash, emitir };
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
const LANZAR = ".pi/.venv/bin/python .pi/scripts/ingesta/ingestar.py iniciar --manifiesto _procesado/manifiesto-aa.json --salida cursos/aa/_procesado";

test("la barra muestra el avance y al terminar el agente sigue el armado", async t => {
  const f = armar(t);
  f.estado({ estado: "en_curso", procesadas: 3, documento: "diap-casos", pagina: 7 });
  f.bash(LANZAR);
  assert.deepEqual(f.entradas.map(e => e.data.tipo), ["inicio"]);
  const [barra] = [...f.widgets.values()][0];
  assert.match(barra, /Ingesta de aa\s+\[█{6}░{14}\]\s+3\/10 páginas · 30% · diap-casos p\. 7/);
  f.estado({ estado: "completada_con_pendientes", procesadas: 10, pendientes: 2 });
  await esperar(50);
  assert.equal(f.widgets.size, 0);
  assert.deepEqual(f.entradas.map(e => e.data.tipo), ["inicio", "fin"]);
  assert.deepEqual(f.avisos, [["info", "Ingesta de aa terminada: 10/10 páginas, 2 pendientes."]]);
  assert.equal(f.mensajes.length, 1);
  const [m, o] = f.mensajes[0];
  assert.deepEqual(o, { triggerTurn: true, deliverAs: "followUp" });
  assert.equal(m.display, false);
  assert.match(m.content, /terminó \(completada_con_pendientes: 10\/10 páginas, 2 pendientes\)\. Seguí con el armado/);
});

test("un proceso muerto sin estado final avisa y pide no relanzar", async t => {
  const f = armar(t), muerto = spawnSync(process.execPath, ["-e", ""]).pid;
  f.estado({ estado: "en_curso", procesadas: 4 });
  f.bash(LANZAR);
  f.estado({ estado: "en_curso", procesadas: 4, pid: muerto });
  await esperar(50);
  assert.equal(f.avisos[0][0], "warning");
  assert.match(f.mensajes[0][0].content, /se cortó \(interrumpida: .*no la relances sin su OK/);
});

test("no mira comandos ajenos, fallidos, salidas fuera de cursos/ ni lo que ya terminó al lanzarse", t => {
  const f = armar(t);
  f.estado({ estado: "en_curso" });
  f.bash("ls cursos/aa/_procesado");
  f.bash(LANZAR, true);
  f.bash(LANZAR.replace("cursos/aa/_procesado", "_procesado/otra"));
  f.bash(LANZAR.replace("cursos/aa/_procesado", "cursos/aa"));
  assert.equal(f.entradas.length, 0);
  f.estado({ estado: "completada" });
  f.bash(LANZAR);
  assert.equal(f.entradas.length, 0);
  assert.equal(f.mensajes.length, 0);
});

test("session_start retoma un inicio abierto y avisa una sola vez", async t => {
  const entradas = [];
  const f = armar(t, entradas);
  entradas.push({ type: "custom", customType: "curso-ingesta", data: { tipo: "inicio", curso: "aa", salida: f.salida } });
  f.estado({ estado: "completada", procesadas: 10 });
  f.emitir("session_start");
  await esperar(50);
  f.emitir("session_start");
  await esperar(30);
  assert.equal(f.mensajes.length, 1);
  assert.deepEqual(entradas.map(e => e.data.tipo), ["inicio", "fin"]);
});

test("la línea sin total ni documento no rompe", () => {
  assert.equal(linea("aa", { estado: "iniciando" }), "⏳ Ingesta de aa  [░░░░░░░░░░░░░░░░░░░░]  0/0 páginas · 0%");
});
