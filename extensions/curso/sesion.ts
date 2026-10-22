import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdirSync, openSync, closeSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { piDir, vaultDir } from "../../scripts/lib/pi-sdk.mjs";
import { normalizar } from "../../scripts/ingesta/bm25.ts";
import { buscarMaterial, cita, documento, dossier, esSlug, leerItems, leerPaginas, ordenarTemas, resolverTemas, rutaSegura,
  type Activo, type DatosCurso, type Tema } from "./material.ts";

import { verificacionPrevia } from "./researcher.ts";

type Config = { max_tokens_dossier: number; max_tokens_curso_md: number };
export function registrarSesion(pi: ExtensionAPI, vault = vaultDir, recursos = piDir) {
  let activo: Activo | undefined;
  let datos: DatosCurso | undefined;
  let resumen = "", teach = "", modo = "", pendiente: string | undefined;
  const cursos = () => readdirSync(rutaSegura(vault, "cursos"), { withFileTypes: true }).filter(d => d.isDirectory() && esSlug(d.name)).map(d => d.name);
  const raiz = (curso: string) => {
    if (!esSlug(curso)) throw new Error("Curso inválido: usá su slug.");
    return rutaSegura(vault, `cursos/${curso}`);
  };
  async function cargar(curso: string, validar = false, signal?: AbortSignal): Promise<DatosCurso> {
    raiz(curso);
    const r = await pi.exec(join(recursos, ".venv/bin/python"), [join(recursos, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", curso, ...(validar ? ["--validar"] : [])], { timeout: 10000, signal });
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Curso no disponible.");
    return JSON.parse(r.stdout);
  }
  function preparar(a: Activo, d: DatosCurso) {
    const config: Config = JSON.parse(readFileSync(join(recursos, "curso.config.json"), "utf8"));
    const tema = a.adHoc || d.temas.find(t => t.id === a.tema);
    if (!tema) throw new Error("El tema ya no está en el índice; volvé a seleccionarlo con /estudiar.");
    let anterior = "";
    pendiente = undefined;
    try {
      const carpeta = rutaSegura(vault, `cursos/${a.curso}/sesiones`);
      const logs = readdirSync(carpeta).filter(n => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${tema.id}(?:-\\d+)?\\.md$`).test(n) && relative(vault, join(carpeta, n)) !== a.log)
        .sort((a, b) => statSync(rutaSegura(carpeta, a)).mtimeMs - statSync(rutaSegura(carpeta, b)).mtimeMs || a.localeCompare(b, undefined, { numeric: true }));
      const ultimo = logs.at(-1);
      if (ultimo && !(d.progreso.historial || []).some(h => typeof h === "object" && h !== null && "log" in h && basename(String(h.log)) === ultimo && (!("cierre" in h) || h.cierre !== false))) {
        pendiente = `sesiones/${ultimo}`;
        anterior = `Última sesión sin registro final de progreso: [[cursos/${a.curso}/${pendiente}]]. Ofrecé reconstruirla con leer_sesion_anterior y confirmación; no infieras errores de preguntas sin respuesta.`;
      }
    } catch { /* Sin sesiones anteriores no hay nada para reconstruir. */ }
    const nuevo = dossier(raiz(a.curso), { ...d, avisos: [...d.avisos, ...(anterior ? [anterior] : [])] }, tema, config.max_tokens_dossier, config.max_tokens_curso_md, verificacionPrevia(vault, recursos, d, tema));
    teach = readFileSync(join(recursos, "skills/teach/SKILL.md"), "utf8");
    modo = readFileSync(join(recursos, "modo-curso.md"), "utf8");
    activo = a; datos = d; resumen = nuevo;
    return tema;
  }
  async function restaurar(_event: unknown, ctx: ExtensionContext) {
    activo = undefined; datos = undefined; resumen = ""; pendiente = undefined;
    ctx.ui.setStatus("curso", undefined);
    const entradas = ctx.sessionManager.getBranch();
    const ultimo = [...entradas].reverse().find(e => e.type === "custom" && e.customType === "curso");
    if (ultimo?.type !== "custom" || !ultimo.data) { ctx.ui.setStatus("curso", undefined); return; }
    try {
      const a = ultimo.data as Activo;
      if (!esSlug(a.curso) || !esSlug(a.tema) || typeof a.log !== "string" || !a.log.startsWith(`cursos/${a.curso}/sesiones/`) || !a.log.endsWith(".md")) throw new Error("Estado de curso inválido.");
      rutaSegura(vault, a.log);
      const d = await cargar(a.curso);
      for (const aviso of d.avisos.filter(a => a.startsWith("Progreso"))) ctx.ui.notify(aviso, "warning");
      const tema = preparar(a, d);
      ctx.ui.setStatus("curso", `📚 ${a.curso} › ${tema.nombre}`);
    } catch (e) { ctx.ui.notify(`No se restauró el curso: ${e instanceof Error ? e.message : "estado inválido"}`, "warning"); }
  }
  pi.on("session_start", restaurar);
  pi.on("session_tree", restaurar);
  pi.on("before_agent_start", event => {
    if (!activo) {
      for (const clave of ["teach", "modo_curso", "curso"]) delete event.systemPromptOptions.sections[clave];
      return;
    }
    Object.assign(event.systemPromptOptions.sections, { teach, modo_curso: modo, curso: resumen });
  });
  const cacheCompletar = new Map<string, { mtime: number; datos: DatosCurso }>();
  pi.registerCommand("estudiar", {
    description: "Estudiar un tema del curso con sus fuentes, contexto persistente y log en Obsidian",
    async getArgumentCompletions(prefijo) {
      try {
        const espacio = prefijo.indexOf(" ");
        if (espacio < 0) return cursos().filter(c => normalizar(c).includes(normalizar(prefijo))).map(c => ({ value: `${c} `, label: c }));
        const curso = prefijo.slice(0, espacio), q = normalizar(prefijo.slice(espacio + 1).trim());
        const mtime = statSync(rutaSegura(raiz(curso), "indice.yaml")).mtimeMs;
        let cached = cacheCompletar.get(curso);
        if (!cached || cached.mtime !== mtime) { cached = { mtime, datos: await cargar(curso) }; cacheCompletar.set(curso, cached); }
        return cached.datos.temas.filter(t => [t.id, t.nombre, ...(t.alias || [])].some(s => normalizar(s).includes(q))).map(t => ({ value: `${curso} ${t.id}`, label: t.nombre }));
      } catch { return null; }
    },
    async handler(args, ctx) {
      if (!ctx.isIdle()) { ctx.ui.notify("Esperá a que termine el turno antes de cambiar de tema.", "warning"); return; }
      const [curso, ...resto] = args.trim().split(/\s+/), consulta = resto.join(" ");
      if (!curso) { ctx.ui.notify("Uso: /estudiar <curso> [tema]", "warning"); return; }
      try {
        const d = await cargar(curso, true);
        for (const aviso of d.avisos.filter(a => a.startsWith("Progreso"))) ctx.ui.notify(aviso, "warning");
        cacheCompletar.delete(curso);
        const candidatos = consulta ? resolverTemas(d.temas, consulta) : ordenarTemas(d);
        let tema: Tema | undefined;
        if (consulta && candidatos.length === 1) tema = candidatos[0];
        else if (candidatos.length && ctx.hasUI) {
          const etiquetas = candidatos.map(t => `${t.nombre} [${t.id}] · ${d.progreso.temas[t.id]?.estado || "sin_empezar"}`);
          const elegido = await ctx.ui.select(consulta ? "Elegí el tema" : "Temas: en curso, prerequisitos firmes, restantes", etiquetas);
          if (!elegido) return;
          tema = candidatos[etiquetas.indexOf(elegido)];
        } else if (candidatos.length) { ctx.ui.notify("Indicá el id exacto del tema; esta sesión no tiene selector interactivo.", "warning"); return; }
        if (!tema) {
          if (!consulta) { ctx.ui.notify("El índice no tiene temas utilizables; indicá el tema para continuar en modo ad hoc.", "warning"); return; }
          let resultados: ReturnType<typeof buscarMaterial> = [];
          try { resultados = buscarMaterial(raiz(curso), d, consulta, "bibliografia"); } catch { /* La falta de BM25 no impide un probe ad hoc. */ }
          let seleccionado = resultados[0];
          if (ctx.hasUI) {
            const etiquetas = resultados.map(r => `${r.doc} · PDF ${r.pagina} · ${r.seccion || r.fragmento.slice(0, 70)}`);
            const sinMaterial = "Continuar sin material ubicado (ad hoc)";
            const elegido = await ctx.ui.select("Tema fuera del índice: elegí una sección para el modo ad hoc", [...etiquetas, sinMaterial]);
            if (!elegido) return;
            seleccionado = resultados[etiquetas.indexOf(elegido)];
          }
          tema = { id: "ad-hoc", nombre: consulta, alias: [], unidad: 1, prerequisitos: [], objetivos: [],
            bibliografia: seleccionado ? [{ doc: seleccionado.doc, seccion: seleccionado.seccion || consulta, paginas: [seleccionado.pagina, seleccionado.pagina] }] : [] };
        }
        if (!esSlug(tema.id)) throw new Error("Id del tema inválido; revisá el índice.");
        const a: Activo = { curso, tema: tema.id, log: "", ...(tema.id === "ad-hoc" ? { adHoc: tema } : {}) };
        // Preparar antes de crear archivos evita dejar un log vacío por configuración inválida.
        const anterior = { activo, datos, resumen, teach, modo, pendiente };
        preparar(a, d);
        try {
          const carpeta = rutaSegura(vault, `cursos/${curso}/sesiones`);
          mkdirSync(carpeta, { recursive: true });
          const fecha = new Date().toISOString().slice(0, 10);
          for (let n = 1; ; n++) {
            const file = rutaSegura(vault, `cursos/${curso}/sesiones/${fecha}-${tema.id}${n === 1 ? "" : `-${n}`}.md`);
            try { closeSync(openSync(file, "wx")); a.log = relative(vault, file); break; }
            catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
          }
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("md-log no confirmó el vínculo; ejecutá /reload y reintentá.")), 2000);
            pi.events.emit("md-log:link", { file: rutaSegura(vault, a.log), backfill: false,
              onComplete(error?: string) { clearTimeout(timer); error ? reject(new Error(error)) : resolve(); } });
          });
        } catch (e) { ({ activo, datos, resumen, teach, modo, pendiente } = anterior); throw e; }
        pi.appendEntry("curso", a);
        pi.setSessionName(`${d.nombre || curso} · ${tema.nombre}`);
        const parcial = d.avisos.length || d.validacion?.errores.length || d.validacion?.avisos.length;
        ctx.ui.setStatus("curso", `📚 ${curso} › ${tema.nombre}${parcial ? " · preparación parcial" : ""}`);
        if (parcial) ctx.ui.notify("Preparación parcial: seguimos con el material disponible, cotejando sus páginas dudosas.", "warning");
        pi.sendUserMessage(`Empecemos con «${tema.nombre}» (${curso}). Iniciá el probe con la primera pregunta, sin preámbulo ni una nueva orden del estudiante.`, { deliverAs: "followUp" });
      } catch (e) { ctx.ui.notify(e instanceof Error ? e.message : "No se pudo activar el curso.", "error"); }
    },
  });
  pi.registerCommand("cursos", {
    description: "Listar los cursos disponibles",
    async handler(_args, ctx) {
      try { ctx.ui.notify(cursos().join("\n") || "No hay cursos preparados.", "info"); }
      catch { ctx.ui.notify("No hay cursos preparados; usá /curso-nuevo.", "warning"); }
    },
  });
  function actual() {
    if (!activo || !datos) throw new Error("No hay curso activo. Usá /estudiar <curso> <tema>.");
    return { a: activo, d: datos, r: raiz(activo.curso), pendiente };
  }
  return {
    actual: () => activo && datos ? actual() : undefined,
    cargar,
    actualizarProgreso: (progreso: DatosCurso["progreso"]) => { if (datos) datos.progreso = progreso; },
    async cerrar(ctx: ExtensionContext) {
      const { a } = actual();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("md-log no confirmó el cierre; el curso sigue activo.")), 2000);
        pi.events.emit("md-log:unlink", { file: rutaSegura(vault, a.log), onComplete(error?: string) { clearTimeout(timer); error ? reject(new Error(error)) : resolve(); } });
      });
      pi.appendEntry("curso", null);
      activo = undefined; datos = undefined; resumen = ""; pendiente = undefined;
      ctx.ui.setStatus("curso", undefined);
    },
    refrescar: () => { if (activo && datos) preparar(activo, datos); return resumen; },
    leer_paginas({ doc, desde, hasta, despues_del_intento = false }: { doc: string; desde: number; hasta: number; despues_del_intento?: boolean }) { const { d, r } = actual(); return leerPaginas(r, d, doc, desde, hasta, despues_del_intento); },
    buscar_material({ consulta, tipo }: { consulta: string; tipo?: string }) { const { d, r } = actual(); return JSON.stringify(buscarMaterial(r, d, consulta, tipo)); },
    leer_items({ doc, ids, incluir_solucion = false }: { doc: string; ids: string[]; incluir_solucion?: boolean }) { return leerItems(actual().d, doc, ids, incluir_solucion); },
    async ver_pagina({ doc, pagina, despues_del_intento = false }: { doc: string; pagina: number; despues_del_intento?: boolean }, signal?: AbortSignal) {
      const { a, d, r } = actual(), fuente = documento(d, doc);
      if (!Number.isInteger(pagina) || pagina < 1 || pagina > fuente.paginas) throw new Error("Página PDF fuera de rango.");
      if (!despues_del_intento && ["evaluaciones", "soluciones"].includes(fuente.tipo)) throw new Error("La imagen de esta página trae la solución: leé el enunciado con leer_items y mostrala recién después del intento (despues_del_intento:true).");
      const resultado = await pi.exec(join(recursos, ".venv/bin/python"), [join(recursos, "scripts/ingesta/sesion.py"), "renderizar", "--vault", vault, "--curso", a.curso, "--doc", doc, "--pagina", String(pagina)], { timeout: 10000, signal });
      if (resultado.code !== 0) throw new Error(resultado.stderr.trim() || "No se pudo renderizar la página.");
      return { imagen: readFileSync(rutaSegura(r, `_procesado/${doc}/render/${String(pagina).padStart(4, "0")}.png`)).toString("base64"), cita: cita(d, doc, pagina) };
    },
  };
}
