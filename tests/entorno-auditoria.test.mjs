import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import { agentDir, importPi, leerConfigLocal, piDir, vaultDir, pythonDelVenv } from "../scripts/lib/pi-sdk.mjs";

const lanzador = join(piDir, "config/fish/pi-learn.fish"), instalacion = process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install");
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
  symlinkSync(vaultDir, join(home, "Projects/pi-learning"), process.platform === "win32" ? "junction" : undefined);
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
    return { skills: loader.getSkills(), secciones: Object.keys(systemPromptOptions.sections), textos: systemPromptOptions.sections, settingsManager };
  } finally { process.env.HOME = anterior; }
}

test("H14: pi-learn abre el tutor sin ponytail ni skills globales y con las skills del proyecto", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, async t => {
  const h = hogar(t);
  const pi = piLearn(t, { home: h.home }).llamadas.find(l => l[0] === "pi").slice(1, -2);
  const { skills, secciones } = await cargar(t, h, pi);
  assert.deepEqual(secciones.filter(s => !["teach", "modo_curso", "curso", "simulacro"].includes(s)), []);
  assert.deepEqual(skills.diagnostics.filter(d => d.type === "collision").map(d => d.message), []);
  const nombres = skills.skills.map(s => s.name);
  for (const n of ["teach", "curso-nuevo", "curso-agregar", "visualize"]) assert.ok(nombres.includes(n), n);
  assert.ok(!nombres.includes("ponytail"));
  assert.ok(skills.skills.find(s => s.name === "teach").filePath.endsWith("Projects/pi-learning/.pi/skills/teach/SKILL.md"));
});

// DA57: un modelo que copiaba los comandos de CURSOS.md (bin/python) en Windows fallaba y salía a buscar otro Python.
test("DA57: fuera de una clase, en Windows el prompt da el Python de learn de esta máquina; en Linux no agrega nada", async t => {
  const { textos } = await cargar(t, hogar(t), ["-ns", "--skill", join(piDir, "skills")]);
  if (process.platform === "win32") assert.equal(textos.python, "Esta computadora es Windows: el Python de learn es .pi/.venv/Scripts/python.exe. Donde CURSOS.md u otro texto diga .pi/.venv/bin/python, usá esa ruta; no busques otro Python.");
  else assert.equal(textos.python, undefined);
});

test("H09: el thinking del tutor queda oculto como setting de proyecto", async t => {
  const { agente } = hogar(t), sdk = await importPi();
  writeFileSync(join(agente, "settings.json"), JSON.stringify({ hideThinkingBlock: false }));
  assert.equal(sdk.SettingsManager.create(vaultDir, agente, { projectTrusted: true }).getHideThinkingBlock(), true);
});

test("X06: el hijo del researcher recibe su orden a los 300 ms y se respeta un valor propio", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, t => {
  const { home } = hogar(t);
  assert.equal(piLearn(t, { home }).llamadas[0].at(-1), "DELAY=300");
  assert.equal(piLearn(t, { home, env: { PI_SUBAGENT_SHELL_READY_DELAY_MS: "900" } }).llamadas[0].at(-1), "DELAY=900");
});

