import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararInvestigacion, registrarResearcher, verificacionPrevia } from '../extensions/curso/researcher.ts';
import { agentDir, loadProject, importDependenciaPi } from '../scripts/lib/pi-sdk.mjs';

const agente = (modelo, cuerpo = 'PROMPT ESPAÑOL') => `---\nname: researcher\ntools: web_search, web_fetch, read\nmodel: ${modelo}\nthinking: medium\n---\n\n${cuerpo}\n`;
function limpiar(vault) {
  if (process.platform === 'win32') {
    const buscar = dir => { try { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? buscar(join(dir, e.name)) : e.name === 'trabajo.json' ? [join(dir, e.name)] : []); } catch { return []; } };
    for (const f of buscar(vault)) try { spawnSync('taskkill', ['/PID', String(JSON.parse(readFileSync(f, 'utf8')).pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ya terminó */ }
  }
  rmSync(vault, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
function entorno(t) {
  const vault = mkdtempSync(join(tmpdir(), 'pi-researcher-aud-')), recursos = join(vault, '.pi'), raiz = join(vault, 'cursos/calculo');
  t.after(() => limpiar(vault));
  for (const p of [join(recursos, 'agents'), join(raiz, '_procesado/libro/paginas')]) mkdirSync(p, { recursive: true });
  writeFileSync(join(recursos, 'curso.config.json'), JSON.stringify({ modelo_researcher: 'openai/gpt-6-luna', modelo_vision: 'openai/gpt-6-luna' }));
  writeFileSync(join(recursos, 'agents/researcher.md'), agente('openai/gpt-6-luna'));
  writeFileSync(join(raiz, 'curso.md'), 'Contrato'); writeFileSync(join(raiz, 'indice.yaml'), 'version: 1');
  for (const n of ['meta.json', 'calidad.json']) writeFileSync(join(raiz, '_procesado/libro', n), '{}');
  for (const p of [1, 2, 3]) writeFileSync(join(raiz, `_procesado/libro/paginas/000${p}.md`), `<!-- p. PDF ${p} -->\nPágina ${p}.`);
  const tema = { id: 'derivadas', nombre: 'Derivadas', alias: [], unidad: 1, objetivos: ['O1'], prerequisitos: [], bibliografia: [{ doc: 'libro', seccion: 'D', paginas: [1, 2] }] };
  const otro = { id: 'integrales', nombre: 'Integrales', alias: [], unidad: 1, objetivos: ['O2'], prerequisitos: [], bibliografia: [{ doc: 'libro', seccion: 'I', paginas: [3, 3] }] };
  const d = { curso: 'calculo', contrato: '# Objetivos\n- O1: Derivar.\n- O2: Integrar.\n# Cómo se evalúa\nParcial.', temas: [tema, otro], items: {}, progreso: { temas: {} }, avisos: [],
    documentos: [{ id: 'libro', titulo: 'Libro', tipo: 'bibliografia', archivo: 'fuentes/bibliografia/libro.pdf', paginas: 3, prioridad: 'principal' }] };
  return { vault, recursos, raiz, tema, otro, d, huella: () => prepararInvestigacion(vault, recursos, d, tema, 'alcance').huella };
}
function cache(e, nombre, entrada, texto) {
  const carpeta = join(e.raiz, 'notas/verificaciones'); mkdirSync(carpeta, { recursive: true });
  const body = `Fecha: 2026-10-21 · Modelo: gpt-6-luna\n\n${texto}\n`;
  writeFileSync(join(carpeta, nombre), `<!-- pi-learning-verificacion ${JSON.stringify({ version: 1, entrada, sha256: createHash('sha256').update(body).digest('hex') })} -->\n${body}`);
}

test('H32: la huella del alcance depende sólo del tema, sus páginas y el prompt del researcher', t => {
  const e = entorno(t), base = e.huella();
  writeFileSync(join(e.recursos, 'curso.config.json'), JSON.stringify({ modelo_researcher: 'openai-codex/gpt-6-luna', modelo_vision: 'openai-codex/otro' }));
  writeFileSync(join(e.recursos, 'agents/researcher.md'), agente('openai-codex/gpt-6-luna'));
  writeFileSync(join(e.raiz, 'indice.yaml'), 'version: 1\n# otro tema curado');
  writeFileSync(join(e.raiz, '_procesado/libro/calidad.json'), '{"0003": 0.4}');
  writeFileSync(join(e.raiz, '_procesado/libro/paginas/0003.md'), 'Página ajena editada.');
  e.otro.bibliografia[0].seccion = 'Integrales curadas'; e.d.contrato = e.d.contrato.replace('Integrar.', 'Integrar por partes.');
  assert.equal(e.huella(), base);
  writeFileSync(join(e.raiz, '_procesado/libro/paginas/0002.md'), 'Página adjuntada editada.');
  const editada = e.huella(); assert.notEqual(editada, base);
  writeFileSync(join(e.recursos, 'agents/researcher.md'), agente('openai-codex/gpt-6-luna', 'OTRO PROMPT'));
  assert.notEqual(e.huella(), editada);
  assert.equal(prepararInvestigacion(e.vault, e.recursos, e.d, e.tema, 'alcance').modelo, 'gpt-6-luna');
});

test('H32: una caché previa del tema se inyecta marcada «previa» y no bloquea el relanzamiento', t => {
  const e = entorno(t);
  cache(e, 'derivadas.md', 'f'.repeat(64), '## Resumen\nMAPA VIEJO');
  cache(e, 'integrales.md', 'f'.repeat(64), '## Resumen\nMAPA DE OTRO TEMA');
  const previa = verificacionPrevia(e.vault, e.recursos, e.d, e.tema);
  assert.match(previa, /previa/i); assert.match(previa, /MAPA VIEJO/); assert.doesNotMatch(previa, /vigente|OTRO TEMA/);
  cache(e, `derivadas-${e.huella()}.md`, e.huella(), '## Resumen\nMAPA NUEVO');
  const vigente = verificacionPrevia(e.vault, e.recursos, e.d, e.tema);
  assert.match(vigente, /vigente/); assert.match(vigente, /MAPA NUEVO/);
});

// researcher simulado: guarda sus argumentos y responde con un informe válido que cita la primera ancla.
function falso(e, cuerpo) {
  const f = join(e.vault, 'falso.mjs'); writeFileSync(f, `import { existsSync, readFileSync, writeFileSync } from 'node:fs';\nconst vault = ${JSON.stringify(e.vault)};\nwriteFileSync(${JSON.stringify(join(e.vault, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));\n${cuerpo}`);
  return [process.execPath, f];
}
const informe = `const cita = readFileSync(0, 'utf8').match(/\\[\\[cursos\\/[^\\]]+#page=\\d+\\]\\]/)[0];
console.log('## Resumen\\nMapa.\\n## Contra el material del curso\\nconcuerda ' + cita + '\\n## Extensiones útiles\\nNinguna.\\n## Fuentes\\nhttps://example.org/');`;
function runtime(e, comando, ...extra) {
  const entradas = [], eventos = new Map(), avisos = [], mensajes = [];
  let activo = { a: { curso: 'calculo', tema: 'derivadas' }, d: e.d, r: e.raiz };
  const pi = { on: (n, h) => eventos.set(n, h), appendEntry: (customType, data) => entradas.push({ type: 'custom', customType, data }), events: { emit: () => {} }, sendMessage: (m, o) => mensajes.push([m, o]) };
  const ctx = { sessionManager: { getBranch: () => entradas }, ui: { notify: (m, tipo) => avisos.push([m, tipo]) }, executeTool: assert.fail,
    modelRegistry: { find: (proveedor, id) => ({ provider: proveedor, id }), hasConfiguredAuth: modelo => r.credenciales && modelo.provider === 'openai' && modelo.id === 'gpt-6-luna' } };
  const r = { entradas, avisos, mensajes, ctx, credenciales: true, set activo(v) { activo = v; },
    construir: () => registrarResearcher(pi, () => activo, () => verificacionPrevia(e.vault, e.recursos, e.d, e.tema), e.vault, e.recursos, comando, ...extra),
    alcance: (afirmaciones = ['La derivada de x² es 2x.']) => r.investigar('1', { modo: 'alcance', afirmaciones }, undefined, undefined, ctx),
    async turno() { const ev = { type: 'before_agent_start', messageType: 'user', prompt: 'Sigo', systemPromptOptions: { sections: {} } }; await eventos.get('before_agent_start')(ev, ctx); return ev; } };
  r.investigar = r.construir();
  return r;
}
const carpeta = (e, nombre) => join(e.raiz, 'notas/verificaciones/.trabajos', nombre);
async function esperar(cond, ms = 10_000) {
  for (const fin = Date.now() + ms; !cond(); await new Promise(r => setTimeout(r, 20))) if (Date.now() > fin) throw new Error('Tiempo de espera agotado.');
}

test('H07: investigar_tema lanza un pi propio sin tmux ni subagent, vuelve enseguida y entrega sin turnos', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe));
  const inicio = performance.now(), res = await r.alcance(), ms = performance.now() - inicio;
  assert.ok(ms < 500, `${ms} ms`); assert.equal(res.isError, undefined);
  assert.ok(res.content[0].text.length <= 80); assert.doesNotMatch(res.content[0].text, /subagent|researcher|[A-Z][a-z]+ [a-z]+ in /);
  const dir = carpeta(e, res.details.nombre);
  await esperar(() => existsSync(join(dir, 'codigo')));
  const argv = JSON.parse(readFileSync(join(e.vault, 'argv.json'), 'utf8')), valor = f => argv[argv.indexOf(f) + 1];
  for (const f of ['-p', '--no-session', '--no-approve', '--no-extensions', '--no-skills', '--no-context-files']) assert.ok(argv.includes(f), f);
  assert.equal(valor('--model'), 'openai/gpt-6-luna'); assert.equal(valor('--thinking'), 'medium'); assert.equal(valor('--tools'), 'web_search,web_fetch,read');
  assert.equal(readFileSync(valor('--append-system-prompt'), 'utf8'), 'PROMPT ESPAÑOL');
  const ev = await r.turno();
  assert.deepEqual(r.avisos, [['Verificación del material lista.', 'info']]);
  assert.match(ev.systemPromptOptions.sections.curso, /vigente/);
  assert.equal(r.mensajes.length, 1); const [mensaje, opciones] = r.mensajes[0];
  assert.equal(mensaje.display, false); assert.equal(opciones.triggerTurn, undefined); assert.equal(opciones.deliverAs, 'nextTurn'); assert.match(mensaje.content, /## Resumen/);
  assert.ok(!existsSync(dir));
  await r.turno(); assert.equal(r.avisos.length, 1); assert.equal(r.mensajes.length, 1);
});

test('H07: tras /fin el informe se guarda en silencio, sin avisos ni mensajes', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe));
  const res = await r.alcance(); r.activo = undefined;
  await esperar(() => existsSync(join(carpeta(e, res.details.nombre), 'codigo')));
  await r.turno();
  assert.deepEqual(r.avisos, []); assert.deepEqual(r.mensajes, []);
  assert.equal(r.entradas.at(-1).data.estado, 'guardada');
  assert.match(verificacionPrevia(e.vault, e.recursos, e.d, e.tema), /vigente/);
});

