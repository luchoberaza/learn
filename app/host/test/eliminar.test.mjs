import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearCursos } from "../curso.mjs";

test("eliminar curso (DA53): cuenta las notas de clase y no deja con una clase abierta, la ingesta o la preparación corriendo", async t => {
  const vault = mkdtempSync(join(tmpdir(), "learn-eliminar-"));
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  // Otro pi: un proceso vivo cualquiera, como en instancia.test.mjs.
  const otro = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
  t.after(() => otro.kill());
  await new Promise(r => setTimeout(r, 300));
  const raiz = join(vault, "cursos", "redes");
  mkdirSync(join(raiz, "sesiones"), { recursive: true });
  mkdirSync(join(raiz, "_procesado"), { recursive: true });
  for (const n of ["2026-10-20-retardos.md", "2026-10-21-retardos.md", "foto.png"]) writeFileSync(join(raiz, "sesiones", n), "");
  const escribir = (f, o) => writeFileSync(join(raiz, f), JSON.stringify(o));
  const cursos = crearCursos({ vault });
  const bloqueo = (claseActual) => cursos.paraEliminar("redes", claseActual).bloqueo;

  assert.deepEqual(cursos.paraEliminar("redes"), { slug: "redes", notas: 2, bloqueo: undefined });
  // La clase abierta en la app, de este curso o de otro.
  assert.match(bloqueo("redes"), /clase abierta de este curso: cerrala con \/fin/);
  assert.equal(bloqueo("quimica"), undefined);
  // Otro pi vivo con una clase del curso; uno muerto ya no cuenta.
  escribir(".sesion-activa.json", { curso: "redes", tema: "retardos", sesion: "/s/x.jsonl", pid: otro.pid });
  assert.match(bloqueo(), /otra ventana de pi/);
  escribir(".sesion-activa.json", { curso: "redes", tema: "retardos", sesion: "/s/x.jsonl", pid: 999999 });
  assert.equal(bloqueo(), undefined);
  // La ingesta leyendo los PDFs; terminada, o con su proceso muerto, no frena.
  escribir("_procesado/estado-ingesta.json", { estado: "en_curso", pid: otro.pid });
  assert.match(bloqueo(), /esperá a que termine la ingesta/);
  escribir("_procesado/estado-ingesta.json", { estado: "completada", pid: otro.pid });
  assert.equal(bloqueo(), undefined);
  escribir("_procesado/estado-ingesta.json", { estado: "en_curso", pid: 999999 });
  assert.equal(bloqueo(), undefined);
  // La preparación de un tema; un candado de más de 6 horas quedó de un pi cortado.
  escribir("_procesado/.preparacion.lock", { pid: otro.pid, inicio: Date.now() });
  assert.match(bloqueo(), /preparando un tema/);
  escribir("_procesado/.preparacion.lock", { pid: otro.pid, inicio: Date.now() - 7 * 3600_000 });
  assert.equal(bloqueo(), undefined);
  // Ni un nombre que salga de cursos/ ni un curso que ya no está.
  assert.throws(() => cursos.paraEliminar("../redes"), /Curso inválido/);
  assert.throws(() => cursos.paraEliminar("quimica"), /ya no está en el vault/);
});
