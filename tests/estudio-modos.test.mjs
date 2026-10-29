import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEZCLAS, MODOS, lineaConteo, mezcla, modoDeArgs, proxima, seccionClase } from "../extensions/comun/estudio.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import mdLog from "../extensions/md-log.ts";
import { guardarConfigLocal, leerConfigLocal, loadProject } from "../scripts/lib/pi-sdk.mjs";

// DA52: modos para encarar un tema (seguir, desde cero, fortalecer lo flojo), mezcla de múltiple opción y desarrollo,
// y la pregunta que se responde escribiendo.

test("estudio: el modo va al final de /estudiar, también «desde cero» en dos palabras, y el resto es el tema", () => {
  assert.deepEqual(modoDeArgs(["retardos", "desde-cero"]), { modo: "desde-cero", resto: ["retardos"] });
  assert.deepEqual(modoDeArgs(["retardos", "de", "propagación", "desde", "cero"]), { modo: "desde-cero", resto: ["retardos", "de", "propagación"] });
  assert.deepEqual(modoDeArgs(["retardos", "Fortalecer"]), { modo: "fortalecer", resto: ["retardos"] });
  assert.deepEqual(modoDeArgs(["retardos"]), { modo: "seguir", resto: ["retardos"] });
  assert.deepEqual(modoDeArgs(["fortalecer"]), { modo: "fortalecer", resto: [] });
  assert.deepEqual(modoDeArgs([]), { modo: "seguir", resto: [] });
});

test("estudio: con una mezcla fija la próxima pregunta sale del conteo; automático la deja al tutor", () => {
  const secuencia = (id, n) => {
    const x = mezcla(id); let o = 0, d = 0; const tipos = [];
    for (let i = 0; i < n; i++) { const t = proxima(x, o, d); tipos.push(t === "desarrollo" ? "D" : "O"); t === "desarrollo" ? d++ : o++; }
    return tipos.join("");
  };
  assert.equal(secuencia("solo-opcion", 6), "OOOOOO");
  assert.equal(secuencia("mas-opcion", 8), "OOODOOOD");
  assert.equal(secuencia("mitad", 6), "ODODOD");
  assert.equal(secuencia("mas-desarrollo", 8), "ODDDODDD");
  assert.equal(secuencia("solo-desarrollo", 4), "DDDD");
  assert.equal(proxima(mezcla("automatico"), 3, 1), undefined);
  // Un valor desconocido (o ninguno) es automático.
  assert.equal(mezcla("cualquiera").id, "automatico"); assert.equal(mezcla(undefined).id, "automatico");
  assert.deepEqual(MEZCLAS.map(m => m.id), ["automatico", "solo-opcion", "mas-opcion", "mitad", "mas-desarrollo", "solo-desarrollo"]);
  assert.deepEqual(MODOS.map(m => m.id), ["seguir", "desde-cero", "fortalecer"]);
});

test("estudio: la sección «Esta clase» nombra el modo sólo si no es seguir, la mezcla y la primera pregunta", () => {
  const seguir = seccionClase(undefined, undefined);
  assert.doesNotMatch(seguir, /Modo:/);
  assert.match(seguir, /Preguntas: Automático\. Múltiple opción \(`quiz`\) en el probe/);
  assert.match(seguir, /Respetá esta mezcla en toda pregunta con respuesta correcta/);
  const cero = seccionClase("desde-cero", "mas-desarrollo");
  assert.match(cero, /^Modo: Desde cero\. No des por sabido nada del dossier/m);
  assert.match(cero, /Preguntas: Más desarrollo \(De cada 4 preguntas, 1 de múltiple opción y 3 de desarrollo\)\. La primera va de múltiple opción \(`quiz`\)\./);
  assert.match(seccionClase("fortalecer", "solo-desarrollo"), /Modo: Fortalecer lo flojo\.[^\n]*falla_resuelta[\s\S]*La primera va de desarrollo \(`pregunta_desarrollo`\)\./);
  // Sólo cambia con el modo o la mezcla: no rompe la caché del prompt en cada turno.
  assert.equal(seccionClase("desde-cero", "mitad"), seccionClase("desde-cero", "mitad"));
  assert.equal(lineaConteo("mitad", 2, 1), "Mezcla «Mitad y mitad»: en esta clase van 2 de múltiple opción y 1 de desarrollo; cuando vuelvas a preguntar, que sea de desarrollo (`pregunta_desarrollo`).");
  assert.equal(lineaConteo(undefined, 1, 0), "Mezcla «Automático»: en esta clase van 1 de múltiple opción y 0 de desarrollo; cuando vuelvas a preguntar, elegí el tipo según el nodo.");
});

