// Abre la app de verdad (Electron con Playwright) contra el vault de trabajo, con datos de app y agente de pi temporales
// (ajustes, confianza y sesiones aisladas) y el proveedor falso con guion. Nada de esto toca la configuración real.
import { _electron } from "playwright";
import electron from "electron";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(aqui, "..");
export const VAULT = resolve(APP, "../..");
export const CURSO = "redes-demo";
export const hayCurso = existsSync(join(VAULT, "cursos", CURSO, "indice.yaml"));

export async function abrirApp(t, { guion, ajustes = {}, tokens = 4000, confiar = true, entorno = {}, ancho = 1400, alto = 900 } = {}) {
  const datos = mkdtempSync(join(tmpdir(), "learn-app-datos-"));
  const agente = mkdtempSync(join(tmpdir(), "learn-app-agente-"));
  writeFileSync(join(datos, "ajustes.json"), JSON.stringify({ vault: VAULT, tema: "noche", ventana: { ancho, alto }, ...ajustes }));
  let archivoGuion;
  if (guion) { archivoGuion = join(agente, "guion.mjs"); writeFileSync(archivoGuion, guion); }
  const notasAntes = notas();
  const app = await _electron.launch({
    executablePath: electron, args: [APP],
    env: { ...process.env, LEARN_APP_DATOS: datos, PI_CODING_AGENT_DIR: agente, PI_OFFLINE: "1", PI_LEARN_E2E: join(APP, "e2e/proveedor-falso.mjs"),
      ...(archivoGuion ? { PI_LEARN_E2E_GUION: archivoGuion } : {}), PI_LEARN_E2E_TOKENS: String(tokens), ...entorno },
  });
  const win = await app.firstWindow();
  const errores = [];
  win.on("pageerror", e => errores.push(String(e)));
  win.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
  t.after(async () => {
    await app.close().catch(() => {});
    // Las notas de clase que dejó la prueba en el vault y el registro de clase activa.
    for (const n of notas()) if (!notasAntes.includes(n)) rmSync(join(VAULT, "cursos", CURSO, "sesiones", n), { force: true });
    rmSync(join(VAULT, "cursos", CURSO, ".sesion-activa.json"), { force: true });
    for (const d of [datos, agente]) rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  if (confiar) {
    const boton = win.getByRole("button", { name: "Confiar y abrir" });
    await boton.waitFor({ timeout: 60000 });
    await boton.click();
  }
  return { app, win, datos, agente, errores };
}

export function notas() {
  const dir = join(VAULT, "cursos", CURSO, "sesiones");
  return existsSync(dir) ? readdirSync(dir).filter(n => n.endsWith(".md")) : [];
}

export const espera = ms => new Promise(r => setTimeout(r, ms));
