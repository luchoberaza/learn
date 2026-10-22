import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { buscarMaterial, leerItems, leerPaginas } from "../extensions/curso/material.ts";
import { tokenizar } from "../scripts/ingesta/bm25.ts";
import { loadProject, piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

const PAGINAS = {
  parcial: [
    "<!-- p. PDF 1 · [[cursos/calculo/fuentes/evaluaciones/parcial.pdf#page=1]] -->\nInstrucciones del parcial.\n### *Pregunta 1 (12 puntos)*\nCalculá el retardo de propagación de un enlace.\n**Solución**\nSOLUCION PROPIA retardo d/s",
    "<!-- p. PDF 2 · [[cursos/calculo/fuentes/evaluaciones/parcial.pdf#page=2]] -->\nSIGUE LA SOLUCION retardo 5 ms\nPágina 1/3\n**_Pregunta 2 (8 puntos)_**\nExplicá Go-Back-N con retardo de propagación.\n### Solución\nRESPUESTA GBN retardo",
    "<!-- p. PDF 3 · [[cursos/calculo/fuentes/evaluaciones/parcial.pdf#page=3]] -->\nCONTINUA RESPUESTA GBN retardo\nPágina 3/3",
  ],
  soluciones: ["SOLUCION SEPARADA retardo de propagación"],
  libro: ["Libro: el retardo de propagación es d/s."],
};
function datos() {
  const tema = { id: "derivacion", nombre: "Derivación", alias: [], unidad: 1, prerequisitos: [], objetivos: [], bibliografia: [] };
  return { curso: "calculo", nombre: "Cálculo", contrato: "# Objetivos\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 1, prioridad: "principal" },
      { id: "parcial", titulo: "Parcial", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/parcial.pdf", paginas: 3 },
      { id: "soluciones", titulo: "Soluciones", tipo: "soluciones", archivo: "fuentes/soluciones/sol.pdf", paginas: 1 }],
    items: { parcial: [{ id: "1", paginas: [1], enunciado: "Calculá el retardo de propagación de un enlace.", puntos: 12 },
      { id: "1-sol", paginas: [1, 2], enunciado: "SOLUCION PROPIA retardo d/s = 5 ms", solucion_de: "1" },
      { id: "2", paginas: [2], enunciado: "Explicá Go-Back-N con retardo de propagación.", solucion: { doc: "soluciones", id: "2" } }],
      soluciones: [{ id: "2", paginas: [1], enunciado: "SOLUCION SEPARADA retardo de propagación" }] },
    progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
}
function curso(t, d = datos(), paginas = PAGINAS) {
  const vault = mkdtempSync(join(tmpdir(), "pi-fuga-")), recursos = join(vault, ".pi"), raiz = join(vault, "cursos/calculo");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  mkdirSync(join(raiz, "sesiones"), { recursive: true });
  const fragmentos = [], df = {};
  for (const [doc, textos] of Object.entries(paginas)) textos.forEach((texto, i) => {
    const p = i + 1, tipo = d.documentos.find(x => x.id === doc).tipo, frecuencias = {};
    mkdirSync(join(raiz, `_procesado/${doc}/paginas`), { recursive: true });
    mkdirSync(join(raiz, `_procesado/${doc}/render`), { recursive: true });
    writeFileSync(join(raiz, `_procesado/${doc}/paginas/000${p}.md`), texto);
    writeFileSync(join(raiz, `_procesado/${doc}/render/000${p}.png`), "png");
    for (const w of tokenizar(texto)) frecuencias[w] = (frecuencias[w] || 0) + 1;
    for (const w of Object.keys(frecuencias)) df[w] = (df[w] || 0) + 1;
    fragmentos.push({ doc, titulo: doc, tipo, pagina: p, seccion: doc === "parcial" ? "SOLUCION PROPIA" : null, texto, cita: `[[x#page=${p}]]`, calidad: 1, pendiente: false,
      largo: tokenizar(texto).length, frecuencias });
  });
  writeFileSync(join(raiz, "_procesado/busqueda.json"), JSON.stringify({ version: 1, normalizacion: "NFD-sin-tildes-v1", k1: 1.2, b: 0.75,
    cantidad: fragmentos.length, largo_promedio: fragmentos.reduce((s, f) => s + f.largo, 0) / fragmentos.length, df, fragmentos }));
  mkdirSync(join(recursos, "skills/teach"), { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH");
  writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  const comandos = new Map();
  const pi = { on: () => {}, registerCommand: (n, c) => comandos.set(n, c), appendEntry: () => {}, setSessionName: () => {}, sendUserMessage: () => {}, sendMessage: () => {},
    exec: async () => ({ code: 0, stdout: JSON.stringify(d), stderr: "" }), events: { emit: (_n, payload) => payload.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => [], getSessionId: () => "prueba" }, model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: () => {}, setStatus: () => {}, select: async (_t, opciones) => opciones[0] } };
  return { raiz, d, tools: registrarSesion(pi, vault, recursos), activar: () => comandos.get("estudiar").handler("calculo derivacion", ctx) };
}

test("buscar_material: de evaluaciones y soluciones sólo da ubicación, con y sin tipo", t => {
  const { raiz, d } = curso(t);
  for (const tipo of [undefined, "evaluaciones", "soluciones"]) {
    const r = buscarMaterial(raiz, d, "retardo de propagación", tipo), texto = JSON.stringify(r);
    assert.ok(r.some(x => x.doc !== "libro"), tipo);
    assert.doesNotMatch(texto, /SOLUCION|RESPUESTA/);
    for (const x of r.filter(x => x.doc !== "libro")) { assert.doesNotMatch(JSON.stringify(x), /\[\[|#page=/); assert.match(x.fragmento, /leer_items|leer_paginas/); }
  }
  const parcial = buscarMaterial(raiz, d, "retardo de propagación", "evaluaciones").find(x => x.pagina === 1);
  assert.match(parcial.fragmento, /ítems: 1\b/);
  const libro = buscarMaterial(raiz, d, "retardo de propagación").find(x => x.doc === "libro");
  assert.match(libro.fragmento, /retardo de propagación es d\/s/); assert.match(libro.cita, /libro\.pdf#page=1/);
});

test("leer_paginas: corta las soluciones entre páginas y sin cortar con seguridad rechaza", t => {
  const { raiz, d } = curso(t);
  const p2 = leerPaginas(raiz, d, "parcial", 2, 2), todo = leerPaginas(raiz, d, "parcial", 1, 3);
  assert.match(p2, /Explicá Go-Back-N/); assert.match(todo, /Calculá el retardo/); assert.match(todo, /PDF p\. 3/);
  for (const t of [p2, todo, leerPaginas(raiz, d, "parcial", 3, 3)]) { assert.doesNotMatch(t, /SOLUCION|RESPUESTA|\[\[|#page=/); }
  assert.match(leerPaginas(raiz, d, "parcial", 1, 3, true), /SIGUE LA SOLUCION[^]*RESPUESTA GBN[^]*#page=3/);
  assert.throws(() => leerPaginas(raiz, d, "soluciones", 1, 1), /leer_items/);
  assert.match(leerPaginas(raiz, d, "soluciones", 1, 1, true), /SOLUCION SEPARADA/);
  assert.match(leerPaginas(raiz, d, "libro", 1, 1), /libro\.pdf#page=1/);
  rmSync(join(raiz, "_procesado/parcial/paginas/0001.md"));
  assert.throws(() => leerPaginas(raiz, d, "parcial", 2, 2), /leer_items/);
  writeFileSync(join(raiz, "_procesado/parcial/paginas/0001.md"), "Pregunta 1\nEnunciado.");
  writeFileSync(join(raiz, "_procesado/parcial/paginas/0002.md"), "Texto sin marcas: 42 ms");
  assert.throws(() => leerPaginas(raiz, d, "parcial", 2, 2), /leer_items/);
});

test("leer_paginas: cada pregunta del documento necesita su marca de solución; si no, rechaza", t => {
  const raiz = mkdtempSync(join(tmpdir(), "pi-fuga-"));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const leerParcial = paginas => {
    rmSync(join(raiz, "_procesado"), { recursive: true, force: true });
    mkdirSync(join(raiz, "_procesado/p/paginas"), { recursive: true });
    paginas.forEach((texto, i) => writeFileSync(join(raiz, `_procesado/p/paginas/000${i + 1}.md`), texto));
    const d = { curso: "c", documentos: [{ id: "p", titulo: "P", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/p.pdf", paginas: paginas.length }], items: {} };
    return leerPaginas(raiz, d, "p", 1, paginas.length);
  };
  for (const paginas of [["Pregunta 1\nUno.\nSolución\nSECRETO\nPregunta 2\nDos.\nSol.: SECRETO"],
    ["Pregunta 1\nUno.\nSolución\nComo en la\nPregunta 2 del práctico, SECRETO\nPregunta 2\nDos.\nSolución\nSECRETO"],
    ["Pregunta 1 (10 puntos) Uno. Solución: SECRETO\nPregunta 2\nDos.\nSolución\nSECRETO"],
    ["Pregunta 1\nUno.\nSolución\nSECRETO\nPregunta 2\nDos.", "Rta: SECRETO"]]) assert.throws(() => leerParcial(paginas), /leer_items/, paginas[0]);
  const texto = leerParcial(["Solución del parcial\nEjercicio Nº 1\nUno.\n| **Solución** |\n| SECRETO |\nEjercicio Nº 2\nDos.\n- Solución: SECRETO"]);
  assert.match(texto, /Uno\.[^]*Dos\./); assert.doesNotMatch(texto, /SECRETO/);
});

test("leer_paginas rechaza sin invitar a pedir el texto completo antes del intento", t => {
  const { raiz, d } = curso(t);
  rmSync(join(raiz, "_procesado/parcial/paginas/0003.md"));
  assert.throws(() => leerPaginas(raiz, d, "parcial", 1, 1), e => /leer_items/.test(e.message) && /sólo después del intento del estudiante/.test(e.message));
});

test("un práctico con ítems solucion_de se reserva como un parcial", async t => {
  const d = datos();
  d.documentos.push({ id: "practico", titulo: "Práctico", tipo: "ejercicios", archivo: "fuentes/ejercicios/practico.pdf", paginas: 1 });
  d.items.practico = [{ id: "1", paginas: [1], enunciado: "Calculá el retardo de propagación de 1 km." }, { id: "1-sol", paginas: [1], enunciado: "RESPUESTA 5 us", solucion_de: "1" }];
  const e = curso(t, d, { ...PAGINAS, practico: ["Ejercicio 1\nCalculá el retardo de propagación de 1 km.\nRespuesta\nRESPUESTA 5 us"] });
  const r = buscarMaterial(e.raiz, d, "retardo de propagación", "ejercicios");
  assert.equal(r[0].doc, "practico"); assert.doesNotMatch(JSON.stringify(r), /RESPUESTA|#page=/);
  assert.doesNotMatch(leerItems(d, "practico", ["1"]), /#page=/);
  assert.doesNotMatch(leerPaginas(e.raiz, d, "practico", 1, 1), /RESPUESTA|#page=/);
  await e.activar();
  await assert.rejects(() => e.tools.ver_pagina({ doc: "practico", pagina: 1 }), /solución/);
});

test("leer_items de evaluaciones cita sin enlace antes del intento y con enlace después", () => {
  const d = datos(), antes = leerItems(d, "parcial", ["1", "2"]);
  assert.doesNotMatch(antes, /SOLUCION|\[\[|#page=/); assert.match(antes, /PDF p\. 1 \(el enlace va después del intento\)/);
  assert.match(leerItems(d, "parcial", ["2"], true), /parcial\.pdf#page=2[^]*SOLUCION SEPARADA/);
});

test("leer_items: la solución del mismo documento sólo tras el intento y nunca se lista antes (H18)", t => {
  const d = datos(), { raiz } = curso(t, d);
  assert.doesNotMatch(leerItems(d, "parcial", ["1-sol"]), /SOLUCION/);
  assert.doesNotMatch(leerItems(d, "soluciones", ["2"]), /SOLUCION/);
  const despues = leerItems(d, "parcial", ["1"], true);
  assert.match(despues, /Solución:\nSOLUCION PROPIA[^\n]*\n\[\[[^\]]*parcial\.pdf#page=1\]\] \[\[[^\]]*parcial\.pdf#page=2\]\]/);
  assert.doesNotMatch(despues, /Sin solución separada/);
  assert.doesNotMatch(leerItems(d, "parcial", ["2"], true), /SOLUCION PROPIA/);
  assert.doesNotMatch(JSON.stringify(buscarMaterial(raiz, d, "retardo de propagación")), /1-sol/);
});

test("leer_items muestra el puntaje oficial del ítem (H72)", () => {
  const d = datos();
  assert.match(leerItems(d, "parcial", ["1"]), /^parcial\/1 \(12 puntos\)\n/);
  assert.match(leerItems(d, "parcial", ["2"]), /^parcial\/2\n/);
  d.items.parcial[2].puntos = 1;
  assert.match(leerItems(d, "parcial", ["2"], true), /^parcial\/2 \(1 punto\)\n/);
});

test("ver_pagina de evaluaciones exige despues_del_intento; leer_paginas lo recibe", async t => {
  const e = curso(t);
  await e.activar();
  await assert.rejects(() => e.tools.ver_pagina({ doc: "parcial", pagina: 1 }), /solución/);
  await assert.rejects(() => e.tools.ver_pagina({ doc: "soluciones", pagina: 1 }), /solución/);
  assert.match((await e.tools.ver_pagina({ doc: "parcial", pagina: 1, despues_del_intento: true })).cita, /parcial\.pdf#page=1/);
  assert.match((await e.tools.ver_pagina({ doc: "libro", pagina: 1 })).cita, /libro\.pdf#page=1/);
  assert.doesNotMatch(e.tools.leer_paginas({ doc: "parcial", desde: 1, hasta: 1 }), /SOLUCION/);
  assert.match(e.tools.leer_paginas({ doc: "parcial", desde: 1, hasta: 1, despues_del_intento: true }), /SOLUCION PROPIA/);
});

test("las tools declaran despues_del_intento para el modelo", async () => {
  const p = await loadProject();
  try {
    for (const n of ["leer_paginas", "ver_pagina"]) assert.ok(p.session.getToolDefinition(n).parameters.properties.despues_del_intento, n);
  } finally { await p.close(); }
});

// Datos reales del curso de Redes (consultas de la auditoría; la última es la de la sesión real).
const redes = join(vaultDir, "cursos/redes"), parcial = join(redes, "_procesado/sol-prc20240926/paginas");
test("datos reales: 0 fragmentos de solución en búsquedas, páginas e ítems del parcial", { skip: !existsSync(parcial) && "sin datos de Redes" }, () => {
  const cargado = spawnSync(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vaultDir, "--curso", "redes"],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(cargado.status, 0, cargado.stderr);
  const d = JSON.parse(cargado.stdout);
  const norm = s => s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").match(/[a-z0-9]{2,}/g) ?? [];
  const gramas = texto => { const x = norm(texto), g = new Set(); for (let i = 0; i + 6 <= x.length; i++) g.add(x.slice(i, i + 6).join(" ")); return g; };
  let todo = "";
  for (let p = 1; p <= 4; p++) todo += "\n" + readFileSync(join(parcial, `000${p}.md`), "utf8").replace(/<!--[^]*?-->/g, "");
  const solucion = gramas([...todo.matchAll(/Soluci[oó]n\**\s*([\s\S]*?)(?=\*{0,2}_?Pregunta \d|$)/g)].map(m => m[1]).join(" "));
  const enunciados = gramas(d.items["sol-prc20240926"].filter(i => i.solucion_de === undefined).map(i => i.enunciado).join(" "));
  const fuga = texto => [...gramas(texto)].filter(g => solucion.has(g) && !enunciados.has(g)).length;
  assert.ok(solucion.size > 500);
  const consultas = ["qué es el retardo de propagación", "retardo de transmisión L/R", "conmutación de circuitos vs conmutación de paquetes",
    "modelo de capas OSI TCP/IP encapsulación", "cómo se obtiene el servidor de correo DNS registro MX", "comandos SMTP HELO MAIL FROM RCPT TO",
    "GET condicional If-Modified-Since", "cómo sabe el navegador el tipo de objeto HTTP Content-Type", "diferencias POP3 IMAP",
    "ventajas y desventajas de UDP frente a TCP", "RDT 2.2 canal con pérdidas temporizador", "Go-Back-N ventana deslizante paquetes perdidos",
    "producto ancho de banda-retardo", "ejercicio de parcial capa de transporte", "control de congestión TCP", "tasa de transferencia cuello de botella",
    "retardo transmisión propagación paquetes"];
  for (const consulta of consultas) for (const tipo of [undefined, "evaluaciones"]) {
    const r = buscarMaterial(redes, d, consulta, tipo);
    assert.equal(fuga(JSON.stringify(r)), 0, `${consulta} · ${tipo}`);
    assert.doesNotMatch(JSON.stringify(r.filter(x => x.doc.startsWith("sol-"))), /\[\[|ventaja concreta|Son 16/, `${consulta} · ${tipo}`);
  }
  assert.ok(buscarMaterial(redes, d, "retardo transmisión propagación paquetes", "evaluaciones").length > 0);
  for (const [desde, hasta] of [[1, 1], [2, 2], [3, 3], [4, 4], [1, 4]]) {
    const texto = leerPaginas(redes, d, "sol-prc20240926", desde, hasta);
    assert.equal(fuga(texto), 0, `p. ${desde}-${hasta}`); assert.doesNotMatch(texto, /\[\[|Son 16|ventaja concreta/);
  }
  assert.match(leerPaginas(redes, d, "sol-prc20240926", 3, 4), /RDT 2\.2[^]*Go-Back-N[^]*Puede asumir/);
  assert.match(leerPaginas(redes, d, "sol-prc20240926", 4, 4, true), /Son 16 paquetes/);
  const ids = d.items["sol-prc20240926"].map(i => i.id), items = leerItems(d, "sol-prc20240926", ids);
  assert.equal(fuga(items), 0); assert.doesNotMatch(items, /#page=/);
  assert.match(leerItems(d, "sol-prc20240926", ["5"], true), /sol_prc20240926\.pdf#page=4/);
});
