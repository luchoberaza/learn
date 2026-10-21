import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";

const png = readFileSync(new URL("./fixtures/rojo.png", import.meta.url));
const imagen = (bytes = png, mimeType = "image/png") => ({ type: "image", mimeType, data: bytes.toString("base64") });
async function entorno(t, vincular = true) {
  const dir = mkdtempSync(join(tmpdir(), "pi-md-fotos-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "sesion.md"), handlers = new Map(), bus = new Map(), comandos = new Map(), entradas = [], avisos = [];
  writeFileSync(file, "NOTA CONSERVADA\n");
  mdLog({ on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h) }, registerCommand: (n, c) => comandos.set(n, c), appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }) });
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: assert.fail }, ui: { setStatus: () => {}, notify: (...a) => avisos.push(a) } };
  await handlers.get("session_start")({}, ctx);
  if (vincular) await bus.get("md-log:link")({ file, backfill: false });
  return { dir, file, handlers, comandos, entradas, avisos, ctx, adjuntos: join(dir, "adjuntos"),
    enviar: content => handlers.get("message_end")({ message: { role: "user", timestamp: 123456, content } }, ctx) };
}
test("Ctrl+V nativo: una ruta de imagen en bloque text se copia y se embebe", async t => {
  const e = await entorno(t), foto = join(e.dir, "pi-clipboard-11111111-2222-4333-8444-555555555555.png");
  writeFileSync(foto, png);
  await e.enviar([{ type: "text", text: foto }]);
  assert.ok(existsSync(e.adjuntos), "La ruta quedó como texto, sin copiar la imagen");
  const [nombre] = readdirSync(e.adjuntos);
  assert.deepEqual(readFileSync(join(e.adjuntos, nombre)), png);
  assert.ok(readFileSync(e.file, "utf8").includes(`![[adjuntos/${nombre}]]`));
  assert.ok(!readFileSync(e.file, "utf8").includes(foto));
  assert.deepEqual(readFileSync(foto), png);
});
test("Ctrl+V en medio de texto conserva el texto y las citas, no sólo la ruta", async t => {
  const e = await entorno(t), foto = join(e.dir, "pi-clipboard-11111111-2222-4333-8444-555555555555.png"); writeFileSync(foto, png);
  await e.enviar(`Mi intento: ${foto} listo. [[fuente.pdf#page=2]]`);
  const texto = readFileSync(e.file, "utf8");
  assert.match(texto, /Mi intento: !\[\[/); assert.match(texto, /listo\. \[\[fuente\.pdf#page=2\]\]/); assert.ok(!texto.includes(foto));
});
test("ruta relativa explícita y entre comillas admite espacios sin copiar menciones en prosa", async t => {
  const e = await entorno(t), foto = join(e.dir, "mi foto.PNG"); writeFileSync(foto, png);
  await e.enviar([{ type: "text", text: 'Antes\n@"mi foto.PNG"\nDespués' }]);
  assert.deepEqual(readFileSync(join(e.adjuntos, readdirSync(e.adjuntos)[0])), png);
  const texto = readFileSync(e.file, "utf8"); assert.match(texto, /Antes\n!\[\[/); assert.match(texto, /\]\]\nDespués/);
  const otra = await entorno(t); writeFileSync(join(otra.dir, "ejemplo.png"), png);
  await otra.enviar(`Sólo menciono ${join(otra.dir, "ejemplo.png")}, no lo adjunto.`);
  assert.ok(!existsSync(otra.adjuntos));
});
test("ruta inexistente, enlazada o no regular conserva el texto sin leer el destino", async t => {
  const e = await entorno(t), foto = join(e.dir, "foto.png"), enlace = join(e.dir, "enlace.png"), falta = join(e.dir, "falta.png"), carpeta = join(e.dir, "carpeta.png");
  writeFileSync(foto, png); symlinkSync(foto, enlace); mkdirSync(carpeta); await e.enviar(`${enlace}\n${falta}\n${carpeta}`);
  const texto = readFileSync(e.file, "utf8"); assert.ok(texto.includes(enlace) && texto.includes(falta) && texto.includes(carpeta));
  assert.equal(e.avisos.length, 3); assert.ok(!existsSync(e.adjuntos)); assert.deepEqual(readFileSync(foto), png);
});
test("historial con ruta nativa reutiliza el mismo adjunto sin reescribir la foto", async t => {
  const e = await entorno(t), foto = join(e.dir, "foto.png"); writeFileSync(foto, png);
  const mensaje = { role: "user", timestamp: 123456, content: [{ type: "text", text: foto }] };
  e.entradas.push({ type: "message", message: mensaje }); await e.enviar(mensaje.content);
  const [nombre] = readdirSync(e.adjuntos); e.ctx.hasUI = true; e.ctx.ui.confirm = async () => true;
  await e.comandos.get("md-log").handler(e.file, e.ctx); const texto = readFileSync(e.file, "utf8");
  await e.comandos.get("md-log").handler(e.file, e.ctx);
  assert.deepEqual(readdirSync(e.adjuntos), [nombre]); assert.equal(readFileSync(e.file, "utf8"), texto); assert.deepEqual(readFileSync(foto), png);
});
test("un mensaje sólo con imagen se guarda y embebe sin convertir ni volcar base64", async t => {
  const e = await entorno(t); await e.enviar([imagen()]);
  const [nombre] = readdirSync(e.adjuntos);
  assert.match(nombre, /^123456-1-[a-f0-9]{64}\.png$/);
  assert.deepEqual(readFileSync(join(e.adjuntos, nombre)), png);
  const texto = readFileSync(e.file, "utf8");
  assert.ok(texto.startsWith("NOTA CONSERVADA\n")); assert.ok(texto.includes(`![[adjuntos/${nombre}]]`));
  assert.ok(!texto.includes(png.toString("base64"))); assert.equal(e.avisos.length, 0);
});
test("texto e imágenes conservan su orden y cada formato recibido", async t => {
  const e = await entorno(t);
  const formatos = [
    ["image/png", "png", png],
    ["image/jpeg", "jpg", Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCOALiMf//Z", "base64")],
    ["image/gif", "gif", Buffer.from("R0lGODdhAQABAIEAAAAA/wAAAAAAAAAAACwAAAAAAQABAAAIBAABBAQAOw==", "base64")],
    ["image/webp", "webp", Buffer.from("UklGRjoAAABXRUJQVlA4IC4AAACQAQCdASoBAAEAAUAmJaACdLoAA5gA/vtV4/+lwf/S4P/pcH/pcH8bss4bpAAA", "base64")],
  ];
  await e.enviar(formatos.flatMap(([mime, _ext, bytes], i) => [{ type: "text", text: `Paso ${i + 1}` }, imagen(bytes, mime)]));
  const texto = readFileSync(e.file, "utf8"); let anterior = -1;
  for (const [i, [_mime, ext, bytes]] of formatos.entries()) {
    const nombre = readdirSync(e.adjuntos).find(n => n.startsWith(`123456-${i + 1}-`));
    assert.ok(nombre.endsWith(`.${ext}`)); assert.deepEqual(readFileSync(join(e.adjuntos, nombre)), bytes);
    const paso = texto.indexOf(`Paso ${i + 1}`), embed = texto.indexOf(`![[adjuntos/${nombre}]]`);
    assert.ok(anterior < paso && paso < embed); anterior = embed;
  }
  assert.equal(e.avisos.length, 0);
});
test("formato, base64 o firma inválidos dejan aviso sin perder texto ni las otras imágenes", async t => {
  const e = await entorno(t);
  await e.enviar([{ type: "text", text: "Mi razonamiento" }, imagen(png, "image/svg+xml"), { ...imagen(), data: "%%%" }, imagen(png, "image/jpeg"), { ...imagen(), data: "" }, imagen(Buffer.from("RIFF0000WEBP"), "__proto__"), imagen()]);
  const texto = readFileSync(e.file, "utf8");
  assert.match(texto, /Mi razonamiento/); assert.equal((texto.match(/no guardada/g) || []).length, 5);
  assert.equal(e.avisos.length, 5); assert.equal(readdirSync(e.adjuntos).length, 1); assert.match(texto, /!\[\[adjuntos\/123456-6-/);
});
test("recuperar historial reutiliza adjuntos aun sin timestamp y confirma la nota existente", async t => {
  const e = await entorno(t), mensaje = { role: "user", content: [imagen()] };
  e.entradas.push({ type: "message", message: mensaje }); await e.handlers.get("message_end")({ message: mensaje }, e.ctx);
  const [nombre] = readdirSync(e.adjuntos); let confirmaciones = 0;
  e.ctx.hasUI = true; e.ctx.ui.confirm = async () => { confirmaciones++; return true; };
  await e.comandos.get("md-log").handler(e.file, e.ctx); const primera = readFileSync(e.file, "utf8");
  await e.comandos.get("md-log").handler(e.file, e.ctx);
  assert.equal(confirmaciones, 2); assert.deepEqual(readdirSync(e.adjuntos), [nombre]);
  assert.equal(readFileSync(e.file, "utf8"), primera); assert.deepEqual(readFileSync(join(e.adjuntos, nombre)), png);
});
test("restaurar no duplica imágenes; un adjunto editado se preserva sin presentarlo como original", async t => {
  const e = await entorno(t); await e.enviar([imagen()]);
  const [nombre] = readdirSync(e.adjuntos); await e.handlers.get("session_start")({}, e.ctx);
  assert.deepEqual(readdirSync(e.adjuntos), [nombre]);
  writeFileSync(join(e.adjuntos, nombre), "Edición manual"); writeFileSync(e.file, "Nota nueva\n"); await e.enviar([imagen()]);
  assert.equal(readFileSync(join(e.adjuntos, nombre), "utf8"), "Edición manual");
  const texto = readFileSync(e.file, "utf8"); assert.match(texto, /Imagen 1 no guardada/); assert.ok(!texto.includes("![["));
});
test("un directorio de adjuntos enlazado no permite escribir fuera de la nota", async t => {
  const e = await entorno(t), fuera = join(e.dir, "ajeno"); mkdirSync(fuera); symlinkSync(fuera, e.adjuntos);
  await e.enviar([imagen()]); assert.deepEqual(readdirSync(fuera), []); assert.equal(e.avisos.length, 1);
});
test("un archivo enlazado, aun idéntico, se rechaza y conserva el destino", async t => {
  const e = await entorno(t); await e.enviar([imagen()]);
  const [nombre] = readdirSync(e.adjuntos), destino = join(e.adjuntos, nombre), ajeno = join(e.dir, "original.png");
  writeFileSync(ajeno, png); rmSync(destino); symlinkSync(ajeno, destino);
  await e.enviar([imagen()]); assert.deepEqual(readFileSync(ajeno), png); assert.equal(e.avisos.length, 1);
});
test("sin vínculo no se guardan imágenes ni se crea un directorio", async t => {
  const e = await entorno(t, false); await e.enviar([imagen()]);
  assert.ok(!existsSync(e.adjuntos)); assert.equal(readFileSync(e.file, "utf8"), "NOTA CONSERVADA\n");
});
test("las notas del curso usan un embed con ruta desde el vault", async t => {
  const e = await entorno(t), carpeta = join(e.dir, "curso/sesiones"), nota = join(carpeta, "nueva.md");
  mkdirSync(carpeta, { recursive: true }); writeFileSync(nota, "");
  await e.comandos.get("md-log").handler(nota, e.ctx); await e.enviar([imagen()]);
  const [nombre] = readdirSync(join(carpeta, "adjuntos"));
  assert.ok(readFileSync(nota, "utf8").includes(`![[curso/sesiones/adjuntos/${nombre}]]`));
  assert.deepEqual(readFileSync(join(carpeta, "adjuntos", nombre)), png);
});
