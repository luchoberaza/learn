// Pruebas de punta a punta de DA52: Ajustes → Cómo estudio, los modos en la página del tema y la pregunta de desarrollo.
// El tutor falso mira el prompt y el resultado de la pregunta: si el modo, la mezcla o el conteo no le llegan, lo dice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, CURSO, dibujado, espera, hayCurso, notas, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const CAPTURAS = process.env.LEARN_CAPTURAS;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const capturar = async (win, nombre) => {
  if (!CAPTURAS) return;
  await espera(350);
  await win.addStyleTag({ content: ".avisos{visibility:hidden}" }).then(h => h.evaluate(e => e.setAttribute("data-captura", ""))).catch(() => {});
  await win.screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
  await win.evaluate(() => document.querySelectorAll("style[data-captura]").forEach(e => e.remove())).catch(() => {});
};
const RAIZ = join(VAULT, "cursos", CURSO), LOCAL = join(VAULT, ".pi/curso.config.local.json");

// La configuración local de esta máquina y el progreso del curso de demostración vuelven a como estaban.
function conservar(t) {
  const local = existsSync(LOCAL) ? readFileSync(LOCAL, "utf8") : undefined;
  const progreso = readFileSync(join(RAIZ, "progreso.yaml"), "utf8"), bak = join(RAIZ, "progreso.yaml.bak"), habiaBak = existsSync(bak);
  t.after(() => {
    if (local === undefined) rmSync(LOCAL, { force: true }); else writeFileSync(LOCAL, local);
    writeFileSync(join(RAIZ, "progreso.yaml"), progreso);
    if (!habiaBak) rmSync(bak, { force: true });
  });
}
const PROGRESO = "version: 1\ntemas:\n  retardos:\n    estado: en_curso\n    borde:\n      domina: []\n      falla:\n        - confunde propagación con transmisión\nhistorial: []\n";

const GUION = `export default ai => [
  ctx => {
    const prompt = JSON.stringify(ctx.messages);
    const ok = prompt.includes("Modo: Desde cero") && prompt.includes("Preguntas: Mitad y mitad") && prompt.includes("pregunta_desarrollo");
    return ai.fauxAssistantMessage([ai.fauxText(ok ? "Empezamos desde cero, con mitad y mitad." : "FALTA el modo o la mezcla en el prompt."),
      ai.fauxToolCall("pregunta_desarrollo", { clase: "El **retardo de propagación** es lo que tarda un bit en viajar de un router al siguiente.", pregunta: "¿Por qué el retardo de propagación no depende del tamaño del paquete?", detalles: "Mismo enlace, dos paquetes de distinto tamaño.",
        respuesta_esperada: "Porque $d_{prop} = d/s$: sólo depende de la distancia y de la velocidad del medio." }, { id: "des-1" })], { stopReason: "toolUse" });
  },
  ctx => {
    const ultimo = JSON.stringify(ctx.messages.at(-1));
    const ok = ultimo.includes("van 0 de múltiple opción y 1 de desarrollo; cuando vuelvas a preguntar, que sea de múltiple opción") && ultimo.includes("velocidad de la señal");
    return ai.fauxAssistantMessage(ok ? "Bien: es por d/s. Me llegó tu respuesta con el conteo." : "FALTA el conteo o la respuesta: " + ultimo.slice(0, 300));
  },
]`;

