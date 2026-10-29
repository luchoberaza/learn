// Eliminar un curso (DA53), de punta a punta, sobre una copia del curso de demostración: se entra al curso y se elimina
// desde ahí. Con una clase abierta del curso (en la app o en otro pi) no se elimina; la confirmación cuenta qué se va y
// arranca en Cancelar. Al aceptar, el curso va a la papelera con su manifiesto y su propuesta, sale de la barra lateral,
// se vuelve a Inicio y «Seguir donde quedaste» salta a la clase anterior de otro curso. La papelera de la prueba es una
// carpeta temporal (PI_LEARN_E2E_PAPELERA). Requiere el curso de demostración y npm run build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirApp, CURSO, espera, hayCurso, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const CAPTURAS = process.env.LEARN_CAPTURAS;
const COPIA = "borrar-prueba", NOMBRE = "Curso para borrar";
const DOS_CLASES = `export default ai => [ai.fauxAssistantMessage("Arranquemos con los retardos del curso de siempre."), ai.fauxAssistantMessage("Arranquemos con los retardos del curso para borrar.")]`;

test("eliminar curso: desde el curso, frenado por una clase abierta, con confirmación y a la papelera", { skip: sinCurso, timeout: 240000 }, async t => {
  const raiz = join(VAULT, "cursos", COPIA), armado = [`manifiesto-${COPIA}.json`, `propuesta-${COPIA}.json`].map(f => join(VAULT, "_procesado", f));
  const papelera = mkdtempSync(join(tmpdir(), "learn-papelera-"));
  t.after(() => { for (const f of [raiz, ...armado, papelera]) rmSync(f, { recursive: true, force: true }); });
  cpSync(join(VAULT, "cursos", CURSO), raiz, { recursive: true, filter: f => !/\.sesion-(activa|cargada)\.json$/.test(f) });
  const contrato = join(raiz, "curso.md");
  writeFileSync(contrato, readFileSync(contrato, "utf8").replace(/^nombre:.*$/m, `nombre: ${NOMBRE}`).replace(/^slug:.*$/m, `slug: ${COPIA}`));
  for (const n of ["2026-10-20-retardos.md", "2026-10-21-retardos.md"]) writeFileSync(join(raiz, "sesiones", n), "# Clase\n");
  for (const f of armado) writeFileSync(f, "{}\n");
  const documentos = (readFileSync(join(raiz, "indice.yaml"), "utf8").split(/^temas:/m)[0].match(/^\s*- id:/gm) ?? []).length;

  const { win, errores } = await abrirApp(t, { guion: DOS_CLASES, entorno: { PI_LEARN_E2E_PAPELERA: papelera } });
  const lateral = win.getByRole("complementary", { name: "Navegación" }), avisos = win.getByRole("region", { name: "Avisos" });
  await lateral.getByRole("button", { name: NOMBRE }).waitFor({ timeout: 60000 });
  const pedir = (tipo, datos) => win.evaluate(([tipo, datos]) => window.learn.pedir(tipo, datos), [tipo, datos]);
  // Una clase en cada curso, cada una en su sesión: primero la del curso de siempre, después la de la copia.
  async function clase(curso) {
    await pedir("enviar", { texto: `/estudiar ${curso} retardos` });
    for (let i = 0; ; i++) {
      const s = await pedir("estado");
      if (s.curso?.curso === curso && !s.trabajando) break;
      assert.ok(i < 300, `no arrancó la clase de ${curso}`);
      await espera(200);
    }
  }
  await clase(CURSO);
  await pedir("nueva-sesion");
  await clase(COPIA);
  assert.equal((await pedir("seguir")).curso.curso, COPIA, "la última clase es la de la copia");

  // La clase abierta en la app: no se elimina y se dice por qué.
  await lateral.getByRole("button", { name: NOMBRE }).click();
  await win.getByRole("heading", { level: 1, name: NOMBRE }).waitFor();
  const eliminar = win.getByRole("button", { name: "Eliminar el curso" });
  await eliminar.click();
  await avisos.getByText(/Tenés una clase abierta de este curso/).waitFor({ timeout: 20000 });
  assert.equal(await win.getByRole("dialog").count(), 0, "sin confirmación");
  await pedir("nueva-sesion");

  // Otro pi con una clase abierta de este curso, tampoco.
  const otro = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  t.after(() => otro.kill());
  writeFileSync(join(raiz, ".sesion-activa.json"), JSON.stringify({ curso: COPIA, tema: "retardos", sesion: "/s/otra.jsonl", pid: otro.pid }));
  await eliminar.click();
  await avisos.getByText(/otra ventana de pi/).waitFor({ timeout: 20000 });
  assert.equal(await win.getByRole("dialog").count(), 0, "sin confirmación");
  otro.kill();
  rmSync(join(raiz, ".sesion-activa.json"));

  // La confirmación: qué se va, el foco en Cancelar, y Enter cancela sin tocar nada.
  const notas = readdirSync(join(raiz, "sesiones")).filter(n => n.endsWith(".md")).length;
  await eliminar.click();
  const dialogo = win.getByRole("dialog", { name: `¿Eliminar ${NOMBRE}?` });
  await dialogo.waitFor({ timeout: 20000 });
  const texto = await dialogo.innerText();
  assert.match(texto, new RegExp(`Va a la papelera la carpeta cursos/${COPIA}, con:`));
  assert.match(texto, new RegExp(`· ${notas} notas de clase`));
  assert.match(texto, new RegExp(`· las copias de los ${documentos} documentos del material`));
  assert.match(texto, /Los PDFs de _entrada\/ no se tocan/);
  assert.equal(await win.evaluate(() => document.activeElement?.textContent), "Cancelar");
  if (CAPTURAS) { await espera(400); await win.screenshot({ path: join(CAPTURAS, "eliminar-curso.png") }); }
  await win.keyboard.press("Enter");
  await dialogo.waitFor({ state: "detached" });
  assert.ok(existsSync(raiz), "Enter cancela");

  // Eliminar: a la papelera, con su armado de _procesado/, y de vuelta en Inicio.
  await eliminar.click();
  await dialogo.getByRole("button", { name: "Eliminar el curso" }).click();
  await avisos.getByText(`Se eliminó ${NOMBRE}`, { exact: false }).waitFor({ timeout: 20000 });
  assert.ok(!existsSync(raiz), "salió del vault");
  for (const f of armado) assert.ok(!existsSync(f), `${f} salió del vault`);
  assert.deepEqual(readdirSync(papelera).sort(), [COPIA, ...armado.map(f => f.split(/[\\/]/).pop())].sort());
  assert.ok(existsSync(join(papelera, COPIA, "sesiones", "2026-10-20-retardos.md")), "las notas van con el curso");
  await win.locator(".pantalla.inicio").waitFor();
  assert.equal(await lateral.getByRole("button", { name: NOMBRE }).count(), 0, "no queda en la barra lateral");
  assert.ok(await lateral.getByRole("button", { name: "Redes (demo)" }).count() > 0, "los demás cursos siguen");
  assert.ok(existsSync(join(VAULT, "cursos", CURSO, "indice.yaml")));
  // Seguir donde quedaste salta la clase del curso eliminado y retoma la anterior.
  assert.equal((await pedir("seguir")).curso.curso, CURSO);
  await win.getByRole("button", { name: "Seguir la clase" }).waitFor();
  assert.match(await win.locator(".ultima-frase small").innerText(), /^Redes \(demo\), /);
  if (CAPTURAS) await win.screenshot({ path: join(CAPTURAS, "eliminar-curso-inicio.png") });
  assert.deepEqual(errores, []);
});
