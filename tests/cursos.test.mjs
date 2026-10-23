import { test } from "node:test";
import assert from "node:assert/strict";
import { guardarCurso, registrarCuracion } from "../extensions/curso/curacion.ts";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

function entorno(nuevo = false) {
  const comandos = new Map(), tools = new Map(), llamadas = [], mensajes = [];
  const pi = { registerCommand: (n, d) => comandos.set(n, d), registerTool: d => tools.set(d.name, d),
    sendUserMessage: (...m) => mensajes.push(m), sendMessage: m => mensajes.push(m),
    exec: async (_programa, args) => {
      const accion = args[1]; llamadas.push(accion);
      return { code: 0, stdout: JSON.stringify(accion === "revisar"
        ? { nuevo, base: "base-revisada", huella: "propuesta-revisada", diff: "+Un tema nuevo", copias: [], validacion: { ok: true } }
        : { curso: "ejemplo", copiados: 0, validacion: { ok: true } }), stderr: "" };
    } };
  registrarCuracion(pi);
  tools.set("guardar_curso", { execute: (_id, args, signal, _update, ctx) => guardarCurso(pi, args, ctx, signal) });
  return { pi, comandos, tools, llamadas, mensajes };
}
const args = { curso: "ejemplo", propuesta: "_procesado/propuesta.json" };

test("pi carga las cuatro órdenes de cursos, la tool de guardado y ambas skills", async () => {
  const project = await loadProject();
  try {
    assert.deepEqual(project.errors, []);
    assert.deepEqual(project.loader.getExtensions().warnings || [], []);
    assert.ok(project.session.getActiveToolNames().includes("guardar_curso"));
    const comandos = project.session.extensionRunner.getRegisteredCommands();
    for (const n of ["curso-nuevo", "curso-agregar", "curso-check", "curso-estado"]) assert.ok(comandos.some(c => c.name === n), n);
    const skills = project.loader.getSkills();
    for (const n of ["curso-nuevo", "curso-agregar"]) assert.ok(skills.skills.some(s => s.name === n), n);
    assert.deepEqual(skills.diagnostics.filter(d => d.type === "error"), []);
  } finally { await project.close(); }
});
test("los alias expanden el skill nativo sin ejecutar bash ni elegir material automáticamente", async () => {
  const e = entorno();
  await e.comandos.get("curso-nuevo").handler("redes", { ui: { notify: assert.fail } });
  assert.deepEqual(e.mensajes[0], ["/skill:curso-nuevo redes", { expandPromptTemplates: true, deliverAs: "followUp" }]);
  assert.deepEqual(e.llamadas, []);
});
test("rechazar o no tener UI nunca aplica una actualización del curso", async () => {
  const e = entorno();
  const tool = e.tools.get("guardar_curso");
  await assert.rejects(() => tool.execute("x", args, undefined, undefined, { hasUI: false }), /confirmación interactiva/);
  const r = await tool.execute("x", args, undefined, undefined, { hasUI: true, ui: { select: async () => "No" } });
  assert.equal(r.details.cancelada, true);
  assert.deepEqual(e.llamadas, ["revisar", "revisar"]);
});
test("la confirmación ve el diff y aplica exactamente las huellas revisadas", async () => {
  const e = entorno();
  let aplica;
  const original = e.pi.exec;
  e.pi.exec = async (programa, parametros, opciones) => { if (parametros[1] === "aplicar") aplica = parametros; return original(programa, parametros, opciones); };
  const r = await e.tools.get("guardar_curso").execute("x", args, undefined, undefined, { hasUI: true, ui: { select: async (_t, o) => {
    assert.equal(e.mensajes[0].content, "+Un tema nuevo"); return o[0];
  } } });
  assert.deepEqual(e.llamadas, ["revisar", "aplicar"]);
  assert.ok(aplica.includes("base-revisada") && aplica.includes("propuesta-revisada"));
  assert.equal(r.details.curso, "ejemplo");
});
test("la creación inicial sin archivos previos funciona sin simular confirmación", async () => {
  const e = entorno(true);
  await e.tools.get("guardar_curso").execute("x", args, undefined, undefined, { hasUI: false });
  assert.deepEqual(e.llamadas, ["revisar", "aplicar"]);
});
test("curso-check muestra errores sin iniciar una sesión de enseñanza", async () => {
  const e = entorno();
  e.pi.exec = async () => ({ code: 1, stdout: JSON.stringify({ ok: false, errores: ["Ítem inexistente"], avisos: [], pendientes: [] }), stderr: "" });
  await e.comandos.get("curso-check").handler("ejemplo", { ui: { notify: assert.fail } });
  assert.match(e.mensajes[0].content, /Ítem inexistente/);
  assert.equal(e.mensajes[0].customType, "curso-check");
});
