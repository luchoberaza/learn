import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { agentDir, loadProject } from "../scripts/lib/pi-sdk.mjs";

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
