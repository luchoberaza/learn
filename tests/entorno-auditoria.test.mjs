import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { importPi, piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

const lanzador = join(piDir, "config/fish/pi-learn.fish");
process.env.PI_OFFLINE = "1";

// HOME falso: ponytail como paquete global, una skill global que choca con teach y el vault en ~/Projects/pi-learning.
function hogar(t) {
  const home = mkdtempSync(join(tmpdir(), "pi-entorno-")), agente = join(home, ".pi/agent");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const paquete = join(agente, "git/github.com/DietrichGebert/ponytail");
  for (const d of [join(paquete, "skills/ponytail"), join(home, ".agents/skills/teach"), join(home, "Projects")]) mkdirSync(d, { recursive: true });
  writeFileSync(join(agente, "settings.json"), JSON.stringify({ packages: ["git:github.com/DietrichGebert/ponytail"] }));
  writeFileSync(join(paquete, "package.json"), JSON.stringify({ name: "ponytail", pi: { extensions: ["./index.js"], skills: ["./skills"] } }));
  writeFileSync(join(paquete, "index.js"), 'export default function (pi) { pi.on("before_agent_start", e => { e.systemPromptOptions.sections.ponytail = "lazy senior developer"; }); }\n');
  writeFileSync(join(paquete, "skills/ponytail/SKILL.md"), "---\nname: ponytail\ndescription: Ajena al tutor.\n---\nAjena.\n");
  writeFileSync(join(home, ".agents/skills/teach/SKILL.md"), "---\nname: teach\ndescription: Teach global ajena.\n---\nAjena.\n");
  symlinkSync(vaultDir, join(home, "Projects/pi-learning"));
  return { home, agente };
}

// Ejecuta pi-learn con pi y tmux simulados; devuelve cada llamada como lista de argumentos.
function piLearn(t, { home, cwd = vaultDir, dentro = true, args = [], env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "pi-learn-")), bin = join(dir, "bin"), registro = join(dir, "registro");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(bin);
  writeFileSync(registro, "");
  for (const programa of ["pi", "tmux"]) {
    writeFileSync(join(bin, programa), `#!/bin/sh\nprintf '%s\\0' ${programa} "$@" "OFFLINE=$PI_OFFLINE" "DELAY=$PI_SUBAGENT_SHELL_READY_DELAY_MS" >> "$REGISTRO"\nprintf '\\n' >> "$REGISTRO"\n[ "$3" = has-session ] && exit "\${HAY:-1}"\nexit 0\n`, { mode: 0o755 });
  }
  const entorno = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home, REGISTRO: registro, ...env };
  for (const v of ["PI_OFFLINE", "PI_SUBAGENT_SHELL_READY_DELAY_MS", "TMUX"]) if (!(v in env)) delete entorno[v];
  if (dentro) entorno.TMUX = "socket-prueba,123,0";
  const r = spawnSync("fish", ["--no-config", "-c", 'source "$argv[1]"; cd "$argv[2]"; pi-learn $argv[3..-1]', "--", lanzador, cwd, ...args], { env: entorno, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const llamadas = readFileSync(registro, "utf8").split("\n").filter(Boolean).map(l => l.split("\0").slice(0, -1));
  return { llamadas, stderr: r.stderr };
}

// Carga el proyecto como lo abre pi-learn (mismas opciones de skills) con el HOME falso.
async function cargar(t, { home, agente }, argumentos) {
  const sdk = await importPi(), anterior = process.env.HOME;
  const skills = argumentos.flatMap((a, i) => argumentos[i - 1] === "--skill" ? [a] : []);
  process.env.HOME = home;
  try {
    const settingsManager = sdk.SettingsManager.create(vaultDir, agente, { projectTrusted: true });
    const loader = new sdk.DefaultResourceLoader({ cwd: vaultDir, agentDir: agente, settingsManager, noSkills: argumentos.includes("-ns"), additionalSkillPaths: skills });
    await loader.reload();
    const { session } = await sdk.createAgentSession({ cwd: vaultDir, agentDir: agente, settingsManager, resourceLoader: loader, sessionManager: sdk.SessionManager.inMemory() });
    t.after(() => session.dispose());
    await session.bindExtensions({});
    const { systemPromptOptions } = await session.extensionRunner.emitBeforeAgentStart({ messageType: "user", prompt: "" }, { cwd: vaultDir });
    return { skills: loader.getSkills(), secciones: Object.keys(systemPromptOptions.sections), settingsManager };
  } finally { process.env.HOME = anterior; }
}

test("H14: pi-learn abre el tutor sin ponytail ni skills globales y con las skills del proyecto", async t => {
  const h = hogar(t);
  const pi = piLearn(t, { home: h.home }).llamadas.find(l => l[0] === "pi").slice(1, -2);
  const { skills, secciones } = await cargar(t, h, pi);
  assert.deepEqual(secciones.filter(s => !["teach", "modo_curso", "curso"].includes(s)), []);
  assert.deepEqual(skills.diagnostics.filter(d => d.type === "collision").map(d => d.message), []);
  const nombres = skills.skills.map(s => s.name);
  for (const n of ["teach", "curso-nuevo", "curso-agregar", "visualize"]) assert.ok(nombres.includes(n), n);
  assert.ok(!nombres.includes("ponytail"));
  assert.ok(skills.skills.find(s => s.name === "teach").filePath.endsWith("Projects/pi-learning/.pi/skills/teach/SKILL.md"));
});

test("H09: el thinking del tutor queda oculto como setting de proyecto", async t => {
  const { agente } = hogar(t), sdk = await importPi();
  writeFileSync(join(agente, "settings.json"), JSON.stringify({ hideThinkingBlock: false }));
  assert.equal(sdk.SettingsManager.create(vaultDir, agente, { projectTrusted: true }).getHideThinkingBlock(), true);
});
