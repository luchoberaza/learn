// Pestañas (DA56), barra lateral y panel de página ajustables (DA54) y escala de la interfaz (DA55), de punta a punta.
// Las conversaciones no necesitan el curso de demostración; el PDF en una pestaña y lo que se restaura al abrir, sí
// (e2e/curso_demo.py). Requieren npm run build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, CURSO, dibujado, espera, hayCurso, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const guardados = datos => JSON.parse(readFileSync(join(datos, "ajustes.json"), "utf8"));
const barra = win => win.getByRole("tablist", { name: "Pestañas" });
const pestanas = win => barra(win).getByRole("tab");
const activa = win => barra(win).getByRole("tab", { selected: true });
const pantalla = win => win.locator(".capa-pantalla");
// Espera a que la barra tenga n pestañas (cerrar o abrir se dibuja un instante después del clic).
const cuantas = (win, n) => win.waitForFunction(n => document.querySelectorAll('[role=tablist][aria-label="Pestañas"] [role=tab]').length === n, n, { timeout: 15000 });
// El último mensaje del tutor que se ve en la pantalla de la clase.
const delTutor = (win, texto) => pantalla(win).locator(".tutor").filter({ hasText: texto }).last();

async function listo(win) {
  await win.getByRole("heading", { level: 2 }).first().waitFor({ timeout: 60000 });
}
async function sesionNueva(win) {
  await win.keyboard.press("Control+K");
  await win.getByRole("dialog", { name: "Buscar o hacer algo" }).getByRole("textbox").fill("/new");
  await win.keyboard.press("Enter");
  await win.getByRole("textbox", { name: "Mensaje para el tutor" }).waitFor();
}
async function decir(win, texto) {
  await win.getByRole("textbox", { name: "Mensaje para el tutor" }).fill(texto);
  await win.keyboard.press("Enter");
}
// Arrastra el borde (un separador) dx px en horizontal, en pasos, como con el mouse.
async function arrastrar(win, tirador, dx) {
  const c = await tirador.boundingBox(), x = c.x + c.width / 2, y = c.y + Math.min(200, c.height / 2);
  await win.mouse.move(x, y);
  await win.mouse.down();
  await win.mouse.move(x + dx / 2, y, { steps: 4 });
  await win.mouse.move(x + dx, y, { steps: 4 });
  await win.mouse.up();
  await espera(300);
}
const ancho = locator => locator.evaluate(e => Math.round(e.getBoundingClientRect().width));

const TRES = `export default ai => [
  ai.fauxAssistantMessage("Primera conversación: hablamos del retardo de propagación."),
  ai.fauxAssistantMessage("Segunda conversación: hablamos de la capa de enlace."),
  ai.fauxAssistantMessage("Primera conversación otra vez: seguimos con la propagación."),
]`;

test("pestañas: cada una con su conversación; al volver a una, pi vuelve a la suya", { timeout: 240000 }, async t => {
  const { win, datos, errores } = await abrirApp(t, { guion: TRES });
  await listo(win);
  assert.deepEqual(await pestanas(win).allInnerTexts(), ["Inicio"]);

  await sesionNueva(win);
  await decir(win, "Hola, empecemos con la propagación");
  await dibujado(delTutor(win, "Primera conversación: hablamos"));

  // Ctrl+T abre Inicio al lado; una sesión nueva ahí no pisa la conversación de la primera pestaña.
  await win.keyboard.press("Control+T");
  await activa(win).filter({ hasText: "Inicio" }).waitFor();
  await cuantas(win, 2);
  await sesionNueva(win);
  assert.equal(await pantalla(win).locator(".tutor").count(), 0);
  await decir(win, "Contame de la capa de enlace");
  await dibujado(delTutor(win, "Segunda conversación"));

  // Volver a la primera: su conversación, sin la otra; y sigue ahí mismo.
  await pestanas(win).nth(0).click();
  await dibujado(delTutor(win, "Primera conversación: hablamos"));
  assert.equal(await pantalla(win).getByText("Segunda conversación").count(), 0);
  await decir(win, "¿Y después?");
  await dibujado(delTutor(win, "Primera conversación otra vez"));
  await pestanas(win).nth(1).click();
  await dibujado(delTutor(win, "Segunda conversación"));
  assert.equal(await pantalla(win).getByText("Primera conversación").count(), 0);

  // Las dos quedan en Sesiones. Retomar una que ya está en una pestaña lleva a ésa, sin abrir otra.
  await barra(win).getByRole("button", { name: "Pestaña nueva" }).click();
  await win.getByRole("button", { name: "Todas las sesiones" }).click();
  const lista = pantalla(win).locator(".sesiones li");
  await lista.nth(1).waitFor({ timeout: 20000 });
  assert.equal(await lista.count(), 2);
  await lista.filter({ hasText: "Hola, empecemos" }).getByRole("button").first().click();
  await activa(win).and(pestanas(win).nth(0)).waitFor();
  await dibujado(delTutor(win, "Primera conversación otra vez"));
  await cuantas(win, 3);

  // El clic del medio cierra; la conversación sigue en Sesiones y se abre de nuevo en una pestaña nueva.
  await pestanas(win).nth(1).click({ button: "middle" });
  await cuantas(win, 2);
  await pestanas(win).nth(1).click();
  await lista.filter({ hasText: "Contame de la capa" }).getByRole("button", { name: "Abrir en una pestaña nueva" }).click();
  await cuantas(win, 3);
  await dibujado(delTutor(win, "Segunda conversación"));
  assert.equal(await pestanas(win).nth(2).getAttribute("aria-selected"), "true");

  // Arrastrar la última pestaña antes de la primera cambia el orden.
  const antes = await pestanas(win).allInnerTexts();
  await win.locator(".pestana").nth(2).dragTo(win.locator(".pestana").nth(0), { targetPosition: { x: 8, y: 12 } });
  const despues = await pestanas(win).allInnerTexts();
  assert.deepEqual(despues, [antes[2], antes[0], antes[1]]);

  // Ctrl+W cierra la activa; quedan guardadas para el próximo arranque, con su conversación.
  await win.keyboard.press("Control+W");
  await cuantas(win, 2);
  await espera(1200);
  const g = guardados(datos).pestanas;
  assert.equal(g.vault, VAULT);
  assert.equal(g.lista.length, 2);
  assert.ok(g.lista.some(p => p.ruta?.pantalla === "clase" && p.sesion?.endsWith(".jsonl")), JSON.stringify(g));
  assert.deepEqual(errores, []);
});

