import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarSesion } from "../extensions/curso/sesion.ts";

// Regresiones de la auditoría de sesión: vault sintético, pi simulado, sin modelos.
function datos() {
  const tema = { id: "derivacion", nombre: "Derivación", alias: ["derivada"], unidad: 1, prerequisitos: [], objetivos: [],
    bibliografia: [{ doc: "libro", seccion: "Derivadas", paginas: [1, 2] }] };
  return { curso: "calculo", nombre: "Cálculo", contrato: "Contrato", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" }],
    items: {}, progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
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
