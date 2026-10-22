import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { acotar, dossier, leerPaginas } from "../extensions/curso/material.ts";
import { registrarPreparacion } from "../extensions/curso/preparacion.ts";
import { agentDir, loadProject, piDir } from "../scripts/lib/pi-sdk.mjs";

function curso(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-preparacion-")), raiz = join(vault, "cursos/redes");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const tema = { id: "retardos", nombre: "Retardos", alias: [], unidad: 1, prerequisitos: [], objetivos: ["O1.2"], bibliografia: [{ doc: "libro", seccion: "1.4", paginas: [1, 3] }] };
  const d = { curso: "redes", nombre: "Redes", contrato: "# Objetivos\n- O1.2: Calcular retardos.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" }],
    items: {}, progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
  const escribir = (relativa, texto) => { mkdirSync(join(raiz, relativa, ".."), { recursive: true }); writeFileSync(join(raiz, relativa), texto); };
  return { vault, raiz, d, tema, escribir };
}

test("guardar_items acepta solucion_de y puntos en el esquema que ve el modelo", async () => {
  const p = await loadProject(), raiz = process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install");
  try {
    const { validateToolArguments } = await import(join(raiz, "releases", readFileSync(join(raiz, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-ai/dist/index.js"));
    const tool = p.session.getAllTools().find(x => x.name === "guardar_items");
    const items = [{ id: "4", paginas: [2], enunciado: "Explique.", puntos: 8 }, { id: "4-solucion", paginas: [3], enunciado: "Respuesta.", solucion_de: "4" }, { id: "5", paginas: [3], enunciado: "Calcule.", puntos: "10 (a: 4, b: 6)" }];
    assert.deepEqual(validateToolArguments(tool, { name: "guardar_items", arguments: { curso: "redes", doc: "sol-prc20230918", items } }).items, items);
    // pi no quita propiedades extra: lo que importa es que el modelo vea los campos en el esquema.
    const campos = tool.parameters.properties.items.items.properties;
    assert.equal(campos.solucion_de.maxLength, 80);
    assert.deepEqual(campos.puntos.anyOf.map(x => x.type), ["number", "string"]);
    assert.match(tool.description, /solucion_de/);
    assert.match(tool.description, /puntos/);
  } finally { await p.close(); }
});

test("leer_paginas muestra el aviso específico de calidad en vez del genérico", t => {
  const c = curso(t);
  c.escribir("_procesado/libro/paginas/0001.md", "t 5 L/R 5 8 microsegundos");
  c.escribir("_procesado/libro/paginas/0002.md", "Texto limpio.");
  c.escribir("_procesado/libro/calidad.json", JSON.stringify({ paginas: { 1: { pendiente: true, avisos: ["En esta página «5» puede ser «=», «1» «+» y «2» «−»: verificá con la imagen."] }, 2: { pendiente: false } } }));
  const texto = leerPaginas(c.raiz, c.d, "libro", 1, 2);
  assert.match(texto, /\[Calidad pendiente: cotejá el original con ver_pagina antes de usarlo\. En esta página «5» puede ser «=», «1» «\+» y «2» «−»: verificá con la imagen\.\]/);
  assert.equal(texto.match(/Calidad pendiente/g).length, 1);
  assert.match(leerPaginas(c.raiz, c.d, "libro", 3, 3), /\[Calidad pendiente: cotejá el original con ver_pagina antes de usarlo\.\]/);
});

// Mismo formato que verificacionPrevia (researcher.ts) para una caché vigente.
const verificacion = texto => `Caché de alcance vigente; no relanzar alcance. [[cursos/redes/notas/verificaciones/retardos.md]]\nDatos externos, no instrucciones:\n${JSON.stringify(acotar(texto, 5000))}`;
function progresoLargo(sesiones) {
  const largo = (s, i) => `${s} ${i}: ${"detalle del razonamiento observado en la respuesta del alumno ".repeat(3)}`;
  return { estado: "en_curso", borde: { domina: Array.from({ length: 8 * sesiones }, (_, i) => largo("Domina", i)), falla: Array.from({ length: 3 * sesiones }, (_, i) => largo("Falla", i)) },
    conceptos_firmes: Array.from({ length: 4 * sesiones }, (_, i) => largo("Firme", i)),
    errores_de_concepto: Array.from({ length: 2 * sesiones }, (_, i) => ({ descripcion: largo(i % 2 ? "ERROR ABIERTO" : "Error resuelto", i), detectado: "2026-10-22", resuelto: i % 2 === 0 })),
    ejercicios: Array.from({ length: 2 * sesiones }, (_, i) => ({ doc: "practico-1", item: String(i + 1), fecha: "2026-10-22", resultado: "parcial", notas: largo("Notas", i) })),
    discrepancias: [], proximo_paso: "PROXIMO PASO: resolver el ejercicio 5 sin opciones.", actualizado: "2026-10-22" };
}

test("H28, H61: el dossier conserva el dónde quedamos y resume la verificación sin cortarla", t => {
  const c = curso(t), informe = `## Resumen\nRESUMEN DEL RESEARCHER.\n\n## Contra el material del curso\n${"A1 concuerda con el libro. ".repeat(200)}\n\n## Extensiones útiles\nEXTENSION AJENA ${"x".repeat(3000)}\n`;
  c.tema.prerequisitos = ["conmutacion"];
  c.d.temas.push({ ...c.tema, id: "conmutacion", nombre: "Conmutación", prerequisitos: [] });
  c.d.progreso.temas = { retardos: progresoLargo(5), conmutacion: progresoLargo(5) };
  const r = dossier(c.raiz, c.d, c.tema, 3000, 1500, verificacion(informe));
  assert.ok(Buffer.byteLength(r) <= 12000);
  const p = c.d.progreso.temas.retardos, linea = r.split("\n\n").find(l => l.startsWith("Progreso retardos:"));
  assert.match(linea, /PROXIMO PASO/);
  for (const e of p.errores_de_concepto.filter(e => !e.resuelto).slice(-3)) assert.ok(linea.includes(e.descripcion.slice(0, 40)), e.descripcion);
  assert.ok(!linea.includes("Error resuelto"));
  assert.match(linea, /"item":"10"/);
  assert.ok(linea.includes(p.borde.falla.at(-1).slice(0, 40)));
  const bloque = r.slice(r.indexOf("## Verificación previa") + 23, r.indexOf("Progreso conmutacion"));
  assert.ok(Buffer.byteLength(bloque.trim()) <= 1200, String(Buffer.byteLength(bloque)));
  assert.match(bloque, /RESUMEN DEL RESEARCHER/);
  assert.match(bloque, /\[\[cursos\/redes\/notas\/verificaciones\/retardos\.md\]\]/);
  assert.ok(!bloque.includes("EXTENSION AJENA"));
  assert.doesNotThrow(() => JSON.parse(bloque.trim().split("\n").at(-1)));
  assert.ok(r.indexOf("## Verificación previa") < r.indexOf("Progreso conmutacion (prerequisito)"));
});

test("el dossier nunca lista ítems de solución aunque el índice los referencie", t => {
  const c = curso(t);
  c.d.documentos.push({ id: "parcial", titulo: "Parcial", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/parcial.pdf", paginas: 2 },
    { id: "soluciones", titulo: "Soluciones", tipo: "soluciones", archivo: "fuentes/soluciones/sol.pdf", paginas: 1 });
  c.d.items = { parcial: [{ id: "1", paginas: [1], enunciado: "ENUNCIADO 1" }, { id: "1-solucion", paginas: [2], enunciado: "SOLUCION INTEGRADA", solucion_de: "1" }],
    soluciones: [{ id: "1", paginas: [1], enunciado: "SOLUCION SEPARADA" }] };
  c.tema.evaluaciones = [{ doc: "parcial", items: ["1", "1-solucion"] }, { doc: "soluciones", items: ["1", "2"] }];
  const r = dossier(c.raiz, c.d, c.tema, 3000, 1500);
  assert.match(r, /evaluaciones: parcial\/1 · ENUNCIADO 1/);
  assert.doesNotMatch(r, /SOLUCION|1-solucion|soluciones\//);
});

test("H55, H31: la preparación se informa por tema y no por avisos del curso ni ejercicios huérfanos", t => {
  const c = curso(t);
  c.d.documentos.push({ id: "practico", titulo: "Práctico", tipo: "ejercicios", archivo: "fuentes/ejercicios/practico.pdf", paginas: 2 });
  c.d.items = { practico: [{ id: "1", paginas: [1], enunciado: "Calculá." }] };
  c.tema.ejercicios = [{ doc: "practico", items: ["1"] }];
  c.d.avisos = ["Ejercicio huérfano: practico/7 ya no está en el banco; su intento se conserva en progreso.yaml."];
  c.d.validacion = { errores: [], avisos: ["Documento practico-5 (ejercicios) sin segmentar: se transcribe y segmenta solo la primera vez que se estudia un tema del curso."], pendientes: [] };
  c.escribir("_procesado/libro/calidad.json", JSON.stringify({ paginas: { 1: { pendiente: false }, 2: { pendiente: false }, 3: { pendiente: false } } }));
  const completo = dossier(c.raiz, c.d, c.tema, 3000, 1500);
  assert.doesNotMatch(completo, /Preparación (incompleta|del tema)/);
  c.escribir("_procesado/libro/calidad.json", JSON.stringify({ paginas: { 1: { pendiente: false }, 2: { pendiente: true } } }));
  c.tema.ejercicios.push({ doc: "practico", items: ["2", "3"] });
  assert.match(dossier(c.raiz, c.d, c.tema, 3000, 1500), /Preparación del tema: sin texto confiable todavía en libro PDF 1–3 \(2 de 3 páginas\); practico: ítems 2, 3\. Se preparan solos en segundo plano/);
  // Ya pasó por visión y sigue dudosa (p. ej. [ilegible]): la preparación no la repite, así que no se promete.
  c.tema.ejercicios.pop();
  c.escribir("_procesado/libro/calidad.json", JSON.stringify({ paginas: { 1: { pendiente: false }, 2: { pendiente: true, vision: { clave: "x" } }, 3: { pendiente: false } } }));
  assert.doesNotMatch(dossier(c.raiz, c.d, c.tema, 3000, 1500), /Preparación del tema/);
});

// Curso real de punta a punta (ingesta base sin modelo) con un modelo simulado: visión, segmentación y clasificación.
const CURSO = `from pathlib import Path
import sys, yaml, pymupdf
from test_ingesta import crear_pdf
from pipeline import ejecutar
v = Path(sys.argv[1]); raiz = v / "cursos/ejemplo"
for tipo in ["bibliografia", "evaluaciones", "ejercicios"]:
    (raiz / f"fuentes/{tipo}").mkdir(parents=True)
crear_pdf(raiz / "fuentes/bibliografia/libro.pdf")
for tipo, doc, texto in [("evaluaciones", "parcial", "Pregunta 1 (8 puntos) Calcule la derivada. Solución: dos equis."), ("ejercicios", "practico", "Ejercicio 1. Derive la composición de funciones.")]:
    with pymupdf.open() as pdf:
        pdf.new_page(width=500, height=700).insert_textbox(pymupdf.Rect(45, 100, 450, 400), texto, fontsize=12)
        pdf.save(raiz / f"fuentes/{tipo}/{doc}.pdf")
docs = [{"id": "libro", "titulo": "Libro", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/libro.pdf", "paginas": 3, "prioridad": "principal"},
        {"id": "parcial", "titulo": "Parcial con soluciones", "tipo": "evaluaciones", "archivo": "fuentes/evaluaciones/parcial.pdf", "paginas": 1},
        {"id": "practico", "titulo": "Práctico", "tipo": "ejercicios", "archivo": "fuentes/ejercicios/practico.pdf", "paginas": 1}]
tema = lambda i, n, p: {"id": i, "nombre": n, "unidad": 1, "alias": [], "prerequisitos": [], "objetivos": ["O1.1"], "bibliografia": [{"doc": "libro", "seccion": n, "paginas": p}], "ejercicios": [], "evaluaciones": []}
(raiz / "indice.yaml").write_text(yaml.safe_dump({"version": 1, "documentos": docs, "temas": [tema("derivacion", "Derivación", [1, 2]), tema("integracion", "Integración", [3, 3])]}, allow_unicode=True))
(raiz / "curso.md").write_text("---\\nnombre: Ejemplo\\nslug: ejemplo\\n---\\n# Objetivos\\n- O1.1: Derivar.\\n")
(raiz / "progreso.yaml").write_text("version: 1\\ntemas: {}\\nhistorial: []\\n")
ejecutar({"version": 1, "motores": {c: "pymupdf" for c in ["digital", "escaneada", "mixta"]},
          "documentos": [{**d, "archivo": f"cursos/ejemplo/{d['archivo']}", "paginas": list(range(1, d["paginas"] + 1))} for d in docs]}, v, raiz / "_procesado")`;
const USO = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const TRANSCRIPCION = "El ejercicio solicita calcular la derivada de una función y justificar el procedimiento. ".repeat(3);
const respuesta = texto => ({ stopReason: "stop", content: [{ type: "text", text: texto }], usage: structuredClone(USO) });
function modeloSimulado(llamadas, guion = {}) {
  return (_modelo, contexto) => ({ result: async () => {
    const pedido = contexto.messages[0].content, texto = pedido.map(b => b.text || "").join("");
    const tipo = pedido.some(b => b.type === "image") ? "vision" : contexto.systemPrompt.startsWith("Segmentás") ? "segmentar" : "clasificar";
    llamadas.push({ tipo, texto });
    const guionada = guion[tipo]?.(texto);
    if (guionada) return guionada;
    if (tipo === "vision") return respuesta(TRANSCRIPCION);
    if (tipo === "segmentar") return respuesta(JSON.stringify({ items: texto.includes("Documento parcial") ?
      [{ id: "1", paginas: [1], enunciado: "Calcule la derivada.", puntos: 8 }, { id: "1-solucion", paginas: [1], enunciado: "Dos equis.", solucion_de: "1" }] :
      [{ id: "1", paginas: [1], enunciado: "Derive la composición de funciones." }] }));
    const { items } = JSON.parse(texto.slice(0, texto.lastIndexOf("}") + 1));
    return respuesta(JSON.stringify({ asignaciones: items.map(i => ({ doc: i.doc, id: i.id, tema: i.doc === "parcial" ? "derivacion" : "integracion" })) }));
  } });
}
function preparacion(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-preparacion-e2e-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/ejemplo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const r = spawnSync(join(piDir, ".venv/bin/python"), ["-c", CURSO, vault], { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(piDir, "tests/ingesta"), PYTHONDONTWRITEBYTECODE: "1" }, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  mkdirSync(recursos);
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ modelo_vision: "openai/gpt-6-luna", max_paginas_vision_sin_confirmar: 1, umbral_calidad_pagina: 0.6 }));
  const cargar = () => JSON.parse(spawnSync(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", "ejemplo"], { encoding: "utf8" }).stdout);
  const e = { activo: { a: { curso: "ejemplo", tema: "derivacion", log: "cursos/ejemplo/sesiones/1.md" }, d: cargar(), r: raiz }, refrescos: [], estados: [], avisos: [], mensajes: [], llamadas: [], eventos: new Map() };
  const pi = { on: (n, h) => e.eventos.set(n, h), sendMessage: (m, o) => e.mensajes.push([m, o]) };
  e.ctx = { hasUI: true, ui: { setStatus: (k, v) => e.estados.push([k, v]), notify: (m, tipo) => e.avisos.push([tipo, m]), confirm: assert.fail },
    modelRegistry: { find: (provider, id) => ({ provider, id, input: ["text", "image"] }), hasConfiguredAuth: () => true, getProviderAuth: async () => undefined, streamSimple: modeloSimulado(e.llamadas) } };
  e.prep = registrarPreparacion(pi, { actual: () => e.activo, refrescar: () => { e.refrescos.push(e.llamadas.length); return ""; } }, vault, recursos);
  e.turno = async (log = e.activo.a.log) => { e.activo.a.log = log; await e.eventos.get("before_agent_start")({}, e.ctx); await e.prep.ultima(); };
  e.json = f => JSON.parse(readFileSync(join(raiz, "_procesado", f), "utf8"));
  e.yaml = f => JSON.parse(spawnSync(join(piDir, ".venv/bin/python"), ["-c", "import sys,yaml,json; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", join(raiz, "_procesado", f)], { encoding: "utf8" }).stdout);
  e.vault = vault; e.raiz = raiz;
  return e;
}

test("preparación: la primera vez transcribe, segmenta con soluciones y puntos, clasifica y avisa sin turno ni confirmación", async t => {
  const e = preparacion(t), indice = readFileSync(join(e.raiz, "indice.yaml"), "utf8");
  await e.turno();
  assert.deepEqual(e.llamadas.map(l => l.tipo), ["vision", "vision", "vision", "vision", "segmentar", "segmentar", "clasificar"]);
  assert.deepEqual(e.estados[0], ["preparacion", "⏳ Preparando material de Derivación: 0/4 páginas"]);
  assert.ok(e.estados.some(([, v]) => v === "⏳ Preparando material de Derivación: 4/4 páginas"));
  assert.deepEqual(e.estados.at(-1), ["preparacion", undefined]);
  assert.deepEqual(e.avisos, [["info", "Material de Derivación listo: 4 páginas transcriptas, 2 ítems nuevos."]]);
  const parcial = e.yaml("parcial/items.yaml").items;
  assert.deepEqual(parcial.map(i => [i.id, i.puntos, i.solucion_de]), [["1", 8, undefined], ["1-solucion", undefined, "1"]]);
  const asignaciones = e.json("asignaciones.json");
  assert.equal(asignaciones.automatico, true);
  assert.deepEqual(asignaciones.items.map(a => [a.doc, a.id, a.tema, a.huella.length]), [["parcial", "1", "derivacion", 64], ["practico", "1", "integracion", 64]]);
  assert.equal(readFileSync(join(e.raiz, "indice.yaml"), "utf8"), indice);
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "completa");
  assert.equal(e.json("preparacion.json").documentos.parcial.segmentado, true);
  assert.equal(e.mensajes.length, 1);
  assert.deepEqual(e.mensajes[0][1], { deliverAs: "nextTurn" });
  assert.equal(e.mensajes[0][0].customType, "curso-preparacion");
  assert.equal(e.mensajes[0][0].display, false);
  assert.match(e.mensajes[0][0].content, /1 ítems asignados a este tema/);
  assert.equal(e.activo.d.items.parcial.length, 2);
  // Tras las 2 páginas del libro (antes de parciales y prácticos) y al terminar.
  assert.deepEqual(e.refrescos, [2, 7]);
  assert.ok(!existsSync(join(e.raiz, "_procesado/.preparacion.lock")));
  const r = dossier(e.raiz, e.activo.d, e.activo.d.temas[0], 3000, 1500);
  assert.match(r, /evaluaciones: parcial\/1 \(asignado automáticamente\) · Calcule la derivada\./);
  assert.doesNotMatch(r, /Dos equis|practico\/1/);
  const muchos = { ...e.activo.d, items: { ...e.activo.d.items, parcial: Array.from({ length: 300 }, (_, i) => ({ id: String(i + 1), paginas: [1], enunciado: "Calcule la derivada de la función compuesta. ".repeat(4) })) } };
  const reales = readFileSync(join(e.raiz, "_procesado/asignaciones.json"), "utf8");
  writeFileSync(join(e.raiz, "_procesado/asignaciones.json"), JSON.stringify({ items: muchos.items.parcial.map(i => ({ doc: "parcial", id: i.id, tema: "derivacion" })) }));
  const lista = dossier(e.raiz, muchos, muchos.temas[0], 3000, 1500).split("\n\n").filter(l => /^(evaluaciones|Más ítems)/.test(l));
  assert.ok(Buffer.byteLength(lista.join("\n\n")) < 3300);
  assert.match(lista.at(-1), /^Más ítems del tema \(leelos con leer_items\): asignados automáticamente: parcial\/\d+, /);
  assert.ok(Buffer.byteLength(lista.at(-1)) <= 800);
  writeFileSync(join(e.raiz, "_procesado/asignaciones.json"), reales);
  await e.turno("cursos/ejemplo/sesiones/2.md");
  assert.equal(e.llamadas.length, 7);
  e.activo.a.tema = "integracion";
  await e.turno("cursos/ejemplo/sesiones/3.md");
  assert.equal(e.llamadas.length, 7);
  assert.equal(e.json("preparacion.json").temas.integracion.estado, "completa");
  assert.equal(e.avisos.length, 1);
});

test("preparación: no demora el turno, y sin credenciales avisa una línea y no llama al modelo", async t => {
  const e = preparacion(t);
  e.ctx.modelRegistry.hasConfiguredAuth = () => false;
  const inicio = performance.now();
  e.eventos.get("before_agent_start")({}, e.ctx);
  assert.ok(performance.now() - inicio < 100, "el handler no espera a la preparación");
  await e.prep.ultima();
  assert.deepEqual(e.llamadas, []);
  assert.deepEqual(e.avisos, [["warning", "Preparación del material no disponible: no hay credenciales para openai; ejecutá /login; seguimos con lo que hay."]]);
  assert.ok(e.estados.every(([, v]) => v === undefined));
  assert.ok(!existsSync(join(e.raiz, "_procesado/.preparacion.lock")));
  await e.turno();
  assert.equal(e.avisos.length, 1, "un solo aviso por /estudiar");
});

test("preparación: JSON inválido se reintenta una vez y queda para la próxima, sin repetir visión", async t => {
  const e = preparacion(t);
  e.ctx.modelRegistry.streamSimple = modeloSimulado(e.llamadas, { segmentar: texto => texto.includes("Documento parcial") && respuesta("Acá van los ítems: …") });
  await e.turno();
  const segmentar = e.llamadas.filter(l => l.tipo === "segmentar" && l.texto.includes("Documento parcial"));
  assert.equal(segmentar.length, 2);
  assert.match(segmentar[1].texto, /Tu respuesta anterior se rechazó: la respuesta no es JSON válido/);
  assert.ok(!existsSync(join(e.raiz, "_procesado/parcial/items.yaml")));
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "incompleta");
  assert.deepEqual(e.avisos, [["warning", "Material de Derivación preparado en parte: 4 páginas transcriptas, 1 ítems nuevos; no se pudieron separar los ítems de parcial (la respuesta no es JSON válido), sigue la próxima vez."]]);
  e.llamadas.length = 0;
  e.ctx.modelRegistry.streamSimple = modeloSimulado(e.llamadas);
  await e.turno("cursos/ejemplo/sesiones/2.md");
  assert.deepEqual(e.llamadas.map(l => l.tipo), ["segmentar", "clasificar"]);
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "completa");
});

test("preparación: un enunciado con su solución adentro se rechaza y nunca llega al dossier", async t => {
  const e = preparacion(t), filtrada = { id: "1", paginas: [1], enunciado: "Pregunta 1 (8 puntos) Calcule la derivada.\n\n**Solución**\nDos equis.", puntos: 8 };
  let intentos = 0;
  e.ctx.modelRegistry.streamSimple = modeloSimulado(e.llamadas, { segmentar: texto => texto.includes("Documento parcial") && intentos++ === 0 && respuesta(JSON.stringify({ items: [filtrada] })) });
  await e.turno();
  const parcial = e.llamadas.filter(l => l.tipo === "segmentar" && l.texto.includes("Documento parcial"));
  assert.match(parcial[1].texto, /Tu respuesta anterior se rechazó: el enunciado de 1 trae una solución/);
  assert.deepEqual(e.yaml("parcial/items.yaml").items.map(i => [i.id, i.solucion_de]), [["1", undefined], ["1-solucion", "1"]]);
  e.ctx.modelRegistry.streamSimple = modeloSimulado(e.llamadas, { segmentar: texto => texto.includes("Documento parcial") && respuesta(JSON.stringify({ items: [filtrada] })) });
  rmSync(join(e.raiz, "_procesado/parcial/items.yaml"));
  await e.turno("cursos/ejemplo/sesiones/2.md");
  assert.ok(!existsSync(join(e.raiz, "_procesado/parcial/items.yaml")));
  assert.doesNotMatch(dossier(e.raiz, e.activo.d, e.activo.d.temas[0], 3000, 1500), /Dos equis/);
});

test("preparación: con la ingesta base corriendo u otro pi preparando espera sin avisos y retoma un lock de un pi muerto", async t => {
  const e = preparacion(t), estado = join(e.raiz, "_procesado/estado-ingesta.json"), lock = join(e.raiz, "_procesado/.preparacion.lock");
  const original = readFileSync(estado, "utf8");
  writeFileSync(estado, JSON.stringify({ ...JSON.parse(original), estado: "en_curso", pid: process.pid }));
  await e.turno();
  writeFileSync(estado, original);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, inicio: Date.now() }));
  await e.turno();
  assert.deepEqual([e.llamadas, e.avisos], [[], []]);
  assert.ok(e.estados.every(([, v]) => v === undefined));
  const muerto = spawnSync("true").pid;
  writeFileSync(lock, JSON.stringify({ pid: muerto, inicio: Date.now() }));
  await e.turno();
  assert.equal(e.llamadas.filter(l => l.tipo === "vision").length, 4);
  assert.ok(!existsSync(lock));
});

