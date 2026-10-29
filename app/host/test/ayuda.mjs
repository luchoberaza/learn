// Levanta el host real como lo hace la app (proceso de Node con canal IPC), con un directorio de agente temporal
// (confianza y sesiones aisladas) y el proveedor falso de las pruebas.
import { fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(aqui, "../..");
export const PI_DIR = resolve(APP, "..");
export const VAULT = resolve(PI_DIR, "..");

export function levantarHost(t, { guion, entorno = {}, aceptarConfianza = true } = {}) {
  const agente = mkdtempSync(join(tmpdir(), "learn-app-agente-"));
  t.after(() => rmSync(agente, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  let archivoGuion;
  if (guion) { archivoGuion = join(agente, "guion.mjs"); writeFileSync(archivoGuion, guion); }
  const hijo = fork(join(APP, "host/inicio.mjs"), ["--vault", VAULT], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, PI_CODING_AGENT_DIR: agente, PI_OFFLINE: "1", PI_LEARN_E2E: join(APP, "e2e/proveedor-falso.mjs"), ...(archivoGuion ? { PI_LEARN_E2E_GUION: archivoGuion } : {}), PI_LEARN_E2E_TOKENS: "5000", ...entorno },
  });
  let errores = "";
  hijo.stderr.on("data", d => { errores += d; });
  hijo.stdout.on("data", () => {});
  t.after(() => { try { hijo.disconnect(); } catch { /* ya cerró */ } hijo.kill(); });
  const mensajes = [], esperas = [];
  let siguienteId = 1;
  hijo.on("message", m => {
    mensajes.push(m);
    if (m.tipo === "confianza") hijo.send({ tipo: "confianza", aceptar: aceptarConfianza });
    for (const e of [...esperas]) if (e.condicion(m)) { esperas.splice(esperas.indexOf(e), 1); e.resolver(m); }
  });
  const esperar = (condicion, ms = 20000, que = "un mensaje") => {
    const ya = mensajes.find(condicion);
    if (ya) return Promise.resolve(ya);
    return new Promise((resolver, rechazar) => {
      const e = { condicion, resolver };
      esperas.push(e);
      setTimeout(() => { if (esperas.includes(e)) { esperas.splice(esperas.indexOf(e), 1); rechazar(new Error(`Tiempo agotado esperando ${que}. stderr:\n${errores.slice(-2000)}`)); } }, ms);
    });
  };
  // Espera un mensaje nuevo (posterior a los ya vistos).
  const proximo = (condicion, ms, que) => { const desde = mensajes.length; return esperar((m) => mensajes.indexOf(m) >= desde && condicion(m), ms, que); };
  const pedir = (tipo, datos = {}, ms = 30000) => {
    const id = `t${siguienteId++}`;
    hijo.send({ tipo, id, datos });
    return esperar(m => m.tipo === "respuesta" && m.id === id, ms, `la respuesta a ${tipo}`).then(r => { if (!r.ok) throw new Error(r.error); return r.datos; });
  };
  return { hijo, mensajes, esperar, proximo, pedir, agente, errores: () => errores };
}
