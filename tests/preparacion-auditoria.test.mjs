import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acotar, dossier, leerPaginas } from "../extensions/curso/material.ts";
import { agentDir, loadProject } from "../scripts/lib/pi-sdk.mjs";

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
