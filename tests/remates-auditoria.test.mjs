import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { getEventListeners } from "node:events";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import mdLog from "../extensions/md-log.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { loadProject, piDir } from "../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "../extensions/curso/ingesta.ts";
import { registrarPreparacion } from "../extensions/curso/preparacion.ts";
import { guardarCurso } from "../extensions/curso/curacion.ts";

// Remates de integración: md-log, sesión y progreso reales sobre un bus de eventos, backend Python real, sin modelos.
async function clase(t, anterior = false) {
  const vault = mkdtempSync(join(tmpdir(), "pi-remates-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  for (const p of [join(recursos, "skills/teach"), join(raiz, "sesiones")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(raiz, "indice.yaml"), "documentos: []\ntemas:\n- {id: derivacion}\n"); writeFileSync(join(raiz, "progreso.yaml"), "version: 1\ntemas: {}\nhistorial: []\n");
  if (anterior) writeFileSync(join(raiz, "sesiones/2026-01-01-derivacion.md"), "> [!quote] VOS\n\nCreo que es la regla de la cadena.\n");
  const d = { curso: "ejemplo", nombre: "Ejemplo", contrato: "Contrato", documentos: [], temas: [{ id: "derivacion", nombre: "Derivación", unidad: 1, alias: [], objetivos: [], prerequisitos: [] }], items: {}, progreso: { temas: {}, historial: [] }, avisos: [] };
  const handlers = new Map(), bus = new Map(), comandos = new Map(), entradas = [], avisos = [], ordenes = [], selects = [];
  const pi = { d, on: (n, h) => handlers.set(n, [...(handlers.get(n) || []), h]), registerCommand: (n, c) => comandos.set(n, c), registerTool: () => {},
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {}, sendMessage: m => ordenes.push(m.content),
    getAllTools: () => [], getActiveTools: () => [], setActiveTools: () => {}, exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "", killed: false }),
    events: { on: (n, h) => bus.set(n, [...(bus.get(n) || []), h]), emit: (n, p) => { for (const h of bus.get(n) || []) h(p); } } };
  const ctx = { cwd: vault, hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "prueba" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: () => {}, select: async (titulo, opciones) => (selects.push([titulo, opciones]), opciones[0]), confirm: assert.fail } };
  mdLog(pi);
  const sesion = registrarSesion(pi, vault, recursos), progreso = registrarProgreso(pi, sesion, vault);
  const emitir = async (n, ev = {}) => { for (const h of handlers.get(n) || []) await h(ev, ctx); };
  await emitir("session_start", { type: "session_start", reason: "startup" });
  await comandos.get("estudiar").handler("ejemplo derivacion", ctx);
  const final = async texto => { const message = { role: "assistant", stopReason: "stop", content: [{ type: "text", text: texto }] }; await emitir("message_end", { message }); entradas.push({ type: "message", message }); };
  const guardar = extra => progreso.registrar("prueba", { resumen: "Probe", borde: { domina: ["Derivar un polinomio"] }, ...extra }, undefined, undefined, ctx);
  return { vault, raiz, pi, ctx, comandos, entradas, avisos, ordenes, selects, sesion, progreso, emitir, final, guardar };
}
const historial = e => readFileSync(join(e.raiz, "progreso.yaml"), "utf8").match(/log: .*/g);

// progreso.py ata el historial al nombre AAAA-MM-DD-<tema>[-N].md (fecha y orden de H29): el curso conserva ese nombre y md-log sigue la nota por inode.
test("H04: con la nota renombrada en Obsidian, /fin guarda con el nombre de la sesión, escribe en la nota movida y cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Clase renombrada.md";
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Pregunta 1.");
  await e.comandos.get("fin").handler("", e.ctx);
  const r = await e.guardar({ cierre: true });
  assert.match(r.content[0].text, /se renombró o movió en Obsidian/);
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.deepEqual(historial(e), [`log: ${log.slice("cursos/ejemplo/".length)}`]);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Pregunta 1\.[\s\S]*Resumen final\./);
  assert.ok(!existsSync(join(e.raiz, ".sesion-activa.json")));
  assert.deepEqual(e.avisos, [["info", "Sesión cerrada. El log se conserva en Obsidian."]]);
});

