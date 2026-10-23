import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dossier } from "../extensions/curso/material.ts";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

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
