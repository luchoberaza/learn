import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararInvestigacion, verificacionPrevia } from '../extensions/curso/researcher.ts';

const agente = (modelo, cuerpo = 'PROMPT ESPAÑOL') => `---\nname: researcher\ntools: web_search, web_fetch, read\nmodel: ${modelo}\nthinking: medium\n---\n\n${cuerpo}\n`;
function entorno(t) {
  const vault = mkdtempSync(join(tmpdir(), 'pi-researcher-aud-')), recursos = join(vault, '.pi'), raiz = join(vault, 'cursos/calculo');
  t.after(() => rmSync(vault, { recursive: true, force: true }));
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