test("estudio: la preferencia vive en curso.config.local.json sin pisar lo demás de la máquina", t => {
  const dir = mkdtempSync(join(tmpdir(), "pi-preguntas-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "curso.config.local.json"), JSON.stringify({ modelo_principal: "anthropic/claude-sonnet-5-5", otra: 1 }));
  guardarConfigLocal({ preguntas: "mitad" }, dir);
  assert.deepEqual(leerConfigLocal(dir), { modelo_principal: "anthropic/claude-sonnet-5-5", preguntas: "mitad" });
  assert.equal(JSON.parse(readFileSync(join(dir, "curso.config.local.json"), "utf8")).otra, 1);
  guardarConfigLocal({ preguntas: undefined, clave_rara: "x" }, dir);
  assert.deepEqual(leerConfigLocal(dir), { modelo_principal: "anthropic/claude-sonnet-5-5" });
});

// Vault falso, como el de sesion.test.mjs.
function datos() {
  const tema = { id: "derivacion", nombre: "Derivación", alias: ["derivada"], unidad: 1, prerequisitos: [], objetivos: ["O1.1"],
    bibliografia: [{ doc: "libro", seccion: "Derivadas", paginas: [1, 2] }], ejercicios: [] };
  return { curso: "calculo", nombre: "Cálculo", contrato: "# Objetivos\n- O1.1: Comprender la derivación.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" }],
    items: {}, progreso: { temas: { derivacion: { estado: "en_curso", borde: { domina: ["pendiente"], falla: ["regla de la cadena"] } } }, historial: [] },
    avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
}
function entorno(t, entradas = []) {
  const vault = mkdtempSync(join(tmpdir(), "pi-modos-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/calculo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of ["sesiones", "_procesado/libro/paginas"]) mkdirSync(join(raiz, p), { recursive: true });
  mkdirSync(join(recursos, "skills/teach"), { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "PROCESO TEACH ORIGINAL");
  writeFileSync(join(recursos, "modo-curso.md"), "PROTOCOLO DEL CURSO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  const comandos = new Map(), eventos = new Map(), mensajes = [], avisos = [], elegidos = [];
  const pi = { on: (n, h) => eventos.set(n, h), registerCommand: (n, d) => comandos.set(n, d),
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {},
    sendMessage: m => mensajes.push(m.content), getAllTools: () => [], getActiveTools: () => [], setActiveTools: () => {},
    exec: async () => ({ code: 0, stdout: JSON.stringify(datos()), stderr: "" }),
    events: { emit: (_n, payload) => payload.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "prueba" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (...m) => avisos.push(m), setStatus: () => {}, select: async (titulo, opciones) => { elegidos.push([titulo, opciones]); return opciones.find(o => o.startsWith("Mitad")) ?? opciones[0]; } } };
  registrarSesion(pi, vault, recursos);
  const secciones = () => { const ev = { systemPromptOptions: { sections: {}, skills: [] } }; eventos.get("before_agent_start")(ev, ctx); return ev.systemPromptOptions.sections; };
  return { pi, ctx, comandos, eventos, mensajes, avisos, elegidos, recursos, entradas, secciones };
}

test("/estudiar … desde-cero: el modo queda en el estado de la clase, en la orden de arranque y en «Esta clase»", async t => {
  const e = entorno(t);
  await e.comandos.get("estudiar").handler("calculo derivacion desde-cero", e.ctx);
  const estado = e.entradas.findLast(x => x.customType === "curso").data;
  assert.equal(estado.tema, "derivacion"); assert.equal(estado.modo, "desde-cero");
  assert.match(e.mensajes.at(-1), /^Empecemos con «Derivación» \(calculo\), desde cero\. Iniciá el probe desde la base/);
  const s = e.secciones();
  assert.match(s.clase, /Modo: Desde cero/); assert.match(s.clase, /Preguntas: Automático/);
  assert.equal(s.teach, "PROCESO TEACH ORIGINAL"); assert.equal(s.modo_curso, "PROTOCOLO DEL CURSO");
  // La mezcla se lee en cada turno: cambiarla vale desde la próxima pregunta.
  guardarConfigLocal({ preguntas: "solo-desarrollo" }, e.recursos);
  assert.match(e.secciones().clase, /Preguntas: Sólo desarrollo/);
});

test("/estudiar … fortalecer abre por lo flojo; sin modo arranca como siempre y no lo guarda", async t => {
  const e = entorno(t);
  await e.comandos.get("estudiar").handler("calculo derivada fortalecer", e.ctx);
  assert.equal(e.entradas.findLast(x => x.customType === "curso").data.modo, "fortalecer");
  assert.match(e.mensajes.at(-1), /, para fortalecer lo flojo\. Abrí con una línea de lo que quedó flojo según el dossier/);
  assert.match(e.secciones().clase, /Modo: Fortalecer lo flojo/);
  const f = entorno(t);
  await f.comandos.get("estudiar").handler("calculo derivacion", f.ctx);
  assert.equal("modo" in f.entradas.findLast(x => x.customType === "curso").data, false);
  assert.match(f.mensajes.at(-1), /^Empecemos con «Derivación» \(calculo\)\. Abrí con una línea de dónde quedamos/);
  assert.doesNotMatch(f.secciones().clase, /Modo:/);
});

test("un tema nuevo arranca por la lista de lo que ya vio, no por una pregunta suelta", async t => {
  const e = entorno(t);
  e.pi.exec = async () => ({ code: 0, stdout: JSON.stringify({ ...datos(), progreso: { temas: {}, historial: [] } }), stderr: "" });
  await e.comandos.get("estudiar").handler("calculo derivacion", e.ctx);
  assert.match(e.mensajes.at(-1), /^Empecemos con «Derivación» \(calculo\)\. Iniciá el probe sin preámbulo: la primera pregunta es la lista de lo que ya vio, sin esperar/);
});

test("al retomar la sesión (pi -c) la clase conserva su modo; uno inválido se descarta", async t => {
  const e = entorno(t);
  await e.comandos.get("estudiar").handler("calculo derivacion desde-cero", e.ctx);
  const g = entorno(t, [...e.entradas]);
  await g.eventos.get("session_start")({}, g.ctx);
  assert.match(g.secciones().clase, /Modo: Desde cero/);
  const h = entorno(t, [{ ...e.entradas.findLast(x => x.customType === "curso"), data: { ...e.entradas.findLast(x => x.customType === "curso").data, modo: "<inyectado>" } }]);
  await h.eventos.get("session_start")({}, h.ctx);
  assert.doesNotMatch(h.secciones().clase, /Modo:|inyectado/);
});

test("cada pregunta respondida suma el conteo de la clase para el modelo; las de antes de la clase y las canceladas no cuentan", async t => {
  const e = entorno(t);
  const respuesta = (toolCallId, toolName, status = "answered") => ({ type: "message", message: { role: "toolResult", toolCallId, toolName, details: { status } } });
  e.entradas.push(respuesta("viejo", "quiz"));
  guardarConfigLocal({ preguntas: "mitad" }, e.recursos);
  await e.comandos.get("estudiar").handler("calculo derivacion", e.ctx);
  e.entradas.push(respuesta("q1", "quiz"), respuesta("q2", "quiz", "cancelled"));
  const r = e.eventos.get("tool_result")({ toolName: "quiz", toolCallId: "q3", content: [{ type: "text", text: "El alumno respondió bien." }], details: { status: "answered" } }, e.ctx);
  assert.equal(r.content[0].text, "El alumno respondió bien.");
  assert.equal(r.content[1].text, "Mezcla «Mitad y mitad»: en esta clase van 2 de múltiple opción y 0 de desarrollo; cuando vuelvas a preguntar, que sea de desarrollo (`pregunta_desarrollo`).");
  // Si pi ya anotó el resultado en la rama, no se cuenta dos veces.
  e.entradas.push(respuesta("q3", "quiz"));
  const otra = e.eventos.get("tool_result")({ toolName: "pregunta_desarrollo", toolCallId: "q3b", content: [], details: { status: "answered" } }, e.ctx);
  // Mitad y mitad tras O, O, D: la que sigue empareja con otra de desarrollo.
  assert.match(otra.content[0].text, /van 2 de múltiple opción y 1 de desarrollo; cuando vuelvas a preguntar, que sea de desarrollo/);
  assert.equal(e.eventos.get("tool_result")({ toolName: "quiz", toolCallId: "q4", content: [], details: { status: "cancelled" } }, e.ctx), undefined);
  assert.equal(e.eventos.get("tool_result")({ toolName: "leer_paginas", toolCallId: "l1", content: [], details: {} }, e.ctx), undefined);
});

test("tema libre (skill teach fuera de un curso): también lleva la mezcla de preguntas y su conteo, sin modo", async t => {
  const e = entorno(t);
  assert.equal(e.secciones().clase, undefined, "sin teach ni curso no hay sección");
  e.entradas.push({ type: "message", message: { role: "user", content: [{ type: "text", text: '<skill name="teach" location="x">…</skill>\n\nquiero entender TCP' }] } });
  guardarConfigLocal({ preguntas: "mas-opcion" }, e.recursos);
  const s = e.secciones();
  assert.match(s.clase, /Preguntas: Más múltiple opción/); assert.doesNotMatch(s.clase, /Modo:/);
  assert.equal(s.teach, undefined, "teach llega como skill, no como sección");
  const r = e.eventos.get("tool_result")({ toolName: "quiz", toolCallId: "t1", content: [], details: { status: "answered" } }, e.ctx);
  assert.match(r.content[0].text, /^Mezcla «Más múltiple opción»: en esta clase van 1 de múltiple opción/);
});

test("/preguntas: elige en la terminal, acepta el id o el nombre, guarda y automático no queda escrito", async t => {
  const e = entorno(t), preguntas = e.comandos.get("preguntas");
  await preguntas.handler("", e.ctx);
  assert.match(e.elegidos[0][0], /¿cuántas de múltiple opción y cuántas de desarrollo\?/);
  assert.ok(e.elegidos[0][1].some(o => o.startsWith("Automático (la de ahora):")));
  assert.equal(leerConfigLocal(e.recursos).preguntas, "mitad");
  assert.deepEqual(e.avisos.at(-1), ["Preguntas: Mitad y mitad. Vale desde la próxima pregunta.", "info"]);
  await preguntas.handler("Sólo desarrollo", e.ctx);
  assert.equal(leerConfigLocal(e.recursos).preguntas, "solo-desarrollo");
  await preguntas.handler("automatico", e.ctx);
  assert.equal(leerConfigLocal(e.recursos).preguntas, undefined);
  await preguntas.handler("muchas", e.ctx);
  assert.match(e.avisos.at(-1)[0], /^No hay una mezcla «muchas»: usá automatico, solo-opcion/);
  assert.deepEqual(preguntas.getArgumentCompletions("mas").map(c => c.value), ["mas-opcion", "mas-desarrollo"]);
  assert.equal(preguntas.getArgumentCompletions("mitad"), null);
});

test("/estudiar sugiere el modo tras un tema exacto y no sugiere nada con el comando completo", async t => {
  const e = entorno(t), completar = p => e.comandos.get("estudiar").getArgumentCompletions(p);
  assert.deepEqual((await completar("calculo derivacion d")).map(c => c.value), ["calculo derivacion desde-cero"]);
  assert.deepEqual((await completar("calculo derivacion f")).map(c => c.label), ["Derivación · Fortalecer lo flojo"]);
  assert.equal(await completar("calculo derivacion desde-cero"), null);
  assert.equal(await completar("calculo derivacion"), null);
});

// La pregunta de desarrollo, con las extensiones reales.
let p, desarrollo;
before(async () => { p = await loadProject(); desarrollo = p.session.extensionRunner.getToolDefinition("pregunta_desarrollo"); });
after(() => p?.close());

const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
const K = { enter: "\r", esc: "\x1b", tab: "\t" };
function ui(teclas, pantallas = []) {
  return { hasUI: true, ui: { custom: factory => new Promise(res => {
    const c = factory(tui, theme, {}, res);
    const foto = () => pantallas.push(c.render(100).join("\n"));
    foto();
    for (const k of teclas) { c.handleInput(K[k] ?? k); foto(); }
  }) } };
}
const pregunta = { pregunta: "¿Por qué el retardo de propagación no depende del tamaño del paquete? [[cursos/redes/fuentes/bibliografia/k.pdf#page=54]]",
  detalles: "Con $d = 2\\,\\text{km}$.", respuesta_esperada: "Porque $d_{prop} = d/s$: depende de la distancia y la velocidad del medio, no de $L$." };

test("pregunta_desarrollo en la terminal: escribe y manda con Enter, ve la esperada después, y nunca antes", async () => {
  const pantallas = [], parciales = [];
  const r = await desarrollo.execute("d1", pregunta, undefined, u => parciales.push(u), ui([..."depende de la distancia", "enter", "enter"], pantallas));
  assert.equal(r.details.status, "answered"); assert.equal(r.details.answer, "depende de la distancia"); assert.equal(r.details.dontKnow, false);
  assert.equal(r.details.question, "¿Por qué el retardo de propagación no depende del tamaño del paquete?");
  assert.equal(r.details.context, "Con d = 2 km.");
  assert.match(r.content[0].text, /^El alumno respondió escribiendo:\n«depende de la distancia»\nRespuesta esperada: Porque \$d_\{prop\}/);
  assert.match(r.content[0].text, /Corregilo en el texto de tu mensaje siguiente \(el alumno no ve tu razonamiento\): bien, a medias o mal; .*Recién después, otra pregunta\.$/);
  const antes = pantallas.slice(0, -2).join("\n"), despues = pantallas.at(-2);
  assert.doesNotMatch(antes, /Respuesta esperada|velocidad del medio/);
  assert.match(antes, /No sé/); assert.match(antes, /Enter enviar/);
  assert.match(despues, /Tu respuesta:[\s\S]*depende de la distancia[\s\S]*Respuesta esperada:[\s\S]*d_prop = d\/s/);
  // md-log recibe la pregunta antes de la respuesta, sin la esperada.
  assert.deepEqual(parciales[0].details, { tipo: "desarrollo", question: r.details.question, context: "Con d = 2 km." });
  const llamada = desarrollo.renderCall(pregunta, theme).text, resultado = desarrollo.renderResult(r, {}, theme).text;
  assert.doesNotMatch(llamada, /velocidad del medio|page=/); assert.match(resultado, /Tu respuesta: depende de la distancia\nRespuesta esperada:/);
});

test("pregunta_desarrollo: «No sé» con Tab, Enter vacío no manda, Esc cancela y sin pregunta o esperada se descarta", async () => {
  const nose = await desarrollo.execute("d2", pregunta, undefined, () => {}, ui(["enter", "tab", "enter", "enter"]));
  assert.equal(nose.details.dontKnow, true); assert.equal(nose.details.answer, undefined);
  assert.match(nose.content[0].text, /«No sé»: no intentó responder/);
  const cancelada = await desarrollo.execute("d3", pregunta, undefined, () => {}, ui([..."algo", "esc"]));
  assert.equal(cancelada.details.status, "cancelled"); assert.equal(cancelada.details.expected, undefined);
  for (const falta of [{ ...pregunta, respuesta_esperada: "  " }, { ...pregunta, pregunta: "" }]) {
    const r = await desarrollo.execute("d4", falta, undefined, () => {}, ui([]));
    assert.equal(r.details.status, "unavailable"); assert.match(r.content[0].text, /hacen falta pregunta y respuesta_esperada/);
  }
});

test("pregunta_desarrollo con la app: le llega la pregunta limpia y la esperada para después; vacía vale como cancelada", async () => {
  const pedidos = [];
  const app = responder => ({ hasUI: true, mode: "rpc", ui: { custom: () => assert.fail("con app no se abre el popup de la terminal"), preguntar: async pedido => { pedidos.push(pedido); return responder; } } });
  const r = await desarrollo.execute("d5", pregunta, undefined, () => {}, app({ noSe: false, texto: "  por la distancia  " }));
  assert.deepEqual(pedidos[0], { tipo: "desarrollo", pregunta: "¿Por qué el retardo de propagación no depende del tamaño del paquete?", contexto: "Con d = 2 km.", esperada: pregunta.respuesta_esperada });
  assert.equal(r.details.answer, "por la distancia");
  assert.equal((await desarrollo.execute("d6", pregunta, undefined, () => {}, app({ noSe: true }))).details.dontKnow, true);
  for (const vacia of [null, { noSe: false, texto: "   " }, { noSe: false }]) assert.equal((await desarrollo.execute("d7", pregunta, undefined, () => {}, app(vacia))).details.status, "cancelled");
});

test("la explicación de la pregunta (clase) se dibuja en la terminal antes de la pregunta, viaja a la app y nunca lleva la respuesta", async () => {
  const clase = "El **retardo de propagación** es lo que tarda un bit en recorrer el enlace: $d_{prop} = d/s$.";
  const dibujo = desarrollo.renderCall({ ...pregunta, clase }, theme).render(100).map(l => l.trimEnd()).join("\n");
  assert.match(dibujo, /retardo de propagación[\s\S]*desarrollo ¿Por qué el retardo de propagación no depende/);
  assert.doesNotMatch(dibujo, /velocidad del medio/);
  const quiz = p.session.extensionRunner.getToolDefinition("quiz");
  const dibujoQuiz = quiz.renderCall({ question: "¿Qué retardo cambia?", options: [{ label: "A" }, { label: "B" }, { label: "C" }], correctAnswer: "A", explanation: "SECRETO", clase }, theme).render(100).join("\n");
  assert.match(dibujoQuiz, /retardo de propagación[\s\S]*quiz ¿Qué retardo cambia\?/); assert.doesNotMatch(dibujoQuiz, /SECRETO/);
  const pedidos = [], parciales = [];
  const r = await desarrollo.execute("d9", { ...pregunta, clase }, undefined, u => parciales.push(u), { hasUI: true, mode: "rpc", ui: { preguntar: async x => { pedidos.push(x); return { noSe: true }; } } });
  assert.equal(pedidos[0].clase, clase); assert.equal(parciales[0].details.clase, clase); assert.equal(r.details.clase, clase);
});

test("pregunta_desarrollo es una tool del estudio y su guía pide corregir sin exigir las palabras exactas", () => {
  const sesion = readFileSync(join(import.meta.dirname, "../extensions/curso/sesion.ts"), "utf8");
  assert.match(sesion, /const ESTUDIO = \["quiz", "pregunta_desarrollo",/);
  const guia = desarrollo.promptGuidelines.join("\n");
  assert.match(guia, /no exijas las palabras exactas/); assert.match(guia, /pedilo en el chat, donde puede mandar foto/);
});

// La guardia (DA52): en una clase real el tutor escribía la explicación en su razonamiento y preguntaba igual.
test("guardia: una pregunta de verificación sin explicación visible desde la anterior no se muestra y vuelve al modelo", async () => {
  const quiz = p.session.extensionRunner.getToolDefinition("quiz");
  const q = { question: "¿Qué retardo depende de la distancia?", options: [{ label: "Propagación", value: "prop" }, { label: "Transmisión", value: "trans" }, { label: "Cola", value: "cola" }], correctAnswer: "prop", explanation: "d_prop = d/s." };
  const anterior = (status = "answered", toolName = "quiz") => ({ type: "message", message: { role: "toolResult", toolCallId: "q0", toolName, details: { status } } });
  const tutor = (texto, id) => ({ type: "message", message: { role: "assistant", content: [...(texto ? [{ type: "text", text: texto }] : []), ...(id ? [{ type: "toolCall", id, name: "quiz", arguments: {} }] : [])] } });
  const alumno = texto => ({ type: "message", message: { role: "user", content: [{ type: "text", text: texto }] } });
  const explicacion = "El retardo de propagación es lo que tarda un bit en viajar de un extremo al otro del enlace: depende del largo del cable y de la velocidad de la señal.";
  const conRama = (entradas, teclas = ["enter", "enter"]) => ({ ...ui(teclas), sessionManager: { getBranch: () => entradas } });
  const sinPopup = entradas => ({ hasUI: true, sessionManager: { getBranch: () => entradas }, ui: { custom: () => assert.fail("no se muestra") } });

  // Pregunta tras pregunta, sin texto (o con «Bien.»): no se muestra, md-log no la anota y el modelo recibe por qué.
  // DA57: un mensaje del alumno corta igual que una pregunta respondida. Lo escrito antes no le responde, haya o no
  // pregunta anterior (un alumno preguntó «¿por qué?» y recibió una pregunta sin la explicación).
  for (const [entradas, escrito] of [[[anterior(), tutor("", "q1")], 0], [[anterior(), tutor("Bien.", "q1")], 5],
    [[tutor(explicacion), alumno("No entendí. ¿Por qué?"), tutor("", "q1")], 0], [[anterior(), tutor(explicacion), alumno("Dale"), tutor("Bien.", "q1")], 5]]) {
    const r = await quiz.execute("q1", q, undefined, () => assert.fail("md-log no la anota"), sinPopup(entradas));
    assert.equal(r.details.status, "unavailable"); assert.equal(r.details.interno, true);
    assert.match(r.content[0].text, new RegExp(`^Pregunta no mostrada: desde la pregunta anterior o el último mensaje del alumno escribiste ${escrito} caracteres de texto visible, y el alumno no ve tu razonamiento`));
    assert.match(r.content[0].text, /Poné en el campo clase de esta misma herramienta la explicación [^.]*\(si el alumno te preguntó algo, empezá por responderle\)[^.]*o escribila como texto antes de llamarla\. No la pases al chat ni le cuentes al alumno de este aviso\./);
    assert.equal(quiz.renderResult(r, {}, theme).text, "(la pregunta vuelve después de la explicación)");
  }
  // Con la explicación escrita (en el mismo mensaje, en uno anterior desde la pregunta o en clase, también después de un
  // mensaje del alumno), con momento diagnostico, sin pregunta respondida ni mensaje del alumno antes o tras una
  // cancelada, se muestra.
  for (const [entradas, params] of [[[anterior(), tutor(explicacion, "q1")], q], [[anterior(), tutor(explicacion), tutor("", "q1")], q],
    [[anterior(), tutor("", "q1")], { ...q, momento: "diagnostico" }], [[tutor("", "q1")], q], [[anterior("cancelled"), tutor("", "q1")], q],
    [[alumno("¿Por qué?"), tutor(explicacion, "q1")], q], [[alumno("¿Por qué?"), tutor("", "q1")], { ...q, clase: explicacion }],
    [[alumno("¿Por qué?"), tutor("", "q1")], { ...q, momento: "diagnostico" }]]) {
    const r = await quiz.execute("q1", params, undefined, () => {}, conRama(entradas));
    assert.equal(r.details.status, "answered", JSON.stringify(entradas.map(e => e.message.role)));
  }
  // Frena una sola vez seguida: si el reintento llega igual sin texto, pasa (en una clase real el tutor reintentaba y
  // terminaba preguntando por el chat, contándole al alumno del rechazo).
  const rechazo = { type: "message", message: { role: "toolResult", toolCallId: "q1", toolName: "quiz", details: { status: "unavailable", interno: true } } };
  const reintento = await quiz.execute("q2", q, undefined, () => {}, conRama([anterior(), tutor("", "q1"), rechazo, tutor("", "q2")]));
  assert.equal(reintento.details.status, "answered");
  // Después de responder, el modelo lee que primero va el texto; en el diagnóstico, no.
  assert.match(reintento.content[0].text, /\nAhora, en el texto de tu mensaje \(el alumno no ve tu razonamiento\): qué estuvo bien o mal y la explicación que corresponda; recién después, otra pregunta\.$/);
  const diagnostico = await quiz.execute("q3", { ...q, momento: "diagnostico" }, undefined, () => {}, conRama([tutor("", "q3")]));
  assert.doesNotMatch(diagnostico.content[0].text, /Ahora, en el texto de tu mensaje/);
  // La explicación puede venir en clase, que se muestra antes de la pregunta: cuenta como texto visible.
  const conClaseOk = await quiz.execute("q4", { ...q, clase: explicacion }, undefined, () => {}, conRama([anterior(), tutor("", "q4")]));
  assert.equal(conClaseOk.details.status, "answered"); assert.equal(conClaseOk.details.clase, explicacion);
  const corta = await quiz.execute("q5", { ...q, clase: "Ojo." }, undefined, () => assert.fail("md-log no la anota"), sinPopup([anterior(), tutor("", "q5")]));
  assert.equal(corta.details.interno, true);
  assert.match(corta.content[0].text, /Poné en el campo clase de esta misma herramienta la explicación/);
  // La de desarrollo cuenta igual, también contra un quiz anterior, y respeta su momento.
  const sinTexto = [anterior("answered", "pregunta_desarrollo"), tutor("", "d1")];
  const d = await desarrollo.execute("d1", pregunta, undefined, () => assert.fail("md-log no la anota"), sinPopup(sinTexto));
  assert.equal(d.details.interno, true); assert.equal(d.details.expected, undefined);
  assert.equal(desarrollo.renderResult(d, {}, theme).text, "(la pregunta vuelve después de la explicación)");
  const diag = await desarrollo.execute("d1", { ...pregunta, momento: "diagnostico" }, undefined, () => {}, { ...ui(["enter", "tab", "enter", "enter"]), sessionManager: { getBranch: () => sinTexto } });
  assert.equal(diag.details.dontKnow, true);
});

// md-log: la nota de Obsidian anota la pregunta y, recién con la respuesta, la esperada.
test("md-log anota la pregunta de desarrollo en vivo y al rellenar, con la esperada sólo después de responder", async t => {
  const dir = mkdtempSync(join(tmpdir(), "pi-md-desarrollo-")), file = join(dir, "nota.md");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(file, "");
  const handlers = new Map(), bus = new Map(), entradas = [];
  const pi = { on: (n, h) => handlers.set(n, h), events: { on: (n, h) => bus.set(n, h), emit: () => {} }, registerCommand: () => {}, appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }) };
  const ctx = { cwd: dir, hasUI: false, isIdle: () => true, sessionManager: { getBranch: () => entradas }, ui: { setStatus: () => {}, notify: () => {} } };
  mdLog(pi);
  await handlers.get("session_start")({}, ctx);
  await new Promise(r => bus.get("md-log:link")({ file, backfill: false, onComplete: r }));
  const details = { tipo: "desarrollo", question: "¿Por qué no depende de L?", context: "Con d = 2 km.", clase: "La propagación depende de la distancia." };
  await handlers.get("tool_execution_update")({ toolName: "pregunta_desarrollo", toolCallId: "d1", args: pregunta, partialResult: { details } }, ctx);
  const antes = readFileSync(file, "utf8");
  assert.match(antes, /> \[!abstract\] PI\n\nLa propagación depende de la distancia\.\n\n> \[!question\] Desarrollo\n> ¿Por qué no depende de L\?\n>\n> Con d = 2 km\./);
  assert.doesNotMatch(antes, /velocidad del medio|Respuesta esperada/);
  const respondida = { ...details, status: "answered", answer: "por la distancia\ny la velocidad", dontKnow: false, expected: pregunta.respuesta_esperada };
  await handlers.get("tool_result")({ toolName: "pregunta_desarrollo", toolCallId: "d1", details: respondida }, ctx);
  const nota = readFileSync(file, "utf8");
  assert.match(nota, /> \[!example\] Desarrollo — tu respuesta\n> por la distancia\n> y la velocidad\n>\n> Respuesta esperada:\n> Porque \$d_\{prop\}/);
  // Rellenar desde la rama da lo mismo; una descartada nunca se mostró y no se anota.
  entradas.push({ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "d1", name: "pregunta_desarrollo", arguments: pregunta }] } },
    { type: "message", message: { role: "toolResult", toolCallId: "d1", toolName: "pregunta_desarrollo", details: respondida } },
    { type: "message", message: { role: "toolResult", toolCallId: "d2", toolName: "pregunta_desarrollo", details: { status: "unavailable", tipo: "desarrollo", question: "", message: "descartada" } } },
    { type: "message", message: { role: "toolResult", toolCallId: "d3", toolName: "pregunta_desarrollo", details: { ...details, status: "answered", dontKnow: true, expected: "Algo" } } });
  writeFileSync(file, "");
  await new Promise(r => bus.get("md-log:link")({ file, onComplete: r }));
  const relleno = readFileSync(file, "utf8");
  assert.match(relleno, /> \[!question\] Desarrollo\n> ¿Por qué no depende de L\?[\s\S]*> \[!example\] Desarrollo — tu respuesta/);
  assert.match(relleno, /> \[!question\] Desarrollo — No sé\n> Tu respuesta: No sé\n>\n> Respuesta esperada:\n> Algo/);
  assert.doesNotMatch(relleno, /descartada/);
});