test('H33: la sesión que encuentra en curso el trabajo de otra (pi cerrado) recibe el informe al terminar', async t => {
  const e = entorno(t), lento = falso(e, `await new Promise(r => setTimeout(r, 500));\n${informe}`);
  const r = runtime(e, lento), otra = runtime(e, lento);
  const res = await r.alcance();
  assert.match((await otra.alcance()).content[0].text, /en curso/);
  await esperar(() => existsSync(join(carpeta(e, res.details.nombre), 'codigo')));
  await otra.turno();
  assert.deepEqual(otra.avisos, [['Verificación del material lista.', 'info']]); assert.equal(otra.mensajes.length, 1);
  await r.turno(); assert.deepEqual(r.avisos, []);
});

// Nunca entrega; termina solo cuando el test borra el vault.
const eterno = `setInterval(() => { if (!existsSync(vault)) process.exit(0); }, 100);`;
const matar = dir => { try {
  const pid = JSON.parse(readFileSync(join(dir, 'trabajo.json'), 'utf8')).pid;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); else process.kill(-pid, 'SIGKILL');
} catch { /* Ya terminó. */ } };
test('H33: un researcher muerto sin informe no bloquea el alcance tras /reload y no sugiere subagent_message', async t => {
  const e = entorno(t), r = runtime(e, falso(e, eterno));
  const res = await r.alcance(), dir = carpeta(e, res.details.nombre);
  t.after(() => matar(dir));
  const repetido = await r.alcance();
  assert.match(repetido.content[0].text, /en curso/); assert.equal(r.entradas.filter(x => x.data.tipo === 'inicio').length, 1);
  await esperar(() => existsSync(join(dir, 'error.txt'))); matar(dir);
  await esperar(() => { try { process.kill(JSON.parse(readFileSync(join(dir, 'trabajo.json'), 'utf8')).pid, 0); return false; } catch { return true; } });
  r.investigar = r.construir();
  await r.turno();
  assert.equal(r.entradas.at(-1).data.estado, 'interrumpida'); assert.equal(r.avisos.length, 1);
  r.investigar = r.construir();
  const relanzado = await r.alcance();
  assert.equal(relanzado.isError, undefined); assert.doesNotMatch(JSON.stringify([res, repetido, relanzado, r.mensajes]), /subagent_message|despachada/);
  assert.equal(r.entradas.filter(x => x.data.tipo === 'inicio').length, 2);
});

