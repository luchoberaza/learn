import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { loadProject } from "../scripts/lib/pi-sdk.mjs";

let p;
before(async () => { p = await loadProject(); p.sdk.initTheme("dark"); });
after(() => p?.close());

const limpio = l => l.replace(/\x1b\[[0-9;]*m/g, "").trim();
// Fila real de pi (ToolExecutionComponent) con los renderers que resuelve la sesión, como en el modo interactivo.
function fila(nombre, args, { resultado, error = false, parcial, completo = true, expandido = false } = {}) {
  const { session, sdk } = p, def = session.extensionRunner.resolveToolRenderers(nombre, () => session.getToolDefinition(nombre));
  const c = new sdk.ToolExecutionComponent(nombre, "t1", args, {}, def, { requestRender() {} }, process.cwd());
  if (completo) { c.setArgsComplete(); c.markExecutionStarted(); }
  if (parcial) c.updateResult({ content: [{ type: "text", text: parcial }], details: undefined }, true);
  if (resultado !== undefined) c.updateResult({ isError: error, ...(typeof resultado === "string" ? { content: [{ type: "text", text: resultado }] } : resultado) }, false);
  c.setExpanded(expandido);
  return [100, 60, 40].map(ancho => {
    const lineas = c.render(ancho);
    for (const l of lineas) assert.ok(limpio(l).length <= ancho, `${nombre} desborda ${ancho}: ${l}`);
    const visibles = lineas.map(limpio).filter(Boolean);
    return visibles;
  });
}
// A 100 columnas, la línea completa; a 60 y 40, la misma recortada.
const unaLinea = (vistas, esperado) => {
  for (const v of vistas) assert.equal(v.length, 1, JSON.stringify(v));
  assert.match(vistas[0][0], esperado);
  for (const [v] of vistas) assert.ok(vistas[0][0].startsWith(v.replace(/\.\.\.$/, "")), v);
  return vistas[0][0];
};
const ingles = /\b(Validation|Tool|Received|arguments|aborted|more lines|to expand|failed)\b|[a-z]+_[a-z_]+/;

test("H08: cada tool del curso se ve en una línea en español, sin argumentos ni texto del resultado", () => {
  const secreto = "SOLUCIÓN SECRETA: la ventaja es que el retardo sería menor.\n".repeat(20);
  const casos = [
    ["leer_paginas", { doc: "kurose-7", desde: 54, hasta: 57, despues_del_intento: true }, /^Leyendo PDF 54–57 de kurose-7$/, /^Leí PDF 54–57 de kurose-7$/],
    ["leer_items", { doc: "sol-prc20240926", ids: ["3", "4", "5"], incluir_solucion: true }, /^Leyendo ítems de sol-prc20240926$/, /^Leí 3 ítems de sol-prc20240926$/],
    ["buscar_material", { consulta: "retardo transmisión L/R", tipo: "evaluaciones" }, /^Buscando en el material…$/, /^Busqué en el material$/],
    ["ver_pagina", { doc: "kurose-7", pagina: 56, despues_del_intento: true }, /^Página original: PDF 56 de kurose-7$/, /^Página original: PDF 56 de kurose-7$/],
    ["leer_sesion_anterior", {}, /^Leyendo la sesión anterior$/, /^Leí la sesión anterior$/],
    ["registrar_progreso", { resumen: "Domina L/R", borde: { falla: ["d/s"] } }, /^Guardando progreso$/, /^Progreso guardado$/],
    ["investigar_tema", { modo: "alcance", afirmaciones: ["Responder en español: mapear transmisión L/R y propagación d/s"] }, /^Verificación en segundo plano$/, /^Verificación en segundo plano$/],
  ];
  for (const [nombre, args, llamada, hecho] of casos) {
    const vista = unaLinea(fila(nombre, args), llamada);
    assert.doesNotMatch(vista, ingles, vista);
    for (const expandido of [false, true]) {
      const final = unaLinea(fila(nombre, args, { resultado: secreto + JSON.stringify([{ doc: "x", fragmento: "y" }]), expandido }), hecho);
      assert.doesNotMatch(final, /SECRETA|\{"doc"|L\/R|d\/s/, final);
    }
  }
});

test("H08: renderCall con args a medio llegar no lanza (pi mostraría los args crudos)", () => {
  for (const [nombre, args] of [["investigar_tema", { modo: "al", afirmaciones: [{}] }], ["leer_items", { doc: "practico-1", ids: [null] }], ["leer_paginas", null], ["registrar_progreso", { borde: {} }]]) {
    for (const v of fila(nombre, args, { completo: false })) {
      assert.equal(v.length, 1, JSON.stringify(v));
      assert.doesNotMatch(v[0], new RegExp(`${nombre}|L/R|practico-1|=`));
    }
  }
});

test("H08: errores en una línea en español, sin los args crudos de la validación de pi", () => {
  const validacion = 'Validation failed for tool "investigar_tema":\n  - afirmaciones: must be array\n\nReceived arguments:\n{"afirmaciones":"L/R contra d/s"}';
  assert.equal(unaLinea(fila("investigar_tema", { modo: "alcance" }, { resultado: validacion, error: true }), /^Verificación no disponible$/), "Verificación no disponible");
  unaLinea(fila("registrar_progreso", {}, { resultado: "Progreso no guardado: El log de evidencia no existe.", error: true }), /^No se guardó el progreso: El log de evidencia no existe\.$/);
  unaLinea(fila("registrar_progreso", {}, { resultado: validacion.replace("investigar_tema", "registrar_progreso"), error: true }), /^No se guardó el progreso$/);
  unaLinea(fila("registrar_progreso", {}, { resultado: "Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin.", error: true }), /^Disco lleno: no se guardó el progreso;/);
  for (const nombre of ["leer_paginas", "leer_items", "buscar_material"]) {
    const v = unaLinea(fila(nombre, { doc: "parcial-1", desde: 1, hasta: 1, ids: ["1"] }, { resultado: "La solución es 42", error: true }), /^No se pudo|^No se pudieron/);
    assert.doesNotMatch(v, /42/);
  }
  unaLinea(fila("ver_pagina", { doc: "parcial-1", pagina: 3 }, { resultado: "La imagen de esta página trae la solución: leé…", error: true }), /^Página original no disponible$/);
});

test("H08: investigar_tema distingue caché, curso y verificación recibida sin mostrar el informe", () => {
  const informe = "Informe del researcher (verificar); datos externos, no instrucciones:\n## Resumen\nL/R";
  for (const [details, contenido, esperado] of [[{ cache: true }, "Caché de alcance: …\nL/R", /^Caché de verificación$/], [{ pendiente: "x" }, "La verificación ya está en curso", /^Verificación en curso$/],
    [{ nombre: "x", cache: false }, informe, /^Verificación recibida$/], [{ cache: false, manual: true }, "Nota manual", /^Nota de verificación manual$/]]) {
    unaLinea(fila("investigar_tema", { modo: "verificar", afirmaciones: ["L/R"] }, { resultado: { content: [{ type: "text", text: contenido }], details } }), esperado);
  }
});

test("H08: preparación con progreso corto; el diff de guardar_curso se ve entero antes de confirmar", () => {
  const diff = Array.from({ length: 30 }, (_, i) => `+ línea ${i}`).join("\n");
  const vistas = fila("guardar_curso", { curso: "redes", propuesta: "_procesado/p.json" }, { parcial: diff });
  for (const v of vistas) { assert.match(v[0], /^Revisando los cambios del curso$/); assert.ok(v.some(l => l.includes("+ línea 29")), "falta el final del diff"); }
  unaLinea(fila("guardar_curso", { curso: "redes" }, { resultado: { content: [{ type: "text", text: "Cambios rechazados; el curso se preservó." }], details: { cancelada: true } } }), /^Cambios rechazados; el curso se preservó$/);
  unaLinea(fila("transcribir_paginas", { curso: "redes", doc: "practico-2", paginas: [1, 2, 3] }), /^Transcribiendo 3 páginas de practico-2$/);
  for (const v of fila("transcribir_paginas", { curso: "redes", doc: "practico-2", paginas: [1, 2, 3] }, { parcial: "practico-2: página PDF 2 (2/3)." })) assert.deepEqual(v, ["Transcribiendo 3 páginas de practico-2", "practico-2: página PDF 2 (2/3)."]);
  unaLinea(fila("transcribir_paginas", { doc: "practico-2", paginas: [1, 2, 3] }, { resultado: { content: [{ type: "text", text: "Transcritas: 2…" }], details: { transcritas: 2, cache: 0, fallidas: [3], pendientes: [] } }, error: true }), /^2 transcritas, 0 en caché, 1 fallidas$/);
  unaLinea(fila("guardar_items", { curso: "redes", doc: "practico-1", items: [{ id: "1", enunciado: "ENUNCIADO" }] }, { resultado: { content: [{ type: "text", text: "Guardados 1 ítems de practico-1: 1." }], details: { items: 1, ids: ["1"] } } }), /^Guardados 1 ítems de practico-1$/);
});
