import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir } from "../../scripts/lib/pi-sdk.mjs";
import { corteModelo, modeloVision, python, transcribir } from "./ingesta.ts";
import { leer, type DatosCurso, type Tema } from "./material.ts";
import type { registrarSesion } from "./sesion.ts";

// Páginas de visión por corrida: acota el gasto de una vez; lo que queda sigue la próxima vez que se estudie el tema.
const TOPE = 150;
const VIEJO = 6 * 3600_000;
const OCUPADA = /Ya hay una ingesta escribiendo/;
// El marcador de pipeline.SOLUCION: un enunciado que lo trae mostraría la solución antes del intento.
const SOLUCION = /^(?:[\s#>*_]*(?:soluci[oó]n|resoluci[oó]n|rta\.?\s*:)|[\s#>]*(?:[*_]+\s*respuesta|respuestas?\s*(?::|$)))/im;
type Segmento = { doc: string; tipo: string; titulo: string; paginas: number; listo: boolean; requeridos: string[]; entrada: string };
type Pendiente = { doc: string; id: string; enunciado: string; huella: string; entrada: string };
type Trabajo = { indice: string; paginas: { doc: string; paginas: number[] }[]; restantes: number; segmentar: Segmento[]; clasificar: Pendiente[]; en_espera: number };

const SEGMENTAR = `Segmentás en ítems un documento de un curso a partir de sus páginas transcriptas. Respondé sólo un objeto JSON, sin texto alrededor:
{"items":[{"id":"3","paginas":[2],"enunciado":"…","puntos":8},{"id":"3-solucion","paginas":[2,3],"enunciado":"…","solucion_de":"3"}]}
- Un ítem por pregunta, ejercicio o problema, con el id como lo numera el documento («Pregunta 3» → "3", «Ejercicio 2» → "2"); los incisos van dentro de su ítem.
- enunciado: el texto literal de la transcripción, con sus datos, tablas, fórmulas y [Figura: …]; sin resolver, resumir ni completar.
- paginas: las páginas PDF donde está ese texto.
- puntos: el puntaje oficial si figura («(8 puntos)» → 8; uno compuesto va como texto: "10 (a: 4, b: 6)"); si no figura, omitilo.
- La solución oficial de un ítem, si el documento la trae, va aparte: otro ítem con id "<id>-solucion", solucion_de: "<id>", su texto literal y sus páginas. El enunciado nunca incluye la solución.
- Carátulas, instrucciones generales y encabezados no son ítems. No inventes ítems ni texto.`;
const CLASIFICAR = `Asignás ítems de práctica de un curso al tema que evalúan. Respondé sólo un objeto JSON, sin texto alrededor:
{"asignaciones":[{"doc":"practico-2","id":"1","tema":"capa-de-aplicacion"}]}
- Una entrada por cada ítem recibido, con su doc e id exactos.
- tema: el id del tema cuyo contenido hace falta para resolverlo (el principal si toca varios), o null si ninguno corresponde. Sólo ids de tema recibidos.`;

const mensaje = (e: unknown) => e instanceof Error ? e.message : String(e);
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const vivo = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; } };
// Identidad que un pid reutilizado (también tras reiniciar) no repite: arranque del sistema y del proceso; en Linux.
function proceso(pid: number) {
  try { return `${readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()}:${readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1)!.split(" ")[19]}`; }
  catch { return undefined; }
}
function ingestando(salida: string) {
  try { const e = JSON.parse(readFileSync(join(salida, "estado-ingesta.json"), "utf8")); return ["iniciando", "en_curso"].includes(e.estado) && vivo(e.pid); }
  catch { return false; }
}
// Una preparación por curso entre procesos; el lock de un pi muerto (kill), de otro proceso con su pid o muy viejo se reemplaza.
// Devuelve el contenido escrito: sólo quien lo escribió lo borra.
function tomar(file: string): string | undefined {
  const propio = JSON.stringify({ pid: process.pid, inicio: Date.now(), proceso: proceso(process.pid) });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const fd = openSync(file, "wx", 0o600);
      try { writeFileSync(fd, propio); } finally { closeSync(fd); }
      return propio;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    let raw = "";
    try { raw = readFileSync(file, "utf8"); const l = JSON.parse(raw); if (vivo(l.pid) && Date.now() - l.inicio < VIEJO && (!l.proceso || l.proceso === proceso(l.pid))) return; }
    catch { /* Ilegible: lo cortó un kill mientras se escribía. */ }
    try { if (readFileSync(file, "utf8") === raw) unlinkSync(file); } catch { /* Ya lo soltó o tomó otro proceso. */ }
  }
}
export function necesitaPreparacion(raiz: string, tema: string) {
  try {
    const t = JSON.parse(readFileSync(join(raiz, "_procesado/preparacion.json"), "utf8")).temas?.[tema];
    return !(t?.estado === "completa" && t.indice === createHash("sha256").update(readFileSync(join(raiz, "indice.yaml"))).digest("hex"));
  } catch { return true; }
}

