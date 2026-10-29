// Consumo de modelos y cupos de los proveedores (DA48). Vive en la carpeta del agente de pi, por máquina, nunca en el
// vault: el vault puede sincronizarse entre computadoras y el gasto es de la cuenta de ésta. Nada de esto guarda texto
// de la clase: sólo proveedor, modelo, tokens y costo.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Se resuelve en cada llamada: los tests que simulan al modelo lo mandan a una carpeta temporal con LEARN_CONSUMO_DIR.
const agentDir = () => process.env.LEARN_CONSUMO_DIR || process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi/agent");
export const carpetaConsumo = (dir = agentDir()) => join(dir, "learn");
const archivoConsumo = dir => join(carpetaConsumo(dir), "consumo.jsonl");
const archivoCupos = dir => join(carpetaConsumo(dir), "cupos.json");

// Una línea por respuesta del modelo. origen: clase, preparación, verificador o subagente. Nunca corta a quien llama.
export function anotarConsumo({ origen, proveedor, modelo, consulta, usage }, dir = agentDir()) {
  try {
    if (!usage || !proveedor || !modelo) return;
    const fila = { t: new Date().toISOString(), origen, proveedor, modelo, ...(consulta ? { consulta } : {}),
      entrada: usage.input || 0, salida: usage.output || 0, cacheLeida: usage.cacheRead || 0, cacheEscrita: usage.cacheWrite || 0, costo: usage.cost?.total || 0 };
    if (!fila.entrada && !fila.salida && !fila.cacheLeida && !fila.cacheEscrita) return;
    mkdirSync(carpetaConsumo(dir), { recursive: true });
    appendFileSync(archivoConsumo(dir), `${JSON.stringify(fila)}\n`);
  } catch { /* el registro es informativo: un disco lleno no corta la clase */ }
}

// La marca de una consulta (el alumno mandó un mensaje o respondió un quiz o una pregunta), sin tokens: el promedio
// por consulta cuenta también las que el tutor contestó junto con otras.
export function anotarConsulta({ origen, proveedor, modelo, consulta }, dir = agentDir()) {
  try {
    if (!consulta || !proveedor || !modelo) return;
    mkdirSync(carpetaConsumo(dir), { recursive: true });
    appendFileSync(archivoConsumo(dir), `${JSON.stringify({ t: new Date().toISOString(), origen, proveedor, modelo, consulta, marca: true })}\n`);
  } catch { /* informativo */ }
}

export function leerConsumo({ desde } = {}, dir = agentDir()) {
  let texto;
  try { texto = readFileSync(archivoConsumo(dir), "utf8"); } catch { return []; }
  const filas = [];
  for (const linea of texto.split("\n")) {
    if (!linea.trim()) continue;
    try { const f = JSON.parse(linea); if (f?.t && (!desde || f.t >= desde)) filas.push(f); } catch { /* una línea cortada por un apagón */ }
  }
  return filas;
}

export function leerCupos(dir = agentDir()) {
  try { const c = JSON.parse(readFileSync(archivoCupos(dir), "utf8")); return c && typeof c === "object" && !Array.isArray(c) ? c : {}; } catch { return {}; }
}
// El último cupo informado por cada proveedor (y modelo, cuando el cupo es por modelo), escrito de forma atómica.
export function anotarCupo(clave, cupo, dir = agentDir()) {
  try {
    const cupos = leerCupos(dir);
    cupos[clave] = { ...cupos[clave], ...cupo, t: new Date().toISOString() };
    mkdirSync(carpetaConsumo(dir), { recursive: true });
    const archivo = archivoCupos(dir), temporal = `${archivo}.${process.pid}.tmp`;
    writeFileSync(temporal, JSON.stringify(cupos, null, 2));
    renameSync(temporal, archivo);
  } catch { /* informativo */ }
}
export const hayConsumo = (dir = agentDir()) => existsSync(archivoConsumo(dir));

// "2m59.56s", "7.66s", "1h2m", "350ms" (Groq) a milisegundos.
export function duracion(texto) {
  const s = String(texto ?? "").trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000;
  let ms = 0, alguna = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) { alguna = true; ms += Number(n) * { h: 3600000, m: 60000, s: 1000, ms: 1 }[u]; }
  return alguna ? ms : undefined;
}
const numero = v => { const n = Number(v); return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : undefined; };

// Lo que cada proveedor informa en las cabeceras de una respuesta, ya normalizado. Sin datos conocidos, undefined.
// - Suscripción de ChatGPT (openai-codex): % usado de dos ventanas (5 horas y semana) y cuándo se renuevan. No es una
//   API documentada: los nombres salen de los clientes que la leen y pueden cambiar.
// - Groq: pedidos que quedan en el día.
export function cupoDeCabeceras(proveedor, cabeceras, ahora = Date.now()) {
  const h = Object.fromEntries(Object.entries(cabeceras ?? {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
  if (h["x-codex-primary-used-percent"] !== undefined || h["x-codex-secondary-used-percent"] !== undefined) {
    const ventana = p => {
      const usado = numero(h[`x-codex-${p}-used-percent`]);
      if (usado === undefined) return undefined;
      const despues = numero(h[`x-codex-${p}-reset-after-seconds`]), en = numero(h[`x-codex-${p}-reset-at`]);
      const renueva = despues !== undefined ? ahora + despues * 1000 : en !== undefined ? (en < 1e10 ? en * 1000 : en) : undefined;
      return { minutos: numero(h[`x-codex-${p}-window-minutes`]), usado: Math.max(0, Math.min(100, usado)), ...(renueva ? { renueva } : {}) };
    };
    const ventanas = [ventana("primary"), ventana("secondary")].filter(Boolean);
    return ventanas.length ? { tipo: "ventanas", ventanas, ...(h["x-codex-plan-type"] ? { plan: h["x-codex-plan-type"] } : {}) } : undefined;
  }
  if (proveedor === "groq" && h["x-ratelimit-limit-requests"] !== undefined) {
    const limite = numero(h["x-ratelimit-limit-requests"]), quedan = numero(h["x-ratelimit-remaining-requests"]), falta = duracion(h["x-ratelimit-reset-requests"]);
    if (limite === undefined || quedan === undefined) return undefined;
    return { tipo: "pedidos", periodo: "día", limite, quedan, ...(falta !== undefined ? { renueva: ahora + falta } : {}) };
  }
  return undefined;
}

// Un 429: el proveedor cortó por cuota o por ritmo. retry-after viene en segundos o como fecha HTTP.
export function agotadoDeCabeceras(cabeceras, ahora = Date.now()) {
  const h = Object.fromEntries(Object.entries(cabeceras ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const r = h["retry-after"];
  const segundos = numero(r);
  const hasta = segundos !== undefined ? ahora + segundos * 1000 : r && !Number.isNaN(Date.parse(r)) ? Date.parse(r) : undefined;
  return { tipo: "agotado", desde: ahora, ...(hasta ? { hasta } : {}) };
}
