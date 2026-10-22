import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerPaginas } from "../extensions/curso/material.ts";
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
