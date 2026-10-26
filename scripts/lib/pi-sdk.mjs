import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const piDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const vaultDir = dirname(piDir);
export const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi/agent");
export const WINDOWS = process.platform === "win32";
// Los scripts de ingesta hablan JSON en UTF-8. En Windows Python usa la página de códigos del sistema en las tuberías,
// también antes de importar almacen (un traceback con una ruta con tildes): todo Python hijo de pi arranca en modo UTF-8.
if (WINDOWS) {
  process.env.PYTHONUTF8 ??= "1";
  process.env.PYTHONIOENCODING ??= "utf-8";
}

// El Python del venv de ingesta: uv lo crea en bin/ en POSIX y en Scripts\ en Windows.
export function pythonDelVenv(recursos = piDir) {
  return join(recursos, ".venv", WINDOWS ? "Scripts/python.exe" : "bin/python");
}
// Cómo se escribe en los textos que sugieren comandos desde la raíz del vault; con / anda en Git Bash y en PowerShell.
export const PYTHON_TEXTO = WINDOWS ? ".pi/.venv/Scripts/python.exe" : ".pi/.venv/bin/python";

// Claves que una máquina puede pisar sin tocar el curso.config.json versionado.
export const CLAVES_LOCALES = ["vault", "ruta_tesseract", "modelo_vision", "modelo_researcher", "modelo_principal"];
export function leerConfigLocal(recursos = piDir) {
  let local = {};
  try { local = JSON.parse(readFileSync(join(recursos, "curso.config.local.json"), "utf8")); } catch { return {}; }
  if (!local || typeof local !== "object" || Array.isArray(local)) return {};
  return Object.fromEntries(Object.entries(local).filter(([k, v]) => CLAVES_LOCALES.includes(k) && typeof v === "string" && v.trim()));
}
export function leerConfig(recursos = piDir) {
  return { ...JSON.parse(readFileSync(join(recursos, "curso.config.json"), "utf8")), ...leerConfigLocal(recursos) };
}

// Mismo orden de resolución que pi-web-access 0.42.0 (utils.ts).
export function webConfigPath(env = process.env) {
  if (env.PI_CODING_AGENT_DIR) return join(env.PI_CODING_AGENT_DIR, "web-search.json");
  const legacy = join(homedir(), ".pi/web-search.json");
  if (env.XDG_CONFIG_HOME) {
    const xdg = join(env.XDG_CONFIG_HOME, "pi/web-search.json");
    return existsSync(xdg) ? xdg : existsSync(legacy) ? legacy : xdg;
  }
  const file = join(homedir(), ".pi/agent/web-search.json");
  return existsSync(file) ? file : existsSync(legacy) ? legacy : file;
}

// dist/index.js de la pi instalada: PI_LEARN_PI_MODULE, la instalación administrada (~/.pi/agent/install) o una global de npm.
export function rutaModuloPi(env = process.env) {
  if (env.PI_LEARN_PI_MODULE) return resolve(env.PI_LEARN_PI_MODULE);
  const root = env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install");
  if (existsSync(join(root, "current-version"))) {
    const version = readFileSync(join(root, "current-version"), "utf8").trim();
    return join(root, "releases", version, "node_modules/@earendil-works/pi-coding-agent/dist/index.js");
  }
  const global = rutaPiGlobal();
  if (global) return global;
  throw new Error("No se encontró la instalación de pi 1.4.0: instalala según SETUP.md o fijá PI_LEARN_PI_MODULE.");
}
let piGlobal;
function rutaPiGlobal() {
  if (piGlobal !== undefined) return piGlobal;
  piGlobal = null;
  try {
    // En Windows npm es un .cmd: va por la shell como una sola línea (con argumentos sueltos Node avisa DEP0190).
    const opciones = { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true };
    const raiz = (WINDOWS ? execSync("npm root -g", opciones) : execFileSync("npm", ["root", "-g"], opciones)).trim();
    const modulo = join(raiz, "@earendil-works/pi-coding-agent/dist/index.js");
    if (raiz && existsSync(modulo)) piGlobal = realpathSync(modulo);
  } catch { /* sin npm en el PATH */ }
  return piGlobal;
}
export async function importPi() {
  return import(pathToFileURL(rutaModuloPi()).href);
}
// Carpeta del paquete de la pi instalada, y la de una dependencia suya (@earendil-works/pi-ai…), anidada o hermana.
export function carpetaPaquetePi() { return resolve(dirname(rutaModuloPi()), ".."); }
export function rutaDependenciaPi(nombre) {
  const paquete = carpetaPaquetePi();
  for (const base of [join(paquete, "node_modules"), resolve(paquete, "../..")]) {
    const carpeta = join(base, nombre);
    if (existsSync(join(carpeta, "package.json"))) {
      const pkg = JSON.parse(readFileSync(join(carpeta, "package.json"), "utf8"));
      const entrada = typeof pkg.exports?.["."] === "object" ? pkg.exports["."].import || pkg.exports["."].default : pkg.main;
      return join(carpeta, typeof entrada === "object" ? entrada.default : entrada || "dist/index.js");
    }
  }
  throw new Error(`No se encontró ${nombre} junto a la pi instalada.`);
}
export async function importDependenciaPi(nombre) {
  return import(pathToFileURL(rutaDependenciaPi(nombre)).href);
}
// Cómo lanzar la CLI de pi en un proceso hijo. En POSIX, `pi` del PATH, como siempre; en Windows `pi` es un .cmd
// que spawn no ejecuta sin shell, así que va el Node actual con la CLI de la misma instalación.
export function comandoPi() {
  if (!WINDOWS) return ["pi"];
  const pkg = JSON.parse(readFileSync(join(carpetaPaquetePi(), "package.json"), "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.pi;
  return [process.execPath, join(carpetaPaquetePi(), bin || "dist/cli.js")];
}

// Diagnóstico solicitado: confianza solo en este proceso; no escribe trust.json.
// No se envía ningún prompt y se usa una sesión en memoria.
export async function loadProject() {
  const sdk = await importPi();
  const settingsManager = sdk.SettingsManager.create(vaultDir, agentDir, { projectTrusted: true });
  // Mismas skills que pi-learn (-ns --skill .pi/skills): las globales no son del tutor y una choca con teach.
  const loader = new sdk.DefaultResourceLoader({ cwd: vaultDir, agentDir, settingsManager, noSkills: true, additionalSkillPaths: [join(piDir, "skills")] });
  await loader.reload();
  const result = loader.getExtensions();
  if (result.errors.length) throw new Error(result.errors.map(e => `${e.path}: ${e.error}`).join("; "));
  const { session } = await sdk.createAgentSession({
    cwd: vaultDir, agentDir, settingsManager, resourceLoader: loader,
    sessionManager: sdk.SessionManager.inMemory(),
  });
  const errors = [];
  await session.bindExtensions({ onError: error => errors.push(error) });
  return {
    sdk, session, loader, errors,
    async close() {
      try { await session.extensionRunner.emit({ type: "session_shutdown" }); }
      finally { session.dispose(); }
    },
  };
}