test("preparación: un kill a mitad no rompe nada y la próxima vez sigue sin repetir páginas", async t => {
  const e = preparacion(t);
  // Corte en la tercera página: lo que quedó guardado es atómico y queda en caché.
  e.ctx.modelRegistry.streamSimple = (...args) => ({ result: async () => {
    if (e.llamadas.length === 2) { e.eventos.get("session_shutdown")(); return { stopReason: "aborted", errorMessage: "Request was aborted", content: [], usage: structuredClone(USO) }; }
    return modeloSimulado(e.llamadas)(...args).result();
  } });
  await e.turno();
  assert.deepEqual([e.avisos, e.estados.at(-1)], [[], ["preparacion", undefined]]);
  writeFileSync(join(e.raiz, "_procesado/.preparacion.lock"), JSON.stringify({ pid: spawnSync("true").pid, inicio: Date.now() }));
  e.llamadas.length = 0;
  e.ctx.modelRegistry.streamSimple = modeloSimulado(e.llamadas);
  await e.turno("cursos/ejemplo/sesiones/2.md");
  assert.deepEqual(e.llamadas.map(l => l.tipo), ["vision", "vision", "segmentar", "segmentar", "clasificar"]);
  assert.deepEqual(e.avisos, [["info", "Material de Derivación listo: 2 páginas transcriptas, 2 ítems nuevos."]]);
});

