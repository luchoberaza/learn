import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clasesAbiertasPorOtros, procesoVivo } from "../instancia.mjs";

test("instancia: avisa de una clase abierta por otro pi vivo, no de la propia ni de un pid muerto", async t => {
  const vault = mkdtempSync(join(tmpdir(), "learn-instancia-"));
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  // Otro pi: un proceso vivo cualquiera (consultarlo no lo termina, a diferencia de os.kill en Python sobre Windows).
  const otro = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
  t.after(() => otro.kill());
  await new Promise(r => setTimeout(r, 300));
  const registrar = (curso, pid) => { mkdirSync(join(vault, "cursos", curso), { recursive: true }); writeFileSync(join(vault, "cursos", curso, ".sesion-activa.json"), JSON.stringify({ curso, tema: "retardos", sesion: `/s/${curso}.jsonl`, pid })); };
  registrar("redes", otro.pid);
  registrar("propio", process.pid);
  registrar("muerto", 999999);
  const abiertas = clasesAbiertasPorOtros(vault);
  assert.deepEqual(abiertas, [{ curso: "redes", tema: "retardos", sesion: "/s/redes.jsonl", pid: otro.pid }]);
  for (let i = 0; i < 3; i++) assert.equal(procesoVivo(otro.pid), true);
  assert.equal(otro.exitCode, null, "consultar no mató al proceso");
  assert.equal(procesoVivo(0), false);
  assert.equal(procesoVivo(-5), false);
});