test("X03: en el servidor de pi-learn una sesión sin cliente no sobrevive", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, t => {
  const dir = mkdtempSync(join(tmpdir(), "pi-tmux-")), tmux = (...a) => spawnSync("tmux", ["-S", join(dir, "s"), ...a], { encoding: "utf8" });
  t.after(() => { tmux("kill-server"); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(tmux("-f", join(piDir, "config/tmux.conf"), "new-session", "-d", "-s", "alumno", "--", "sleep", "30").status, 0);
  assert.notEqual(tmux("has-session", "-t", "=alumno").status, 0);
});

test("X03: pi-learn reutiliza la sesión de tmux de la carpeta y avisa si no puede usar los argumentos", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, t => {
  const { home } = hogar(t), otra = mkdtempSync(join(tmpdir(), "pi-otra-"));
  t.after(() => rmSync(otra, { recursive: true, force: true }));
  const nueva = l => l.slice(l.indexOf("new-session"), l.indexOf("--"));
  const [a, b, c] = [vaultDir, vaultDir, otra].map(cwd => nueva(piLearn(t, { home, cwd, dentro: false }).llamadas.at(-1)));
  assert.deepEqual(a, b);
  assert.match(a[3], /^pi-learn-[0-9a-f]{8}$/);
  assert.deepEqual(a.slice(0, 3), ["new-session", "-A", "-s"]);
  assert.notEqual(c[3], a[3]);
  const viva = piLearn(t, { home, dentro: false, args: ["--resume"], env: { HAY: "0" } });
  assert.match(viva.stderr, /^Ya hay un pi abierto en esta carpeta.*--resume.*\n$/);
  assert.equal(piLearn(t, { home, dentro: false, args: ["--resume"] }).stderr, "");
  assert.ok(!piLearn(t, { home, dentro: false }).llamadas.some(l => l.includes("has-session")));
});

test("H41: sin los paquetes fijados pi-learn avisa en una línea y arranca pi sin red de inicio", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, t => {
  const { home } = hogar(t), sin = mkdtempSync(join(tmpdir(), "pi-sinpaquetes-")), recursos = join(sin, "Projects/pi-learning/.pi");
  t.after(() => rmSync(sin, { recursive: true, force: true }));
  mkdirSync(join(recursos, "config"), { recursive: true });
  mkdirSync(join(recursos, "git/github.com/amosblomqvist/pi-interactive-subagents"), { recursive: true });
  writeFileSync(join(recursos, "config/tmux.conf"), "");
  const dentro = piLearn(t, { home: sin }), fuera = piLearn(t, { home: sin, dentro: false });
  assert.match(dentro.stderr, /^Faltan paquetes de \.pi .*SETUP\.md\.\n$/);
  assert.equal(dentro.llamadas[0].at(-2), "OFFLINE=1");
  const nueva = fuera.llamadas.at(-1);
  assert.deepEqual(nueva.slice(nueva.indexOf("-e"), nueva.indexOf("--")), ["-e", "PI_OFFLINE=1"]);
  const completo = piLearn(t, { home });
  assert.equal(completo.stderr, "");
  assert.equal(completo.llamadas[0].at(-2), "OFFLINE=");
});

test("X01: el doctor marca menos de 2 GB libres y dice cómo ver qué ocupa", t => {
  const disco = mkdtempSync(join(tmpdir(), "pi-disco-"));
  t.after(() => rmSync(disco, { recursive: true, force: true }));
  const r = spawnSync("unshare", ["-rm", "sh", "-c", 'mount -t tmpfs -o size=64m tmpfs "$0" && mkdir "$0/agente" && exec "$@"', disco, process.execPath, join(piDir, "scripts/doctor"), "--sin-red"],
    { encoding: "utf8", timeout: 60000, env: { ...process.env, PI_CODING_AGENT_DIR: join(disco, "agente"), PI_MANAGED_INSTALL_ROOT: instalacion } });
  if (r.error || !r.stdout) return t.skip(`sin espacios de nombres de usuario: ${r.stderr}`);
  assert.match(r.stdout, /^✗ Espacio libre: 0,1 GB.*; liberá al menos 2 GB.*du -xh/m);
});

test("H80/H14/H09: el doctor del proyecto ve el prompt, las skills y el thinking como los usa pi-learn", () => {
  const r = spawnSync(process.execPath, [join(piDir, "scripts/doctor"), "--sin-red"], { cwd: vaultDir, encoding: "utf8", timeout: 60000 });
  assert.match(r.stdout, /^✓ Prompt del tutor: sin secciones ajenas/m);
  assert.match(r.stdout, /^✓ Skills de cursos: teach, curso-nuevo y curso-agregar, sin colisiones/m);
  assert.match(r.stdout, /^✓ Thinking oculto/m);
  // El de settings.json, salvo que esta máquina tenga el suyo en curso.config.local.json (DA49).
  const principal = leerConfigLocal(piDir).modelo_principal || "openai-codex/gpt-6.1-sol";
  // «!» si no tiene credenciales pero otro modelo sí (DA58).
  assert.match(r.stdout, new RegExp(`^[✓✗!] Credenciales principal: ${principal.replace(/[.]/g, "[.]")}: `, "m"));
});

test("preventivo: la lista blanca de secciones del doctor cubre las que agrega el curso, también la de /simulacro", () => {
  const blanca = JSON.parse(readFileSync(join(piDir, "scripts/doctor"), "utf8").match(/filter\(s => !(\[[^\]]+\])\.includes\(s\)\)/)[1]);
  const dir = join(piDir, "extensions/curso"), fuentes = readdirSync(dir).map(f => readFileSync(join(dir, f), "utf8")).join("\n");
  const propias = new Set([...fuentes.matchAll(/sections\.(\w+) =/g)].map(m => m[1]));
  for (const m of fuentes.matchAll(/sections, \{([^}]+)\}/g)) for (const k of m[1].split(",")) propias.add(k.split(":")[0].trim());
  assert.ok(propias.has("simulacro") && propias.has("modo_curso"));
  assert.deepEqual([...propias].filter(s => !blanca.includes(s)), []);
});

