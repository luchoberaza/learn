import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { agentDir, loadProject, piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

let project;
const temp = mkdtempSync(join(tmpdir(), "pi-learning-base-"));
before(async () => { project = await loadProject(); });
after(async () => { if (project) await project.close(); rmSync(temp, { recursive: true, force: true }); });

test("pi carga las extensiones originales y los alias sin errores", () => {
  assert.deepEqual(project.errors, []);
  assert.deepEqual(project.loader.getExtensions().warnings || [], []);
  const names = project.session.getActiveToolNames();
  for (const name of ["quiz", "ask_user_question", "subagent", "web_search", "web_fetch"]) assert.ok(names.includes(name), name);
  assert.equal(typeof globalThis.__pi_interactive_subagents.registerToolExtension, "function");
});

test("el proceso restringido puede cargar web y safe_bash con --no-extensions", async () => {
  const { DefaultResourceLoader, SettingsManager } = project.sdk;
  const loader = new DefaultResourceLoader({
    cwd: vaultDir, agentDir, settingsManager: SettingsManager.inMemory(),
    noExtensions: true, noSkills: true, noContextFiles: true,
    additionalExtensionPaths: [
      join(piDir, "npm/node_modules/pi-web-access/dist/index.js"),
      join(piDir, "git/github.com/amosblomqvist/pi-interactive-subagents/pi-extension/subagents/tools/safe-bash.ts"),
    ],
  });
  await loader.reload();
  const result = loader.getExtensions();
  assert.deepEqual(result.errors, []);
  const tools = result.extensions.flatMap(extension => [...extension.tools.keys()]).sort();
  assert.deepEqual(tools, ["safe_bash", "web_fetch", "web_search"]);
});

test("instalar-config es idempotente y no pisa archivos distintos", () => {
  const home = join(temp, "instalacion");
  const agent = join(home, "agente");
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agent };
  const args = [join(piDir, "scripts/instalar-config")];
  for (let i = 0; i < 2; i++) assert.equal(spawnSync(process.execPath, args, { env }).status, 0);
  const file = join(agent, "web-search.json");
  writeFileSync(file, "configuracion propia");
  assert.equal(spawnSync(process.execPath, args, { env }).status, 1);
  assert.equal(readFileSync(file, "utf8"), "configuracion propia");
});

test("teach sigue idéntico al fork original", () => {
  const diff = spawnSync("git", ["-C", piDir, "diff", "--exit-code", "7cfd8942f82ab9476e63572387e1fe9bcea5082c", "--", "skills/teach/SKILL.md"]);
  assert.equal(diff.status, 0);
});

test("researcher usa el modelo de la configuración", () => {
  const config = JSON.parse(readFileSync(join(piDir, "curso.config.json"), "utf8"));
  const researcher = readFileSync(join(piDir, "agents/researcher.md"), "utf8");
  assert.equal(researcher.match(/^model: (.+)$/m)[1], config.modelo_researcher);
});

test("web está limitada a proveedores sin claves, sin cookies ni llamadas de resumen", () => {
  const config = JSON.parse(readFileSync(join(piDir, "config/web-search.json"), "utf8"));
  assert.deepEqual(config.webSearch.allowedProviders, ["exa", "parallel-mcp", "duckduckgo"]);
  assert.equal(config.allowBrowserCookies, false);
  assert.equal(config.workflow, "none");
  assert.equal(config.fetchRouting.allowRemoteHostedProviders, false);
  assert.equal(config.toolNames.fetchContent, "web_fetch");
  assert.equal(config.toolActivation, "eager");
});

test("md-log registra texto y no filtra resultados de herramientas al log", async () => {
  const file = join(temp, "sesion.md");
  writeFileSync(file, "");
  await project.session.prompt(`/md-log ${file}`);
  const runner = project.session.extensionRunner;
  await runner.emit({ type: "message_end", message: { role: "user", content: "Pregunta de prueba", timestamp: Date.now() } });
  await runner.emit({ type: "message_end", message: { role: "toolResult", toolName: "read", content: [{ type: "text", text: "SOLUCION-PRIVADA" }], toolCallId: "lectura", isError: false, timestamp: Date.now() } });
  const text = readFileSync(file, "utf8");
  assert.match(text, /Pregunta de prueba/);
  assert.doesNotMatch(text, /SOLUCION-PRIVADA/);
  await project.session.prompt("/md-unlog");
});

test("pi-learn: sintaxis fish correcta", () => {
  const result = spawnSync("fish", ["--no-execute", join(piDir, "config/fish/pi-learn.fish")]);
  assert.equal(result.status, 0, result.stderr?.toString());
});

for (const inside of [false, true]) {
  test(`pi-learn ${inside ? "dentro" : "fuera"} de tmux conserva carpeta y argumentos sin evaluarlos`, () => {
    const dir = join(temp, inside ? "dentro" : "fuera");
    const bin = join(dir, "bin");
    const cwd = join(dir, "carpeta con espacios");
    mkdirSync(bin, { recursive: true }); mkdirSync(cwd);
    const record = join(dir, "argumentos");
    for (const command of ["pi", "tmux"]) {
      writeFileSync(join(bin, command), `#!/bin/sh\nprintf '%s\\0' '${command}' "$@" > "$RECORD"\n`, { mode: 0o755 });
    }
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RECORD: record };
    if (inside) env.TMUX = "socket-prueba,123,0"; else delete env.TMUX;
    const args = ["--model", "texto con espacios", "$(touch NO-EJECUTAR); 'prueba'"];
    const result = spawnSync("fish", ["--no-config", "-c", 'source "$argv[1]"; cd "$argv[2]"; pi-learn $argv[3..-1]', "--", join(piDir, "config/fish/pi-learn.fish"), cwd, ...args], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const actual = readFileSync(record, "utf8").split("\0").slice(0, -1);
    const expected = inside ? ["pi", ...args] : ["tmux", "-L", "pi-learn", "-f", join(process.env.HOME, "Projects/pi-learning/.pi/config/tmux.conf"), "new-session", "-c", cwd, "--", "pi", ...args];
    assert.deepEqual(actual, expected);
  });
}

test("doctor sin red informa modelos no comprobados y no intenta llamadas", () => {
  const result = spawnSync(process.execPath, [join(piDir, "scripts/doctor"), "--sin-red"], { cwd: vaultDir, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Modelo researcher: .*sin verificar/);
  assert.match(result.stdout, /Modelo visión: .*sin verificar/);
  assert.match(result.stdout, /Prueba web_search: sin verificar/);
  assert.doesNotMatch(result.stdout, /✗ Carga de pi/);
});