test("H04: si el renombre se nota recién con el mensaje final, igual cierra", async t => {
  const e = await clase(t), log = e.sesion.actual().a.log, nueva = "cursos/ejemplo/sesiones/Movida.md";
  await e.comandos.get("fin").handler("", e.ctx);
  await e.guardar({ cierre: true });
  renameSync(join(e.vault, log), join(e.vault, nueva));
  await e.final("Resumen final.");
  await e.emitir("agent_settled", {});
  assert.equal(e.sesion.actual(), undefined);
  assert.match(readFileSync(join(e.vault, nueva), "utf8"), /Resumen final\./);
});

test("H26/H25: cortar el turno (/fin, /estudiar) cierra un quiz o una pregunta abiertos sin Esc", async () => {
  const p = await loadProject();
  const theme = { fg: (_c, s) => s, bg: (_c, s) => s, bold: s => s, italic: s => s, underline: s => s, strikethrough: s => s };
  const tui = { requestRender() {}, terminal: { rows: 40, columns: 100 } };
  const quiz = { question: "¿Qué retardo depende de la distancia?", options: [{ label: "Propagación", value: "prop" }, { label: "Transmisión", value: "trans" }, { label: "Cola", value: "cola" }], correctAnswer: "prop", explanation: "d/s" };
  const ask = { question: "¿Seguimos?", options: [{ label: "Sí" }, { label: "Más tarde" }] };
  try {
    for (const [nombre, args] of [["quiz", quiz], ["quiz", { ...quiz, multiSelect: true, correctAnswer: ["prop"] }], ["ask_user_question", ask], ["ask_user_question", { ...ask, multiSelect: true }]]) {
      for (const antes of [false, true]) {
        // antes: el corte llegó mientras esperaba el turno de otro popup.
        const corte = new AbortController(), tool = p.session.extensionRunner.getToolDefinition(nombre);
        const ctx = { hasUI: true, ui: { custom: factory => new Promise(res => { if (antes) corte.abort(); factory(tui, theme, {}, res); setTimeout(() => corte.abort(), 10); }) } };
        const r = await Promise.race([tool.execute("x", args, corte.signal, () => {}, ctx), new Promise(res => setTimeout(() => res({ details: { status: "abierto" } }), 1500))]);
        assert.equal(r.details.status, "cancelled", `${nombre} ${JSON.stringify(args.multiSelect ?? false)} ${antes}`);
      }
    }
    // El signal dura toda la corrida: los popups respondidos no le dejan listeners (Node avisa desde 11, y el aviso ensucia la terminal).
    const corrida = new AbortController(), quizTool = p.session.extensionRunner.getToolDefinition("quiz");
    const responder = { hasUI: true, ui: { custom: factory => new Promise(res => { const c = factory(tui, theme, {}, r => { c.dispose?.(); res(r); }); c.handleInput("\r"); c.handleInput("\r"); }) } };
    for (let i = 0; i < 12; i++) assert.notEqual((await quizTool.execute("q", quiz, corrida.signal, () => {}, responder)).details.status, "cancelled");
    assert.equal(getEventListeners(corrida.signal, "abort").length, 0);
  } finally { await p.close(); }
});

