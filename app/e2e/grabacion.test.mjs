// La ventana de grabación (DA51), de punta a punta: una cita #t= del tutor abre la grabación en su propia ventana, en
// ese segundo, y se puede adelantar (el protocolo learn-medio:// sirve rangos de bytes). Otra cita de la misma grabación
// salta en la ventana abierta, y la ventana se cierra con la principal. Requiere el curso de demostración y npm run build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, CURSO, hayCurso, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const CAPTURAS = process.env.LEARN_CAPTURAS;
const GRABACION = join(VAULT, "cursos", CURSO, "fuentes", "otros", "clase-demo.wav");
const CITA = `export default ai => [
  ai.fauxAssistantMessage("En la clase lo explicó con un ejemplo de autos en una ruta.[[cursos/${CURSO}/fuentes/otros/clase-demo.wav#t=12]] Después volvió sobre la cola.[[cursos/${CURSO}/fuentes/otros/clase-demo.wav#t=40]]"),
]`;

// 60 s de un tono suave, PCM de 16 bits a 8 kHz: algo que reproducir, sin depender de un códec.
function crearWav(destino, segundos = 60, muestreo = 8000) {
  const n = segundos * muestreo, datos = Buffer.alloc(44 + n * 2);
  datos.write("RIFF", 0); datos.writeUInt32LE(36 + n * 2, 4); datos.write("WAVEfmt ", 8); datos.writeUInt32LE(16, 16); datos.writeUInt16LE(1, 20); datos.writeUInt16LE(1, 22);
  datos.writeUInt32LE(muestreo, 24); datos.writeUInt32LE(muestreo * 2, 28); datos.writeUInt16LE(2, 32); datos.writeUInt16LE(16, 34); datos.write("data", 36); datos.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) datos.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / muestreo) * 2000), 44 + i * 2);
  mkdirSync(join(destino, ".."), { recursive: true });
  writeFileSync(destino, datos);
}

test("ventana de grabación: la cita abre la grabación en su segundo, se puede adelantar, reusa la ventana y se cierra con la app", { skip: sinCurso, timeout: 180000 }, async t => {
  const carpeta = join(GRABACION, ".."), habia = existsSync(carpeta);
  crearWav(GRABACION);
  t.after(() => rmSync(habia ? GRABACION : carpeta, { recursive: true, force: true }));
  const { app, win, errores } = await abrirApp(t, { guion: CITA });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  const nota = win.locator(".nota-margen").filter({ hasText: "desde 0:12" });
  await nota.waitFor({ timeout: 60000 });
  assert.match(await nota.innerText(), /clase demo, desde 0:12/);
  const [ventana] = await Promise.all([app.waitForEvent("window"), nota.getByRole("button", { name: "Escuchar desde 0:12" }).click()]);
  const erroresVentana = [];
  ventana.on("pageerror", e => erroresVentana.push(String(e)));
  ventana.on("console", m => { if (m.type() === "error") erroresVentana.push(m.text()); });

  // Arranca en el segundo citado, con el título del documento y la duración entera.
  const medio = ventana.locator("video.medio");
  await medio.waitFor({ timeout: 20000 });
  await ventana.waitForFunction(() => { const v = document.querySelector("video.medio"); return v && v.readyState >= 1 && v.currentTime >= 12; }, null, { timeout: 20000 });
  assert.equal(await ventana.locator(".desde-reproductor").innerText(), "Desde 0:12");
  assert.match(await ventana.title(), /^clase demo · learn$/);
  assert.equal(Math.round(await medio.evaluate(v => v.duration)), 60);
  // Adelantar a un punto lejano carga ese rango (206) en vez de bajar todo de nuevo.
  await medio.evaluate(v => new Promise(listo => { v.addEventListener("seeked", listo, { once: true }); v.currentTime = 50; }));
  assert.ok(await medio.evaluate(v => v.currentTime >= 50 && v.readyState >= 2), "salta al segundo 50");
  if (CAPTURAS) await ventana.screenshot({ path: join(CAPTURAS, "ventana-grabacion.png") });

  // La otra cita de la misma grabación salta en la misma ventana.
  await win.locator(".tutor sup.llamada").nth(1).click();
  await ventana.waitForFunction(() => document.querySelector(".desde-reproductor")?.textContent === "Desde 0:40", null, { timeout: 10000 });
  assert.ok(await medio.evaluate(v => v.currentTime >= 40 && v.currentTime < 50), "volvió al segundo 40");
  assert.equal(app.windows().length, 2, "sin ventanas de más");

  // learn-medio:// no sirve a quien no tiene el permiso: ni otro permiso ni una ruta.
  const ajena = await app.evaluate(async ({ net }) => (await net.fetch("learn-medio://permiso-inventado/")).status);
  assert.equal(ajena, 404);
  assert.deepEqual([...errores, ...erroresVentana], []);

  // Se cierra con la ventana principal.
  const cerrada = ventana.waitForEvent("close");
  await win.close();
  await cerrada;
});
