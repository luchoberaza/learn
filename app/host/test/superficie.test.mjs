import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bashDelSistema, crearSuperficie } from "../superficie.mjs";
import { aplicar, carpetaPaquete, estado, quitar } from "../../subagentes/aplicar.mjs";
import { PI_DIR, VAULT } from "./ayuda.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const sinBash = !bashDelSistema() && "no hay bash en esta máquina";
const esperarHasta = async (f, ms = 15000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const v = f(); if (v) return v; await new Promise(r => setTimeout(r, 100)); } throw new Error("tiempo agotado"); };

test("superficie: un panel corre bash, se lee como tmux capture-pane y avisa a la app", { skip: sinBash }, async t => {
  const mensajes = [];
  const s = await crearSuperficie({ enviar: m => mensajes.push(m), cwd: tmpdir() });
  assert.equal(s.disponible, true, s.motivo);
  t.after(() => s.cerrarTodo());
  const id = s.superficie.crear("prueba");
  assert.match(id, /^app-\d+$/);
  assert.deepEqual(mensajes[0], { tipo: "subagente-abierto", id, nombre: "prueba" });
  // Se escribe enseguida, como el paquete: la superficie lo guarda hasta que bash está listo.
  s.superficie.escribir(id, "echo hola-$((40+2))");
  s.superficie.escribir(id, "\r");
  await esperarHasta(() => /hola-42/.test(s.superficie.leer(id, 5))).catch(e => { throw new Error(`${e.message}: ${JSON.stringify(s.superficie.leer(id, 5)).slice(0, 400)} ${JSON.stringify(mensajes.filter(m => m.datos).map(m => m.datos).join("")).slice(0, 400)}`); });
  assert.ok(mensajes.some(m => m.tipo === "subagente-datos" && m.id === id), "la app recibe lo que se dibuja");
  assert.equal(s.lista()[0].vivo, true);
  s.tamano(id, 120, 40);
  // El alumno lo cierra: el paquete lo ve como un fin, en lugar de esperar para siempre.
  s.cerrarPorElAlumno(id);
  await esperarHasta(() => /__SUBAGENT_DONE_\d+__/.test(s.superficie.leer(id, 5)));
  await esperarHasta(() => mensajes.some(m => m.tipo === "subagente-fin" && m.id === id));
  s.superficie.cerrar(id);
  assert.ok(mensajes.some(m => m.tipo === "subagente-cerrado" && m.id === id));
  assert.throws(() => s.superficie.leer("app-999", 5), /can't find pane/);
});

// Un vault de mentira con el paquete instalado: el index.ts real de la versión fijada.
function vaultConPaquete(t) {
  const vault = mkdtempSync(join(tmpdir(), "learn-parche-"));
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const origen = carpetaPaquete(VAULT), destino = carpetaPaquete(vault);
  mkdirSync(destino, { recursive: true });
  for (const f of ["index.ts", "tmux.ts"]) cpSync(join(origen, f), join(destino, f));
  // Si el vault de trabajo ya tiene el parche, se parte del index.ts original.
  writeFileSync(join(destino, "index.ts"), readFileSync(join(destino, "index.ts"), "utf8").replace(/\}\s*from\s*"\.\/superficie\.ts";/, '} from "./tmux.ts";'));
  return vault;
}
const hayPaquete = existsSync(join(carpetaPaquete(VAULT), "index.ts")) || "no está instalado pi-interactive-subagents en el vault de trabajo";

test("parche de subagentes: agrega la superficie, es idempotente y se quita", { skip: hayPaquete === true ? false : hayPaquete }, t => {
  const vault = vaultConPaquete(t), dir = carpetaPaquete(vault);
  assert.deepEqual(estado(vault), { instalado: true, aplicado: false, propia: false });
  assert.equal(aplicar(vault), "aplicado");
  assert.match(readFileSync(join(dir, "index.ts"), "utf8"), /\} from "\.\/superficie\.ts";/);
  assert.doesNotMatch(readFileSync(join(dir, "index.ts"), "utf8"), /from "\.\/tmux\.ts"/);
  assert.equal(estado(vault).aplicado, true);
  assert.equal(aplicar(vault), "ya estaba");
  assert.equal(quitar(vault), "quitado");
  assert.match(readFileSync(join(dir, "index.ts"), "utf8"), /\} from "\.\/tmux\.ts";/);
  assert.equal(existsSync(join(dir, "superficie.ts")), false);
  assert.throws(() => aplicar(join(vault, "otro")), /No está instalado/);
});

test("superficie.ts del paquete: con la app usa sus paneles; sin ella, tmux como siempre", { skip: hayPaquete === true ? false : hayPaquete }, async t => {
  const vault = vaultConPaquete(t), dir = carpetaPaquete(vault);
  aplicar(vault);
  const sup = await import(pathToFileURL(join(dir, "superficie.ts")).href);
  // Sin la app: lo mismo que tmux.ts (fuera de tmux, no disponible).
  delete globalThis.__piLearnSuperficie;
  const conTmux = !!process.env.TMUX;
  assert.equal(sup.isMuxAvailable(), conTmux && sup.isTmuxAvailable());
  if (!conTmux) assert.match(sup.muxSetupHint(), /tmux/);
  // Con la app: cada llamada va a sus paneles.
  const llamadas = [];
  globalThis.__piLearnSuperficie = {
    crear: n => { llamadas.push(["crear", n]); return "app-1"; },
    escribir: (id, x) => llamadas.push(["escribir", id, x]),
    leer: () => "pi terminó\n__SUBAGENT_DONE_0__\n$ ",
    cerrar: id => llamadas.push(["cerrar", id]),
  };
  t.after(() => { delete globalThis.__piLearnSuperficie; });
  assert.equal(sup.isMuxAvailable(), true);
  assert.equal(sup.muxSetupHint(), "");
  assert.equal(sup.createSurface("scout"), "app-1");
  const guion = join(vault, "lanzar.sh");
  assert.equal(sup.sendLongCommand("app-1", "pi -p hola; echo '__SUBAGENT_DONE_'$?'__'", { scriptPath: guion, scriptPreamble: "# prueba" }), guion);
  assert.match(readFileSync(guion, "utf8"), /^#!\/bin\/bash\n# prueba\npi -p hola/);
  assert.deepEqual(llamadas.at(-2), ["escribir", "app-1", `bash '${guion.replace(/\\/g, "/")}'`]);
  assert.deepEqual(llamadas.at(-1), ["escribir", "app-1", "\r"]);
  const fin = await sup.pollForExit("app-1", new AbortController().signal, { interval: 50 });
  assert.deepEqual(fin, { reason: "sentinel", exitCode: 0 });
  sup.closeSurface("app-1");
  assert.deepEqual(llamadas.at(-1), ["cerrar", "app-1"]);
  void aqui; void PI_DIR;
});
