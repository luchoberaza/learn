import { lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { buscar, normalizar, type IndiceBM25 } from "../../scripts/ingesta/bm25.ts";

export interface Documento { id: string; titulo: string; tipo: string; archivo: string; paginas: number; prioridad?: string }
export interface Tema { id: string; nombre: string; alias: string[]; unidad: number; prerequisitos: string[]; objetivos: string[];
  bibliografia?: { doc: string; seccion: string; paginas: number[] }[];
  ejercicios?: { doc: string; items: string[] }[]; evaluaciones?: { doc: string; items: string[] }[] }
interface Item { id: string; paginas: number[]; enunciado: string; solucion?: { doc: string; id: string }; solucion_de?: string; puntos?: number }
export interface DatosCurso { curso: string; nombre?: string; contrato: string; documentos: Documento[]; temas: Tema[]; items: Record<string, Item[]>;
  progreso: { temas: Record<string, { estado?: string; borde?: unknown; proximo_paso?: string }>; historial?: unknown[] };
  avisos: string[]; validacion?: { errores: string[]; avisos: string[]; pendientes: unknown[] } }
export interface Activo { curso: string; tema: string; log: string; adHoc?: Tema }
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
export function buscarMaterial(raiz: string, datos: DatosCurso, consulta: string, tipo?: string) {
  const indice = JSON.parse(leer(raiz, "_procesado/busqueda.json", 50_000_000)) as IndiceBM25;
  return buscar(indice, consulta, 5, tipo).flatMap(r => {
    const d = datos.documentos.find(d => d.id === r.doc);
    if (!d) return [];
    if (!conSolucion(datos, d)) return [{ doc: r.doc, pagina: r.pagina, seccion: r.seccion, fragmento: r.fragmento, pendiente: r.pendiente, cita: cita(datos, r.doc, r.pagina) }];
    const items = (datos.items[r.doc] || []).filter(i => !esSolucion(d, i) && i.paginas.includes(r.pagina)).map(i => i.id);
    const como = d.tipo === "soluciones" ? "son soluciones: pedilas con leer_items e incluir_solucion después del intento" : items.length ? `leé el enunciado con leer_items (ítems: ${items.join(", ")})` : "leé el enunciado con leer_paginas, que omite la parte resuelta";
    return [{ doc: r.doc, pagina: r.pagina, seccion: /^(pregunta|ejercicio|problema)\b/i.test(r.seccion || "") ? r.seccion : null, pendiente: r.pendiente, cita: sinEnlace([r.pagina]),
      fragmento: `Sin texto antes del intento: ${como}.` }];
  });
}
// Quita de todo el documento lo que va de «Solución» a la próxima «Pregunta N»; si alguna pregunta no trae su marca, no se separa.
function sinSoluciones(raiz: string, d: Documento, noSeparable: Error): string[] {
  if (d.tipo === "soluciones") throw noSeparable;
  const omitida = "[Solución omitida hasta después del intento.]", paginas: string[] = [];
  let en = false, marcada = true, preguntas = 0;
  for (let p = 1; p <= d.paginas; p++) {
    let texto: string;
    try { texto = leer(raiz, `_procesado/${d.id}/paginas/${String(p).padStart(4, "0")}.md`, 200_000); } catch { throw noSeparable; }
    const lineas = en ? [omitida] : [];
    for (const linea of texto.split("\n")) {
      const t = normalizar(linea).replace(/^(?:[\s#>*_|•-]|<[^>]*>)+/, "");
      if (/^(solucion|resolucion|respuesta)/.test(t)) { if (!en) lineas.push(omitida); en = marcada = true; }
      else if (/^(pregunta|ejercicio|problema)\s*(n\S{0,2}\s*)?\d/.test(t)) { if (!marcada) throw noSeparable; en = marcada = false; preguntas++; }
      if (!en) lineas.push(linea);
    }
    paginas.push(lineas.join("\n").replace(/\[\[[^\]]*\]\]/g, ""));
  }
  if (!preguntas || !marcada) throw noSeparable;
  return paginas;
}
export function leerPaginas(raiz: string, datos: DatosCurso, doc: string, desde: number, hasta: number, despuesDelIntento = false): string {
  const d = documento(datos, doc);
  if (![desde, hasta].every(Number.isInteger) || desde < 1 || hasta < desde || hasta > d.paginas) throw new Error("Rango PDF inválido (base 1, extremos incluidos).");
  const reservadas = !despuesDelIntento && conSolucion(datos, d) ? sinSoluciones(raiz, d, new Error(`No se puede separar el enunciado de la solución en ${doc}: leé el enunciado con leer_items; el texto completo, sólo después del intento del estudiante (despues_del_intento:true).`)) : undefined;
  let salida = "";
  for (let p = desde; p <= hasta && Buffer.byteLength(salida) < 30000; p++) {
    try { salida += reservadas ? `\n${reservadas[p - 1]}\n${sinEnlace([p])}\n` : `\n${leer(raiz, `_procesado/${doc}/paginas/${String(p).padStart(4, "0")}.md`, 200_000)}\n${cita(datos, doc, p)}\n`; }
    catch { salida += `\nPágina PDF ${p} sin transcripción utilizable; consultá ver_pagina. ${cita(datos, doc, p)}\n`; }
    try {
      const q = JSON.parse(leer(raiz, `_procesado/${doc}/calidad.json`)).paginas?.[String(p)];
      if (!q || q.pendiente) salida += `[Calidad pendiente: cotejá el original con ver_pagina antes de usarlo.${q?.avisos?.length ? ` ${q.avisos.join(" ")}` : ""}]\n`;
    } catch { salida += "[Calidad no disponible.]\n"; }
  }
  if (Buffer.byteLength(salida) >= 30000) salida += "\n[Rango incompleto; pedí menos páginas o ver_pagina para una página extensa.]";
  return acotar(salida, 32000);
}
export function leerItems(datos: DatosCurso, doc: string, ids: string[], incluirSolucion = false): string {
  const d = documento(datos, doc);
  if (!["ejercicios", "evaluaciones", "soluciones"].includes(d.tipo) || !ids.length || ids.length > 100) throw new Error("Indicá ids de un banco de ítems del curso.");
  return acotar(ids.map(id => {
    const i = datos.items[doc]?.find(i => i.id === id);
    if (!i) return `${doc}/${id}: ítem no preparado.`;
    if (!incluirSolucion && esSolucion(d, i)) return `${doc}/${id}: es una solución; pedila con incluir_solucion después del intento.`;
    let t = `${doc}/${i.id}${typeof i.puntos === "number" ? ` (${i.puntos} punto${i.puntos === 1 ? "" : "s"})` : ""}\n${i.enunciado}\n${incluirSolucion || !conSolucion(datos, d) ? i.paginas.map(p => cita(datos, doc, p)).join(" ") : sinEnlace(i.paginas)}\nRevisión humana pendiente.`;
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
// acotar corta el final: primero estado, próximo paso, fallas, errores sin resolver y últimos ejercicios (H28).
function progresoCompacto(p: any, bytes: number): string {
  if (!p) return "sin registro";
  const lista = (xs: unknown): any[] => (Array.isArray(xs) ? xs : []), corto = (s: unknown) => String(s ?? "").slice(0, 200);
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
    `Prerequisitos: ${(tema.prerequisitos || []).join(", ") || "ninguno declarado"}`];
  for (const ref of tema.bibliografia || []) {
    try { const d = documento(datos, ref.doc); lineas.push(`${ref.doc} · ${d.titulo} · ${d.prioridad} · ${ref.seccion} · PDF ${ref.paginas.join("–")} · ${cita(datos, ref.doc, ref.paginas[0])}`); }
    catch { lineas.push("Referencia bibliográfica no disponible; no reconstruirla desde memoria."); }
  }
  for (const clase of ["ejercicios", "evaluaciones"] as const) for (const ref of tema[clase] || []) for (const id of ref.items) {
    const i = datos.items[ref.doc]?.find(i => i.id === id);
    lineas.push(`${clase}: ${ref.doc}/${id} · ${i?.enunciado.replace(/\s+/g, " ").slice(0, 140) || "sin preparar"}`);
  }
  if (datos.avisos.length || datos.validacion?.errores.length || datos.validacion?.avisos.length) lineas.push("Preparación incompleta: usá sólo referencias comprobables; los avisos no certifican fidelidad.");
  // Lo que puede cortarse va al final: el progreso de los prerequisitos.
  lineas.push(`Progreso ${tema.id}: ${progresoCompacto(datos.progreso.temas[tema.id], 3000)}`, "## Verificación previa", resumirVerificacion(verificacion));
  for (const id of tema.prerequisitos || []) lineas.push(`Progreso ${id} (prerequisito): ${progresoCompacto(datos.progreso.temas[id], 800)}`);
  return acotar(lineas.join("\n\n"), maxTokens * 4);
}