test('H33: un informe terminado se recupera por huella desde otra sesión, sin relanzar', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe));
  const res = await r.alcance();
  await esperar(() => existsSync(join(carpeta(e, res.details.nombre), 'codigo')));
  const otra = runtime(e, falso(e, informe));
  assert.match(verificacionPrevia(e.vault, e.recursos, e.d, e.tema), /vigente/);
  const cache = await otra.alcance();
  assert.equal(cache.details.cache, true); assert.equal(otra.entradas.length, 0);
  await r.turno(); assert.equal(r.entradas.at(-1).data.tipo, 'fin'); assert.deepEqual(r.avisos, []);
});

test('H34: el researcher colgado se mata al vencer el plazo, avisa una vez y espera antes de relanzar', async t => {
  const e = entorno(t), r = runtime(e, falso(e, eterno), 1);
  const res = await r.alcance(), dir = carpeta(e, res.details.nombre);
  t.after(() => matar(dir));
  await esperar(() => existsSync(join(dir, 'codigo')));
  const { pid } = JSON.parse(readFileSync(join(dir, 'trabajo.json'), 'utf8'));
  await esperar(() => { try { process.kill(-pid, 0); return false; } catch { return true; } });
  await r.turno(); await r.turno();
  assert.equal(r.entradas.at(-1).data.estado, 'vencida');
  assert.deepEqual(r.avisos, [['Verificación del material no disponible; seguimos con el material del curso.', 'warning']]);
  assert.equal(r.mensajes.length, 1); assert.equal(r.mensajes[0][1].triggerTurn, undefined);
  const otra = await r.alcance();
  assert.equal(otra.isError, true); assert.doesNotMatch(otra.content[0].text, /en curso|despachada/); assert.match(otra.content[0].text, /no disponible/);
  assert.equal(r.entradas.filter(x => x.data.tipo === 'inicio').length, 1);
});