async function pedirJSON(ctx: Pick<ExtensionContext, "modelRegistry">, modelo: Model<Api>, sistema: string, texto: string, signal: AbortSignal, maxTokens: number) {
  const r = await ctx.modelRegistry.streamSimple(modelo, { systemPrompt: sistema, messages: [{ role: "user", timestamp: Date.now(), content: [{ type: "text", text: texto }] }] },
    { maxTokens, reasoning: "low", maxRetries: 0, signal: AbortSignal.any([signal, AbortSignal.timeout(300_000)]) }).result();
  const salida = r.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  // «aborted» sin un corte del usuario es el plazo de 5 minutos (pi-ai lo informa como «Request was aborted»).
  if (r.stopReason !== "stop" || !salida) throw new Error(r.stopReason === "aborted" ? "el modelo no respondió en 5 minutos" : r.errorMessage || "respuesta vacía o cortada");
  try { return JSON.parse(salida.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("la respuesta no es JSON válido"); }
}
// Una respuesta inválida se reintenta una vez con el motivo; si vuelve a fallar, espera hasta mañana o hasta que cambien sus entradas.
async function conReintento<T>(pedido: (error: string) => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let intento = 0, error = ""; ; intento++) {
    try { return await pedido(error ? `\nTu respuesta anterior se rechazó: ${error}. Corregila.` : ""); }
    catch (e) { if (intento || signal.aborted || OCUPADA.test(mensaje(e)) || corteModelo(mensaje(e))) throw e; error = mensaje(e).slice(0, 300); }
  }
}
function validarItems(r: any, s: Segmento) {
  if (!Array.isArray(r?.items) || !r.items.length) throw new Error("falta la lista items");
  const items = r.items.map((i: any) => {
    if (typeof i?.id !== "string" || !i.id.trim() || typeof i.enunciado !== "string" || !i.enunciado.trim() || !Array.isArray(i.paginas) || !i.paginas.length
      || i.paginas.some((p: unknown) => !Number.isInteger(p) || (p as number) < 1 || (p as number) > s.paginas)) throw new Error(`ítem inválido: ${JSON.stringify(i).slice(0, 120)}`);
    if (i.solucion_de == null && SOLUCION.test(i.enunciado)) throw new Error(`el enunciado de ${i.id} trae una solución o un encabezado de solución: la solución va aparte, en otro ítem con solucion_de`);
    return { id: i.id, paginas: i.paginas, enunciado: i.enunciado, ...(i.solucion_de == null ? {} : { solucion_de: i.solucion_de }), ...(i.puntos == null ? {} : { puntos: i.puntos }) };
  });
  const faltan = s.requeridos.filter(id => !items.some((i: any) => i.id === id && i.solucion_de === undefined));
  if (faltan.length) throw new Error(`faltan los ids ${faltan.join(", ")}, que usa el índice del curso`);
  return items;
}
function validarAsignaciones(r: any, lote: Pendiente[], temas: Set<string>) {
  if (!Array.isArray(r?.asignaciones)) throw new Error("falta la lista asignaciones");
  const esperadas = new Set(lote.map(i => `${i.doc}/${i.id}`)), vistas = new Set<string>();
  const asignaciones = r.asignaciones.map((a: any) => {
    const clave = `${a?.doc}/${a?.id}`;
    if (!esperadas.has(clave) || vistas.has(clave) || !(a.tema === null || temas.has(a.tema))) throw new Error(`asignación inválida: ${JSON.stringify(a).slice(0, 120)}`);
    vistas.add(clave);
    return { doc: a.doc, id: a.id, tema: a.tema };
  });
  if (vistas.size !== esperadas.size) throw new Error(`faltan ${esperadas.size - vistas.size} ítems`);
  return asignaciones;
}

