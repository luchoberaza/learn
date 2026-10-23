import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { getEventListeners } from "node:events";
import { join } from "node:path";
import { elegir } from "../extensions/comun/elegir.ts";
import { piDir } from "../scripts/lib/pi-sdk.mjs";

// Teclas por defecto de pi 1.4.0 (pi-tui keybindings.js:78-89, core/keybindings.js:37).
const TECLAS = { "tui.select.up": [["up", "\x1b[A"]], "tui.select.down": [["down", "\x1b[B"]], "tui.select.confirm": [["enter", "\r"]], "tui.select.cancel": [["escape", "\x1b"], ["ctrl+c", "\x03"]], "app.tools.expand": [["ctrl+o", "\x0f"]] };
const kb = { matches: (dato, id) => (TECLAS[id] || []).some(([, d]) => d === dato), getKeys: id => (TECLAS[id] || []).map(([k]) => k) };
const theme = { fg: (_c, s) => s, bold: s => s };
const K = { arriba: "\x1b[A", abajo: "\x1b[B", enter: "\r", esc: "\x1b", ctrlc: "\x03", ctrlo: "\x0f" };
// UI de terminal falsa: dibuja el selector antes de cada tecla y después de la última.
function terminal(teclas, pantallas = [], extra = {}) {
  let expandido = false;
  return { mode: "tui", ui: { select: assert.fail, getToolsExpanded: () => expandido, setToolsExpanded: v => { expandido = v; },
    custom: factory => new Promise(res => {
      const c = factory({ requestRender() {} }, theme, kb, res);
      pantallas.push(c.render(extra.ancho ?? 80));
      for (const k of teclas) { c.handleInput(K[k] ?? k); pantallas.push(c.render(extra.ancho ?? 80)); }
      extra.componente?.(c);
    }) }, expandido: () => expandido };
}

test("H45: en la terminal el selector dibuja título, opciones y la ayuda en español con las teclas reales", async () => {
  const pantallas = [];
  assert.equal(await elegir(terminal(["enter"], pantallas), "Reemplazar nota con el historial\nLa nota tiene contenido.", ["Sí, reemplazar la nota", "No"]), "Sí, reemplazar la nota");
  assert.deepEqual(pantallas[0], ["─".repeat(80), "", " Reemplazar nota con el historial", " La nota tiene contenido.", "", " → Sí, reemplazar la nota", "   No", "",
    " ↑↓ moverse  enter elegir  escape/ctrl+c cancelar", "", "─".repeat(80)]);
  assert.doesNotMatch(pantallas.flat().join("\n"), /navigate|select|cancel\b/);
});

test("H45: ↑↓, j/k, enter y esc o ctrl+c como el selector de pi; ctrl+o expande las tools", async () => {
  const pantallas = [];
  assert.equal(await elegir(terminal(["abajo", "abajo", "abajo", "arriba", "enter"], pantallas), "Temas", ["A", "B", "C"]), "B");
  assert.ok(pantallas[3].includes(" → C"), "abajo no pasa de la última");
  assert.equal(await elegir(terminal(["j", "j", "k", "\n"]), "Temas", ["A", "B", "C"]), "B");
  assert.equal(await elegir(terminal(["arriba", "enter"]), "Temas", ["A", "B"]), "A");
  assert.equal(await elegir(terminal(["abajo", "esc"]), "Temas", ["A", "B"]), undefined);
  assert.equal(await elegir(terminal(["ctrlc"]), "Temas", ["A", "B"]), undefined);
  const ctx = terminal(["ctrlo", "enter"]);
  assert.equal(await elegir(ctx, "Temas", ["A"]), "A");
  assert.equal(ctx.expandido(), true);
});

test("H45: un corte (signal) cierra el selector como Esc y suelta su listener", async () => {
  const antes = new AbortController(); antes.abort();
  assert.equal(await elegir(terminal([]), "Hay una pregunta abierta", ["Sí", "No"], { signal: antes.signal }), undefined);
  const corte = new AbortController();
  let componente;
  const r = elegir(terminal([], [], { componente: c => { componente = c; } }), "Confirmar gasto de visión", ["Sí, transcribir", "No"], { signal: corte.signal });
  assert.equal(getEventListeners(corte.signal, "abort").length, 1);
  corte.abort();
  assert.equal(await r, undefined);
  componente.dispose();
  assert.equal(getEventListeners(corte.signal, "abort").length, 0);
});

test("H45: ninguna línea pasa el ancho de la terminal, aunque haya texto largo, tabs o caracteres anchos", async () => {
  for (const ancho of [12, 30, 80]) {
    const pantallas = [];
    await elegir(terminal(["enter"], pantallas, { ancho }), `Reconstruir el progreso\n{\n\t"borde": "${"retardo ".repeat(20)}"\n}\n漢字漢字漢字漢字漢字漢字 📚📚📚📚📚📚📚📚`, ["Capa de aplicación [capa-de-aplicacion] · sin_empezar · por material", "Unapalabrasinespaciosmuchomaslargaqueelanchodelaterminal"]);
    // Como en pi-tui (visibleWidth), CJK y emoji ocupan dos columnas.
    for (const l of pantallas.flat()) assert.ok([...l].reduce((n, c) => n + (/\p{Script=Han}|\p{Extended_Pictographic}/u.test(c) ? 2 : 1), 0) <= ancho, `${ancho}: ${l}`);
    assert.match(pantallas[0].join("\n"), /漢字/);
  }
});

test("H45: fuera de la terminal (rpc, json, print o sin modo) usa ui.select tal cual", async () => {
  for (const mode of ["rpc", "json", "print", undefined]) {
    const llamadas = [], senal = new AbortController().signal;
    const ctx = { mode, ui: { custom: assert.fail, select: async (...a) => (llamadas.push(a), "No") } };
    assert.equal(await elegir(ctx, "Guardar cambios del curso", ["Sí, guardar los cambios", "No"], { signal: senal }), "No");
    assert.deepEqual(llamadas, [["Guardar cambios del curso", ["Sí, guardar los cambios", "No"], { signal: senal }]]);
  }
});

test("H45: las extensiones no llaman a ui.select ni ui.confirm directo: todo pasa por el selector en español", () => {
  const archivos = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === "node_modules" ? [] : archivos(join(dir, e.name))) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []);
  const directas = archivos(join(piDir, "extensions")).filter(f => !f.endsWith("comun/elegir.ts") && /\bui\.(select|confirm)\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(directas, []);
});
