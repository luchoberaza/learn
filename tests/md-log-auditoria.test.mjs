import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import mdLog from "../extensions/md-log.ts";

// Vault falso con la nota de la sesión en cursos/redes/sesiones, como la crea /estudiar.
function entorno(t) {
  const dir = mkdtempSync(join(tmpdir(), "pi-md-auditoria-")), sesiones = join(dir, "cursos/redes/sesiones");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(sesiones, { recursive: true });
  const file = join(sesiones, "2026-10-22-retardos.md"), handlers = new Map(), bus = new Map(), emitidos = [], entradas = [], avisos = [], estados = [];
  writeFileSync(file, "");
  const pi = { on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h), emit: (n, d) => emitidos.push([n, d]) }, registerCommand: () => {},
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }) };
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => entradas }, ui: { setStatus: (_k, v) => estados.push(v), notify: (...a) => avisos.push(a) } };
  mdLog(pi);
  const enviar = texto => handlers.get("message_end")({ message: { role: "user", content: texto } }, ctx);
  const vincular = () => new Promise(r => bus.get("md-log:link")({ file, backfill: false, onComplete: r }));
  const desvincular = file => new Promise(r => bus.get("md-log:unlink")({ file, onComplete: r }));
  return { dir, sesiones, file, handlers, emitidos, entradas, avisos, estados, ctx, enviar, vincular, desvincular };
}

test("H04: renombrar la nota en Obsidian no pierde entradas, no avisa y /fin la cierra", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx);
  assert.equal(await e.vincular(), undefined);
  await e.enviar("Antes del renombre");
  const nueva = join(e.sesiones, "Clase retardos (renombrada).md");
  renameSync(e.file, nueva);
  await e.enviar("Primera tras renombrar"); await e.enviar("Segunda tras renombrar");
  const texto = readFileSync(nueva, "utf8");
  for (const m of ["Antes del renombre", "Primera tras renombrar", "Segunda tras renombrar"]) assert.match(texto, new RegExp(m));
  assert.ok(!existsSync(e.file), "no debe recrear la ruta vieja");
  assert.deepEqual(e.avisos, []);
  assert.equal(e.estados.at(-1), "🗒 Clase retardos (renombrada).md");
  assert.deepEqual(e.emitidos, [["md-log:movido", { anterior: e.file, actual: nueva }]]);
  assert.equal(e.entradas.at(-1).data.file, nueva);
  // sesion.ts pide cerrar con la ruta original.
  assert.equal(await e.desvincular(e.file), undefined);
  assert.equal(await e.desvincular(e.file), undefined, "ya desvinculado cuenta como éxito");
  await e.enviar("Fuera del log");
  assert.doesNotMatch(readFileSync(nueva, "utf8"), /Fuera del log/);
});

test("H04: una nota movida a otra carpeta del vault se encuentra por inode; una ajena con el mismo nombre no", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const archivo = join(e.dir, "Archivo/redes"), ajena = join(e.dir, "Otra/2026-10-22-retardos.md");
  mkdirSync(archivo, { recursive: true }); mkdirSync(join(e.dir, "Otra")); writeFileSync(ajena, "AJENA\n");
  renameSync(e.file, join(archivo, "retardos.md"));
  await e.enviar("Sigue en la movida");
  assert.match(readFileSync(join(archivo, "retardos.md"), "utf8"), /Sigue en la movida/);
  assert.equal(readFileSync(ajena, "utf8"), "AJENA\n");
});

test("H04: si la nota se borró, se recrea en su ruta con un solo aviso", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  rmSync(e.file);
  await e.enviar("Uno"); await e.enviar("Dos");
  assert.match(readFileSync(e.file, "utf8"), /Uno[\s\S]*Dos/);
  assert.equal(e.avisos.length, 1); assert.match(e.avisos[0][0], /^La nota del log no estaba; la recreé en 2026-10-22-retardos\.md/);
});

test("H04: tras /resume con la nota renombrada se sigue escribiendo en ella", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const nueva = join(e.sesiones, "renombrada.md"); renameSync(e.file, nueva);
  // /resume: restaura desde la entrada que se guardó al vincular, con la ruta vieja.
  await e.handlers.get("session_start")({}, e.ctx);
  await e.enviar("Retomado");
  assert.match(readFileSync(nueva, "utf8"), /Retomado/);
  assert.deepEqual(e.avisos, []);
  assert.equal(await e.desvincular(e.file), undefined);
});