test("app: Cómo estudio guarda la mezcla, el tema ofrece los modos y la clase desde cero pregunta para escribir", { skip: sinCurso, timeout: 240000 }, async t => {
  conservar(t);
  writeFileSync(join(RAIZ, "progreso.yaml"), PROGRESO);
  const { win, errores } = await abrirApp(t, { guion: GUION });

  // Ajustes → Cómo estudio: la mezcla queda en curso.config.local.json, sin tocar lo demás de la máquina.
  const antes = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, "utf8")) : {};
  await win.getByRole("button", { name: "Ajustes", exact: true }).click();
  await win.locator(".ajustes-nav").getByRole("button", { name: "Cómo estudio" }).click();
  await win.getByRole("radio", { name: /Automático \(recomendado\)/ }).waitFor({ timeout: 30000 });
  assert.equal(await win.getByRole("radio", { name: /Automático/ }).isChecked(), true);
  await win.getByRole("radio", { name: /Mitad y mitad/ }).check();
  for (let i = 0; i < 50 && JSON.parse(readFileSync(LOCAL, "utf8")).preguntas !== "mitad"; i++) await espera(100);
  assert.deepEqual(JSON.parse(readFileSync(LOCAL, "utf8")), { ...antes, preguntas: "mitad" });
  await capturar(win, "ajustes-estudio");

  // La página del tema: «Desde cero» siempre; «Fortalecer lo flojo» porque hay una falla guardada.
  await win.locator(".temas button").first().click();
  await win.getByRole("button", { name: "Fortalecer lo flojo" }).waitFor({ timeout: 30000 });
  assert.match(await win.locator(".modos-tema").innerText(), /Desde cero[\s\S]*Repasa todo el tema desde las bases[\s\S]*Fortalecer lo flojo[\s\S]*Trabaja lo que te costó/);
  await capturar(win, "tema-modos");
  await win.getByRole("button", { name: "Desde cero", exact: true }).click();

  // La pregunta de desarrollo: se escribe, y la respuesta esperada aparece recién después de responder.
  const tarjeta = win.locator(".quiz.desarrollo.vivo");
  await tarjeta.waitFor({ timeout: 60000 });
  await dibujado(tarjeta);
  const clase = await win.locator(".clase").innerText();
  assert.match(clase, /Empezamos desde cero, con mitad y mitad\./);
  assert.doesNotMatch(clase, /velocidad del medio/);
  // La explicación que trae la pregunta se lee como texto del tutor, antes de la pregunta.
  await dibujado(win.locator(".explicacion-previa").first());
  assert.match(await win.locator(".explicacion-previa").first().innerText(), /retardo de propagación es lo que tarda un bit en viajar/);
  // Mientras la pregunta está abierta, la caja de abajo explica qué hacer.
  assert.match(await win.locator(".compositor").innerText(), /Escribí tu respuesta arriba, o tocá «Prefiero responder en el chat»\./);
  await capturar(win, "clase-desarrollo");
  await tarjeta.locator("textarea").fill("Porque depende de la distancia y de la velocidad de la señal, no de L.");
  await tarjeta.getByRole("button", { name: "Responder", exact: true }).click();
  await tarjeta.locator(".veredicto.esperada").waitFor({ timeout: 20000 });
  assert.match(await tarjeta.innerText(), /velocidad de la señal[\s\S]*Respuesta esperada\.[\s\S]*velocidad del medio/);
  await capturar(win, "clase-desarrollo-respondida");
  await tarjeta.getByRole("button", { name: "Seguir", exact: true }).click();
  await win.getByText("Bien: es por d/s. Me llegó tu respuesta con el conteo.").waitFor({ timeout: 30000 });
  // La tarjeta viva queda como pregunta resuelta en la transcripción.
  await dibujado(win.locator(".quiz.desarrollo:not(.vivo)"));
  assert.equal(await win.locator(".quiz.desarrollo.vivo").count(), 0);
  assert.match(await win.locator(".quiz.desarrollo").innerText(), /velocidad de la señal[\s\S]*Respuesta esperada/);

  // La nota de Obsidian: la pregunta y, después, lo escrito con la esperada.
  const nota = readFileSync(join(RAIZ, "sesiones", notas().sort().at(-1)), "utf8");
  assert.match(nota, /> \[!abstract\] PI\n\nEl \*\*retardo de propagación\*\* es lo que tarda un bit en viajar de un router al siguiente\.\n\n> \[!question\] Desarrollo\n> ¿Por qué el retardo de propagación no depende del tamaño del paquete\?/);
  assert.match(nota, /> \[!example\] Desarrollo — tu respuesta\n> Porque depende de la distancia y de la velocidad de la señal, no de L\.\n>\n> Respuesta esperada:/);
  assert.deepEqual(errores, []);
});