test('H34: un plazo vencido que el dossier recogió primero se avisa como no disponible, no como lista', async t => {
  const e = entorno(t), r = runtime(e, falso(e, eterno), 1);
  const res = await r.alcance(), dir = carpeta(e, res.details.nombre);
  t.after(() => matar(dir));
  await esperar(() => existsSync(join(dir, 'codigo')));
  verificacionPrevia(e.vault, e.recursos, e.d, e.tema); // restaurar o registrar_progreso arman el dossier antes del turno
  await r.turno();
  assert.equal(r.entradas.at(-1).data.estado, 'vencida');
  assert.deepEqual(r.avisos, [['Verificación del material no disponible; seguimos con el material del curso.', 'warning']]);
  assert.equal(r.mensajes.length, 1); assert.doesNotMatch(r.mensajes[0][0].content, /^Informe/);
});

// DA58: el repo fija el researcher en openai-codex; learn tiene que andar con la clave que tenga el alumno.
test('DA58: sin credenciales para el modelo del researcher, se lanza con el de la conversación', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe));
  r.ctx.model = { provider: 'anthropic', id: 'claude-sonnet-5-5' };
  r.ctx.modelRegistry.hasConfiguredAuth = modelo => modelo.provider === 'anthropic';
  const res = await r.alcance();
  assert.equal(res.isError, undefined, res.content[0].text);
  await esperar(() => existsSync(join(carpeta(e, res.details.nombre), 'codigo')));
  const argv = JSON.parse(readFileSync(join(e.vault, 'argv.json'), 'utf8'));
  assert.equal(argv[argv.indexOf('--model') + 1], 'anthropic/claude-sonnet-5-5');
});