const LENTO = `export default ai => [
  ai.fauxAssistantMessage("Primera: lista."),
  ai.fauxAssistantMessage("Segunda: " + "una respuesta larga que tarda en escribirse. ".repeat(60)),
]`;

test("pestañas: con el tutor respondiendo, pasar a otra conversación pregunta antes de cortar", { timeout: 240000 }, async t => {
  const { win, errores } = await abrirApp(t, { guion: LENTO, tokens: 40 });
  await listo(win);
  await sesionNueva(win);
  await decir(win, "Uno");
  await dibujado(delTutor(win, "Primera: lista."));
  await win.keyboard.press("Control+T");
  await sesionNueva(win);
  await decir(win, "Dos");
  await delTutor(win, "Segunda:").waitFor({ timeout: 30000 });
  // La pestaña de la conversación late mientras el tutor escribe.
  await activa(win).locator(".latido").waitFor();

  await pestanas(win).nth(0).click();
  const dialogo = win.getByRole("dialog", { name: "El tutor está respondiendo" });
  await dialogo.waitFor();
  await dialogo.getByRole("button", { name: "Esperar" }).click();
  assert.equal(await pestanas(win).nth(1).getAttribute("aria-selected"), "true");
  assert.equal(await pantalla(win).getByText("Primera: lista.").count(), 0);

  await pestanas(win).nth(0).click();
  await dialogo.getByRole("button", { name: "Cortar y cambiar" }).click();
  await dibujado(delTutor(win, "Primera: lista."));
  assert.equal(await pestanas(win).nth(0).getAttribute("aria-selected"), "true");
  await win.locator(".pestana .latido").waitFor({ state: "detached", timeout: 20000 });
  assert.deepEqual(errores, []);
});