test("H45: las confirmaciones se dibujan en español y Esc o un corte valen como no", async t => {
  const vistas = [], si = respuesta => async (titulo, opciones) => (vistas.push([titulo.split("\n")[0], opciones]), respuesta === "si" ? opciones[0] : respuesta);
  // Reconstrucción del progreso (la ve el alumno en clase).
  const e = await clase(t, true), { r } = e.sesion.actual();
  const leido = await e.progreso.leerAnterior(), huella = leido.content[0].text.match(/SHA-256: (\w+)/)[1];
  const reconstruir = () => e.guardar({ reconstruir_log: e.sesion.actual().pendiente, huella_log: huella });
  e.ctx.ui.select = si(undefined);
  await assert.rejects(reconstruir, /Reconstrucción sin confirmar/);
  e.ctx.ui.select = si("si");
  assert.equal((await reconstruir()).details.guardado, true);
  // /md-log sobre una nota con contenido.
  const nota = join(r, "sesiones/otra.md"); writeFileSync(nota, "contenido previo");
  e.ctx.ui.select = si(undefined);
  await e.comandos.get("md-log").handler(nota, e.ctx);
  assert.equal(readFileSync(nota, "utf8"), "contenido previo");
  // Tanda de visión sobre el límite y guardado de un curso existente.
  const modelRegistry = { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true };
  const tanda = await transcribir({ hasUI: true, modelRegistry, ui: { select: si("No") } }, { vault: e.vault, salida: r, doc: "libro", paginas: [1, 2] }, { modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 });
  assert.equal(tanda.resumen.cancelada, true);
  const pi = { exec: async () => ({ code: 0, killed: false, stderr: "", stdout: JSON.stringify({ diff: "+Un tema", copias: [], nuevo: false }) }), sendMessage: () => {} };
  assert.equal((await guardarCurso(pi, { curso: "ejemplo", propuesta: "_procesado/propuesta.json" }, { hasUI: true, ui: { select: si(undefined) } })).details.cancelada, true);
  assert.deepEqual(vistas, [["Reconstruir el progreso de la clase anterior", ["Sí, guardar la reconstrucción", "No"]], ["Reconstruir el progreso de la clase anterior", ["Sí, guardar la reconstrucción", "No"]],
    ["Reemplazar nota con el historial", ["Sí, reemplazar la nota", "No"]], ["Confirmar gasto de visión", ["Sí, transcribir", "No"]], ["Guardar cambios del curso", ["Sí, guardar los cambios", "No"]]]);
});

