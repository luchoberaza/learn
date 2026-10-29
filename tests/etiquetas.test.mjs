import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { etiquetaLlamada, etiquetaResultado, textoParcial, TOOLS_DEL_CURSO } from "../extensions/curso/etiquetas.ts";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

// etiquetas.ts se importa sin pi ni pi-tui (lo usa la app de escritorio) y da las mismas líneas que la terminal.
let p;
before(async () => { p = await loadProject(); p.sdk.initTheme("dark"); });
after(() => p?.close());

const casos = [
  ["leer_paginas", { doc: "kurose", desde: 54, hasta: 57 }, { content: [{ type: "text", text: "TEXTO DEL LIBRO" }] }],
  ["leer_items", { doc: "parcial", ids: ["3"] }, { content: [{ type: "text", text: "ENUNCIADO" }] }],
  ["buscar_material", { consulta: "retardo" }, { content: [{ type: "text", text: "[]" }] }],
  ["ver_pagina", { doc: "kurose", pagina: 54 }, { content: [{ type: "text", text: "[[k.pdf#page=54]]" }], details: { render: "x.png" } }],
  ["registrar_progreso", { resumen: "r" }, { content: [{ type: "text", text: "Progreso guardado" }], details: { sin_cambios: true } }],
  ["investigar_tema", { modo: "alcance" }, { content: [{ type: "text", text: "Caché" }], details: { cache: true } }],
  ["guardar_curso", { curso: "redes" }, { content: [{ type: "text", text: "Sin cambios; no se escribió ningún archivo." }] }],
  ["transcribir_paginas", { doc: "p", paginas: [1, 2] }, { content: [{ type: "text", text: "x" }], details: { transcritas: 2, cache: 0, fallidas: [] } }],
  ["guardar_items", { doc: "p" }, { content: [{ type: "text", text: "x" }], details: { items: 3 } }],
  ["leer_sesion_anterior", {}, { content: [{ type: "text", text: "LOG" }] }],
];

test("etiquetas: cubre cada tool del curso y nunca muestra el texto del resultado", () => {
  assert.deepEqual([...TOOLS_DEL_CURSO].sort(), casos.map(c => c[0]).sort());
  for (const [nombre, args, resultado] of casos) {
    const hecho = etiquetaResultado(nombre, args, resultado, false);
    assert.ok(hecho, nombre);
    assert.doesNotMatch(hecho, /TEXTO DEL LIBRO|ENUNCIADO|LOG|\[\[/);
  }
  assert.equal(etiquetaLlamada("leer_paginas", { doc: "kurose", desde: 54, hasta: 57 }), "Leyendo PDF 54–57 de kurose");
  assert.equal(etiquetaResultado("leer_paginas", { doc: "kurose", desde: 54, hasta: 57 }, casos[0][2], false), "Leí PDF 54–57 de kurose");
  assert.equal(etiquetaResultado("registrar_progreso", {}, { content: [{ type: "text", text: "Progreso no guardado: no hay permiso." }] }, true), "No se guardó el progreso: no hay permiso.");
  assert.equal(etiquetaResultado("registrar_progreso", {}, { content: [{ type: "text", text: "Validation failed for tool" }] }, true), "No se guardó el progreso");
  assert.equal(etiquetaLlamada("bash", {}), undefined); assert.equal(etiquetaResultado("quiz", {}, {}, false), undefined);
  assert.equal(textoParcial("guardar_curso", { content: [{ type: "text", text: "+Un tema" }] }), "+Un tema");
  assert.equal(textoParcial("leer_paginas", casos[0][2]), undefined);
});

test("etiquetas: la terminal dibuja exactamente las mismas líneas", () => {
  // Fila real de pi (ToolExecutionComponent) con los renderers que resuelve la sesión, como en presentacion-auditoria.
  const limpio = l => l.replace(/\x1b\[[0-9;]*m/g, "").trim();
  let comparadas = 0;
  for (const [nombre, args, resultado] of casos) {
    const { session, sdk } = p, def = session.extensionRunner.resolveToolRenderers(nombre, () => session.getToolDefinition(nombre));
    const c = new sdk.ToolExecutionComponent(nombre, "t1", args, {}, def, { requestRender() {} }, process.cwd());
    c.setArgsComplete(); c.markExecutionStarted();
    assert.deepEqual(c.render(200).map(limpio).filter(Boolean), [etiquetaLlamada(nombre, args)], `llamada ${nombre}`);
    c.updateResult({ isError: false, ...resultado }, false);
    assert.deepEqual(c.render(200).map(limpio).filter(Boolean), [etiquetaResultado(nombre, args, resultado, false)], `resultado ${nombre}`);
    comparadas++;
  }
  assert.equal(comparadas, casos.length);
});
