import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buscar, normalizar } from "../scripts/ingesta/bm25.ts";
import { piDir, vaultDir, pythonDelVenv } from "../scripts/lib/pi-sdk.mjs";

const python = pythonDelVenv(piDir);
const cli = join(piDir, "scripts/ingesta/ingestar.py");
const temporal = mkdtempSync(join(tmpdir(), "pi-ingesta-bm25-"));
const salida = join(temporal, "_procesado/prueba");
const manifiesto = join(temporal, "manifiesto.json");
let indice;
before(() => {
  const fixture = spawnSync(python, ["-c", "from pathlib import Path; from test_ingesta import crear_pdf; import sys; crear_pdf(Path(sys.argv[1]))", join(temporal, "muestra.pdf")], {
    env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta") }, encoding: "utf8", timeout: 20000,
  });
  assert.equal(fixture.status, 0, fixture.stderr);
  writeFileSync(manifiesto, JSON.stringify({ version: 1, motores: { digital: "pymupdf", escaneada: "pymupdf", mixta: "pymupdf" },
    documentos: [{ id: "muestra", titulo: "Curso de prueba", tipo: "bibliografia", archivo: "muestra.pdf", paginas: [1, 2, 3] }] }));
  const proceso = spawnSync(python, [cli, "procesar", "--manifiesto", manifiesto, "--vault", temporal, "--salida", salida], { encoding: "utf8", timeout: 30000 });
  assert.equal(proceso.status, 0, proceso.stderr);
  indice = JSON.parse(readFileSync(join(salida, "busqueda.json"), "utf8"));
});
after(() => rmSync(temporal, { recursive: true, force: true }));

test("ingesta Python: clasificación, calidad, OCR local, reanudación, fallos y protección de fuentes", () => {
  // La suite tarda ~80 s sola (con OCR real); dentro de la suite Node, con la máquina cargada, 90 s vencían (SETUP, «Tests»).
  const resultado = spawnSync(python, ["-m", "unittest", "discover", "-s", join(piDir, "tests/ingesta"), "-v"], { cwd: vaultDir, encoding: "utf8", timeout: 300000 });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.match(resultado.stderr, /Ran \d+ tests/);
});
test("BM25 consume el JSON de Python y encuentra derivacion sin tildes", () => {
  const resultados = buscar(indice, "derivacion");
  assert.equal(resultados[0].pagina, 1);
  assert.equal(resultados[0].cita, "[[muestra.pdf#page=1]]");
  assert.equal(normalizar("DERIVACIÓN Ñ"), "derivacion n");
  assert.equal("frecuencias" in resultados[0], false);
  assert.equal("texto" in resultados[0], false);
});
test("BM25 encuentra regla cadena y devuelve la calidad pendiente sin ocultarla", () => {
  const resultados = buscar(indice, "regla cadena");
  assert.equal(resultados[0].pagina, 1);
  assert.equal(resultados[0].pendiente, true);
  assert.ok(resultados[0].fragmento.length <= 400);
});
test("BM25 limita, filtra por tipo y tolera consulta vacía", () => {
  assert.equal(buscar(indice, "redes", 1).length, 1);
  assert.equal(buscar(indice, "cadena", 5, "evaluaciones").length, 0);
  assert.deepEqual(buscar(indice, ""), []);
  assert.throws(() => buscar(indice, "cadena", 0), /límite/);
  assert.throws(() => buscar({ ...indice, version: 2 }, "cadena"), /incompatible/);
});
test("la CLI inicia en segundo plano y deja un resultado consultable", async () => {
  const destino = join(temporal, "_procesado/fondo");
  const inicio = spawnSync(python, [cli, "iniciar", "--manifiesto", manifiesto, "--vault", temporal, "--salida", destino], { encoding: "utf8", timeout: 10000 });
  assert.equal(inicio.status, 0, inicio.stderr);
  const estadoFile = join(destino, "estado-ingesta.json");
  let estado;
  const plazo = Date.now() + 15000;
  while (Date.now() < plazo) {
    if (existsSync(estadoFile)) {
      estado = JSON.parse(readFileSync(estadoFile, "utf8"));
      if (estado.estado !== "en_curso") break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(estado?.estado || "sin estado", /^completada/);
  assert.equal(estado.procesadas, 3);
});
test("doctor de ingesta no depende de los entornos experimentales", () => {
  const resultado = spawnSync(python, [join(piDir, "scripts/ingesta/comprobar.py")], { encoding: "utf8", timeout: 15000 });
  assert.equal(resultado.status, 0, resultado.stderr);
  const chequeos = JSON.parse(resultado.stdout).chequeos;
  assert.ok(chequeos.every(c => c.ok));
  assert.ok(chequeos.every(c => !/marker|docling|aprobación/i.test(c.nombre)));
});
test("la CLI consulta estado sin ejecutar una extracción", () => {
  const resultado = spawnSync(python, [cli, "estado", "--salida", salida], { encoding: "utf8", timeout: 10000 });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(JSON.parse(resultado.stdout).procesadas, 3);
});
