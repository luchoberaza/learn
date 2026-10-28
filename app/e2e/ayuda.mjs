// Abre la app de verdad (Electron con Playwright) contra el vault de trabajo, con datos de app y agente de pi temporales
// (ajustes, confianza y sesiones aisladas) y el proveedor falso con guion. Nada de esto toca la configuración real.
import { _electron } from "playwright";
import electron from "electron";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(aqui, "..");
// Con LEARN_E2E_VAULT, otro vault con su propio .pi (por ejemplo, uno de prueba con el curso de demostración), para no
// tocar el vault de uso diario que contiene esta copia de learn.
export const VAULT = process.env.LEARN_E2E_VAULT ? resolve(process.env.LEARN_E2E_VAULT) : resolve(APP, "../..");
export const CURSO = "redes-demo";
export const hayCurso = existsSync(join(VAULT, "cursos", CURSO, "indice.yaml"));

// agente: archivos que se escriben en la carpeta temporal del agente antes de abrir (por ejemplo, el registro de consumo).
export async function abrirApp(t, { guion, ajustes = {}, tokens = 4000, confiar = true, entorno = {}, ancho = 1400, alto = 900, agente: archivosAgente = {} } = {}) {
  const datos = mkdtempSync(join(tmpdir(), "learn-app-datos-"));
  const agente = mkdtempSync(join(tmpdir(), "learn-app-agente-"));
  writeFileSync(join(datos, "ajustes.json"), JSON.stringify({ vault: VAULT, tema: "noche", ventana: { ancho, alto }, ...ajustes }));
  for (const [ruta, contenido] of Object.entries(archivosAgente)) { mkdirSync(dirname(join(agente, ruta)), { recursive: true }); writeFileSync(join(agente, ruta), contenido); }
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

// Los bloques de la clase usan content-visibility: auto: lo recién llegado ya está en el DOM, pero hasta el cuadro
// siguiente no se dibuja y su innerText sale vacío (en WSLg ese cuadro llegó a tardar más de un segundo). Espera a que
// se dibuje de verdad; el locator se resuelve de nuevo en cada vuelta, así que no importa si React cambió el nodo.
export async function dibujado(locator, timeout = 60000) {
  const hasta = Date.now() + timeout;
  await locator.waitFor({ timeout });
  while (!(await locator.evaluate(el => el.checkVisibility({ contentVisibilityAuto: true })))) {
    if (Date.now() > hasta) throw new Error(`no se dibujó en ${timeout} ms: ${locator}`);
    await espera(50);
  }
}