test("H04: un vínculo viejo sin inode cuya nota falta se recrea con aviso en vez de perderse en silencio", async t => {
  const e = entorno(t); rmSync(e.file); e.entradas.push({ type: "custom", customType: "md-log", data: { file: e.file } });
  await e.handlers.get("session_start")({}, e.ctx);
  await e.enviar("Después de /resume");
  assert.match(readFileSync(e.file, "utf8"), /Después de \/resume/);
  assert.equal(e.avisos.length, 1);
});

const pregunta = { question: "¿Qué cambia si se duplica R? Ver [[cursos/redes/fuentes/kurose-7.pdf#page=56|p. 56]]", details: "Referencia: [[cursos/redes/fuentes/kurose-7.pdf#page=56]]\nCon $L$ = 1000 bits", options: [{ label: "A" }, { label: "B" }, { label: "C" }], correctAnswer: "A", explanation: "d = L/R [[cursos/redes/fuentes/kurose-7.pdf#page=56]]" };
const opciones = [{ index: 1, label: "B" }, { index: 2, label: "A" }, { index: 3, label: "C" }];

test("H49: el callout del quiz va sin el enlace a la página con la respuesta, con el contexto limpio de quiz", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  await e.handlers.get("tool_execution_update")({ toolName: "quiz", toolCallId: "q1", args: pregunta, partialResult: { details: { question: "¿Qué cambia si se duplica R? Ver p. 56", context: "Con L = 1000 bits", options: opciones } } }, e.ctx);
  // Un log anterior a details.context: se limpia args.details.
  await e.handlers.get("tool_execution_update")({ toolName: "quiz", toolCallId: "q2", args: pregunta, partialResult: { details: { options: opciones } } }, e.ctx);
  const texto = readFileSync(e.file, "utf8");
  assert.doesNotMatch(texto, /#page=|\[\[/);
  assert.match(texto, /> \[!question\] Quiz\n> ¿Qué cambia si se duplica R\? Ver p\. 56\n>\n> Con L = 1000 bits\n>\n> 1\. B/);
  assert.match(texto, /> Con \$L\$ = 1000 bits/);
  // Después de responder, la explicación conserva su cita.
  await e.handlers.get("tool_result")({ toolName: "quiz", toolCallId: "q1", details: { status: "answered", answers: [], correctIndices: [2], explanation: pregunta.explanation } }, e.ctx);
  assert.match(readFileSync(e.file, "utf8"), /Tu respuesta: \(ninguna\)[\s\S]*#page=56/);
});

test("H49: un quiz rechazado por forma no deja «Quiz — no disponible» en la nota, ni en vivo ni al rellenar", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const rechazo = { status: "unavailable", message: "Pregunta descartada por tener menos de 3 opciones; ya viene otra." };
  await e.handlers.get("tool_result")({ toolName: "quiz", toolCallId: "q9", details: rechazo }, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), "");
  const asistente = (id, args) => ({ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id, name: "quiz", arguments: args }] } });
  e.entradas.push(asistente("q9", { ...pregunta, options: pregunta.options.slice(0, 2) }), { type: "message", message: { role: "toolResult", toolCallId: "q9", toolName: "quiz", details: rechazo } },
    asistente("q1", pregunta), { type: "message", message: { role: "toolResult", toolCallId: "q1", toolName: "quiz", details: { status: "answered", context: "Con L = 1000 bits", options: opciones, answers: [{ index: 2, label: "A" }], correctIndices: [2], correct: true } } });
  const comandos = new Map(); mdLog({ on: () => {}, events: { on: () => {} }, registerCommand: (n, c) => comandos.set(n, c), appendEntry: () => {} });
  e.ctx.hasUI = true; e.ctx.ui.confirm = async () => true;
  await comandos.get("md-log").handler(e.file, e.ctx);
  const texto = readFileSync(e.file, "utf8");
  assert.doesNotMatch(texto, /no disponible|descartada|#page=|\[\[/);
  assert.match(texto, /> \[!question\] Quiz\n> ¿Qué cambia si se duplica R\? Ver p\. 56\n>\n> Con L = 1000 bits\n>\n> 1\. B\n> 2\. A/);
  assert.match(texto, /Quiz — correcto ✓/);
});

const png = readFileSync(new URL("./fixtures/rojo.png", import.meta.url));
const convertir = destino => { const r = spawnSync("magick", ["png:-", `${destino}:-`], { input: png }); return r.status === 0 ? r.stdout : undefined; };