test("H45: sin el venv, las operaciones locales fallan en español y remiten al doctor", async t => {
  const real = childProcess.spawn;
  mock.method(childProcess, "spawn", (_programa, args, opciones) => real("/no/existe/python", args, opciones)); syncBuiltinESMExports();
  t.after(() => { mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(() => python("trabajo", {}, undefined, "preparacion.py"), { message: "Falta el entorno de ingesta (Python): corré .pi/scripts/doctor." });
});

test("textos: la copia muestra el error limpio de Python y la nota se nombra en palabras del alumno", async t => {
  const e = await clase(t);
  e.pi.exec = async () => ({ code: 1, killed: false, stdout: "", stderr: "Disco lleno: no se pudo preparar el material; liberá espacio y reintentá.\n" });
  e.avisos.length = 0;
  await e.comandos.get("estudiar").handler("ejemplo derivacion", e.ctx);
  assert.deepEqual(e.avisos.filter(([, m]) => /Material/.test(m)), [["warning", "Material desde la última carga. Disco lleno: no se pudo preparar el material; liberá espacio y reintentá."]]);
  assert.equal(e.sesion.actual().pendiente, undefined);
  // Otra nota vinculada a mano durante la clase: el cierre no se confirma y se dice sin nombrar componentes.
  const otra = join(e.raiz, "sesiones/otra.md"); writeFileSync(otra, "");
  await e.comandos.get("md-log").handler(otra, e.ctx);
  await e.comandos.get("fin").handler("", e.ctx);
  await e.guardar({ cierre: true });
  await e.final("Resumen final.");
  e.avisos.length = 0;
  await e.emitir("agent_settled", {});
  assert.deepEqual(e.avisos, [["warning", "No se pudo cerrar la nota de la clase en Obsidian; la clase sigue abierta: repetí /fin."]]);
  assert.ok(e.sesion.actual());
});

// Preparación por tema con la ingesta base real y un modelo simulado (como preparacion-auditoria): libro, parcial y práctico.
const CURSO = `from pathlib import Path
import sys, yaml, pymupdf
from test_ingesta import crear_pdf
from pipeline import ejecutar
v = Path(sys.argv[1]); raiz = v / "cursos/ejemplo"
for tipo in ["bibliografia", "evaluaciones", "ejercicios"]:
    (raiz / f"fuentes/{tipo}").mkdir(parents=True)
crear_pdf(raiz / "fuentes/bibliografia/libro.pdf")
for tipo, doc, texto in [("evaluaciones", "parcial", "Pregunta 1 (8 puntos) Calcule la derivada."), ("ejercicios", "practico", "Ejercicio 1. Derive la composición de funciones.")]:
    with pymupdf.open() as pdf:
        pdf.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 100, 450, 400), texto, fontsize=12)
        pdf.save(raiz / f"fuentes/{tipo}/{doc}.pdf")
docs = [{"id": "libro", "titulo": "Libro", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/libro.pdf", "paginas": 3, "prioridad": "principal"},
        {"id": "parcial", "titulo": "Parcial", "tipo": "evaluaciones", "archivo": "fuentes/evaluaciones/parcial.pdf", "paginas": 1},
        {"id": "practico", "titulo": "Práctico", "tipo": "ejercicios", "archivo": "fuentes/ejercicios/practico.pdf", "paginas": 1}]
tema = {"id": "derivacion", "nombre": "Derivación", "unidad": 1, "alias": [], "prerequisitos": [], "objetivos": ["O1.1"], "bibliografia": [{"doc": "libro", "seccion": "Derivadas", "paginas": [1, 2]}], "ejercicios": [], "evaluaciones": []}
(raiz / "indice.yaml").write_text(yaml.safe_dump({"version": 1, "documentos": docs, "temas": [tema]}, allow_unicode=True))
(raiz / "curso.md").write_text("---\\nnombre: Ejemplo\\nslug: ejemplo\\n---\\n# Objetivos\\n- O1.1: Derivar.\\n")
(raiz / "progreso.yaml").write_text("version: 1\\ntemas: {}\\nhistorial: []\\n")
ejecutar({"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
          "documentos": [{**d, "archivo": f"cursos/ejemplo/{d['archivo']}", "paginas": list(range(1, d["paginas"] + 1))} for d in docs]}, v, raiz / "_procesado")`;
const USO = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const respuesta = (texto, extra = {}) => ({ stopReason: "stop", content: texto ? [{ type: "text", text: texto }] : [], usage: structuredClone(USO), ...extra });
function preparacion(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-remates-prep-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const r = spawnSync(join(piDir, ".venv/bin/python"), ["-c", CURSO, vault], { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta"), PYTHONDONTWRITEBYTECODE: "1" }, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  mkdirSync(recursos);
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 }));
  const d = JSON.parse(spawnSync(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", "ejemplo"], { encoding: "utf8" }).stdout);
  const e = { activo: { a: { curso: "ejemplo", tema: "derivacion", log: "cursos/ejemplo/sesiones/1.md" }, d, r: raiz }, avisos: [], llamadas: [], eventos: new Map(), guion: {}, raiz };
  const pi = { on: (n, h) => e.eventos.set(n, h), sendMessage: () => {} };
  const ctx = { hasUI: true, ui: { setStatus: () => {}, notify: (m, tipo) => e.avisos.push([tipo, m]) },
    modelRegistry: { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true, getProviderAuth: async () => undefined,
      streamSimple: (_modelo, contexto) => ({ result: async () => {
        const pedido = contexto.messages[0].content, texto = pedido.map(b => b.text || "").join("");
        const tipo = pedido.some(b => b.type === "image") ? "vision" : contexto.systemPrompt.startsWith("Segmentás") ? "segmentar" : "clasificar";
        e.llamadas.push(tipo);
        const guionada = e.guion[tipo]?.(texto);
        if (guionada) return guionada;
        if (tipo === "vision") return respuesta("El ejercicio pide derivar una función compuesta y justificar cada paso del procedimiento. ".repeat(3));
        if (tipo === "segmentar") return respuesta(JSON.stringify({ items: [{ id: "1", paginas: [1], enunciado: texto.includes("Documento parcial") ? "Calcule la derivada." : "Derive la composición." }] }));
        const { items } = JSON.parse(texto.slice(0, texto.lastIndexOf("}") + 1));
        return respuesta(JSON.stringify({ asignaciones: items.map(i => ({ doc: i.doc, id: i.id, tema: "derivacion" })) }));
      } }) } };
  const prep = registrarPreparacion(pi, { actual: () => e.activo, refrescar: () => "" }, vault, recursos);
  let n = 0;
  e.turno = async () => { e.activo.a.log = `cursos/ejemplo/sesiones/${++n}.md`; await e.eventos.get("before_agent_start")({}, ctx); await prep.ultima(); };
  e.json = f => JSON.parse(readFileSync(join(raiz, "_procesado", f), "utf8"));
  return e;
}

test("preparación (a): una segmentación que falla siempre no gasta llamadas en cada /estudiar hasta mañana o hasta que cambien sus entradas", async t => {
  const e = preparacion(t);
  e.guion.segmentar = texto => texto.includes("Documento parcial") && respuesta("No encontré ítems.");
  await e.turno();
  assert.equal(e.llamadas.filter(x => x === "segmentar").length, 3);
  assert.deepEqual(e.avisos, [["warning", "Material de Derivación preparado en parte: 4 páginas transcriptas, 1 ítem nuevo; no se pudieron separar los ítems de parcial (la respuesta no es JSON válido), se reintenta mañana o si cambia el material."]]);
  e.llamadas.length = 0;
  await e.turno();
  assert.deepEqual([e.llamadas, e.avisos.length, e.json("preparacion.json").temas.derivacion.estado], [[], 1, "incompleta"]);
  // Un día después se reintenta una vez más (2 llamadas) y vuelve a esperar.
  const prep = e.json("preparacion.json"); prep.fallos["segmentar/parcial"].fecha = "2000-01-01T00:00:00+00:00";
  writeFileSync(join(e.raiz, "_procesado/preparacion.json"), JSON.stringify(prep));
  await e.turno(); await e.turno();
  assert.deepEqual(e.llamadas, ["segmentar", "segmentar"]);
  // El mismo día, si cambian sus entradas (el índice usa un id de ese parcial), también.
  e.llamadas.length = 0; delete e.guion.segmentar;
  writeFileSync(join(e.raiz, "indice.yaml"), readFileSync(join(e.raiz, "indice.yaml"), "utf8").replace("evaluaciones: []", "evaluaciones: [{doc: parcial, items: ['1']}]"));
  await e.turno();
  assert.deepEqual(e.llamadas, ["segmentar"]);
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "completa");
});

test("preparación (b, c): red, cuota o credenciales cortan la tanda en la primera falla; un plazo vencido se dice en español", async t => {
  const e = preparacion(t);
  e.guion.vision = () => respuesta("", { stopReason: "error", errorMessage: "429 Too Many Requests: You have hit your usage limit" });
  await e.turno();
  assert.deepEqual(e.llamadas, ["vision"]);
  assert.deepEqual(e.avisos, [["warning", "Preparación del material no disponible: el proveedor rechazó el pedido por cuota o límite de uso; esperá o cambiá de modelo con /model; seguimos con lo que hay."]]);
  const f = preparacion(t);
  f.guion.segmentar = () => respuesta("", { stopReason: "error", errorMessage: "fetch failed" });
  await f.turno();
  assert.deepEqual(f.llamadas.filter(x => x !== "vision"), ["segmentar"]);
  assert.deepEqual(f.avisos, [["warning", "Preparación del material no disponible: sin conexión con el proveedor del modelo; revisá la red; seguimos con lo que hay."]]);
  assert.ok(!existsSync(join(f.raiz, "_procesado/preparacion.json")) || !f.json("preparacion.json").fallos, "una falla de red no deja el documento en espera");
  const g = preparacion(t);
  g.guion.segmentar = texto => texto.includes("Documento parcial") && respuesta("", { stopReason: "aborted", errorMessage: "Request was aborted" });
  await g.turno();
  assert.equal(g.avisos.length, 1);
  assert.match(g.avisos[0][1], /no se pudieron separar los ítems de parcial \(el modelo no respondió en 5 minutos\)/);
  assert.doesNotMatch(g.avisos[0][1], /Request was aborted/);
});

test("preparación (e, f): sólo se borra el lock propio y un pid reutilizado tras reiniciar no lo retiene", async t => {
  const e = preparacion(t), lock = join(e.raiz, "_procesado/.preparacion.lock");
  // El pid vive (este proceso) pero el lock es de otro arranque.
  writeFileSync(lock, JSON.stringify({ pid: process.pid, inicio: Date.now(), proceso: "otro-arranque:123" }));
  const ajeno = JSON.stringify({ pid: process.pid, inicio: Date.now(), proceso: "otra-instancia" });
  // A mitad de la tanda, otra instancia (tras /reload) toma el lock: el finally viejo no lo borra.
  e.guion.vision = () => { if (e.llamadas.length === 1) writeFileSync(lock, ajeno); };
  await e.turno();
  assert.equal(e.llamadas.filter(x => x === "vision").length, 4);
  assert.equal(readFileSync(lock, "utf8"), ajeno);
});