test('H34: sin credenciales del modelo del researcher no se lanza nada', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe)); r.credenciales = false;
  const res = await r.alcance();
  assert.equal(res.isError, true); assert.match(res.content[0].text, /^Verificación externa no disponible: [^\n]+$/);
  assert.equal(r.entradas.length, 0); assert.ok(!existsSync(join(e.raiz, 'notas/verificaciones/.trabajos')));
});

test('H08: alcance acepta afirmaciones omitidas y guarda un mapa sin veredictos; verificar las sigue exigiendo', async t => {
  const e = entorno(t), r = runtime(e, falso(e, informe.replace("concuerda ' + cita", "' + cita")));
  const sin = await r.investigar('1', { modo: 'verificar' }, undefined, undefined, r.ctx);
  assert.equal(sin.isError, true); assert.equal(r.entradas.length, 0);
  const res = await r.investigar('2', { modo: 'alcance' }, undefined, undefined, r.ctx);
  assert.equal(res.isError, undefined); assert.equal(res.content[0].text, 'Verificación en segundo plano; seguí con el material.');
  assert.match(r.entradas[0].data.pedido.tarea, /Afirmaciones recibidas[^\n]*\nNinguna/);
  await esperar(() => existsSync(join(carpeta(e, res.details.nombre), 'codigo')));
  await r.turno(); assert.equal(r.entradas.at(-1).data.estado, 'guardada');
  const p = await loadProject();
  try { assert.ok(!p.session.getAllTools().find(x => x.name === 'investigar_tema').parameters.required.includes('afirmaciones')); }
  finally { await p.close(); }
});

test('H08: alcance con afirmaciones vacías pasa el validador de pi, sin «Validation failed» ni argumentos a la vista', async () => {
  const p = await loadProject();
  try {
    const { validateToolArguments } = await importDependenciaPi("@earendil-works/pi-ai");
    const tool = p.session.getAllTools().find(x => x.name === 'investigar_tema');
    assert.deepEqual(validateToolArguments(tool, { name: 'investigar_tema', arguments: { modo: 'alcance', afirmaciones: [] } }), { modo: 'alcance', afirmaciones: [] });
  } finally { await p.close(); }
});