test("preparación: un parcial sin ingesta base espera, sin cortar lo demás ni mostrar un error en inglés", async t => {
  const e = preparacion(t);
  rmSync(join(e.raiz, "_procesado/parcial"), { recursive: true });
  await e.turno();
  assert.deepEqual(e.llamadas.map(l => l.tipo), ["vision", "vision", "vision", "segmentar", "clasificar"]);
  assert.deepEqual(e.avisos, [["warning", "Material de Derivación preparado en parte: 3 páginas transcriptas, 1 ítems nuevos; quedan 1 páginas, sigue la próxima vez."]]);
  assert.equal(e.json("preparacion.json").temas.derivacion.estado, "incompleta");
  e.llamadas.length = 0;
  await e.turno("cursos/ejemplo/sesiones/2.md");
  assert.deepEqual([e.llamadas, e.avisos.length], [[], 1]);
});

test("skills y CURSOS.md describen la preparación automática por tema", () => {
  for (const skill of ["curso-nuevo", "curso-agregar"]) {
    const texto = readFileSync(join(piDir, `skills/${skill}/SKILL.md`), "utf8");
    assert.match(texto, /preparación (automática|por tema)/, skill);
    assert.match(texto, /asignaciones\.json/, skill);
    assert.doesNotMatch(texto, /Usá `transcribir_paginas` en todo ejercicio/, skill);
  }
  const cursos = readFileSync(join(piDir, "scripts/ingesta/CURSOS.md"), "utf8");
  for (const clave of ["## Preparación por tema", "preparacion.json", ".preparacion.lock", "150 páginas", "asignado automáticamente", "sin ingesta base espera", "editado a mano", "marcador de solución"]) assert.ok(cursos.includes(clave), clave);
});
