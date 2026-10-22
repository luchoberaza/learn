import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";

function entorno(t) {
  const dir = mkdtempSync(join(tmpdir(), "pi-md-curso-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "sesion.md"), handlers = new Map(), bus = new Map(), comandos = new Map(), entradas = [], avisos = [];
  writeFileSync(file, "NOTA CONSERVADA\n");
  const pi = { on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h) }, registerCommand: (n, c) => comandos.set(n, c), appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }) };
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: assert.fail },
    ui: { setStatus: () => {}, notify: (...a) => avisos.push(a), get theme() { throw new Error("No hay tema TUI en este proceso headless"); } } };
  mdLog(pi);
  return { dir, file, handlers, bus, comandos, entradas, avisos, ctx };
}
test("bus enlaza con acuse sin rellenar historia ni sustituir notas", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx);
  let error;
  await e.bus.get("md-log:link")({ file: e.file, backfill: false, onComplete: err => { error = err; } });
  assert.equal(error, undefined); assert.equal(e.entradas.at(-1).data.file, e.file);
  await e.handlers.get("message_end")({ message: { role: "user", content: "Pregunta nueva" } }, e.ctx);
  assert.match(readFileSync(e.file, "utf8"), /^NOTA CONSERVADA/);
  assert.match(readFileSync(e.file, "utf8"), /Pregunta nueva/);
  await e.handlers.get("message_end")({ message: { role: "toolResult", toolName: "leer_items", content: [{ type: "text", text: "SOLUCIÓN SECRETA" }] } }, e.ctx);
  assert.ok(!readFileSync(e.file, "utf8").includes("SOLUCIÓN SECRETA"));
  await e.handlers.get("tool_result")({ toolName: "quiz", isError: true, details: undefined }, e.ctx);
  assert.match(readFileSync(e.file, "utf8"), /Quiz sin respuesta/);
  assert.ok(!readFileSync(e.file, "utf8").includes("incorrecto ✗"));
  await e.bus.get("md-log:unlink")();
  const antes = readFileSync(e.file, "utf8");
  await e.handlers.get("message_end")({ message: { role: "user", content: "No registrar" } }, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), antes);
});
test("cierre con acuse rechaza un vínculo distinto y conserva el resumen final", async t => {
  const e=entorno(t);await e.handlers.get('session_start')({},e.ctx);
  await e.bus.get('md-log:link')({file:e.file,backfill:false});let error;
  await e.bus.get('md-log:unlink')({file:join(e.dir,'otro.md'),onComplete:err=>error=err});assert.match(error,/activo cambió/);
  await e.handlers.get('message_end')({message:{role:'assistant',content:[{type:'text',text:'RESUMEN FINAL'}]}},e.ctx);
  assert.match(readFileSync(e.file,'utf8'),/RESUMEN FINAL/);
  let acuse=false;await e.bus.get('md-log:unlink')({file:e.file,onComplete:err=>{assert.equal(err,undefined);acuse=true;}});assert.ok(acuse);
  const antes=readFileSync(e.file,'utf8');await e.handlers.get('message_end')({message:{role:'user',content:'Fuera del log'}},e.ctx);assert.equal(readFileSync(e.file,'utf8'),antes);
});
test("bus y comando rechazan backfill destructivo sin confirmación", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx);
  let error;
  await e.bus.get("md-log:link")({ file: e.file, onComplete: err => { error = err; } });
  assert.match(error, /preservó/);
  await e.comandos.get("md-log").handler(e.file, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), "NOTA CONSERVADA\n");
  assert.equal(e.entradas.length, 0);
});
test("restaurar usa sólo la rama activa y no rellena ni duplica el archivo", async t => {
  const e = entorno(t); e.entradas.push({ type: "custom", customType: "md-log", data: { file: e.file } });
  await e.handlers.get("session_start")({}, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), "NOTA CONSERVADA\n");
  await e.handlers.get("message_end")({ message: { role: "assistant", content: [{ type: "text", text: "Continuación [[fuente.pdf#page=2]]" }] } }, e.ctx);
  assert.match(readFileSync(e.file, "utf8"), /\[\[fuente.pdf#page=2\]\]/);
  e.entradas.length = 0; await e.handlers.get("session_tree")({}, e.ctx);
  const antes = readFileSync(e.file, "utf8");
  await e.handlers.get("message_end")({ message: { role: "user", content: "Otra rama" } }, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), antes);
});
