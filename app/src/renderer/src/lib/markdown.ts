// Markdown del tutor y de las notas de Obsidian: fórmulas con KaTeX, citas [[…pdf#page=N]] como notas al margen,
// imágenes del vault ![[…]], callouts de Obsidian (> [!note] …) y bloques Mermaid. Sin HTML crudo: lo que escribe el
// modelo nunca se inyecta como HTML.
import MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import katex from "katex";
import { analizarEnlace, nombreDeArchivo, type Enlace } from "../../../lib/texto.ts";

export interface Cita { n: number; destino: string; curso: string; archivo: string; pagina: number; alias?: string }
interface Entorno { citas: Cita[] }

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const formula = (tex: string, display: boolean) => {
  try { return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "html" }); }
  catch { return `<code>${escapar(tex)}</code>`; }
};

function reglaFormulaEnLinea(state: StateInline, silent: boolean) {
  const src = state.src, pos = state.pos;
  let abre: string, cierra: string;
  if (src.startsWith("\\(", pos)) { abre = "\\("; cierra = "\\)"; }
  else if (src[pos] === "$" && src[pos + 1] !== "$") { abre = "$"; cierra = "$"; }
  else if (src.startsWith("$$", pos)) { abre = "$$"; cierra = "$$"; }
  else return false;
  const inicio = pos + abre.length;
  if (abre === "$" && (/\s/.test(src[inicio] ?? " ") || src[pos - 1] === "\\")) return false;
  let fin = inicio;
  while ((fin = src.indexOf(cierra, fin)) >= 0) {
    if (src[fin - 1] === "\\") { fin++; continue; }
    // $5 y $10: un signo pesos seguido de cifra al cerrar no es fórmula.
    if (abre === "$" && (/\s/.test(src[fin - 1]) || /\d/.test(src[fin + 1] ?? ""))) { fin++; continue; }
    break;
  }
  if (fin < 0 || fin === inicio) return false;
  if (!silent) {
    const t = state.push("formula_en_linea", "", 0);
    t.content = src.slice(inicio, fin);
    t.markup = abre;
  }
  state.pos = fin + cierra.length;
  return true;
}

function reglaFormulaEnBloque(state: StateBlock, inicio: number, finLinea: number, silent: boolean) {
  let pos = state.bMarks[inicio] + state.tShift[inicio];
  const max = state.eMarks[inicio];
  const linea = state.src.slice(pos, max);
  const abre = linea.startsWith("$$") ? "$$" : linea.startsWith("\\[") ? "\\[" : undefined;
  if (!abre) return false;
  const cierra = abre === "$$" ? "$$" : "\\]";
  if (silent) return true;
  let contenido = linea.slice(abre.length), siguiente = inicio, cerrado = false;
  if (contenido.trimEnd().endsWith(cierra) && contenido.trim().length >= cierra.length) {
    contenido = contenido.trimEnd().slice(0, -cierra.length);
    cerrado = true;
  }
  const partes = [contenido];
  while (!cerrado) {
    siguiente++;
    if (siguiente >= finLinea) break;
    pos = state.bMarks[siguiente] + state.tShift[siguiente];
    const l = state.src.slice(pos, state.eMarks[siguiente]);
    if (l.trimEnd().endsWith(cierra)) { partes.push(l.trimEnd().slice(0, -cierra.length)); cerrado = true; break; }
    partes.push(l);
  }
  state.line = siguiente + 1;
  const t = state.push("formula_en_bloque", "", 0);
  t.content = partes.join("\n").trim();
  t.map = [inicio, state.line];
  return true;
}

function reglaEnlaceObsidian(state: StateInline, silent: boolean) {
  const src = state.src, pos = state.pos, incrustado = src.startsWith("![[", pos);
  if (!incrustado && !src.startsWith("[[", pos)) return false;
  const inicio = pos + (incrustado ? 3 : 2), fin = src.indexOf("]]", inicio);
  if (fin < 0 || src.slice(inicio, fin).includes("\n")) return false;
  if (!silent) {
    const t = state.push("enlace_obsidian", "", 0);
    t.content = src.slice(inicio, fin);
    t.meta = { incrustado };
  }
  state.pos = fin + 2;
  return true;
}