test("H70: la firma decide el formato: HEIC y BMP por ruta se convierten y un PNG con extensión .jpg se guarda como .png", async t => {
  const heic = convertir("heic"), bmp = convertir("bmp");
  if (!heic || !bmp) return t.skip("sin ImageMagick con HEIC");
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const fotos = { "IMG_0001.HEIC": heic, "captura.bmp": bmp, "mentira.jpg": png };
  for (const [nombre, bytes] of Object.entries(fotos)) writeFileSync(join(e.dir, nombre), bytes);
  await e.enviar(Object.keys(fotos).map(n => join(e.dir, n)).join("\n"));
  const adjuntos = readdirSync(join(e.sesiones, "adjuntos")).sort(), texto = readFileSync(e.file, "utf8");
  assert.deepEqual(adjuntos.map(n => n.split(".").pop()), ["jpg", "png", "png"]);
  assert.ok(readFileSync(join(e.sesiones, "adjuntos", adjuntos[0])).subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")));
  assert.deepEqual(readFileSync(join(e.sesiones, "adjuntos", adjuntos.find(n => n.startsWith("0-3-")))), png);
  for (const n of adjuntos) assert.ok(texto.includes(`![[cursos/redes/sesiones/adjuntos/${n}]]`), n);
  assert.deepEqual(e.avisos, []);
  for (const [nombre, bytes] of Object.entries(fotos)) assert.deepEqual(readFileSync(join(e.dir, nombre)), bytes, "el original queda intacto");
});

test("H70: sin conversor, una foto HEIC avisa en una línea y el aviso no rompe el texto ni el callout", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const foto = join(e.dir, "IMG_0002.heic"), vacio = mkdtempSync(join(tmpdir(), "pi-sin-magick-")), path = process.env.PATH;
  t.after(() => rmSync(vacio, { recursive: true, force: true }));
  writeFileSync(foto, Buffer.concat([Buffer.from("000000186674797068656963", "hex"), Buffer.alloc(32)]));
  process.env.PATH = vacio;
  try { await e.enviar(foto); } finally { process.env.PATH = path; }
  assert.equal(e.avisos.length, 1);
  assert.equal(e.avisos[0][0], "La imagen 1 es HEIC o BMP y no hay ImageMagick para convertirla; mandala en JPEG o PNG.");
  const texto = readFileSync(e.file, "utf8");
  assert.match(texto, /\n\n> \[!warning\] Imagen 1 no guardada\n> Revisá[^\n]*\n\n/);
  assert.ok(texto.includes(foto));
  // Una ruta de pegado en medio de una línea: el callout empieza su propio párrafo.
  await e.enviar(`Mi intento: ${join(e.dir, "pi-clipboard-11111111-2222-4333-8444-555555555555.png")} listo.`);
  assert.match(readFileSync(e.file, "utf8"), /Mi intento: \n\n> \[!warning\] Imagen 1 no guardada\n> [^\n]+\n\n\/.*pi-clipboard-[^ ]+ listo\./);
});

test("H48: la página que el tutor muestra con ver_pagina queda enlazada en la nota, salvo si se rechazó", async t => {
  const e = entorno(t); await e.handlers.get("session_start")({}, e.ctx); await e.vincular();
  const cita = "[[cursos/redes/fuentes/kurose-7.pdf#page=56]]", imagen = { type: "image", mimeType: "image/png", data: png.toString("base64") };
  await e.handlers.get("tool_result")({ toolName: "ver_pagina", isError: false, content: [{ type: "text", text: cita }, imagen] }, e.ctx);
  await e.handlers.get("tool_result")({ toolName: "ver_pagina", isError: true, content: [{ type: "text", text: "La imagen de esta página trae la solución: [[parcial.pdf#page=3]]" }] }, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), `> [!info] Página mostrada\n> ${cita}\n`);
  e.entradas.push({ type: "message", message: { role: "toolResult", toolName: "ver_pagina", isError: false, content: [{ type: "text", text: cita }, imagen] } },
    { type: "message", message: { role: "toolResult", toolName: "ver_pagina", isError: true, content: [{ type: "text", text: "rechazada [[parcial.pdf#page=3]]" }] } });
  const comandos = new Map(); mdLog({ on: () => {}, events: { on: () => {} }, registerCommand: (n, c) => comandos.set(n, c), appendEntry: () => {} });
  e.ctx.hasUI = true; e.ctx.ui.confirm = async () => true;
  await comandos.get("md-log").handler(e.file, e.ctx);
  assert.equal(readFileSync(e.file, "utf8"), `> [!info] Página mostrada\n> ${cita}\n`);
});

test("H49: la limpieza de enlaces de md-log es la misma que la de quiz (D5)", () => {
  const funcion = archivo => readFileSync(new URL(`../extensions/${archivo}`, import.meta.url), "utf8").match(/function sinEnlaces[\s\S]*?\n\t?}\n/)[0].replace(/^\t+/gm, "");
  assert.equal(funcion("md-log.ts"), funcion("quiz.ts"));
});
