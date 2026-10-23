import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buscarMaterial, dossier, leerItems, leerPaginas, reservados, reservas } from "../extensions/curso/material.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarSimulacro } from "../extensions/curso/simulacro.ts";
import { tokenizar } from "../scripts/ingesta/bm25.ts";
import { piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

// Regresiones de la etapa I (fidelidad y evaluación): curso sintético y curso real, sin modelos.
const COPIA_PARCIAL = "**Pregunta 2 (8 puntos)**\nSuponga un enlace de microondas a 10 Mbps entre un satélite geoestacionario (a 36000 Km) y su estación base. El satélite toma una fotografía por minuto. La velocidad de propagación es $2,4 \\times 10^8$ metros/segundo.\na) ¿Cuál es el retardo de propagación?\nb) ¿Cuál es el producto ancho de banda-retardo?";
const COPIA_PRACTICO = "Suponga que existe un enlace de microondas a 10 Mbps entre un satélite geoestacionario y su estación base en la Tierra. El satélite toma una fotografía digital por minuto. La velocidad de propagación es $2,4 \\times 10^8$ metros/segundo. Recuerde que está a 36,000 km.\n(a) ¿Cuál es el retardo de propagación del enlace?\n(b) ¿Cuál es el producto ancho de banda-retardo?";
const CONMUTACION = "a) Compare conmutación de circuitos y conmutación de paquetes. b) Para cada tipo de conmutación, mencione una aplicación que se beneficia de la misma. c) ¿Qué significa que un conmutador implementa almacenamiento y reenvío? d) ¿Qué retardos introduce este modo de funcionamiento?";
function curso(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-fidelidad-")), raiz = join(vault, "cursos/redes");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const tema = { id: "retardos", nombre: "Retardos", alias: [], unidad: 1, prerequisitos: [], objetivos: ["O1.2"], bibliografia: [{ doc: "libro", seccion: "1.4", paginas: [1, 3] }],
    ejercicios: [{ doc: "practico", items: ["1", "2"] }], evaluaciones: [{ doc: "parcial", items: ["2", "3"] }] };
  const d = { curso: "redes", nombre: "Redes", contrato: "# Objetivos\n- O1.2: Calcular retardos.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" },
      { id: "practico", titulo: "Práctico", tipo: "ejercicios", archivo: "fuentes/ejercicios/practico.pdf", paginas: 1 },
      { id: "parcial", titulo: "Parcial", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/parcial.pdf", paginas: 1 }],
    items: { practico: [{ id: "1", paginas: [1], enunciado: COPIA_PRACTICO }, { id: "2", paginas: [1], enunciado: "Suponga que N paquetes llegan simultáneamente a un enlace sin cola. ¿Cuál es el retardo de cola medio?" }],
      parcial: [{ id: "2", paginas: [1], enunciado: COPIA_PARCIAL, puntos: 8 }, { id: "2-solucion", paginas: [1], enunciado: "SOLUCION DOS", solucion_de: "2" },
        { id: "3", paginas: [1], enunciado: `**Pregunta 3 (10 puntos)**\n${CONMUTACION}`, puntos: 10 }, { id: "3-solucion", paginas: [1], enunciado: "SOLUCION TRES", solucion_de: "3" }] },
    progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
  const escribir = (relativa, texto) => { mkdirSync(join(raiz, relativa, ".."), { recursive: true }); writeFileSync(join(raiz, relativa), texto); };
  escribir("_procesado/practico/paginas/0001.md", `<!-- p. PDF 1 · [[cursos/redes/fuentes/ejercicios/practico.pdf#page=1]] -->\n**Ejercicio 1**\n${COPIA_PRACTICO}\n**Ejercicio 2**\nSuponga que N paquetes llegan simultáneamente a un enlace sin cola.`);
  return { vault, raiz, d, tema, escribir };
}

test("E3: la reserva prefiere un ítem de evaluación sin casi copias visibles y, si todos tienen, oculta también la copia", t => {
  const c = curso(t);
  // parcial/2 tiene una casi copia en el práctico: se reserva parcial/3 aunque el 2 venga primero.
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "3" });
  assert.deepEqual([...reservados(c.raiz, c.d)].sort(), ["parcial/3", "parcial/3-solucion"]);
  // Si todos tienen copia, se elige igual (solución, puntos y orden del índice) y su copia tampoco se ve; la del otro, sí.
  c.d.items.practico.push({ id: "3", paginas: [1], enunciado: CONMUTACION.replace("Compare", "Explique y compare") });
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "2" });
  assert.deepEqual([...reservados(c.raiz, c.d)].sort(), ["parcial/2", "parcial/2-solucion", "practico/1"]);
  c.d.items.practico.pop();
  // Una reserva ya fijada no cambia aunque tenga copia: se ocultan sus copias, por todas las vías.
  c.d.progreso.temas.retardos = { estado: "en_curso", reservado: [{ doc: "parcial", id: "2" }] };
  const r = reservados(c.raiz, c.d);
  assert.deepEqual([...r].sort(), ["parcial/2", "parcial/2-solucion", "practico/1"]);
  assert.equal(leerItems(c.d, "practico", ["1"], false, r), "practico/1: Ese ítem está reservado para /simulacro; elegí otro.");
  assert.match(leerItems(c.d, "practico", ["2"], false, r), /N paquetes llegan/);
  for (const despues of [false, true]) {
    const texto = leerPaginas(c.raiz, c.d, "practico", 1, 1, despues, r);
    assert.ok(!/geoestacionario|#page=/.test(texto), texto);
    assert.match(texto, /\[Pregunta reservada para \/simulacro\.\][\s\S]*N paquetes llegan/);
  }
  const d = dossier(c.raiz, c.d, c.tema, 3000, 1500);
  assert.ok(!d.includes("practico/1") && !d.includes("geoestacionario"), d);
  assert.match(d, /ejercicios: practico\/2 /);
  const fragmentos = [{ doc: "practico", titulo: "Práctico", tipo: "ejercicios", pagina: 1, seccion: "Ejercicio 1", texto: COPIA_PRACTICO, cita: "", calidad: 1, pendiente: false }];
  for (const f of fragmentos) { f.largo = tokenizar(f.texto).length; f.frecuencias = Object.fromEntries(tokenizar(f.texto).map(w => [w, 1])); }
  c.escribir("_procesado/busqueda.json", JSON.stringify({ version: 1, normalizacion: "NFD-sin-tildes-v1", k1: 1.2, b: 0.75, cantidad: 1, largo_promedio: 40, df: { satelite: 1, geoestacionario: 1 }, fragmentos }));
  const [hallado] = buscarMaterial(c.raiz, c.d, "satélite geoestacionario", undefined, r);
  assert.ok(!/geoestacionario|#page=/.test(JSON.stringify(hallado)), JSON.stringify(hallado));
  assert.match(hallado.fragmento, /leer_items \(ítems: 2\)/);
  // Sin reserva, el práctico se lee entero y con su enlace.
  assert.match(leerPaginas(c.raiz, c.d, "practico", 1, 1, false, new Set()), /geoestacionario[\s\S]*practico\.pdf#page=1/);
});

test("F1, F2: el dossier muestra la bibliografía del tema con su tool y su rango, antes de los ítems y sin enlace al comienzo del rango", t => {
  const c = curso(t), d = dossier(c.raiz, c.d, c.tema, 3000, 1500);
  assert.match(d, /^Bibliografía del tema: antes de enseñar cada nodo, leé con leer_paginas la página que lo define y citá esa\.\n\n- leer_paginas libro PDF 1–3 · 1\.4 · Libro \(principal\)$/m);
  assert.ok(d.indexOf("- leer_paginas libro") < d.indexOf("ejercicios: practico/"));
  assert.doesNotMatch(d, /libro\.pdf#page=/);
  c.tema.bibliografia = [];
  assert.match(dossier(c.raiz, c.d, c.tema, 3000, 1500), /^Bibliografía del tema: ninguna; lo que no conste en el material va marcado «sin respaldo en el material»\.$/m);
});

const redes = () => JSON.parse(execFileSync(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vaultDir, "--curso", "redes"], { env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }));

test("E3 con el curso real: el Ej. 10 del Práctico 1, casi copia de la Pregunta 3 del parcial 2023, no se ve mientras esa pregunta esté reservada", t => {
  if (!existsSync(join(vaultDir, "cursos/redes/_procesado/practico-1/items.yaml"))) return t.skip("sin el curso redes");
  const d = redes(), raiz = join(vaultDir, "cursos/redes"), retardos = d.temas.find(x => x.id === "retardos");
  // Sin el parcial 2023 segmentado todavía, sus textos reales del e2e de la etapa H.
  d.items["sol-prc20230918"] ||= JSON.parse(readFileSync(join(piDir, "tests/fixtures/sol-prc20230918.json"), "utf8")).items;
  d.progreso = { temas: { retardos: { estado: "en_curso", reservado: [{ doc: "sol-prc20230918", id: "3" }] } }, historial: [] };
  const r = reservados(raiz, d);
  assert.ok(r.has("practico-1/10"));
  // Nada más que el reservado, sus soluciones y esa copia: los otros ejercicios del práctico siguen a la vista.
  assert.deepEqual([...r].filter(x => !/^sol-prc20240926\//.test(x)).sort(), ["practico-1/10", "sol-prc20230918/3", "sol-prc20230918/3-solucion"]);
  assert.equal(leerItems(d, "practico-1", ["10"], false, r), "practico-1/10: Ese ítem está reservado para /simulacro; elegí otro.");
  const pagina = leerPaginas(raiz, d, "practico-1", 3, 3, false, r);
  assert.ok(!/geoestacionario|#page=/.test(pagina), pagina);
  assert.match(pagina, /Ejercicio 9[\s\S]*R = 1\$ Gbps/);
  assert.match(leerPaginas(raiz, d, "practico-1", 1, 2, false, r), /practico1\.pdf#page=1/);
  const texto = dossier(raiz, d, retardos, 3000, 2000);
  assert.ok(!texto.includes("practico-1/10") && !texto.includes("geoestacionario"));
  assert.match(texto, /practico-1\/9/);
  for (const x of buscarMaterial(raiz, d, "satélite geoestacionario fotografía por minuto", "ejercicios", r)) assert.ok(!/geoestacionario|fotograf/i.test(JSON.stringify(x)), JSON.stringify(x));
});

test("F1, F2 con el curso real: el dossier de retardos nombra la tool y los rangos de Kurose dentro del presupuesto", t => {
  if (!existsSync(join(vaultDir, "cursos/redes/indice.yaml"))) return t.skip("sin el curso redes");
  const d = redes(), r = dossier(join(vaultDir, "cursos/redes"), d, d.temas.find(x => x.id === "retardos"), 3000, 2000);
  assert.ok(Buffer.byteLength(r) <= 12000);
  assert.match(r, /^- leer_paginas kurose-7 PDF 54–64 · 1\.4 Retardos, pérdidas y tasa de transferencia · /m);
  assert.match(r, /^- leer_paginas kurose-7 PDF 82–89 · /m);
});

// modo-curso.md: cada regla de la etapa I por una frase estable (el tamaño lo controla el test de la auditoría pedagógica).
const REGLAS_I = {
  "leer la bibliografía antes de cada nodo (F1)": "Antes de establecer cada nodo, leé con `leer_paginas` la página de la bibliografía del tema que lo define",
  "un enunciado no respalda una definición (F2)": "un enunciado de ejercicio nunca respalda una definición",
  "sin bibliografía, decirlo (F1)": "decilo en una línea y marcá «sin respaldo en el material» lo que no conste",
  "leer al arrancar sin demorar (F1)": "en una misma tanda: `leer_paginas` con 2–3 páginas del comienzo de la bibliografía e `investigar_tema`",
  "sin preámbulo no es sin leer (F1)": "«sin preámbulo» es sin texto, no sin leer",
  "6a desde la bibliografía (F1)": "enseñá ya, en modo expositivo y desde la bibliografía",
  "retomar tras un corte (A3, D5)": "Al retomar tras un corte, una línea de «dónde quedamos» y la pregunta pendiente idéntica, sin agregar datos",
  "peso del objetivo (A4, E2)": "su peso en curso.md: cae en N de M parciales",
  "6a con peso y ajustable (A4)": "el objetivo del curso con su peso y que se puede ajustar",
  "details sin la propiedad ni la forma (D3, D5)": "nunca la propiedad que el quiz verifica ni la forma de la respuesta (fracción, unidad) salvo que todas las opciones la compartan",
};
test("modo-curso: reglas de fidelidad y evaluación de la etapa I", () => {
  const plano = readFileSync(join(piDir, "modo-curso.md"), "utf8").replace(/\s+/g, " ");
  for (const [nombre, frase] of Object.entries(REGLAS_I)) assert.ok(plano.includes(frase), nombre);
});

// Vault sintético con pi simulado: /simulacro con Python real para el progreso.
function vault(t, estado) {
  const c = curso(t), recursos = join(c.vault, ".pi");
  for (const p of [join(recursos, "skills/teach"), join(c.raiz, "sesiones"), join(c.raiz, "_procesado/parcial")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(c.raiz, "indice.yaml"), JSON.stringify({ version: 1, documentos: c.d.documentos, temas: c.d.temas }));
  for (const doc of ["parcial", "practico"]) writeFileSync(join(c.raiz, `_procesado/${doc}/items.yaml`), JSON.stringify({ items: c.d.items[doc] }));
  c.d.progreso.temas = estado ? { retardos: { estado } } : {};
  writeFileSync(join(c.raiz, "progreso.yaml"), `version: 1\ntemas: ${estado ? `{retardos: {estado: ${estado}}}` : "{}"}\nhistorial: []\n`);
  const comandos = new Map(), entradas = [], avisos = [], ordenes = [], preguntas = [], cortes = [];
  const pi = { on: () => {}, registerCommand: (n, x) => comandos.set(n, x), registerTool: () => {}, appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }),
    setSessionName: () => {}, sendMessage: m => ordenes.push(m), getAllTools: () => [], getActiveTools: () => [], setActiveTools: () => {},
    exec: async () => ({ code: 0, stdout: JSON.stringify(c.d), stderr: "", killed: false }), events: { emit: (_n, p) => p.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => false, abort: () => cortes.push("abort"), waitForIdle: async () => {}, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "s" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: () => {}, select: async (titulo, o) => { preguntas.push([titulo, o]); return ctx.respuesta(o); } } };
  const sesion = registrarSesion(pi, c.vault, recursos);
  registrarSimulacro(pi, sesion, c.vault);
  return { ...c, ctx, comandos, entradas, avisos, ordenes, preguntas, cortes, sesion, progreso: () => readFileSync(join(c.raiz, "progreso.yaml"), "utf8") };
}

test("E9, 6d: /simulacro con el tema sin dominar pregunta antes de gastar el reservado; cancelar no usa nada", async t => {
  const e = vault(t);
  await e.comandos.get("estudiar").handler("redes retardos", e.ctx);
  e.cortes.length = 0;
  const ordenes = e.ordenes.length, progreso = e.progreso();
  e.ctx.respuesta = () => undefined;
  await e.comandos.get("simulacro").handler("", e.ctx);
  assert.deepEqual(e.preguntas, [["Todavía no terminaste el tema: el simulacro usa el único ítem reservado y no se repite. ¿Rendirlo ahora?", ["Sí, rendirlo ahora", "No, seguir estudiando"]]]);
  assert.deepEqual(e.avisos.at(-1), ["info", "Seguimos estudiando: el simulacro queda reservado para cuando termines el tema."]);
  assert.ok(!e.entradas.some(x => x.customType === "curso-simulacro"));
  assert.deepEqual([e.cortes, e.ordenes.length, e.progreso()], [[], ordenes, progreso]);
  e.ctx.respuesta = o => o[1];
  await e.comandos.get("simulacro").handler("", e.ctx);
  assert.deepEqual([e.cortes, e.ordenes.length, e.progreso()], [[], ordenes, progreso]);
  // Confirmado, corta el turno, lo marca usado y lo presenta.
  e.ctx.respuesta = o => o[0];
  await e.comandos.get("simulacro").handler("", e.ctx);
  assert.deepEqual(e.cortes, ["abort"]);
  assert.match(e.progreso(), /- doc: parcial\n\s+id: '3'\n\s+usado: true/);
  assert.deepEqual(e.entradas.findLast(x => x.customType === "curso-simulacro").data.id, "3");
  const orden = e.ordenes.at(-1).content;
  assert.match(orden, /si viene de un nodo del plan que todavía no se enseñó, decilo/);
  assert.match(orden, /plan de repaso ordenado por peso en el examen: los puntos que suman, en los parciales de curso\.md, las preguntas del tema/);
});

test("E9, 6d: sin interfaz y con el tema sin dominar /simulacro no gasta el reservado; con el tema dominado no pregunta", async t => {
  const e = vault(t);
  await e.comandos.get("estudiar").handler("redes retardos", e.ctx);
  e.cortes.length = 0;
  const progreso = e.progreso();
  e.ctx.hasUI = false;
  await e.comandos.get("simulacro").handler("", e.ctx);
  assert.deepEqual(e.avisos.at(-1), ["info", "Todavía no terminaste el tema: rendí el simulacro cuando lo termines."]);
  assert.deepEqual([e.preguntas, e.cortes, e.progreso()], [[], [], progreso]);
  assert.ok(!e.entradas.some(x => x.customType === "curso-simulacro"));
  const d = vault(t, "dominado");
  await d.comandos.get("estudiar").handler("redes retardos", d.ctx);
  await d.comandos.get("simulacro").handler("", d.ctx);
  assert.deepEqual(d.preguntas, []);
  assert.match(d.progreso(), /usado: true/);
  assert.match(d.ordenes.at(-1).content, /^Simulacro de «Retardos»/);
});