test("H80/H14/H09: el doctor marca credenciales, secciones, colisiones y thinking, y avisa por otra versión de pi; con la clave de otro proveedor, cada rol usa ése (DA58)", t => {
  const h = hogar(t), v = mkdtempSync(join(tmpdir(), "pi-doctor-")), copia = join(v, ".pi");
  t.after(() => rmSync(v, { recursive: true, force: true }));
  // Como una máquina nueva: sin el venv ni los modelos propios de esta (curso.config.local.json, DA40 y DA49). Lo que se
  // instala o se compila en app/ (dependencias, instaladores) no lo mira el doctor y pesa cientos de MB.
  cpSync(piDir, copia, { recursive: true, filter: f => !/[\\/]\.(git|venv)$|[\\/]curso\.config\.local\.json$|[\\/]app[\\/](node_modules|dist|out)$/.test(f) });
  for (const d of ["cursos", "_entrada", ".pi/skills/otra-teach", "bin"]) mkdirSync(join(v, d), { recursive: true });
  const settings = JSON.parse(readFileSync(join(copia, "settings.json"), "utf8"));
  writeFileSync(join(copia, "settings.json"), JSON.stringify({ ...settings, hideThinkingBlock: undefined, packages: settings.packages.filter(p => typeof p === "string") }));
  writeFileSync(join(copia, "skills/otra-teach/SKILL.md"), "---\nname: teach\ndescription: Duplicada.\n---\nDuplicada.\n");
  if (process.platform === "win32") writeFileSync(join(v, "bin/pi.cmd"), "@echo 1.5.0\r\n");
  else writeFileSync(join(v, "bin/pi"), "#!/bin/sh\necho 1.5.0\n", { mode: 0o755 });
  const doctor = () => spawnSync(process.execPath, [join(copia, "scripts/doctor"), "--sin-red"], { cwd: v, encoding: "utf8", timeout: 60000,
    env: { ...process.env, HOME: h.home, USERPROFILE: h.home, PI_CODING_AGENT_DIR: h.agente, PI_MANAGED_INSTALL_ROOT: instalacion, PATH: `${join(v, "bin")}${delimiter}${process.env.PATH}` } });
  const r = doctor();
  assert.match(r.stdout, /^! pi: 1\.5\.0, distinta de la fijada 1\.4\.0; verificá APIs antes de usar/m);
  assert.doesNotMatch(r.stdout, /^✗ pi:/m);
  assert.match(r.stdout, /^✗ Prompt del tutor: secciones ajenas: ponytail;/m);
  assert.match(r.stdout, /^✗ Skills de cursos: nombres repetidos: teach;/m);
  assert.match(r.stdout, /^✗ Thinking oculto:/m);
  for (const rol of ["principal", "researcher", "visión"]) assert.match(r.stdout, new RegExp(`^✗ Credenciales ${rol}: openai-codex/`, "m"));
  assert.match(r.stdout, /^✗ Entorno de ingesta: falta \.pi\/\.venv; recrealo desde el vault: UV_PROJECT_ENVIRONMENT=\$PWD\/\.pi\/\.venv uv sync --project \.pi\/scripts\/ingesta --python 3\.13\.13 --python-preference only-managed --locked$/m);
  // DA58: con la clave de otro proveedor (un alumno que no usa ChatGPT), ningún rol queda en rojo: cada uno dice qué usa.
  writeFileSync(join(h.agente, "auth.json"), JSON.stringify({ anthropic: { type: "api_key", key: "sk-ant-prueba" } }));
  const conClave = doctor();
  for (const rol of ["principal", "researcher", "visión"]) assert.match(conClave.stdout, new RegExp(`^! Credenciales ${rol}: openai-codex/[^:]+: sin credenciales; se usa anthropic/claude-[^,]+, que sí tiene$`, "m"));
  assert.doesNotMatch(conClave.stdout, /^✗ Credenciales/m);
  assert.match(conClave.stdout, /^✗ Modelo visión: anthropic\/claude-[^:]+: sin verificar \(--sin-red\)$/m);
});