test("barra lateral plegable y con el ancho a mano; escala de la interfaz", { timeout: 180000 }, async t => {
  const { app, win, datos, errores } = await abrirApp(t);
  await listo(win);
  const lateral = win.locator("aside.lateral");
  assert.equal(await ancho(lateral), 256);

  // Ctrl+B y el botón la pliegan a una franja; queda guardado.
  await win.keyboard.press("Control+B");
  await win.locator("aside.lateral.plegada").waitFor();
  assert.equal(await ancho(lateral), 44);
  await win.getByRole("button", { name: "Mostrar la barra lateral" }).click();
  await win.getByRole("button", { name: "Plegar la barra lateral" }).click();
  await win.locator("aside.lateral.plegada").waitFor();
  await espera(300);
  assert.equal(guardados(datos).lateral.plegada, true);
  await win.keyboard.press("Control+B");
  await win.locator("aside.lateral:not(.plegada)").waitFor();

  // El borde se arrastra, con tope en 420 px; doble clic vuelve al de siempre.
  const tirador = win.getByRole("separator", { name: "Ancho de la barra lateral" });
  await arrastrar(win, tirador, 100);
  assert.equal(await ancho(lateral), 356);
  assert.equal(guardados(datos).lateral.ancho, 356);
  await arrastrar(win, tirador, 300);
  assert.equal(await ancho(lateral), 420);
  await tirador.dblclick();
  await espera(300);
  assert.equal(await ancho(lateral), 256);
  assert.equal(guardados(datos).lateral.ancho, undefined);
  // Con el teclado, de a 16 px.
  await tirador.focus();
  await win.keyboard.press("ArrowRight");
  await espera(300);
  assert.equal(await ancho(lateral), 272);

  // Escala: los pasos del navegador con Ctrl + y Ctrl −, Ctrl 0 vuelve; Ajustes la muestra y la cambia.
  const zoom = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());
  const esperarZoom = async z => { for (let i = 0; i < 50 && Math.abs((await zoom()) - z) > 0.001; i++) await espera(100); assert.equal(Math.round((await zoom()) * 100), Math.round(z * 100)); };
  await win.keyboard.press("Control+Equal");
  await esperarZoom(1.1);
  assert.equal(guardados(datos).escala, 1.1);
  await win.keyboard.press("Control+Minus");
  await win.keyboard.press("Control+Minus");
  await esperarZoom(0.9);
  await win.keyboard.press("Control+Digit0");
  await esperarZoom(1);
  await win.getByRole("button", { name: "Ajustes", exact: true }).click();
  const grupo = win.getByRole("radiogroup", { name: "Tamaño de la interfaz" });
  assert.equal(await grupo.getByRole("radio", { checked: true }).innerText(), "100 %");
  await grupo.getByRole("radio", { name: "125 %" }).click();
  await esperarZoom(1.25);
  assert.equal(await grupo.getByRole("radio", { checked: true }).innerText(), "125 %");
  await win.keyboard.press("Control+Digit0");
  await esperarZoom(1);
  assert.deepEqual(errores, []);
});

const CITA = `export default ai => [
  ai.fauxAssistantMessage("El retardo de transmisión es el tiempo de empujar todos los bits del paquete al enlace: $d_{trans} = L/R$.[[cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=2]]"),
]`;
const textoDePagina = (lugar, n) => lugar.locator(`.page[data-page-number="${n}"] .textLayer`);

test("PDF en una pestaña: se elige al abrirlo, sin la página reservada, y la clase sigue donde estaba", { skip: sinCurso, timeout: 240000 }, async t => {
  const { app, win, datos, errores } = await abrirApp(t, { guion: CITA });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await win.locator(".tutor sup.llamada").first().click({ timeout: 60000 });
  const panel = win.getByRole("complementary", { name: "Página del material" });
  await panel.locator(".panel-cuerpo img").waitFor({ timeout: 20000 });

  // El borde del panel de página también se arrastra (hacia la izquierda lo ensancha).
  const antes = await ancho(panel);
  await arrastrar(win, panel.getByRole("separator", { name: "Ancho del panel de página" }), -80);
  assert.equal(await ancho(panel), antes + 80);
  assert.equal(guardados(datos).anchoPanel, antes + 80);

  // Abrir el PDF entero: el menú da a elegir; en una pestaña no abre ninguna ventana.
  await panel.getByRole("button", { name: "Abrir el PDF entero" }).click();
  await win.getByRole("menuitem", { name: "En una pestaña" }).click();
  const pdf = win.locator(".pestana-pdf:not(.oculta)");
  await textoDePagina(pdf, 2).getByText(/1\.4\.1 Retardo de transmisión/).waitFor({ timeout: 30000 });
  assert.equal(app.windows().length, 1);
  await activa(win).filter({ hasText: /Kurose/ }).waitFor();
  assert.equal(await pdf.locator(".de-total").innerText(), "de 8");
  // El problema reservado para el simulacro no está en ninguna parte del documento.
  await pdf.getByLabel("Buscar en el PDF").fill("P29");
  await pdf.locator(".cuenta-visor").filter({ hasText: "Sin resultados" }).waitFor({ timeout: 15000 });
  await pdf.getByLabel("Buscar en el PDF").press("Escape");
  // En el PDF, Ctrl + agranda el documento y no la interfaz.
  const zoomPdf = await pdf.locator(".zoom").innerText();
  await win.keyboard.press("Control+Equal");
  await win.waitForFunction(z => document.querySelector(".pestana-pdf:not(.oculta) .zoom")?.textContent !== z, zoomPdf);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()), 1);

  // La clase sigue donde estaba.
  await pestanas(win).nth(0).click();
  await dibujado(win.locator(".tutor sup.llamada").first());
  assert.equal(await win.locator(".pestana-pdf.oculta").count(), 1);

  // Pedirlo otra vez (desde el material del curso) no abre otra pestaña: vuelve a la misma, en la página pedida.
  await win.getByRole("button", { name: "Redes (demo)" }).first().click();
  await win.getByRole("tab", { name: "Material" }).click();
  await win.locator(".documentos li", { hasText: "Kurose" }).getByRole("button", { name: "Abrir el PDF entero" }).click();
  await win.getByRole("menuitem", { name: "En una pestaña" }).click();
  await win.waitForFunction(() => document.querySelector(".pestana-pdf:not(.oculta) input.numero-pagina")?.value === "1", null, { timeout: 30000 });
  await cuantas(win, 2);

  // Con el PDF a la vista, la barra lateral navega en la otra pestaña y el PDF queda.
  await win.getByRole("button", { name: "Inicio", exact: true }).click();
  await activa(win).filter({ hasText: "Inicio" }).waitFor();
  await cuantas(win, 2);

  // Queda guardado para el próximo arranque; Ctrl+W lo cierra.
  await espera(1200);
  const pdfGuardado = guardados(datos).pestanas.lista.find(p => p.pdf);
  assert.equal(pdfGuardado.pdf.curso, CURSO);
  assert.equal(pdfGuardado.pdf.doc, "kurose");
  await pestanas(win).nth(1).click();
  await win.keyboard.press("Control+W");
  await cuantas(win, 1);
  assert.deepEqual(errores, []);
});

