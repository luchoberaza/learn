import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const piDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const vaultDir = dirname(piDir);
export const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi/agent");

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

export async function importPi() {
  if (process.env.PI_LEARN_PI_MODULE) return import(pathToFileURL(process.env.PI_LEARN_PI_MODULE).href);
  const root = process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install");
  const version = readFileSync(join(root, "current-version"), "utf8").trim();
  return import(pathToFileURL(join(root, "releases", version, "node_modules/@earendil-works/pi-coding-agent/dist/index.js")).href);
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