test("comprobar: respeta ruta_tesseract y dice cómo recrear el venv con Python de uv", t => {
  const v = mkdtempSync(join(tmpdir(), "pi-comprobar-")), ingesta = join(v, ".pi/scripts/ingesta");
  let falso = join(v, "bin/tesseract");
  t.after(() => rmSync(v, { recursive: true, force: true }));
  cpSync(join(piDir, "scripts/ingesta"), ingesta, { recursive: true, filter: f => !/__pycache__|[\\/]benchmark([\\/]|$)/.test(f) });
  mkdirSync(join(v, "bin"));
  if (process.platform === "win32") { falso += ".bat"; writeFileSync(falso, '@echo off\r\nif "%1"=="--version" (echo tesseract 5.5.2& exit /b 0)\r\necho List of available languages ^(1^):\r\necho eng\r\n'); }
  else writeFileSync(falso, '#!/bin/sh\n[ "$1" = --version ] && echo "tesseract 5.5.2" || printf "List of available languages (1):\\neng\\n"\n', { mode: 0o755 });
  const config = JSON.parse(readFileSync(join(piDir, "curso.config.json"), "utf8"));
  writeFileSync(join(v, ".pi/curso.config.json"), JSON.stringify({ ...config, ruta_tesseract: falso }));
  const lanzar = "import os, runpy, sys; sys.path.insert(0, os.path.dirname(sys.argv[1])); runpy.run_path(sys.argv[1], run_name='__main__')";
  const correr = codigo => {
    const r = spawnSync(pythonDelVenv(piDir), ["-c", codigo, join(ingesta, "comprobar.py")], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    assert.equal(r.status, 0, r.stderr);
    return Object.fromEntries(JSON.parse(r.stdout).chequeos.map(c => [c.nombre, c]));
  };
  const propio = correr(lanzar);
  assert.equal(propio["Tesseract"].ok, true);
  assert.equal(propio["Idiomas OCR"].ok, false);
  assert.match(correr(`import sys; sys.version_info = (3, 12, 0, 'final', 0); ${lanzar}`)["Python de ingesta"].detalle,
    /UV_PROJECT_ENVIRONMENT=\$PWD\/\.pi\/\.venv uv sync --project \.pi\/scripts\/ingesta --python 3\.13\.13 --python-preference only-managed --locked/);
});

test("H14: los argumentos de pi-learn van primero y no tapan los subcomandos de pi", { skip: process.platform === "win32" && "pi-learn es el lanzador de Linux (fish + tmux); en Windows se abre con la app" }, t => {
  const { home } = hogar(t);
  // pi 1.4.0 rechaza -ns en sus subcomandos («Unknown option -ns for "update"»).
  for (const sub of [["update", "--self"], ["config"], ["auth", "check", "--provider", "openai-codex"]]) {
    assert.deepEqual(piLearn(t, { home, args: sub }).llamadas[0].slice(1, -2), sub);
  }
  assert.deepEqual(piLearn(t, { home, args: ["--resume"] }).llamadas[0].slice(1, 4), ["--resume", "-ns", "--skill"]);
});