const DOS_CLASES = `export default ai => [
  ai.fauxAssistantMessage("Clase de retardos: empecemos por la transmisión."),
  ai.fauxAssistantMessage("Clase de aplicación: empecemos por HTTP."),
  ai.fauxAssistantMessage("Sigo en la clase."),
  ai.fauxAssistantMessage("Sigo en la clase."),
]`;

test("pestañas: la clase de otro tema, empezada en otra pestaña, no pisa la primera", { skip: sinCurso, timeout: 240000 }, async t => {
  const { win, errores } = await abrirApp(t, { guion: DOS_CLASES });
  await win.getByRole("button", { name: "Empezar la clase" }).click({ timeout: 60000 });
  await dibujado(delTutor(win, "Clase de retardos"));
  await activa(win).filter({ hasText: "Retardos y tasa de transferencia" }).waitFor();

  await win.keyboard.press("Control+T");
  await win.locator("aside.lateral").getByRole("button", { name: "Capa de aplicación" }).click();
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await pantalla(win).locator(".barra-clase .miga").filter({ hasText: "Capa de aplicación" }).waitFor({ timeout: 60000 });
  await pantalla(win).locator(".tutor").first().waitFor({ timeout: 60000 });
  assert.equal(await pantalla(win).getByText("Clase de retardos").count(), 0);
  await activa(win).filter({ hasText: "Capa de aplicación" }).waitFor();

  // La primera pestaña sigue con su clase y su tema.
  await pestanas(win).nth(0).click();
  await dibujado(delTutor(win, "Clase de retardos"));
  await pantalla(win).locator(".barra-clase .miga").filter({ hasText: "Retardos y tasa de transferencia" }).waitFor({ timeout: 30000 });
  assert.deepEqual((await pestanas(win).allInnerTexts()).map(x => x.trim()), ["Retardos y tasa de transferencia", "Capa de aplicación"]);
  assert.deepEqual(errores, []);
});

test("al abrir vuelven las pestañas, la barra plegada y la escala guardadas", { skip: sinCurso, timeout: 180000 }, async t => {
  const pestanasGuardadas = { vault: VAULT, activa: 1, lista: [{ ruta: { pantalla: "curso", slug: CURSO } }, { pdf: { curso: CURSO, doc: "kurose", pagina: 3 } }, { ruta: { pantalla: "curso", slug: "no-existe" } }] };
  const { app, win, errores } = await abrirApp(t, { ajustes: { pestanas: pestanasGuardadas, lateral: { plegada: true }, escala: 1.25 } });
  await win.locator(".pestana-pdf:not(.oculta) input.numero-pagina").waitFor({ timeout: 60000 });
  await win.waitForFunction(() => document.querySelector(".pestana-pdf:not(.oculta) input.numero-pagina")?.value === "3", null, { timeout: 30000 });
  // La de un curso que ya no está vuelve a Inicio.
  assert.deepEqual(await pestanas(win).allInnerTexts(), ["Redes (demo)", await pestanas(win).nth(1).innerText(), "Inicio"]);
  assert.match(await pestanas(win).nth(1).innerText(), /Kurose/);
  await win.locator("aside.lateral.plegada").waitFor();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()), 1.25);
  await pestanas(win).nth(0).click();
  await win.getByRole("tab", { name: "Material" }).waitFor();
  assert.deepEqual(errores, []);
});
