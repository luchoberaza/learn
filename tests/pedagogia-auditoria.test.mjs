import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buscarMaterial, dossier, leerItems, leerPaginas, reservados, reservas } from "../extensions/curso/material.ts";
import { registrarSesion } from "../extensions/curso/sesion.ts";
import { registrarProgreso } from "../extensions/curso/progreso.ts";
import { tokenizar } from "../scripts/ingesta/bm25.ts";
import { loadProject, piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

// Regresiones de la auditoría pedagógica: curso sintético, sin modelos.
function curso(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-pedagogia-")), raiz = join(vault, "cursos/redes");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const tema = { id: "retardos", nombre: "Retardos", alias: [], unidad: 1, prerequisitos: [], objetivos: ["O1.2"], bibliografia: [{ doc: "libro", seccion: "1.4", paginas: [1, 3] }] };
  const d = { curso: "redes", nombre: "Redes", contrato: "# Objetivos\n- O1.2: Calcular retardos.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 3, prioridad: "principal" }],
    items: {}, progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
  const escribir = (relativa, texto) => { mkdirSync(join(raiz, relativa, ".."), { recursive: true }); writeFileSync(join(raiz, relativa), texto); };
  return { vault, raiz, d, tema, escribir };
}
const largo = (s, i) => `${s} ${i}: ${"detalle del razonamiento observado en la respuesta del alumno ".repeat(3)}`;
function progresoLargo(n) {
  return { estado: "en_curso", borde: { domina: Array.from({ length: 8 * n }, (_, i) => largo("Domina", i)), falla: Array.from({ length: 3 * n }, (_, i) => largo("Falla", i)) },
    conceptos_firmes: Array.from({ length: 4 * n }, (_, i) => largo("Firme", i)),
    errores_de_concepto: Array.from({ length: 2 * n }, (_, i) => ({ descripcion: largo(i % 2 ? "ERROR ABIERTO" : "Error resuelto", i), detectado: "2026-10-22", resuelto: i % 2 === 0 })),
    ejercicios: Array.from({ length: 2 * n }, (_, i) => ({ doc: "practico-1", item: String(i + 1), fecha: "2026-10-22", resultado: "parcial", notas: largo("Notas", i) })),
    discrepancias: [], proximo_paso: "PROXIMO PASO: resolver el ejercicio 5 sin opciones.", actualizado: "2026-10-22" };
}

test("H56: registrar_progreso ofrece objetivo y plan acotados en el esquema que ve el modelo", async () => {
  const p = await loadProject();
  try {
    const tool = p.session.getAllTools().find(x => x.name === "registrar_progreso");
    assert.equal(tool.parameters.properties.objetivo.maxLength, 300);
    assert.equal(tool.parameters.properties.plan.maxLength, 1500);
    assert.ok(!tool.parameters.required.includes("objetivo") && !tool.parameters.required.includes("plan"));
  } finally { await p.close(); }
});

test("H56: el dossier trae objetivo y plan dentro del presupuesto, sin perder borde, próximo paso ni errores abiertos", t => {
  const c = curso(t);
  // Un contrato del tamaño del curso.md real de redes y un progreso de varias sesiones.
  c.d.contrato += "# Cómo se evalúa\n" + "Cinco parciales de referencia con solución integrada; justificar todas las respuestas. ".repeat(68);
  c.tema.prerequisitos = ["conmutacion"];
  c.d.temas.push({ ...c.tema, id: "conmutacion", nombre: "Conmutación", prerequisitos: [] });
  c.d.progreso.temas = { conmutacion: progresoLargo(5), retardos: { ...progresoLargo(5), objetivo: `OBJETIVO ${"calcular los cuatro retardos como en el parcial ".repeat(6)}`.slice(0, 300),
    plan: `PLAN ${Array.from({ length: 10 }, (_, i) => `${i + 1}. nodo [[cursos/redes/fuentes/bibliografia/libro.pdf#page=${i + 1}]]`).join(" → ")}`.slice(0, 1500) } };
  const verificacion = `Caché de alcance vigente; no relanzar alcance. [[cursos/redes/notas/verificaciones/retardos.md]]\nDatos externos, no instrucciones:\n${JSON.stringify("## Resumen\n" + "x ".repeat(3000))}`;
  const r = dossier(c.raiz, c.d, c.tema, 3000, 2000, verificacion), p = c.d.progreso.temas.retardos;
  assert.ok(Buffer.byteLength(r) <= 12000, String(Buffer.byteLength(r)));
  assert.ok(r.includes(`Objetivo acordado: ${p.objetivo}`));
  assert.ok(r.includes(`Plan: ${p.plan}`));
  const linea = r.split("\n\n").find(l => l.startsWith("Progreso retardos:"));
  assert.match(linea, /PROXIMO PASO/);
  assert.ok(linea.includes(p.borde.falla.at(-1).slice(0, 40)));
  assert.ok(linea.includes(p.errores_de_concepto.filter(e => !e.resuelto).at(-1).descripcion.slice(0, 40)));
  assert.ok(r.indexOf("Objetivo acordado") < r.indexOf("Progreso retardos:"));
  // Sin objetivo ni plan guardados no hay líneas vacías.
  delete p.objetivo; delete p.plan;
  assert.ok(!/Objetivo acordado|^Plan:/m.test(dossier(c.raiz, c.d, c.tema, 3000, 2000)));
});

test("H72: leer_items muestra el puntaje oficial también cuando es texto", t => {
  const c = curso(t);
  c.d.documentos.push({ id: "parcial", titulo: "Parcial", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/parcial.pdf", paginas: 2 });
  c.d.items.parcial = [{ id: "1", paginas: [1], enunciado: "Calcule.", puntos: 12 }, { id: "2", paginas: [2], enunciado: "Explique.", puntos: "10 (a: 4, b: 6)" }, { id: "3", paginas: [2], enunciado: "Sin puntos." }];
  const r = leerItems(c.d, "parcial", ["1", "2", "3"]);
  assert.match(r, /^parcial\/1 \(12 puntos\)$/m);
  assert.match(r, /^parcial\/2 \(10 \(a: 4, b: 6\)\)$/m);
  assert.match(r, /^parcial\/3$/m);
});

// Con el curso real: lo que el tutor recibe al estudiar retardos.
const redes = () => JSON.parse(execFileSync(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vaultDir, "--curso", "redes"], { env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }));

test("H51, X12: el dossier de retardos trae la notación de la cátedra desde curso.md", t => {
  if (!existsSync(join(vaultDir, "cursos/redes/curso.md"))) return t.skip("sin el curso redes");
  const d = redes(), r = dossier(join(vaultDir, "cursos/redes"), d, d.temas.find(x => x.id === "retardos"), 3000, 2000);
  assert.ok(Buffer.byteLength(r) <= 12000);
  const notacion = r.slice(r.indexOf("# Notación y convenciones"));
  assert.match(notacion, /Manda la notación de la cátedra \(prácticos y parciales\) sobre la del libro/);
  assert.match(notacion, /distancia \$D\$, velocidad de propagación \$c\$, \$d_\{prop\}\$/);
  assert.match(notacion, /traducí una vez a la notación de la cátedra/);
});

// Un parcial con la solución integrada después de cada pregunta, como los de redes.
function parcial(c) {
  c.d.documentos.push({ id: "parcial", titulo: "Parcial", tipo: "evaluaciones", archivo: "fuentes/evaluaciones/parcial.pdf", paginas: 2 });
  c.d.items.parcial = [{ id: "1", paginas: [1], enunciado: "ENUNCIADO UNO sin puntos ni solución." },
    { id: "2", paginas: [1, 2], enunciado: "ENUNCIADO DOS: calcule el retardo.", puntos: 8 }, { id: "2-solucion", paginas: [2], enunciado: "SOLUCION DOS", solucion_de: "2" },
    { id: "3", paginas: [2], enunciado: "ENUNCIADO TRES: compare.", puntos: 10 }, { id: "3-solucion", paginas: [2], enunciado: "SOLUCION TRES", solucion_de: "3" }];
  c.tema.evaluaciones = [{ doc: "parcial", items: ["1", "2", "3"] }];
  c.escribir("_procesado/parcial/paginas/0001.md", "**Pregunta 1 (5 puntos)**\nENUNCIADO UNO sin puntos ni solución.\n**Solución**\nSOLUCION UNO\n**Pregunta 2 (8 puntos)**\nENUNCIADO DOS: calcule el retardo.");
  c.escribir("_procesado/parcial/paginas/0002.md", "**Solución**\nSOLUCION DOS\n### Pregunta 3 (10 puntos)\nENUNCIADO TRES: compare.\nSolución\nSOLUCION TRES");
}

test("E3: la reserva elige un ítem real de evaluación con solución y puntos, y los ítems nuevos no la cambian", t => {
  const c = curso(t);
  assert.deepEqual(reservas(c.raiz, c.d), {});
  parcial(c);
  assert.deepEqual(reservas(c.raiz, c.d), { retardos: { doc: "parcial", id: "2" } });
  // La preparación asigna otro ítem mejor: la elección no cambia porque el índice curado va primero.
  c.d.items.parcial.push({ id: "4", paginas: [2], enunciado: "CUATRO", puntos: 12 }, { id: "4-solucion", paginas: [2], enunciado: "S4", solucion_de: "4" });
  c.escribir("_procesado/asignaciones.json", JSON.stringify({ items: [{ doc: "parcial", id: "4", tema: "retardos" }] }));
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "2" });
  // La fijada en progreso.yaml manda; usada, se elige otra que no se haya practicado ni reservado.
  c.d.progreso.temas.retardos = { estado: "en_curso", reservado: [{ doc: "parcial", id: "3" }] };
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "3" });
  c.d.progreso.temas.retardos = { estado: "en_curso", reservado: [{ doc: "parcial", id: "3", usado: true }], ejercicios: [{ doc: "parcial", item: "2", resultado: "parcial" }] };
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "4" });
  // Si la fijada desaparece del banco (re-segmentación), se elige otra.
  c.d.progreso.temas.retardos = { estado: "en_curso", reservado: [{ doc: "parcial", id: "9" }] };
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "2" });
  // Nunca una solución ni un práctico.
  c.d.progreso.temas = {};
  c.tema.evaluaciones = [{ doc: "parcial", items: ["2-solucion"] }];
  c.d.documentos.push({ id: "practico", titulo: "Práctico", tipo: "ejercicios", archivo: "fuentes/ejercicios/p.pdf", paginas: 1 });
  c.d.items.practico = [{ id: "1", paginas: [1], enunciado: "Ejercicio", puntos: 3 }];
  c.tema.ejercicios = [{ doc: "practico", items: ["1"] }];
  assert.deepEqual(reservas(c.raiz, c.d).retardos, { doc: "parcial", id: "4" });
  rmSync(join(c.raiz, "_procesado/asignaciones.json"));
  assert.deepEqual(reservas(c.raiz, c.d), {});
});

