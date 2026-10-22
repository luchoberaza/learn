import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { agentDir, loadProject, piDir, vaultDir } from "../scripts/lib/pi-sdk.mjs";

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

test("H09/X04: «Working» y «Thinking...» quedan en español desde el arranque", async t => {
  const { sdk } = p, etiquetas = {};
  const { session } = await sdk.createAgentSession({ cwd: vaultDir, agentDir, settingsManager: p.session.settingsManager, resourceLoader: p.loader, sessionManager: sdk.SessionManager.inMemory() });
  t.after(() => session.dispose());
  await session.bindExtensions({ uiContext: new Proxy({ setWorkingMessage: m => { etiquetas.trabajando = m; }, setHiddenThinkingLabel: m => { etiquetas.pensando = m; } }, { get: (o, k) => o[k] ?? (() => {}) }) });
  assert.deepEqual(etiquetas, { trabajando: "Trabajando…", pensando: "Pensando…" });
  const mensaje = new sdk.AssistantMessageComponent({ role: "assistant", content: [{ type: "thinking", thinking: "I wonder if I can end the turn" }, { type: "text", text: "Seguimos." }] }, true, undefined, etiquetas.pensando);
  const visto = mensaje.render(60).map(limpio).join("\n");
  assert.match(visto, /Pensando…/); assert.doesNotMatch(visto, /Thinking|wonder/);
});

