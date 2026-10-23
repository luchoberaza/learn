import { lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { buscar, normalizar, type IndiceBM25 } from "../../scripts/ingesta/bm25.ts";

export interface Documento { id: string; titulo: string; tipo: string; archivo: string; paginas: number; prioridad?: string }
export interface Tema { id: string; nombre: string; alias: string[]; unidad: number; prerequisitos: string[]; objetivos: string[];
  bibliografia?: { doc: string; seccion: string; paginas: number[] }[];
  ejercicios?: { doc: string; items: string[] }[]; evaluaciones?: { doc: string; items: string[] }[] }
interface Item { id: string; paginas: number[]; enunciado: string; solucion?: { doc: string; id: string }; solucion_de?: string; puntos?: number | string }
export interface DatosCurso { curso: string; nombre?: string; contrato: string; documentos: Documento[]; temas: Tema[]; items: Record<string, Item[]>;
  progreso: { temas: Record<string, { estado?: string; borde?: unknown; proximo_paso?: string; objetivo?: string; plan?: string; ejercicios?: unknown; reservado?: unknown }>; historial?: unknown[] };
  avisos: string[]; validacion?: { errores: string[]; avisos: string[]; pendientes: unknown[] } }
export interface Activo { curso: string; tema: string; log: string; adHoc?: Tema }
export type Ref = { doc: string; id: string };
export const esSlug = (s: string) => typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

export function rutaSegura(base: string, relativa: string): string {
  if (!relativa || isAbsolute(relativa) || relativa.split(/[\\/]/).some(p => p === ".." || p === "." || !p)) throw new Error("Ruta fuera del curso.");
  let actual = resolve(base);
  for (const parte of ["", ...relativa.split("/")]) {
    actual = parte ? join(actual, parte) : actual;
    try {
      if (lstatSync(actual).isSymbolicLink()) throw new Error("Se preservó un enlace simbólico; usá una ruta real del curso.");
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  return actual;
}
export function leer(base: string, relativa: string, max = 2_000_000): string {
  const file = rutaSegura(base, relativa);
  if (statSync(file).size > max) throw new Error("Material demasiado grande; consultá un rango menor.");
  return readFileSync(file, "utf8");
}
export function acotar(t: string, bytes: number): string {
  if (Buffer.byteLength(t) <= bytes) return t;
  const aviso = "\n[Resumen truncado: consultá las tools de lectura para ampliar.]";
  return Buffer.from(t).subarray(0, Math.max(0, bytes - Buffer.byteLength(aviso))).toString("utf8").replace(/\uFFFD+$/u, "") + (bytes >= Buffer.byteLength(aviso) ? aviso : "");
}
export function documento(datos: DatosCurso, id: string) {
  const d = datos.documentos.find(d => d.id === id);
  if (!esSlug(id) || !d || !Number.isInteger(d.paginas) || d.paginas < 1 || !d.archivo.startsWith(`fuentes/${d.tipo}/`) || !d.archivo.toLowerCase().endsWith(".pdf") || /[#\[\]|\n\r]/.test(d.archivo)) throw new Error("Documento no identificado en el curso.");
  return d;
}
export const cita = (datos: DatosCurso, doc: string, p: number) => `[[cursos/${datos.curso}/${documento(datos, doc).archivo}#page=${p}]]`;
// Sin coincidencia por nombre, los temas cuya bibliografía contiene las páginas que encontró BM25, de más a menos páginas.
export function resolverTemas(temas: Tema[], consulta: string, resultados: { doc: string; pagina: number }[] = []): Tema[] {
  const q = normalizar(consulta.trim());
  const exacto = temas.find(t => t.id === q);
  if (exacto) return [exacto];
  const alias = temas.filter(t => [t.nombre, ...(t.alias || [])].some(a => normalizar(a) === q));
  if (alias.length) return alias;
  function distancia(a: string, b: string) {
    let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const siguiente = [i + 1];
      for (let j = 0; j < b.length; j++) siguiente.push(Math.min(siguiente[j] + 1, fila[j + 1] + 1, fila[j] + Number(a[i] !== b[j])));
      fila = siguiente;
    }
    return fila[b.length];
  }
  const parecidos = temas.map(t => ({ t, puntaje: Math.max(...[t.id, t.nombre, ...(t.alias || [])].map(s => {
    const a = normalizar(s);
    return a.includes(q) ? 1 : Math.max(0, 1 - distancia(a, q) / Math.max(a.length, q.length));
  })) })).filter(r => q && r.puntaje >= 0.65).sort((a, b) => b.puntaje - a.puntaje).slice(0, 5).map(r => r.t);
  return parecidos.length ? parecidos : temas.map(t => ({ t, puntaje: resultados.filter(r => (t.bibliografia || []).some(b => b.doc === r.doc && b.paginas[0] <= r.pagina && r.pagina <= b.paginas.at(-1)!)).length }))
    .filter(r => r.puntaje).sort((a, b) => b.puntaje - a.puntaje).map(r => r.t);
}
export function ordenarTemas(datos: DatosCurso): Tema[] {
  const nivel = (t: Tema) => datos.progreso.temas[t.id]?.estado === "en_curso" ? 0 : datos.progreso.temas[t.id]?.estado === "repasar" ? 1 : datos.progreso.temas[t.id]?.estado === "dominado" ? 4 : (t.prerequisitos || []).every(p => datos.progreso.temas[p]?.estado === "dominado") ? 2 : 3;
  return [...datos.temas].sort((a, b) => nivel(a) - nivel(b) || a.unidad - b.unidad);
}
// Evaluaciones, soluciones y documentos con ítems solucion_de traen la solución en sus páginas: antes del intento, sin texto ni enlace.
const conSolucion = (datos: DatosCurso, d: Documento) => d.tipo === "evaluaciones" || d.tipo === "soluciones" || (datos.items[d.id] || []).some(i => i.solucion_de !== undefined);
const sinEnlace = (paginas: number[]) => `PDF p. ${paginas.join(", ")} (el enlace va después del intento)`;
const esSolucion = (d: Documento, i: Item) => d.tipo === "soluciones" || i.solucion_de !== undefined;
const lista = (xs: unknown): any[] => (Array.isArray(xs) ? xs : []);
// Ítems del tema: primero los del índice curado y después los que asignó la preparación automática.
function itemsDelTema(raiz: string, datos: DatosCurso, tema: Tema) {
  const r: (Ref & { clase: string; automatico: boolean })[] = [];
  for (const clase of ["ejercicios", "evaluaciones"] as const) for (const ref of tema[clase] || []) for (const id of ref.items) r.push({ clase, doc: ref.doc, id, automatico: false });
  let automaticas: { doc?: string; id?: string; tema?: string | null }[] = [];
  try { automaticas = JSON.parse(leer(raiz, "_procesado/asignaciones.json")).items || []; } catch { /* Sin preparación automática todavía. */ }
  for (const clase of ["evaluaciones", "ejercicios"]) for (const a of automaticas) {
    const d = datos.documentos.find(d => d.id === a?.doc);
    if (a?.tema === tema.id && d?.tipo === clase && datos.items[d.id]?.some(i => i.id === a.id)) r.push({ clase, doc: d.id, id: String(a.id), automatico: true });
  }
  return r;
}
// E3: números normalizados (36,000 → 36000; 2,4 → 2.4) y palabras de 5 letras o más, sin comandos LaTeX.
const huella = (t: string) => new Set(normalizar(t).replace(/\\[a-z]+/g, " ").replace(/(\d)[.,](?=\d{3}(?!\d))/g, "$1").replace(/(\d),(?=\d)/g, "$1.").match(/\d+(?:\.\d+)?|[a-z]{5,}/g) ?? []);
// Casi copia: Jaccard ≥ 0,5 y 10 términos en común, así dos enunciados cortos no se confunden
// (en redes, el parcial copiado en el práctico da 0,73 con 30 en común y en el problema P29 del libro 0,63; el par siguiente, 0,21).
const casi = (a: Set<string>, b: Set<string>) => { const comun = [...a].filter(t => b.has(t)).length; return comun >= 10 && comun / (a.size + b.size - comun) >= 0.5; };
// Casi copias visibles de un ítem entre los enunciados de ejercicios y evaluaciones.
function casiCopias(datos: DatosCurso) {
  const visibles = datos.documentos.filter(d => d.tipo === "ejercicios" || d.tipo === "evaluaciones").flatMap(d => (datos.items[d.id] || []).filter(i => !esSolucion(d, i)).map(i => ({ doc: d.id, id: i.id, h: huella(i.enunciado) })));
  return (x: Ref) => {
    const a = visibles.find(v => v.doc === x.doc && v.id === x.id);
    return a ? visibles.filter(v => v !== a && casi(a.h, v.h)) : [];
  };
}
// En una página leída entera (el libro, un práctico sin segmentar) se omite el bloque («P29.», «Ejercicio 10»…) casi igual a un reservado.
// shortcut: un problema partido entre dos páginas puede quedar bajo el umbral en cada mitad; si aparece, comparar también con la página siguiente.
function sinCopias(datos: DatosCurso, texto: string, reservados: Set<string>) {
  const huellas = datos.documentos.flatMap(d => (datos.items[d.id] || []).filter(i => !esSolucion(d, i) && reservados.has(`${d.id}/${i.id}`)).map(i => huella(i.enunciado)));
  if (!huellas.length) return texto;
  const salida: string[] = [];
  let bloque: string[] = [];
  const cerrar = () => { salida.push(...(huellas.some(h => casi(h, huella(bloque.join("\n")))) ? ["[Problema reservado para /simulacro.]"] : bloque)); bloque = []; };
  for (const linea of texto.split("\n")) {
    if (/^(?:[pr]\d+\.|(?:pregunta|ejercicio|problema)\s*(?:n\S{0,2}\s*)?\d+)/.test(normalizar(linea).replace(/^(?:[\s#>*_|•-]|<[^>]*>)+/, ""))) cerrar();
    bloque.push(linea);
  }
  cerrar();
  return salida.join("\n");
}
const textoPagina = (raiz: string, doc: string, p: number) => leer(raiz, `_procesado/${doc}/paginas/${String(p).padStart(4, "0")}.md`, 200_000);
export function copiaEnPagina(raiz: string, datos: DatosCurso, doc: string, p: number, reservados: Set<string>) {
  try { const t = textoPagina(raiz, doc, p); return sinCopias(datos, t, reservados) !== t; } catch { return false; }
}
// E3: por tema, un ítem real de evaluación sin practicar queda para /simulacro: sin casi copias visibles si hay, con solución oficial y puntos si hay.
// El primero vigente que guardó progreso.yaml manda: los ítems nuevos no lo cambian; usado o desaparecido, se elige otro.
export function reservas(raiz: string, datos: DatosCurso): Record<string, Ref> {
  const enunciado = (x: Ref) => datos.documentos.some(d => d.id === x?.doc && d.tipo === "evaluaciones") ? datos.items[x.doc]?.find(i => i.id === x.id && i.solucion_de === undefined) : undefined;
  const conSolucionOficial = (x: Ref) => !!enunciado(x)?.solucion || (datos.items[x.doc] || []).some(i => i.solucion_de === x.id);
  const progresos = Object.values(datos.progreso.temas), r: Record<string, Ref> = {}, copias = casiCopias(datos);
  const tocados = new Set([...progresos.flatMap(p => lista(p?.ejercicios).map(e => `${e?.doc}/${e?.item}`)), ...progresos.flatMap(p => lista(p?.reservado).map(x => `${x?.doc}/${x?.id}`))]);
  for (const tema of datos.temas) {
    const fijado = lista(datos.progreso.temas[tema.id]?.reservado).find(x => !x?.usado && enunciado(x));
    const peso = (x: Ref) => 4 * Number(!copias(x).length) + 2 * Number(conSolucionOficial(x)) + Number(enunciado(x)!.puntos !== undefined);
    const elegido = fijado || itemsDelTema(raiz, datos, tema).filter(x => x.clase === "evaluaciones" && enunciado(x) && !tocados.has(`${x.doc}/${x.id}`)).sort((a, b) => peso(b) - peso(a))[0];
    if (elegido) { r[tema.id] = { doc: elegido.doc, id: elegido.id }; tocados.add(`${elegido.doc}/${elegido.id}`); }
  }
  return r;
}
// Lo que no se muestra fuera del simulacro: los reservados de todos los temas, sus casi copias y sus soluciones, salvo el que se está rindiendo.
export function reservados(raiz: string, datos: DatosCurso, permitido?: Ref): Set<string> {
  const s = new Set<string>(), copias = casiCopias(datos);
  const ocultar = (x: Ref) => {
    s.add(`${x.doc}/${x.id}`);
    for (const i of datos.items[x.doc] || []) if (i.solucion_de === x.id) s.add(`${x.doc}/${i.id}`);
    const sol = datos.items[x.doc]?.find(i => i.id === x.id)?.solucion;
    if (sol) s.add(`${sol.doc}/${sol.id}`);
  };
  for (const x of Object.values(reservas(raiz, datos))) {
    copias(x).forEach(ocultar);
    if (x.doc !== permitido?.doc || x.id !== permitido.id) ocultar(x);
  }
  return s;
}
export const paginasReservadas = (datos: DatosCurso, doc: string, reservados: Set<string>) => new Set((datos.items[doc] || []).filter(i => reservados.has(`${doc}/${i.id}`)).flatMap(i => i.paginas));
export function buscarMaterial(raiz: string, datos: DatosCurso, consulta: string, tipo?: string, reservados = new Set<string>()) {
  const indice = JSON.parse(leer(raiz, "_procesado/busqueda.json", 50_000_000)) as IndiceBM25;
  return buscar(indice, consulta, 5, tipo).flatMap(r => {
    const d = datos.documentos.find(d => d.id === r.doc);
    if (!d) return [];
    if (!conSolucion(datos, d) && !paginasReservadas(datos, r.doc, reservados).has(r.pagina)) return [{ doc: r.doc, pagina: r.pagina, seccion: r.seccion, pendiente: r.pendiente, cita: cita(datos, r.doc, r.pagina),
      fragmento: copiaEnPagina(raiz, datos, r.doc, r.pagina, reservados) ? "Sin fragmento: la página trae un problema reservado para /simulacro; leela con leer_paginas, que lo omite." : r.fragmento }];
    const items = (datos.items[r.doc] || []).filter(i => !esSolucion(d, i) && !reservados.has(`${r.doc}/${i.id}`) && i.paginas.includes(r.pagina)).map(i => i.id);
    const como = d.tipo === "soluciones" ? "son soluciones: pedilas con leer_items e incluir_solucion después del intento" : items.length ? `leé el enunciado con leer_items (ítems: ${items.join(", ")})` : "leé el enunciado con leer_paginas, que omite la parte resuelta";
    return [{ doc: r.doc, pagina: r.pagina, seccion: /^(pregunta|ejercicio|problema)\b/i.test(r.seccion || "") ? r.seccion : null, pendiente: r.pendiente, cita: sinEnlace([r.pagina]),
      fragmento: `Sin texto antes del intento: ${como}.` }];
  });
}
// Quita de todo el documento lo que va de «Solución» a la próxima «Pregunta N» y las preguntas reservadas enteras; si alguna pregunta no trae su marca, no se separa.
function sinSoluciones(raiz: string, d: Documento, noSeparable: Error, reservadas = new Set<string>(), soluciones = true): string[] {
  if (d.tipo === "soluciones") throw noSeparable;
  const omitida = "[Solución omitida hasta después del intento.]", reservada = "[Pregunta reservada para /simulacro.]", paginas: string[] = [], vistas = new Set<string>();
  let en = false, fuera = false, marcada = true, preguntas = 0;
  for (let p = 1; p <= d.paginas; p++) {
    let texto: string;
    try { texto = leer(raiz, `_procesado/${d.id}/paginas/${String(p).padStart(4, "0")}.md`, 200_000); } catch { throw noSeparable; }
    const lineas = fuera ? [reservada] : en ? [omitida] : [];
    for (const linea of texto.split("\n")) {
      const t = normalizar(linea).replace(/^(?:[\s#>*_|•-]|<[^>]*>)+/, ""), pregunta = t.match(/^(?:pregunta|ejercicio|problema)\s*(?:n\S{0,2}\s*)?(\d+)/);
      if (soluciones && /^(solucion|resolucion|respuesta)/.test(t)) { if (!en && !fuera) lineas.push(omitida); en = marcada = true; }
      else if (pregunta) {
        if (!marcada) throw noSeparable;
        en = false; marcada = !soluciones; fuera = reservadas.has(pregunta[1]); preguntas++;
        if (fuera) { vistas.add(pregunta[1]); lineas.push(reservada); }
      }
      if (!en && !fuera) lineas.push(linea);
    }
    paginas.push(lineas.join("\n").replace(/\[\[[^\]]*\]\]/g, ""));
  }
  if (!preguntas || !marcada || [...reservadas].some(id => !vistas.has(id))) throw noSeparable;
  return paginas;
}
export function leerPaginas(raiz: string, datos: DatosCurso, doc: string, desde: number, hasta: number, despuesDelIntento = false, reservados = new Set<string>()): string {
  const d = documento(datos, doc);
  if (![desde, hasta].every(Number.isInteger) || desde < 1 || hasta < desde || hasta > d.paginas) throw new Error("Rango PDF inválido (base 1, extremos incluidos).");
  // Un ítem reservado (E3) no se ve ni después de otro intento: se omite su pregunta entera o se rechaza el rango.
  const enRango = [...paginasReservadas(datos, doc, reservados)].some(p => desde <= p && p <= hasta);
  const omitir = new Set(enRango ? (datos.items[doc] || []).filter(i => i.solucion_de === undefined && reservados.has(`${doc}/${i.id}`)).map(i => i.id) : []);
  const separadas = (!despuesDelIntento && conSolucion(datos, d)) || enRango ? sinSoluciones(raiz, d, new Error(enRango ? `Esas páginas de ${doc} traen un ítem reservado para /simulacro; elegí otro rango o leé los ítems con leer_items.` : `No se puede separar el enunciado de la solución en ${doc}: leé el enunciado con leer_items; el texto completo, sólo después del intento del estudiante (despues_del_intento:true).`), omitir, !despuesDelIntento && conSolucion(datos, d)) : undefined;
  let salida = "";
  for (let p = desde; p <= hasta && Buffer.byteLength(salida) < 30000; p++) {
    try { salida += separadas ? `\n${separadas[p - 1]}\n${sinEnlace([p])}\n` : `\n${sinCopias(datos, textoPagina(raiz, doc, p), reservados)}\n${cita(datos, doc, p)}\n`; }
    catch { salida += `\nPágina PDF ${p} sin transcripción utilizable; consultá ver_pagina. ${cita(datos, doc, p)}\n`; }
    try {
      const q = JSON.parse(leer(raiz, `_procesado/${doc}/calidad.json`)).paginas?.[String(p)];
      if (!q || q.pendiente) salida += `[Calidad pendiente: cotejá el original con ver_pagina antes de usarlo.${q?.avisos?.length ? ` ${q.avisos.join(" ")}` : ""}]\n`;
    } catch { salida += "[Calidad no disponible.]\n"; }
  }
  if (Buffer.byteLength(salida) >= 30000) salida += "\n[Rango incompleto; pedí menos páginas o ver_pagina para una página extensa.]";
  return acotar(salida, 32000);
}
export function leerItems(datos: DatosCurso, doc: string, ids: string[], incluirSolucion = false, reservados = new Set<string>()): string {
  const d = documento(datos, doc);
  if (!["ejercicios", "evaluaciones", "soluciones"].includes(d.tipo) || !ids.length || ids.length > 100) throw new Error("Indicá ids de un banco de ítems del curso.");
  return acotar(ids.map(id => {
    const i = datos.items[doc]?.find(i => i.id === id);
    if (!i) return `${doc}/${id}: ítem no preparado.`;
    if (reservados.has(`${doc}/${id}`)) return `${doc}/${id}: Ese ítem está reservado para /simulacro; elegí otro.`;
    if (!incluirSolucion && esSolucion(d, i)) return `${doc}/${id}: es una solución; pedila con incluir_solucion después del intento.`;
    let t = `${doc}/${i.id}${typeof i.puntos === "number" ? ` (${i.puntos} punto${i.puntos === 1 ? "" : "s"})` : typeof i.puntos === "string" ? ` (${i.puntos})` : ""}\n${i.enunciado}\n${incluirSolucion || !conSolucion(datos, d) ? i.paginas.map(p => cita(datos, doc, p)).join(" ") : sinEnlace(i.paginas)}\nRevisión humana pendiente.`;
    if (incluirSolucion) {
      const ref = i.solucion;
      const s = ref && datos.items[ref.doc]?.find(i => i.id === ref.id);
      const propias = (datos.items[doc] || []).filter(s => s.solucion_de === i.id);
      if (s && documento(datos, ref!.doc).tipo === "soluciones") t += `\nSolución:\n${s.enunciado}\n${s.paginas.map(p => cita(datos, ref!.doc, p)).join(" ")}`;
      else if (!propias.length) t += "\nSin solución separada vinculada: no inventarla ni extraerla implícitamente del enunciado.";
      for (const s of propias) t += `\nSolución:\n${s.enunciado}\n${s.paginas.map(p => cita(datos, doc, p)).join(" ")}`;
    }
    return t;
  }).join("\n\n"), 32000);
}
// Qué referencias del tema todavía no tienen texto confiable: las completa la preparación automática (H55).
export function faltantesTema(raiz: string, datos: DatosCurso, tema: Tema): string[] {
  const faltan: string[] = [];
  for (const ref of tema.bibliografia || []) {
    let qs: Record<string, { pendiente?: boolean; vision?: unknown; error_vision?: unknown }> = {};
    try { qs = JSON.parse(leer(raiz, `_procesado/${ref.doc}/calidad.json`, 50_000_000)).paginas || {}; } catch { /* Sin ingesta falta todo el rango. */ }
    const [desde, hasta] = ref.paginas, total = hasta - desde + 1;
    // Una página que ya pasó por visión y sigue dudosa no se vuelve a preparar: la marca leer_paginas.
    const sin = Array.from({ length: total }, (_, i) => desde + i).filter(p => !qs[p] || (qs[p].pendiente && (!qs[p].vision || qs[p].error_vision))).length;
    if (sin) faltan.push(`${ref.doc} PDF ${desde}–${hasta} (${sin} de ${total} páginas)`);
  }
  for (const clase of ["ejercicios", "evaluaciones"] as const) for (const ref of tema[clase] || []) {
    const sin = ref.items.filter(id => !datos.items[ref.doc]?.some(i => i.id === id));
    if (sin.length) faltan.push(`${ref.doc}: ítems ${sin.join(", ")}`);
  }
  return faltan;
}
// acotar corta el final: primero estado, próximo paso, fallas, errores sin resolver y últimos ejercicios (H28).
function progresoCompacto(p: any, bytes: number): string {
  if (!p) return "sin registro";
  const corto = (s: unknown) => String(s ?? "").slice(0, 200);
  // Las entradas más recientes que entran en su parte del presupuesto: una lista larga no desplaza a las otras.
  const recientes = (xs: any[], parte: number) => {
    const r: any[] = [];
    for (const x of [...xs].reverse()) { if (Buffer.byteLength(JSON.stringify([x, ...r])) > bytes * parte) break; r.unshift(x); }
    return r;
  };
  return acotar(JSON.stringify({ estado: p.estado, proximo_paso: String(p.proximo_paso ?? "").slice(0, 400), falla: recientes(lista(p.borde?.falla).map(corto), 0.25),
    errores_sin_resolver: recientes(lista(p.errores_de_concepto).filter(e => !e?.resuelto).map(e => corto(e?.descripcion)), 0.25),
    ultimos_ejercicios: recientes(lista(p.ejercicios).map(e => ({ ...e, notas: e?.notas === undefined ? undefined : corto(e.notas) })), 0.25),
    domina: recientes(lista(p.borde?.domina).map(corto), 0.15), conceptos_firmes: recientes(lista(p.conceptos_firmes).map(corto), 0.1),
    discrepancias: recientes(lista(p.discrepancias).map(corto), 0.1), actualizado: p.actualizado }), bytes);
}
// Del informe del researcher quedan Resumen y Contra el material en ≤1200 B; el resto está en la nota enlazada (H61).
function resumirVerificacion(v: string, bytes = 1200): string {
  const corte = v.lastIndexOf('\n"');
  let texto: string;
  try { texto = JSON.parse(v.slice(corte + 1)); } catch { return acotar(v, bytes); }
  const cabecera = v.slice(0, corte + 1), secciones = texto.split(/^(?=## )/m).filter(s => /^## (Resumen|Contra el material)/.test(s)).join("").trim() || texto;
  for (let n = bytes; n > 0; n -= 100) {
    const r = cabecera + JSON.stringify(acotar(secciones, n));
    if (Buffer.byteLength(r) <= bytes) return r;
  }
  return acotar(cabecera, bytes);
}
export function dossier(raiz: string, datos: DatosCurso, tema: Tema, maxTokens: number, maxContrato: number, verificacion = "Sin caché validada; usá investigar_tema en modo alcance."): string {
  if (![maxTokens, maxContrato].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Presupuestos de contexto inválidos.");
  const contrato = Buffer.byteLength(datos.contrato) <= Math.min(maxContrato, maxTokens) * 4 ? datos.contrato : "Contrato excede el presupuesto: revisalo antes de inferir objetivos o rúbrica.";
  const lineas = [`# ${datos.curso} · ${tema.nombre} (${tema.id})`, ...datos.avisos, "## Contrato del curso", contrato,
    "## Mapa del tema", `Objetivos: ${(tema.objetivos || []).map(id => datos.contrato.split("\n").find(l => l.startsWith(`- ${id}:`)) || id).join("; ")}`,
    `Prerequisitos: ${(tema.prerequisitos || []).join(", ") || "ninguno declarado"}`,
    // F1, F2: el rango con su tool y sin enlace; la cita sale de la página leída, no del comienzo del rango.
    tema.bibliografia?.length ? "Bibliografía del tema: antes de enseñar cada nodo, leé con leer_paginas la página que lo define y citá esa." : "Bibliografía del tema: ninguna; lo que no conste en el material va marcado «sin respaldo en el material»."];
  for (const ref of tema.bibliografia || []) {
    try { const d = documento(datos, ref.doc); lineas.push(`- leer_paginas ${ref.doc} PDF ${ref.paginas.join("–")} · ${ref.seccion} · ${d.titulo}${d.prioridad ? ` (${d.prioridad})` : ""}`); }
    catch { lineas.push("Referencia bibliográfica no disponible; no reconstruirla desde memoria."); }
  }
  const items: { linea: string; id: string; automatico: boolean }[] = [], vistos = reservados(raiz, datos);
  // Lo que la preparación automática asignó al tema va después del índice curado, que manda.
  for (const { clase, doc, id, automatico } of itemsDelTema(raiz, datos, tema)) {
    const i = datos.items[doc]?.find(i => i.id === id), d = datos.documentos.find(d => d.id === doc), marca = automatico ? " (asignado automáticamente)" : "";
    // Una solución nunca entra al prompt antes del intento, aunque el índice la referencie; un reservado, nunca fuera del simulacro.
    if ((d && i ? esSolucion(d, i) : d?.tipo === "soluciones") || vistos.has(`${doc}/${id}`)) continue;
    vistos.add(`${doc}/${id}`);
    items.push({ id: `${doc}/${id}`, automatico, linea: `${clase}: ${doc}/${id}${marca} · ${i?.enunciado.replace(/\s+/g, " ").slice(0, 140) || "sin preparar"}` });
  }
  // Las vistas previas ocupan hasta 2400 B; el resto va sólo con su id (leer_items lo trae).
  let bytes = 0;
  const resto: typeof items = [];
  for (const i of items) {
    bytes += Buffer.byteLength(i.linea);
    if (bytes > 2400) resto.push(i); else lineas.push(i.linea);
  }
  const ids = (automatico: boolean) => resto.filter(i => i.automatico === automatico).map(i => i.id).join(", ");
  if (resto.length) lineas.push(acotar(`Más ítems del tema (leelos con leer_items): ${[ids(false), ids(true) && `asignados automáticamente: ${ids(true)}`].filter(Boolean).join("; ")}`, 800));
  if (reservas(raiz, datos)[tema.id]) lineas.push("Simulacro: un ítem de evaluación del tema está reservado para /simulacro; no figura acá ni se puede leer. Terminada la práctica y antes del cierre, ofrecé /simulacro.");
  const faltan = faltantesTema(raiz, datos, tema);
  if (faltan.length) lineas.push(`Preparación del tema: sin texto confiable todavía en ${faltan.join("; ")}. Se preparan solos en segundo plano; mientras, cotejá esas páginas con ver_pagina antes de citarlas.`);
  // Objetivo y plan acordados (H56) comparten los 3000 B del progreso del tema y ocupan hasta 2000 (en bytes: los caracteres pueden ser multibyte): retomar no los vuelve a pedir ni pierde el borde.
  const p = datos.progreso.temas[tema.id], acordado = acotar([p?.objetivo && `Objetivo acordado: ${String(p.objetivo).slice(0, 300)}`, p?.plan && `Plan: ${String(p.plan).slice(0, 1500)}`].filter(Boolean).join("\n\n"), 2000);
  // Lo que puede cortarse va al final: el progreso de los prerequisitos.
  lineas.push(...(acordado ? [acordado] : []), `Progreso ${tema.id}: ${progresoCompacto(p, 3000 - Buffer.byteLength(acordado))}`, "## Verificación previa", resumirVerificacion(verificacion));
  for (const id of tema.prerequisitos || []) lineas.push(`Progreso ${id} (prerequisito): ${progresoCompacto(datos.progreso.temas[id], 800)}`);
  return acotar(lineas.join("\n\n"), maxTokens * 4);
}