test("E3: fuera del simulacro el reservado no está en el dossier, leer_items, leer_paginas ni buscar_material", t => {
  const c = curso(t);
  parcial(c);
  const r = reservados(c.raiz, c.d);
  assert.deepEqual([...r].sort(), ["parcial/2", "parcial/2-solucion"]);
  const d = dossier(c.raiz, c.d, c.tema, 3000, 1500);
  assert.ok(!d.includes("ENUNCIADO DOS") && !d.includes("parcial/2"));
  assert.match(d, /evaluaciones: parcial\/3 · ENUNCIADO TRES/);
  assert.match(d, /Simulacro: un ítem de evaluación del tema está reservado para \/simulacro/);
  assert.equal(leerItems(c.d, "parcial", ["2"], false, r), "parcial/2: Ese ítem está reservado para /simulacro; elegí otro.");
  assert.match(leerItems(c.d, "parcial", ["2-solucion"], true, r), /reservado para \/simulacro/);
  assert.doesNotMatch(leerItems(c.d, "parcial", ["2", "3"], true, r), /ENUNCIADO DOS|SOLUCION DOS/);
  // En el simulacro, leer_items sí lo devuelve (y su solución sólo con incluir_solucion).
  const permitido = reservados(c.raiz, c.d, { doc: "parcial", id: "2" });
  assert.match(leerItems(c.d, "parcial", ["2"], false, permitido), /^parcial\/2 \(8 puntos\)\nENUNCIADO DOS/);
  assert.match(leerItems(c.d, "parcial", ["2"], true, permitido), /Solución:\nSOLUCION DOS/);
  for (const despues of [false, true]) {
    const texto = leerPaginas(c.raiz, c.d, "parcial", 1, 2, despues, r);
    assert.ok(!/ENUNCIADO DOS|SOLUCION DOS|#page=/.test(texto), texto);
    assert.match(texto, /ENUNCIADO UNO[\s\S]*\[Pregunta reservada para \/simulacro\.\][\s\S]*ENUNCIADO TRES/);
    assert.equal(/SOLUCION UNO/.test(texto), despues);
  }
  // Sin el encabezado de la pregunta reservada no se puede separar: se rechaza.
  c.escribir("_procesado/parcial/paginas/0001.md", "**Pregunta 1 (5 puntos)**\nENUNCIADO UNO\n**Solución**\nSOLUCION UNO\nENUNCIADO DOS: calcule el retardo.");
  assert.throws(() => leerPaginas(c.raiz, c.d, "parcial", 2, 2, true, r), /traen un ítem reservado para \/simulacro/);
  // buscar_material ubica la página pero no ofrece leer el reservado.
  const fragmentos = [{ doc: "parcial", titulo: "Parcial", tipo: "evaluaciones", pagina: 1, seccion: "Pregunta 2", texto: "retardo calcule", cita: "", calidad: 1, pendiente: false }];
  for (const f of fragmentos) { f.largo = tokenizar(f.texto).length; f.frecuencias = Object.fromEntries(tokenizar(f.texto).map(w => [w, 1])); }
  c.escribir("_procesado/busqueda.json", JSON.stringify({ version: 1, normalizacion: "NFD-sin-tildes-v1", k1: 1.2, b: 0.75, cantidad: 1, largo_promedio: 2, df: { retardo: 1, calcule: 1 }, fragmentos }));
  const [hallado] = buscarMaterial(c.raiz, c.d, "retardo", undefined, r);
  assert.match(hallado.fragmento, /leer_items \(ítems: 1\)/);
});

// Vault sintético con pi simulado para los wrappers de sesion.ts y registrar_progreso con Python real.
function vault(t) {
  const c = curso(t), recursos = join(c.vault, ".pi");
  parcial(c);
  for (const p of [join(recursos, "skills/teach"), join(c.raiz, "sesiones")]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, "skills/teach/SKILL.md"), "TEACH"); writeFileSync(join(recursos, "modo-curso.md"), "MODO");
  writeFileSync(join(recursos, "curso.config.json"), JSON.stringify({ max_tokens_dossier: 3000, max_tokens_curso_md: 1500 }));
  writeFileSync(join(c.raiz, "indice.yaml"), JSON.stringify({ version: 1, documentos: c.d.documentos, temas: c.d.temas }));
  writeFileSync(join(c.raiz, "_procesado/parcial/items.yaml"), JSON.stringify({ items: c.d.items.parcial }));
  writeFileSync(join(c.raiz, "progreso.yaml"), "version: 1\ntemas: {}\nhistorial: []\n");
  const comandos = new Map(), eventos = new Map(), entradas = [], avisos = [], estados = {}, ordenes = [];
  const pi = { on: (n, h) => eventos.set(n, [...(eventos.get(n) || []), h]), registerCommand: (n, x) => comandos.set(n, x), registerTool: () => {},
    appendEntry: (customType, data) => entradas.push({ type: "custom", customType, data }), setSessionName: () => {}, sendMessage: (m, o) => ordenes.push({ ...m, ...o }),
    getAllTools: () => [], getActiveTools: () => [], setActiveTools: () => {}, exec: async () => ({ code: 0, stdout: JSON.stringify(c.d), stderr: "", killed: false }),
    events: { emit: (_n, p) => p.onComplete?.() } };
  const ctx = { hasUI: true, isIdle: () => true, sessionManager: { getBranch: () => entradas, getEntries: () => entradas, getSessionId: () => "s" },
    model: { provider: "prueba", id: "modelo" }, modelRegistry: { hasConfiguredAuth: () => true },
    ui: { notify: (m, tipo) => avisos.push([tipo, m]), setStatus: (k, v) => { estados[k] = v; }, select: async (_t, o) => o[0], confirm: async () => true } };
  const sesion = registrarSesion(pi, c.vault, recursos);
  return { ...c, recursos, pi, ctx, comandos, eventos, entradas, avisos, estados, ordenes, sesion };
}