export function registrarPreparacion(pi: ExtensionAPI, sesion: Pick<ReturnType<typeof registrarSesion>, "actual" | "refrescar">, vault = vaultDir, recursos = piDir) {
  const corriendo = new Map<string, AbortController>(), intentados = new Set<string>();
  let ultima: Promise<void> | undefined;
  async function preparar(curso: string, tema: Tema, d: DatosCurso, raiz: string, ctx: ExtensionContext, clave: string) {
    const salida = join(raiz, "_procesado"), lock = join(salida, ".preparacion.lock"), control = new AbortController(), signal = control.signal;
    // La ingesta base u otro pi preparando, o un curso sin ingesta base: sin aviso, se reintenta en el próximo turno.
    let propio: string | undefined;
    try { if (corriendo.has(curso) || ingestando(salida) || !(propio = tomar(lock))) return; } catch { return; }
    corriendo.set(curso, control); intentados.add(clave);
    const estado = (texto?: string) => { try { ctx.ui.setStatus("preparacion", texto); } catch { /* ctx viejo tras /reload. */ } };
    const avisar = (texto: string, tipo: "info" | "warning") => { try { ctx.ui.notify(texto, tipo); } catch { /* ctx viejo tras /reload. */ } };
    let ocupada = false, transcriptas = 0, nuevos = 0, asignadas = 0, fallo = false;
    // Segmentaciones y clasificaciones fallidas, con la huella de sus entradas: no se repiten hasta mañana o hasta que cambien.
    const avisos: string[] = [], segmentados: string[] = [], fallos: Record<string, string> = {};
    // Red, cuota o credenciales: cada llamada siguiente fallaría igual, así que se corta la tanda con la causa.
    const cortar = (e: unknown) => { const corte = corteModelo(mensaje(e)); if (signal.aborted || OCUPADA.test(mensaje(e)) || corte) throw corte ? new Error(corte) : e; };
    try {
      const config = JSON.parse(readFileSync(join(recursos, "curso.config.json"), "utf8"));
      const pedir = (): Promise<Trabajo> => python("trabajo", { vault, curso, tema: tema.id, maximo: TOPE }, signal, "preparacion.py");
      let t = await pedir();
      // Un documento que espera la ingesta base no es trabajo: el tema queda incompleto sin aviso.
      const total = t.paginas.reduce((n, x) => n + x.paginas.length, 0), hubo = total || t.segmentar.some(s => s.listo) || t.clasificar.length;
      if (hubo) {
        const vision = await modeloVision(ctx, config.modelo_vision);
        if ("motivo" in vision) throw new Error(vision.motivo);
        const { modelo } = vision;
        let hechas = 0;
        estado(`⏳ Preparando material de ${tema.nombre}: 0/${total} páginas`);
        for (const { doc, paginas } of t.paginas) {
          const { resumen } = await transcribir(ctx, { vault, salida, doc, paginas }, { ...config, max_paginas_vision_sin_confirmar: paginas.length }, signal, () => {
            if (ingestando(salida)) { ocupada = true; control.abort(); }
            estado(`⏳ Preparando material de ${tema.nombre}: ${++hechas}/${total} páginas`);
          });
          transcriptas += resumen.transcritas;
          ocupada ||= resumen.avisos.some(a => OCUPADA.test(a));
          if (ocupada || resumen.cancelada) throw new Error("cancelada");
          if (resumen.corte) throw new Error(resumen.corte);
          avisos.push(...resumen.avisos);
          // Las páginas del tema ya sirven: el dossier deja de mandarlas a ver_pagina sin esperar a parciales y prácticos.
          if (resumen.transcritas && tema.bibliografia?.some(b => b.doc === doc)) {
            try { if (sesion.actual()?.a.curso === curso) sesion.refrescar(); } catch { /* El tema dejó el índice: el próximo /estudiar lo informa. */ }
          }
        }
        t = await pedir();
        for (const s of t.segmentar.filter(s => s.listo)) {
          estado(`⏳ Preparando material de ${tema.nombre}: ítems de ${s.doc}`);
          const paginas = Array.from({ length: s.paginas }, (_, i) => `=== Página PDF ${i + 1} ===\n${leer(raiz, `_procesado/${s.doc}/paginas/${String(i + 1).padStart(4, "0")}.md`, 200_000)}`).join("\n\n");
          const requeridos = s.requeridos.length ? ` El índice del curso ya usa los ids ${s.requeridos.join(", ")}: conservalos para las mismas preguntas.` : "";
          try {
            const items = await conReintento(async error => {
              const r = validarItems(await pedirJSON(ctx, modelo, SEGMENTAR, `Documento ${s.doc} (${s.tipo}): ${s.titulo}. Páginas PDF 1–${s.paginas}.${requeridos}${error}\n\n${paginas}`, signal, 32000), s);
              await python("items", { vault, salida, doc: s.doc, items: r }, signal);
              return r;
            }, signal);
            await python("registrar", { vault, curso, documento: { id: s.doc, segmentado: true, items: items.length } }, signal, "preparacion.py");
            const antes = new Set((d.items[s.doc] || []).map(i => i.id));
            nuevos += items.filter((i: any) => i.solucion_de === undefined && !antes.has(i.id)).length;
            segmentados.push(s.doc);
          } catch (e) {
            cortar(e);
            fallo ||= !avisos.length;
            avisos.push(`no se pudieron separar los ítems de ${s.doc} (${mensaje(e).slice(0, 150)})`);
            fallos[`segmentar/${s.doc}`] = s.entrada;
          }
        }
        t = await pedir();
        const temas = d.temas.map(x => ({ id: x.id, nombre: x.nombre, alias: x.alias, secciones: (x.bibliografia || []).map(b => b.seccion),
          objetivos: (x.objetivos || []).map(id => d.contrato.split("\n").find(l => l.startsWith(`- ${id}:`))?.slice(2) || id) }));
        for (let i = 0; i < t.clasificar.length; i += 40) {
          estado(`⏳ Preparando material de ${tema.nombre}: clasificando ítems`);
          const lote = t.clasificar.slice(i, i + 40);
          try {
            const asignaciones = await conReintento(async error => {
              const r = validarAsignaciones(await pedirJSON(ctx, modelo, CLASIFICAR, JSON.stringify({ temas, items: lote.map(x => ({ doc: x.doc, id: x.id, enunciado: x.enunciado.slice(0, 1500) })) }) + error, signal, 8000), lote, new Set(temas.map(x => x.id)));
              await python("asignar", { vault, curso, asignaciones: r }, signal, "preparacion.py");
              return r;
            }, signal);
            asignadas += asignaciones.filter((a: any) => a.tema === tema.id).length;
          } catch (e) {
            cortar(e);
            fallo ||= !avisos.length;
            avisos.push(`no se ${lote.length === 1 ? "pudo clasificar 1 ítem" : `pudieron clasificar ${lote.length} ítems`} (${mensaje(e).slice(0, 150)})`);
            for (const x of lote) fallos[`clasificar/${x.doc}/${x.id}`] = x.entrada;
          }
        }
        t = await pedir();
      }
      const pendientes = t.restantes + t.paginas.reduce((n, x) => n + x.paginas.length, 0), completa = !pendientes && !t.segmentar.length && !t.clasificar.length && !t.en_espera;
      await python("registrar", { vault, curso, tema: { id: tema.id, estado: completa ? "completa" : "incompleta", indice: t.indice, pendientes }, fallos }, signal, "preparacion.py");
      if (!hubo) return;
      const e = sesion.actual();
      if (e?.a.curso === curso) {
        e.d.items = await python("bancos", { vault, curso }, signal, "preparacion.py");
        try { sesion.refrescar(); } catch { /* El tema dejó el índice: el próximo /estudiar lo informa. */ }
      }
      const resultado = `${cuenta(transcriptas, "página transcripta", "páginas transcriptas")}, ${cuenta(nuevos, "ítem nuevo", "ítems nuevos")}`;
      const quedan = pendientes === 1 ? "queda 1 página" : `quedan ${pendientes} páginas`;
      const detalle = avisos[0]?.replace(/\.$/, "").slice(0, 200) || (pendientes ? quedan : "quedan ítems que no se pudieron preparar");
      avisar(completa ? `Material de ${tema.nombre} listo: ${resultado}.` : `Material de ${tema.nombre} preparado en parte: ${resultado}; ${detalle}, ${fallo || !avisos.length && !pendientes ? "se reintenta mañana o si cambia el material" : "sigue la próxima vez"}.`, completa ? "info" : "warning");
      if (e?.a.curso === curso && e.a.tema === tema.id) pi.sendMessage({ customType: "curso-preparacion", display: false,
        content: `Preparación automática del material de «${tema.nombre}»: ${resultado}${segmentados.length ? ` (ítems de ${segmentados.join(", ")})` : ""}${asignadas ? `; ${cuenta(asignadas, "ítem asignado a este tema, marcado", "ítems asignados a este tema, marcados")} «asignado automáticamente» en el dossier` : ""}${pendientes ? `; ${quedan} sin transcribir` : ""}. El dossier ya está actualizado: usá leer_paginas y leer_items con ese material.` }, { deliverAs: "nextTurn" });
    } catch (e) {
      // Cancelada al cerrar pi, o la ingesta base tomó la salida: sin aviso; se reintenta después.
      if (ocupada) intentados.delete(clave);
      else if (!signal.aborted) avisar(`Preparación del material no disponible: ${mensaje(e).replace(/^No se completó la (operación|preparación): /, "").replace(/\.$/, "").slice(0, 200)}; seguimos con lo que hay.`, "warning");
    } finally {
      estado(undefined);
      corriendo.delete(curso);
      // Tras /reload el lock puede ser de otra instancia: sólo se borra el propio.
      try { if (readFileSync(lock, "utf8") === propio) unlinkSync(lock); } catch { /* Ya no estaba. */ }
    }
  }
  pi.on("before_agent_start", (_event, ctx) => {
    try {
      const e = sesion.actual(), tema = e?.d.temas.find(t => t.id === e.a.tema);
      // Sin await: la primera pregunta no espera a la preparación.
      if (e && tema && !e.a.adHoc && !intentados.has(e.a.log) && necesitaPreparacion(e.r, tema.id)) ultima = preparar(e.a.curso, tema, e.d, e.r, ctx, e.a.log);
    } catch { /* Sin curso legible no hay qué preparar. */ }
  });
  pi.on("session_shutdown", () => { for (const c of corriendo.values()) c.abort(); });
  return { ultima: () => ultima };
}
