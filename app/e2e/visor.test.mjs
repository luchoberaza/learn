// La ventana de PDF (DA47), de punta a punta: el libro entero en su propia ventana, en la página citada, con la página
// del problema reservado en blanco; se recarga cuando cambia lo reservado y se cierra con la ventana principal.
// Requiere el curso de demostración (e2e/curso_demo.py) y npm run build. Con LEARN_CAPTURAS=<carpeta> guarda capturas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, CURSO, espera, hayCurso, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const CAPTURAS = process.env.LEARN_CAPTURAS;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const RAIZ = join(VAULT, "cursos", CURSO);
const CITA = `export default ai => [
  ai.fauxAssistantMessage("El retardo de transmisión es el tiempo de empujar todos los bits del paquete al enlace: $d_{trans} = L/R$.[[cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=2]]"),
]`;
// La pregunta 1 del parcial ya se rindió: deja de estar reservada y la página del problema P29 del libro se puede ver.
const PROGRESO_RENDIDA = "version: 1\ntemas:\n  retardos:\n    estado: en_curso\n    reservado:\n    - doc: parcial-2025\n      id: '1'\n      usado: true\nhistorial: []\n";

function guardarProgreso(t) {
  const antes = new Set(readdirSync(RAIZ)), copia = join(RAIZ, "progreso.yaml.prueba-visor");
  copyFileSync(join(RAIZ, "progreso.yaml"), copia);
  const restaurar = () => copyFileSync(copia, join(RAIZ, "progreso.yaml"));
  t.after(() => {
    restaurar();
    rmSync(copia, { force: true });
    for (const f of readdirSync(RAIZ)) if (!antes.has(f) && f !== "sesiones") rmSync(join(RAIZ, f), { recursive: true, force: true });
  });
  return restaurar;
}

const errores = pagina => {
  const lista = [];
  pagina.on("pageerror", e => lista.push(String(e)));
  pagina.on("console", m => { if (m.type() === "error") lista.push(m.text()); });
  return lista;
};
const textoDePagina = (visor, n) => visor.locator(`.page[data-page-number="${n}"] .textLayer`);
// Como volver a la ventana con el mouse: el proceso principal recibe el foco (la prueba no puede mover el foco del sistema).
const enfocar = (app, titulo) => app.evaluate(({ BrowserWindow }, t) => { BrowserWindow.getAllWindows().find(w => w.getTitle().startsWith(t))?.emit("focus"); }, titulo);

test("ventana de PDF: el libro entero en la página citada, sin el problema reservado; se recarga y se cierra con la app", { skip: sinCurso, timeout: 240000 }, async t => {
  const restaurarProgreso = guardarProgreso(t);
  const { app, win, errores: erroresApp } = await abrirApp(t, { guion: CITA });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await win.locator(".tutor sup.llamada").first().click({ timeout: 60000 });
  const panel = win.getByRole("complementary", { name: "Página del material" });
  await panel.locator(".panel-cuerpo img").waitFor({ timeout: 20000 });
  const [visor] = await Promise.all([app.waitForEvent("window"), panel.getByRole("button", { name: "Abrir el PDF en una ventana" }).click()]);
  const erroresVisor = errores(visor);

  // Abre en la página citada, con el texto de PDF.js (seleccionable) y el título del documento.
  await textoDePagina(visor, 2).getByText(/1\.4\.1 Retardo de transmisión/).waitFor({ timeout: 30000 });
  assert.equal(await visor.getByLabel("Página", { exact: true }).inputValue(), "2");
  assert.equal(await visor.locator(".de-total").innerText(), "de 8");
  assert.match(await visor.title(), /^Kurose y Ross .*· learn$/);

  // Búsqueda sin distinguir tildes; el problema reservado no está en ninguna parte del documento.
  const buscar = visor.getByLabel("Buscar en el PDF");
  await buscar.fill("transmision");
  await visor.locator(".cuenta-visor").filter({ hasText: /^\d+ de \d+$/ }).waitFor({ timeout: 15000 });
  if (CAPTURAS) await visor.screenshot({ path: join(CAPTURAS, "visor-pdf.png") });
  await buscar.fill("P29");
  await visor.locator(".cuenta-visor").filter({ hasText: "Sin resultados" }).waitFor({ timeout: 15000 });
  await visor.keyboard.press("Escape");
  const numero = visor.getByLabel("Página", { exact: true });
  await numero.fill("8");
  await numero.press("Enter");
  await textoDePagina(visor, 8).getByText(/guardado para el simulacro/).waitFor({ timeout: 20000 });

  // Miniaturas: llevan a la página; la página oscura se prende y se apaga.
  await visor.getByRole("button", { name: "Miniaturas e índice" }).click();
  await visor.getByRole("button", { name: "Página 3", exact: true }).click();
  await visor.waitForFunction(() => document.querySelector("input.numero-pagina")?.value === "3");
  await visor.getByRole("button", { name: "Página oscura" }).click();
  assert.equal(await visor.locator(".visor.oscuro").count(), 1);
  if (CAPTURAS) await visor.screenshot({ path: join(CAPTURAS, "visor-pdf-miniaturas.png") });
  await visor.getByRole("button", { name: "Página oscura" }).click();

  // Se rindió la pregunta reservada mientras la ventana estaba abierta: al volver a ella llega el libro completo.
  writeFileSync(join(RAIZ, "progreso.yaml"), PROGRESO_RENDIDA);
  await espera(3200);
  await enfocar(app, "Kurose");
  await numero.fill("8");
  await numero.press("Enter");
  await textoDePagina(visor, 8).getByText(/P29\./).waitFor({ timeout: 30000 });

  // Pedirlo otra vez desde la app no abre otra ventana: la misma salta a la página y, como volvió la reserva, recarga.
  restaurarProgreso();
  await win.getByRole("button", { name: "Redes (demo)" }).first().click();
  await win.getByRole("tab", { name: "Material" }).click();
  await win.locator(".documentos li", { hasText: "Kurose" }).getByRole("button", { name: "Abrir" }).click();
  await visor.waitForFunction(() => document.querySelector("input.numero-pagina")?.value === "1", null, { timeout: 30000 });
  assert.equal(app.windows().length, 2);
  await numero.fill("8");
  await numero.press("Enter");
  await textoDePagina(visor, 8).getByText(/guardado para el simulacro/).waitFor({ timeout: 30000 });

  // Ctrl+W la cierra. Los parciales no se abren enteros; un práctico sí, con su PDF tal cual.
  // (La ventana se cierra antes de que Playwright dé la tecla por terminada.)
  await Promise.all([visor.waitForEvent("close"), visor.keyboard.press("Control+w").catch(() => {})]);
  assert.equal(await win.locator(".documentos li", { hasText: "Primer parcial" }).getByRole("button", { name: "Abrir" }).count(), 0);
  const [practico] = await Promise.all([app.waitForEvent("window"), win.locator(".documentos li", { hasText: "Práctico 1" }).getByRole("button", { name: "Abrir" }).click()]);
  const erroresPractico = errores(practico);
  await textoDePagina(practico, 1).getByText(/Ejercicio 1\./).waitFor({ timeout: 30000 });
  assert.equal(await practico.locator(".de-total").innerText(), "de 1");

  assert.deepEqual(erroresApp, []); assert.deepEqual(erroresVisor, []); assert.deepEqual(erroresPractico, []);
  // Al cerrar la ventana principal se cierran las de PDF.
  await Promise.all([practico.waitForEvent("close"), app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes("visor.html"))?.close()).catch(() => {})]);
});