test("E3: ver_pagina rechaza una página con el reservado, aun después del intento", async t => {
  const e = vault(t);
  await e.comandos.get("estudiar").handler("redes retardos", e.ctx);
  await assert.rejects(() => e.sesion.ver_pagina({ doc: "parcial", pagina: 2, despues_del_intento: true }), /^Error: Esa página trae un ítem reservado para \/simulacro; elegí otra\.$/);
  assert.doesNotMatch(e.sesion.leer_paginas({ doc: "parcial", desde: 1, hasta: 2 }), /ENUNCIADO DOS/);
  assert.match(e.sesion.leer_items({ doc: "parcial", ids: ["2"] }), /reservado para \/simulacro/);
  assert.match(e.sesion.leer_items({ doc: "parcial", ids: ["2"] }, { doc: "parcial", id: "2" }), /ENUNCIADO DOS/);
});

test("E3: registrar_progreso fija la reserva en progreso.yaml la primera vez", async t => {
  const e = vault(t);
  const progreso = registrarProgreso(e.pi, e.sesion, e.vault);
  await e.comandos.get("estudiar").handler("redes retardos", e.ctx);
  await progreso.registrar("1", { resumen: "probe" }, undefined, undefined, e.ctx);
  assert.match(readFileSync(join(e.raiz, "progreso.yaml"), "utf8"), /reservado:\n\s+- doc: parcial\n\s+id: '2'/);
  assert.deepEqual(e.sesion.actual().d.progreso.temas.retardos.reservado, [{ doc: "parcial", id: "2" }]);
});