// > [!note] Título  →  un recuadro con su título, como los callouts de Obsidian.
function reglaCallouts(state: StateCore) {
  const t = state.tokens;
  for (let i = 0; i < t.length; i++) {
    if (t[i].type !== "blockquote_open") continue;
    const inline = t[i + 2];
    if (t[i + 1]?.type !== "paragraph_open" || inline?.type !== "inline") continue;
    const m = /^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)\n?/.exec(inline.content);
    if (!m) continue;
    t[i].meta = { callout: m[1].toLowerCase(), titulo: m[2].trim() };
    inline.content = inline.content.slice(m[0].length);
    inline.children = [];
    state.md.inline.parse(inline.content, state.md, state.env, inline.children);
    if (!inline.content.trim()) { t[i + 1].hidden = true; t[i + 3].hidden = true; }
  }
}

const TITULOS: Record<string, string> = { quote: "Vos", abstract: "Tutor", info: "Página mostrada", warning: "Atención", note: "Nota", tip: "Idea", question: "Pregunta", success: "Bien", failure: "A revisar", example: "Ejemplo" };

export const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });
md.inline.ruler.before("escape", "formula_en_linea", reglaFormulaEnLinea);
md.block.ruler.before("fence", "formula_en_bloque", reglaFormulaEnBloque, { alt: ["paragraph", "reference", "blockquote", "list"] });
md.inline.ruler.before("link", "enlace_obsidian", reglaEnlaceObsidian);
md.core.ruler.after("inline", "callouts", reglaCallouts);

md.renderer.rules.formula_en_linea = (t, i) => formula(t[i].content, t[i].markup === "$$");
md.renderer.rules.formula_en_bloque = (t, i) => `<div class="formula">${formula(t[i].content, true)}</div>\n`;
md.renderer.rules.enlace_obsidian = (t, i, _o, env: Entorno) => {
  const e: Enlace = analizarEnlace(t[i].content);
  if (e.tipo === "cita") {
    // La misma página citada dos veces en un mensaje lleva el mismo número.
    let c = env.citas.find(x => x.destino === e.destino);
    if (!c) { c = { n: env.citas.length + 1, destino: e.destino, curso: e.curso, archivo: e.archivo, pagina: e.pagina, alias: e.alias }; env.citas.push(c); }
    return `<sup class="llamada" data-cita="${escapar(e.destino)}" role="button" tabindex="0" title="Abrir la página ${e.pagina}">${c.n}</sup>`;
  }
  if (e.tipo === "imagen") return `<img class="del-vault" data-vault="${escapar(e.destino)}" alt="${escapar(e.alias ?? "")}">`;
  if (e.tipo === "pdf") return `<span class="enlace-pdf">${escapar(e.alias ?? `${nombreDeArchivo(e.destino)}${e.pagina ? `, página ${e.pagina}` : ""}`)}</span>`;
  return `<span class="enlace-nota">${escapar(e.alias ?? e.destino)}</span>`;
};
md.renderer.rules.blockquote_open = (t, i) => {
  const c = t[i].meta?.callout as string | undefined;
  if (!c) return "<blockquote>\n";
  const titulo = (t[i].meta.titulo as string) || TITULOS[c] || c;
  return `<div class="callout callout-${escapar(c)}"><div class="callout-titulo">${escapar(titulo === "VOS" ? "Vos" : titulo === "PI" ? "Tutor" : titulo)}</div>\n`;
};
md.renderer.rules.blockquote_close = (t, i) => {
  // Busca el blockquote_open correspondiente para cerrar con la misma etiqueta.
  let nivel = 0;
  for (let j = i - 1; j >= 0; j--) {
    if (t[j].type === "blockquote_close") nivel++;
    else if (t[j].type === "blockquote_open") { if (nivel === 0) return t[j].meta?.callout ? "</div>\n" : "</blockquote>\n"; nivel--; }
  }
  return "</blockquote>\n";
};
const fenceOriginal = md.renderer.rules.fence!;
md.renderer.rules.fence = (t, i, o, env, self) => {
  const lenguaje = t[i].info.trim().split(/\s+/)[0];
  if (lenguaje === "mermaid") return `<div class="mermaid" data-codigo="${escapar(t[i].content)}"><span class="apagado">Dibujando el diagrama…</span></div>\n`;
  return fenceOriginal(t, i, o, env, self);
};
const enlaceOriginal = md.renderer.rules.link_open ?? ((t, i, o, _e, self) => self.renderToken(t, i, o));
md.renderer.rules.link_open = (t, i, o, env, self) => {
  t[i].attrSet("target", "_blank");
  t[i].attrSet("rel", "noreferrer");
  return enlaceOriginal(t, i, o, env, self);
};

export function renderizar(texto: string): { html: string; citas: Cita[] } {
  const env: Entorno = { citas: [] };
  return { html: md.render(texto, env), citas: env.citas };
}