// Sesión con un proveedor falso (sin red ni modelo) y el curso activo restaurado de la rama.
async function conFaux(t, entradas) {
  const raiz = process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install"), { sdk } = p;
  const ai = await import(pathToFileURL(join(raiz, "releases", readFileSync(join(raiz, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-ai/dist/index.js")).href);
  const faux = ai.fauxProvider({ provider: "faux", models: [{ id: "faux-1", contextWindow: 200000, maxTokens: 8000 }] });
  const settingsManager = sdk.SettingsManager.create(vaultDir, agentDir, { projectTrusted: true });
  const loader = new sdk.DefaultResourceLoader({ cwd: vaultDir, agentDir, settingsManager, extensionFactories: [pi => pi.registerProvider(faux.provider)] });
  await loader.reload();
  const sessionManager = sdk.SessionManager.inMemory();
  sessionManager.appendCustomEntry("curso", { curso: "redes", tema: "retardos", log: "cursos/redes/sesiones/2026-10-22-retardos.md" });
  const uso = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  const { session } = await sdk.createAgentSession({ cwd: vaultDir, agentDir, settingsManager, resourceLoader: loader, sessionManager, model: faux.getModel(), thinkingLevel: "off" });
  t.after(async () => { await session.extensionRunner.emit({ type: "session_shutdown" }); session.dispose(); });
  await session.bindExtensions({});
  if (session.model?.provider !== "faux") await session.setModel(faux.getModel());
  settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
  for (const m of entradas) sessionManager.appendMessage({ timestamp: Date.now(), ...(m.role === "assistant" ? { provider: "faux", model: "faux-1", api: faux.api, usage: uso, stopReason: "stop" } : {}), ...m });
  return { ai, faux, session };
}

const charla = [
  { role: "user", content: [{ type: "text", text: "Empecemos con retardos" }] },
  { role: "assistant", content: [{ type: "text", text: "Primera pregunta." }, { type: "toolCall", id: "q1", name: "quiz", arguments: { question: "¿Qué cambia si se duplica R?" } }], stopReason: "toolUse" },
  { role: "toolResult", toolCallId: "q1", toolName: "quiz", content: [{ type: "text", text: "El estudiante cerró el quiz sin responder." }], isError: false },
  { role: "user", content: [{ type: "text", text: "sigamos" }] },
  { role: "assistant", content: [{ type: "text", text: "Dale." }] },
];

test("H62: /compact resume en español con curso, tema y log, y no califica el quiz sin responder", async t => {
  const { ai, faux, session } = await conFaux(t, charla), pedidos = [];
  faux.setResponses([c => { pedidos.push(c); return ai.fauxAssistantMessage("## Curso y tema\nredes · retardos"); }]);
  const r = await session.compact();
  assert.equal(pedidos.length, 1, "una sola llamada, también con el turno partido");
  const pedido = JSON.stringify(pedidos[0].messages);
  for (const parte of ["## Curso y tema", "## Borde", "## Práctica", "## Próximo paso", "pendiente, sin responder", "nunca lo califiques", "curso redes, tema retardos, log cursos/redes/sesiones/2026-10-22-retardos.md", "¿Qué cambia si se duplica R?"]) assert.ok(pedido.includes(parte), parte);
  assert.doesNotMatch(pedido, /## Goal|In Progress|Blocked|Turn Context/);
  assert.equal(r.summary, "## Curso y tema\nredes · retardos");
});

test("H62: si el resumen en español falla, pi sigue con el suyo y la sesión no se corta", async t => {
  const { ai, faux, session } = await conFaux(t, charla);
  faux.setResponses([ai.fauxAssistantMessage("", { stopReason: "error", errorMessage: "sin red" }), ai.fauxAssistantMessage("resumen de pi"), ai.fauxAssistantMessage("resumen de pi")]);
  assert.match((await session.compact()).summary, /resumen de pi/);
});

test("H80: el doctor revisa timeout, la web del researcher y el renombre a web_fetch en vez de safe_bash", t => {
  const agente = mkdtempSync(join(tmpdir(), "pi-doctor-web-")), vacio = mkdtempSync(join(tmpdir(), "pi-doctor-path-"));
  t.after(() => { rmSync(agente, { recursive: true, force: true }); rmSync(vacio, { recursive: true, force: true }); });
  const { toolNames, ...sinRenombre } = JSON.parse(readFileSync(join(piDir, "config/web-search.json"), "utf8"));
  writeFileSync(join(agente, "web-search.json"), JSON.stringify(sinRenombre));
  const doctor = env => spawnSync(process.execPath, [join(piDir, "scripts/doctor"), "--sin-red"], { cwd: vaultDir, encoding: "utf8", timeout: 120000,
    env: { ...process.env, PI_CODING_AGENT_DIR: agente, PI_MANAGED_INSTALL_ROOT: process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install"), ...env } }).stdout;
  const salida = doctor({});
  assert.match(salida, new RegExp(`^✗ web_fetch del researcher: ${join(agente, "web-search.json")}: toolNames\\.fetchContent = null; debe ser "web_fetch"`, "m"));
  assert.match(salida, /^✓ timeout \(coreutils\)/m);
  assert.match(salida, /^✓ Web del researcher: \.pi\/npm\/node_modules\/pi-web-access\/dist\/index\.js/m);
  assert.doesNotMatch(salida, /safe_bash|puente web/);
  assert.match(doctor({ PATH: vacio }), /^✗ timeout \(coreutils\): .*instalá coreutils$/m);
});

test("loadProject carga las skills como pi-learn (-ns --skill .pi/skills): sin globales ni choque con teach", t => {
  const home = mkdtempSync(join(tmpdir(), "pi-sdk-skills-")), agente = join(home, ".pi/agent");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  for (const [nombre, ruta] of [["teach", join(home, ".agents/skills/teach")], ["ajena", join(agente, "skills/ajena")]]) {
    mkdirSync(ruta, { recursive: true });
    writeFileSync(join(ruta, "SKILL.md"), `---\nname: ${nombre}\ndescription: Global ajena al tutor.\n---\nAjena.\n`);
  }
  const codigo = `const { loadProject } = await import(${JSON.stringify(pathToFileURL(join(piDir, "scripts/lib/pi-sdk.mjs")).href)});
const p = await loadProject(), s = p.loader.getSkills();
console.log(JSON.stringify({ nombres: s.skills.map(x => x.name), choques: s.diagnostics.filter(d => d.type === "collision").length, teach: s.skills.find(x => x.name === "teach")?.filePath }));
await p.close(); process.exit(0);`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", codigo], { encoding: "utf8", timeout: 60000,
    env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agente, PI_MANAGED_INSTALL_ROOT: process.env.PI_MANAGED_INSTALL_ROOT || join(agentDir, "install"), PI_OFFLINE: "1" } });
  const { nombres, choques, teach } = JSON.parse(r.stdout.trim().split("\n").at(-1));
  assert.equal(choques, 0);
  assert.ok(!nombres.includes("ajena"));
  for (const n of ["teach", "curso-nuevo", "curso-agregar"]) assert.ok(nombres.includes(n), n);
  assert.equal(teach, join(piDir, "skills/teach/SKILL.md"));
});