test("E3 con el curso real: el reservado de cada tema no se ve en sol-prc20240926", t => {
  if (!existsSync(join(vaultDir, "cursos/redes/_procesado/sol-prc20240926/items.yaml"))) return t.skip("sin el curso redes");
  const d = redes(), raiz = join(vaultDir, "cursos/redes"), r = reservados(raiz, d), todas = reservas(raiz, d);
  for (const tema of ["capa-de-aplicacion", "capa-de-transporte"]) {
    const x = todas[tema], item = d.items[x.doc].find(i => i.id === x.id), sol = d.items[x.doc].find(i => i.solucion_de === x.id);
    assert.equal(x.doc, "sol-prc20240926");
    assert.ok(item.puntos && sol, "con puntos y solución oficial");
    const paginas = [...new Set([...item.paginas, ...sol.paginas])], fragmento = s => s.replace(/[*_\s]+/g, " ").slice(0, 60);
    for (const despues of [false, true]) {
      const texto = leerPaginas(raiz, d, x.doc, Math.min(...paginas), Math.max(...paginas), despues, r).replace(/[*_\s]+/g, " ");
      assert.ok(!texto.includes(fragmento(item.enunciado.split("\n")[0])), `${tema}: enunciado`);
      assert.ok(!texto.includes(fragmento(sol.enunciado.split("\n").at(-1))), `${tema}: solución`);
    }
    assert.match(leerItems(d, x.doc, [x.id], true, r), /Ese ítem está reservado para \/simulacro/);
    const tema_ = d.temas.find(t => t.id === tema);
    assert.ok(!dossier(raiz, d, tema_, 3000, 2000).includes(`${x.doc}/${x.id} `));
  }
});
