import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdirSync, openSync, closeSync, readdirSync, readFileSync, renameSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { piDir, vaultDir, pythonDelVenv, leerConfig } from "../../scripts/lib/pi-sdk.mjs";
import { normalizar } from "../../scripts/ingesta/bm25.ts";
import { aBarra, buscarMaterial, cita, copiaEnPagina, documento, dossier, esSlug, leer, leerItems, leerPaginas, ordenarTemas, paginasReservadas, reservados, resolverTemas, rutaSegura,
  type Activo, type DatosCurso, type Ref, type Tema } from "./material.ts";

import { verificacionPrevia } from "./researcher.ts";
import { elegir } from "../comun/elegir.ts";
import { cortarTurno } from "../comun/corte.ts";

type Config = { max_tokens_dossier: number; max_tokens_curso_md: number };
// Tools del estudio; read queda para las fotos del alumno, que pi 1.4.0 pega como ruta de texto (interactive-mode.js:2477-2483).
const ESTUDIO = ["quiz", "ask_user_question", "buscar_material", "leer_paginas", "leer_items", "ver_pagina", "registrar_progreso", "leer_sesion_anterior", "investigar_tema", "read"];
const COPIA = "Material desde la última carga";
// pi.exec devuelve code 0 cuando mata al proceso por tiempo (exec.js:63): manda killed. Un traceback no es un mensaje para el alumno.
export function fallaPython(r: { stderr: string; killed: boolean }) {
  const causa = r.stderr.trim().split("\n").at(-1) || "";
  return r.killed ? "El entorno de ingesta (Python) no respondió a tiempo: corré .pi/scripts/doctor y reintentá."
    : causa && !/^(Traceback|[\w.]+(Error|Exception)\b)/.test(causa) ? causa : "El entorno de ingesta (Python) falló: corré .pi/scripts/doctor y reintentá.";
}
// Una sesión real tiene alguna respuesta del alumno: un mensaje propio (no las órdenes que antes se anotaban como suyas) o un quiz o pregunta respondidos.
const conRespuestas = (t: string) => /^> \[!quote\] VOS\n\n(?!Empecemos con «|Terminemos (la|esta) sesión)|^> \[!(success|failure)\] Quiz|^> \[!question\] Quiz — No sé|^> \[!example\] Respuesta\n> (?!\(sin respuesta\))/m.test(t)
  && !/Prueba técnica|Ensayo técnico|SINTÉTICO/.test(t);
const cerrado = (d: DatosCurso, log: string) => (d.progreso.historial || []).some(h => typeof h === "object" && h !== null && "log" in h && basename(String(h.log)) === basename(log) && (!("cierre" in h) || h.cierre !== false));
const vivo = (pid: unknown) => { try { return Number.isInteger(pid) && (pid as number) > 0 && process.kill(pid as number, 0); } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; } };
// Un errno de Node no es un mensaje para el alumno.
function mensaje(e: unknown, defecto: string) {
  const { code, syscall } = (e ?? {}) as NodeJS.ErrnoException;
  return code === "ENOSPC" ? "Disco lleno: liberá espacio y repetí /estudiar." : code && syscall ? `${defecto} (${code}).` : e instanceof Error ? e.message : `${defecto}.`;
}
function escribir(file: string, texto: string) {
  const temporal = `${file}.${process.pid}.tmp`;
  try { writeFileSync(temporal, texto); renameSync(temporal, file); } catch (e) { rmSync(temporal, { force: true }); throw e; }
}
// Las órdenes internas van ocultas: llegan al modelo como mensaje custom y md-log no las anota como del alumno.
export const ordenar = (pi: ExtensionAPI, content: string) => pi.sendMessage({ customType: "curso-orden", content, display: false }, { triggerTurn: true, deliverAs: "followUp" });
export function registrarSesion(pi: ExtensionAPI, vault = vaultDir, recursos = piDir) {
  // log es el nombre de la sesión, al que progreso.py ata fecha y orden; nota, la ruta actual si se renombró en Obsidian.
  let activo: (Activo & { nota?: string }) | undefined;
  let datos: DatosCurso | undefined;
  let resumen = "", teach = "", modo = "", pendiente: string | undefined, sinLog = false, religar = false, herramientas: string[] | undefined;
  const activarEstudio = () => { const todas = new Set(pi.getAllTools().map(t => t.name)); pi.setActiveTools(ESTUDIO.filter(n => todas.has(n))); };
  const cursos = () => { const dir = rutaSegura(vault, "cursos"); return statSync(dir, { throwIfNoEntry: false }) ? readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && esSlug(d.name)).map(d => d.name) : []; };
  const raiz = (curso: string) => {
    if (!esSlug(curso)) throw new Error("Curso inválido: usá su slug.");
    return rutaSegura(vault, `cursos/${curso}`);
  };
  // Registro propio del curso activo, fuera del archivo de sesión de pi, que con el disco lleno pierde entradas (X01).
  const registro = (curso: string) => rutaSegura(raiz(curso), ".sesion-activa.json");
  function registrarActivo(ctx: ExtensionContext, estado: Activo) {
    try { escribir(registro(estado.curso), JSON.stringify({ sesion: ctx.sessionManager.getSessionId(), pid: process.pid, ...estado })); }
    catch (e) { ctx.ui.notify(`No se guardó el registro del curso activo (${(e as NodeJS.ErrnoException).code === "ENOSPC" ? "disco lleno" : "error de archivo"}): si pi se corta, repetí /estudiar.`, "warning"); }
  }
  function olvidarActivo(ctx: ExtensionContext, curso: string) {
    try { if (JSON.parse(readFileSync(registro(curso), "utf8")).sesion === ctx.sessionManager.getSessionId()) rmSync(registro(curso)); } catch { /* sin registro propio */ }
  }
  // Sin Python, la última carga buena del curso mantiene teach, modo-curso y dossier.
  async function cargar(curso: string, validar = false, signal?: AbortSignal, timeout = 10000): Promise<DatosCurso> {
    const copia = rutaSegura(raiz(curso), ".sesion-cargada.json");
    const r = await pi.exec(pythonDelVenv(recursos), [join(recursos, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", curso, ...(validar ? ["--validar"] : [])], { timeout, signal });
    if (!r.killed && r.code === 0) try {
      const d = JSON.parse(r.stdout);
      try { escribir(copia, r.stdout); } catch { /* La copia es un respaldo: sin disco o sin permiso se sigue con lo cargado. */ }
      return d;
    } catch { /* Salida cortada: como un fallo del entorno. */ }
    let d: DatosCurso;
    try { d = JSON.parse(readFileSync(copia, "utf8")); } catch { throw new Error(fallaPython(r)); }
    // fallaPython remite al doctor sólo si Python no dio un error propio (p. ej. «Disco lleno…»), que ya dice qué hacer.
    const causa = fallaPython(r);
    return { ...d, avisos: [...d.avisos, causa.includes(".pi/scripts/doctor") ? `${COPIA}; el entorno de ingesta no respondió: corré .pi/scripts/doctor.` : `${COPIA}. ${causa}`] };
  }
  // Se ofrece una sola vez (queda en .no-reconstruir.json) la última sesión real del tema sin cierre; no con el progreso dudoso, en ad hoc ni la viva de otro pi.
  function sinCierre(a: Activo, d: DatosCurso, tema: Tema) {
    if (a.adHoc || d.avisos.some(x => /^Progreso (no disponible|inválido)/.test(x) || x.startsWith(COPIA))) return;
    const r = raiz(a.curso), carpeta = rutaSegura(r, "sesiones");
    let viva = "";
    try { const o = JSON.parse(readFileSync(rutaSegura(r, ".sesion-activa.json"), "utf8")); if (o.pid !== process.pid && vivo(o.pid)) viva = o.log; } catch { /* sin otra sesión registrada */ }
    const log = readdirSync(carpeta).filter(n => {
      const sufijo = n.match(new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${tema.id}(?:-(\\d+))?\\.md$`));
      return sufijo && !d.temas.some(t => t.id === `${tema.id}-${sufijo[1]}`) && ![a.log, viva].includes(`cursos/${a.curso}/sesiones/${n}`);
    }).sort((x, y) => statSync(rutaSegura(carpeta, x)).mtimeMs - statSync(rutaSegura(carpeta, y)).mtimeMs || x.localeCompare(y, undefined, { numeric: true }))
      .findLast(n => { try { return conRespuestas(leer(r, `sesiones/${n}`)); } catch { return false; } });
    if (!log || cerrado(d, `sesiones/${log}`) || !noOfrecer(a.curso, `sesiones/${log}`)) return;
    return `sesiones/${log}`;
  }
  // Anota un log (relativo al curso) para no ofrecerlo; devuelve si era nuevo.
  function noOfrecer(curso: string, log: string) {
    const lista = rutaSegura(raiz(curso), ".no-reconstruir.json");
    let vistos: string[] = [];
    try { vistos = JSON.parse(readFileSync(lista, "utf8")); } catch { /* nada anotado todavía */ }
    if (vistos.includes(log)) return false;
    try { escribir(lista, JSON.stringify([...vistos, log])); } catch { /* Sin disco, la oferta puede repetirse. */ }
    return true;
  }
  function preparar(a: Activo, d: DatosCurso) {
    const config: Config = leerConfig(recursos);
    const tema = a.adHoc || d.temas.find(t => t.id === a.tema);
    if (!tema) throw new Error("El tema ya no está en el índice; volvé a seleccionarlo con /estudiar.");
    let anterior = "";
    if (pendiente && cerrado(d, pendiente)) pendiente = undefined;
    if (!pendiente) try {
      pendiente = sinCierre(a, d, tema);
      if (pendiente) anterior = `Última sesión sin registro final de progreso: [[cursos/${a.curso}/${pendiente}]]. Ofrecé reconstruirla con leer_sesion_anterior y confirmación; no infieras errores de preguntas sin respuesta.`;
    } catch { /* Sin sesiones anteriores no hay nada para reconstruir. */ }
    const nuevo = dossier(raiz(a.curso), { ...d, avisos: [...d.avisos, ...(anterior ? [anterior] : [])] }, tema, config.max_tokens_dossier, config.max_tokens_curso_md, verificacionPrevia(vault, recursos, d, tema));
    teach = readFileSync(join(recursos, "skills/teach/SKILL.md"), "utf8");
    modo = readFileSync(join(recursos, "modo-curso.md"), "utf8");
    activo = a; datos = d; resumen = nuevo;
    return tema;
  }
  async function restaurar(ctx: ExtensionContext, inicio: boolean) {
    activo = undefined; datos = undefined; resumen = ""; pendiente = undefined; sinLog = false; religar = false; herramientas = undefined;
    ctx.ui.setStatus("curso", undefined);
    const ultimo = ctx.sessionManager.getBranch().findLast(e => e.type === "custom" && e.customType === "curso");
    let estado = ultimo?.type === "custom" ? ultimo.data : undefined;
    // Si el archivo de pi ya no tiene ninguna entrada del curso, vale el registro propio de esta sesión; md-log se revincula en el próximo turno.
    if (!ultimo && inicio) try {
      if (!ctx.sessionManager.getEntries().some(e => e.type === "custom" && e.customType === "curso")) for (const curso of cursos()) try {
        const { sesion, pid: _pid, ...guardado } = JSON.parse(readFileSync(registro(curso), "utf8"));
        if (sesion === ctx.sessionManager.getSessionId()) { estado = guardado; pi.appendEntry("curso", estado); religar = !guardado.sinLog; }
      } catch { /* sin registro en ese curso */ }
    } catch { /* sin registro utilizable */ }
    if (!estado) return;
    try {
      const a = estado as Activo & { nota?: string };
      if (!esSlug(a.curso) || !esSlug(a.tema) || [a.log, a.nota ?? a.log].some(l => typeof l !== "string" || !l.startsWith(`cursos/${a.curso}/sesiones/`) || !l.endsWith(".md"))) throw new Error("Estado de curso inválido.");
      for (const l of [a.log, a.nota ?? a.log]) rutaSegura(vault, l);
      const d = await cargar(a.curso, false, undefined, 30000);
      for (const aviso of d.avisos.filter(a => a.startsWith("Progreso") || a.startsWith(COPIA))) ctx.ui.notify(aviso, "warning");
      const tema = preparar(a, d);
      sinLog = !!(a as { sinLog?: boolean }).sinLog;
      herramientas = (a as { herramientas?: string[] }).herramientas ?? pi.getActiveTools();
      activarEstudio();
      registrarActivo(ctx, a);
      ctx.ui.setStatus("curso", `📚 ${a.curso} › ${tema.nombre}`);
      // pi -c no retoma un turno cortado: si la rama termina en un mensaje del alumno sin respuesta, el tutor lo responde.
      const ultimoMensaje = () => ctx.sessionManager.getBranch().findLast(e => e.type === "message");
      const pregunta = inicio && ctx.hasUI ? ultimoMensaje() : undefined;
      if (pregunta?.type === "message" && pregunta.message.role === "user") {
        ctx.ui.notify("La clase se cortó antes de responder tu último mensaje: el tutor lo responde ahora.", "info");
        // Al arrancar pi, session_start corre antes de que la terminal escuche a la sesión (interactive-mode.js:787, 1598-1603): el turno se difiere.
        setTimeout(() => {
          try { if (activo && ctx.isIdle() && ultimoMensaje()?.id === pregunta.id) ordenar(pi, "La sesión se cortó antes de que respondieras el último mensaje del alumno. Respondelo ahora, sin repetirlo ni pedirle que lo reescriba."); }
          catch { /* la sesión ya se reemplazó */ }
        }, 1500).unref();
      }
    } catch (e) { ctx.ui.notify(`No se restauró el curso: ${mensaje(e, "estado inválido")}`, "warning"); }
  }
  pi.on("session_start", (_event, ctx) => restaurar(ctx, true));
  pi.on("session_tree", (_event, ctx) => restaurar(ctx, false));
  pi.on("before_agent_start", (event, ctx) => {
    if (!activo) {
      for (const clave of ["teach", "modo_curso", "curso"]) delete event.systemPromptOptions.sections[clave];
      return;
    }
    Object.assign(event.systemPromptOptions.sections, { teach, modo_curso: modo, curso: resumen });
    // teach ya va como sección y read sólo abre fotos: ninguna skill se puede cargar durante el estudio.
    event.systemPromptOptions.skills = [];
    // pi activa las tools que se registran tarde (web, MCP, o al reanudar sin el set en el archivo de sesión): el set se reafirma en cada turno.
    activarEstudio();
    if (religar) {
      religar = false;
      pi.events.emit("md-log:link", { file: rutaSegura(vault, activo.nota ?? activo.log), backfill: false,
        onComplete(error?: string) { if (error) ctx.ui.notify("No se reabrió la nota del curso: seguimos sin nota de Obsidian.", "warning"); } });
    }
  });
  // md-log siguió la nota renombrada o movida: su ruta queda en el curso activo y en el registro propio, para revincularla al restaurar y cerrarla.
  // shortcut: ?. porque los dobles de pi de los tests de sesión y progreso sólo emiten; sacarlo si suman events.on.
  pi.events.on?.("md-log:movido", datos => {
    const { anterior, actual: nueva } = datos as { anterior: string; actual: string };
    try {
      if (!activo || anterior !== rutaSegura(vault, activo.nota ?? activo.log)) return;
      const nota = aBarra(relative(vault, nueva));
      // Fuera de sesiones/ se cierra por la ruta de origen, que md-log también reconoce.
      activo.nota = nota.startsWith(`cursos/${activo.curso}/sesiones/`) && nota.endsWith(".md") ? nota : undefined;
      pi.appendEntry("curso", { ...activo, ...(sinLog ? { sinLog } : {}), herramientas });
      const propio = JSON.parse(readFileSync(registro(activo.curso), "utf8"));
      if (propio.log === activo.log) escribir(registro(activo.curso), JSON.stringify({ ...propio, nota: activo.nota }));
    } catch { /* Sin registro propio, md-log igual sigue la nota. */ }
  });
  // Durante el estudio read no lee material ni notas del curso (saltearía el filtro de soluciones) ni otros textos.
  pi.on("tool_call", (event, ctx) => {
    if (!activo || event.toolName !== "read") return;
    const ruta = resolve(ctx.cwd, String((event.input as { path?: unknown }).path ?? "").replace(/^@/, "").replace(/^~(?=[\\/]|$)/, homedir()));
    if (!/\.(png|jpe?g|webp|gif)$/i.test(ruta) || ruta.startsWith(join(vault, "cursos") + sep)) return { block: true, reason: "Durante el estudio read sólo abre fotos del alumno; el material se lee con leer_paginas, leer_items o ver_pagina." };
  });
  let preguntas = 0;
  pi.on("tool_execution_start", event => { if (["quiz", "ask_user_question"].includes(event.toolName)) preguntas++; });
  pi.on("tool_execution_end", event => { if (["quiz", "ask_user_question"].includes(event.toolName)) preguntas = Math.max(0, preguntas - 1); });
  // pi muestra el error del proveedor en inglés: se suma una línea con la causa probable y qué hacer.
  pi.on("agent_settled", (event, ctx) => {
    preguntas = 0;
    const ultimo = activo && !event.aborted ? ctx.sessionManager.getBranch().findLast(e => e.type === "message") : undefined;
    if (ultimo?.type !== "message" || ultimo.message.role !== "assistant" || ultimo.message.stopReason !== "error") return;
    const error = ultimo.message.errorMessage || "";
    const causa = /ENOSPC|no space left/i.test(error) ? "Disco lleno: liberá espacio"
      : /usage limit|quota|rate.?limit|\b429\b|too many requests/i.test(error) ? "El proveedor rechazó el pedido por cuota o límite de uso: esperá o cambiá de modelo con /model"
      : /api key|unauthori[sz]ed|\b40[13]\b|authenticat|credential|expired|\/login/i.test(error) ? "Faltan o vencieron las credenciales del modelo: ejecutá /login"
      : /fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|socket|timed? ?out/i.test(error) ? "Sin conexión con el proveedor del modelo: revisá la red"
      : "El modelo devolvió un error";
    ctx.ui.notify(`${causa}; escribí «seguí» para reintentar o /fin para guardar.`, "warning");
  });
  const cacheCompletar = new Map<string, { mtime: number; temas: Tema[] }>();
  pi.registerCommand("estudiar", {
    description: "Estudiar un tema del curso con sus fuentes, contexto persistente y log en Obsidian",
    async getArgumentCompletions(prefijo) {
      try {
        // Un texto exacto no se sugiere: en pi-tui, Enter con la lista abierta aplica la sugerencia en vez de enviar.
        const espacio = prefijo.indexOf(" "), lista = cursos();
        if (espacio < 0) return lista.includes(normalizar(prefijo)) ? null : lista.filter(c => normalizar(c).includes(normalizar(prefijo))).map(c => ({ value: `${c} `, label: c }));
        const curso = lista.find(c => normalizar(c) === normalizar(prefijo.slice(0, espacio))), q = normalizar(prefijo.slice(espacio + 1).trim());
        if (!curso) return null;
        // Sin Python ni espera (salvo la primera vez): una lista vieja abierta deformaba el comando al tipear rápido.
        const copia = rutaSegura(raiz(curso), ".sesion-cargada.json");
        if (!statSync(copia, { throwIfNoEntry: false })) await cargar(curso);
        const mtime = statSync(copia).mtimeMs;
        let cached = cacheCompletar.get(curso);
        if (cached?.mtime !== mtime) { cached = { mtime, temas: (JSON.parse(readFileSync(copia, "utf8")) as DatosCurso).temas }; cacheCompletar.set(curso, cached); }
        if (cached.temas.some(t => [t.id, t.nombre, ...(t.alias || [])].some(s => normalizar(s) === q))) return null;
        return cached.temas.filter(t => [t.id, t.nombre, ...(t.alias || [])].some(s => normalizar(s).includes(q))).map(t => ({ value: `${curso} ${t.id}`, label: t.nombre }));
      } catch { return null; }
    },
    async handler(args, ctx) {
      try {
        const palabras = args.trim().split(/\s+/).filter(Boolean), lista = cursos();
        let curso = lista.find(c => normalizar(c) === normalizar(palabras[0] || ""));
        if (curso) palabras.shift();
        else if (lista.length === 1) curso = lista[0];
        else if (palabras.length) { ctx.ui.notify(lista.length ? `No hay un curso «${palabras[0]}»: elegí uno de ${lista.join(", ")}.` : "No hay cursos preparados; usá /curso-nuevo.", "warning"); return; }
        if (!curso) { ctx.ui.notify("Uso: /estudiar <curso> [tema]", "warning"); return; }
        const consulta = palabras.join(" "), modelo = ctx.model;
        if (!modelo) { ctx.ui.notify("No hay un modelo elegido: elegí uno con /model y repetí /estudiar.", "error"); return; }
        // hasConfiguredAuth lee un snapshot que puede estar viejo; como pi, se confirma con la resolución real (un error lo informa el turno).
        if (!ctx.modelRegistry.hasConfiguredAuth(modelo) && !(await ctx.modelRegistry.getProviderAuth(modelo.provider).catch(() => true))) {
          ctx.ui.notify(`Sin credenciales para ${modelo.provider}/${modelo.id}: ejecutá /login y repetí /estudiar.`, "error"); return;
        }
        // Con el disco lleno pi corta su archivo de sesión: por debajo de 200 MB no se arranca.
        let libres = Infinity;
        try { const disco = statfsSync(vault); libres = disco.bavail * disco.bsize; } catch { /* sin datos del disco */ }
        if (libres < 2e8) { ctx.ui.notify(`Disco casi lleno (${Math.floor(libres / 1e6)} MB libres): liberá espacio y repetí /estudiar.`, "error"); return; }
        if (libres < 1e9) ctx.ui.notify(`Queda poco disco (${Math.floor(libres / 1e6)} MB libres): liberá espacio pronto para no perder la sesión.`, "warning");
        let d = await cargar(curso, true);
        for (const aviso of d.avisos.filter(a => a.startsWith("Progreso") || a.startsWith(COPIA))) ctx.ui.notify(aviso, "warning");
        let candidatos = consulta ? resolverTemas(d.temas, consulta) : ordenarTemas(d), resultados: ReturnType<typeof buscarMaterial> = [];
        if (consulta && !candidatos.length) {
          try { resultados = buscarMaterial(raiz(curso), d, consulta, "bibliografia"); } catch { /* La falta de BM25 no impide un probe ad hoc. */ }
          candidatos = resolverTemas(d.temas, consulta, resultados);
        }
        let tema: Tema | undefined;
        if (consulta && candidatos.length === 1) tema = candidatos[0];
        else if (candidatos.length && ctx.hasUI) {
          const etiquetas = candidatos.map(t => `${t.nombre} [${t.id}] · ${d.progreso.temas[t.id]?.estado || "sin_empezar"}${resultados.length ? " · por material" : ""}`);
          const elegido = await elegir(ctx, consulta ? "Elegí el tema" : "Temas: en curso, prerequisitos firmes, restantes", resultados.length ? [...etiquetas, `Estudiar «${consulta}» fuera del índice (ad hoc)`] : etiquetas);
          if (!elegido) return;
          tema = candidatos[etiquetas.indexOf(elegido)];
        } else if (candidatos.length) { ctx.ui.notify("Indicá el id exacto del tema; esta sesión no tiene selector interactivo.", "warning"); return; }
        if (!tema) {
          if (!consulta) { ctx.ui.notify("El índice no tiene temas utilizables; indicá el tema para continuar en modo ad hoc.", "warning"); return; }
          let seleccionado = resultados[0];
          if (ctx.hasUI) {
            const etiquetas = resultados.map(r => `${r.doc} · PDF ${r.pagina} · ${r.seccion || r.fragmento.slice(0, 70)}`);
            const sinMaterial = "Continuar sin material ubicado (ad hoc)";
            const elegido = await elegir(ctx, "Tema fuera del índice: elegí una sección para el modo ad hoc", [...etiquetas, sinMaterial]);
            if (!elegido) return;
            seleccionado = resultados[etiquetas.indexOf(elegido)];
          }
          tema = { id: "ad-hoc", nombre: consulta, alias: [], unidad: 1, prerequisitos: [], objetivos: [],
            bibliografia: seleccionado ? [{ doc: seleccionado.doc, seccion: seleccionado.seccion || consulta, paginas: [seleccionado.pagina, seleccionado.pagina] }] : [] };
        }
        if (!esSlug(tema.id)) throw new Error("Id del tema inválido; revisá el índice.");
        // Con un tema activo, lo trabajado se guarda (como /fin, con orden oculta y espera) o se descarta a propósito.
        const viejo = activo && !activo.adHoc && ctx.hasUI ? activo : undefined, nombre = viejo && (datos?.temas.find(t => t.id === viejo.tema)?.nombre || viejo.tema);
        const eleccion = viejo && await elegir(ctx, `Estás en «${nombre}»`, ["Guardar y cambiar", "Cambiar sin guardar", "Cancelar"]);
        if (viejo && eleccion !== "Guardar y cambiar" && eleccion !== "Cambiar sin guardar") return;
        // Recién ahora, para que cancelar no corte el turno; una pregunta abierta se confirma antes.
        if (!ctx.isIdle() && preguntas && !viejo && await elegir(ctx, "Hay una pregunta abierta", ["Cortarla y cambiar de tema", "Seguir con la pregunta"]) !== "Cortarla y cambiar de tema") return;
        await cortarTurno(pi, ctx, "al cambiar de tema");
        if (viejo && eleccion === "Guardar y cambiar") {
          pi.appendEntry("curso-cierre", { log: viejo.log, adHoc: false });
          ordenar(pi, "Cambiamos de tema. Llamá registrar_progreso con cierre:true, la evidencia observada desde el último guardado (lo omitido se conserva) y un resumen de toda la sesión, no sólo de lo nuevo: qué se aprendió, qué falló y qué sigue; después cerrá con una línea de resumen, sin preguntas.");
          await ctx.waitForIdle();
          if (activo === viejo) { ctx.ui.notify(`No se confirmó el guardado: seguís en «${nombre}»; repetí /estudiar o elegí «Cambiar sin guardar».`, "warning"); return; }
          d = await cargar(curso, true);
        } else if (viejo) noOfrecer(viejo.curso, viejo.log.slice(`cursos/${viejo.curso}/`.length));
        const a: Activo = { curso, tema: tema.id, log: "", ...(tema.id === "ad-hoc" ? { adHoc: tema } : {}) }, previo = activo;
        pendiente = undefined;
        preparar(a, d);
        // La nota es deseable, no imprescindible: sin ella la clase sigue y no queda un .md vacío.
        let sinNota = "";
        const base = `cursos/${curso}/sesiones/${new Date().toLocaleDateString("sv-SE")}-${tema.id}`;
        a.log = `${base}.md`;
        // El nombre de una sesión sin nota (su .md vacío se borró) o de una nota movida sigue ocupado: reusarlo mezclaría su cierre y su historial.
        const usados = new Set([...ctx.sessionManager.getBranch().map(e => e.type === "custom" && (e.data as { log?: unknown } | null)?.log),
          ...(d.progreso.historial || []).map(h => typeof h === "object" && h !== null && "log" in h && `cursos/${curso}/${h.log}`)]);
        try {
          mkdirSync(rutaSegura(vault, `cursos/${curso}/sesiones`), { recursive: true });
          for (let n = 1; ; n++) {
            a.log = `${base}${n === 1 ? "" : `-${n}`}.md`;
            if (usados.has(a.log)) continue;
            try { closeSync(openSync(rutaSegura(vault, a.log), "wx")); break; }
            catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
          }
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("md-log no confirmó la nota")), 2000);
            pi.events.emit("md-log:link", { file: rutaSegura(vault, a.log), backfill: false,
              onComplete(error?: string) { clearTimeout(timer); error ? reject(new Error(error)) : resolve(); } });
          });
        } catch (e) {
          const codigo = (e as NodeJS.ErrnoException).code;
          sinNota = `No se pudo crear la nota de la clase en Obsidian${codigo === "ENOSPC" ? " (disco lleno)" : ["EACCES", "EPERM", "EROFS"].includes(codigo || "") ? " (sin permiso para escribir en sesiones/)" : ""}; seguimos sin nota.`;
          // Que la nota anterior no reciba este tema.
          pi.events.emit("md-log:unlink", {});
          try { const file = rutaSegura(vault, a.log); if (statSync(file).size === 0) rmSync(file); } catch { /* no quedó archivo */ }
        }
        sinLog = !!sinNota;
        herramientas ??= pi.getActiveTools();
        const estado = { ...a, ...(sinLog ? { sinLog } : {}), herramientas };
        pi.appendEntry("curso", estado);
        registrarActivo(ctx, estado);
        activarEstudio();
        if (previo && previo.curso !== curso) olvidarActivo(ctx, previo.curso);
        pi.setSessionName(`${d.nombre || curso} · ${tema.nombre}`);
        // Los avisos del curso van al dossier; la preparación por tema informa al alumno lo que le toca.
        ctx.ui.setStatus("curso", `📚 ${curso} › ${tema.nombre}`);
        if (sinNota) ctx.ui.notify(sinNota, "warning");
        const estudiado = d.progreso.temas[tema.id]?.estado;
        ordenar(pi, `Empecemos con «${tema.nombre}» (${curso}). ${estudiado && estudiado !== "sin_empezar" ? "Abrí con una línea de dónde quedamos (borde y próximo paso del dossier) y enseguida la primera pregunta" : "Iniciá el probe con la primera pregunta, sin preámbulo"}, sin esperar una nueva orden del estudiante.`);
      } catch (e) { ctx.ui.notify(mensaje(e, "No se pudo activar el curso"), "error"); }
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
    return { a: activo, d: datos, r: raiz(activo.curso), pendiente, sinLog };
  }
  return {
    actual: () => activo && datos ? actual() : undefined,
    cargar,
    actualizarProgreso: (progreso: DatosCurso["progreso"]) => { if (datos) datos.progreso = progreso; },
    async cerrar(ctx: ExtensionContext) {
      const { a } = actual();
      if (!sinLog) await new Promise<void>((resolve, reject) => {
        const sinCerrar = "No se pudo cerrar la nota de la clase en Obsidian; la clase sigue abierta:";
        const timer = setTimeout(() => reject(new Error(`${sinCerrar} repetí /fin.`)), 2000);
        // md-log sólo rechaza si la nota vinculada ya no es la de la clase (otra con /md-log): repetir /fin no alcanza.
        pi.events.emit("md-log:unlink", { file: rutaSegura(vault, a.nota ?? a.log), onComplete(error?: string) { clearTimeout(timer); error ? reject(new Error(`${sinCerrar} hay otra nota vinculada, desvinculala con /md-unlog y repetí /fin.`)) : resolve(); } });
      });
      pi.appendEntry("curso", null);
      olvidarActivo(ctx, a.curso);
      if (herramientas) pi.setActiveTools(herramientas);
      activo = undefined; datos = undefined; resumen = ""; pendiente = undefined; sinLog = false; herramientas = undefined;
      ctx.ui.setStatus("curso", undefined);
    },
    refrescar: () => { if (activo && datos) preparar(activo, datos); return resumen; },
    // Los ítems reservados para /simulacro (E3) no se muestran por ninguna vía; leer_items sí el que se está rindiendo.
    leer_paginas({ doc, desde, hasta, despues_del_intento = false }: { doc: string; desde: number; hasta: number; despues_del_intento?: boolean }) { const { d, r } = actual(); return leerPaginas(r, d, doc, desde, hasta, despues_del_intento, reservados(r, d)); },
    buscar_material({ consulta, tipo }: { consulta: string; tipo?: string }) { const { d, r } = actual(); return JSON.stringify(buscarMaterial(r, d, consulta, tipo, reservados(r, d))); },
    leer_items({ doc, ids, incluir_solucion = false }: { doc: string; ids: string[]; incluir_solucion?: boolean }, permitido?: Ref) { const { d, r } = actual(); return leerItems(d, doc, ids, incluir_solucion, reservados(r, d, permitido)); },
    async ver_pagina({ doc, pagina, despues_del_intento = false }: { doc: string; pagina: number; despues_del_intento?: boolean }, signal?: AbortSignal) {
      const { a, d, r } = actual(), fuente = documento(d, doc);
      if (!Number.isInteger(pagina) || pagina < 1 || pagina > fuente.paginas) throw new Error("Página PDF fuera de rango.");
      const ocultos = reservados(r, d);
      if (paginasReservadas(d, doc, ocultos).has(pagina) || copiaEnPagina(r, d, doc, pagina, ocultos)) throw new Error("Esa página trae un ítem reservado para /simulacro; elegí otra.");
      if (!despues_del_intento && (["evaluaciones", "soluciones"].includes(fuente.tipo) || d.items[doc]?.some(i => i.solucion_de !== undefined))) throw new Error("La imagen de esta página trae la solución: leé el enunciado con leer_items y mostrala recién después del intento (despues_del_intento:true).");
      const resultado = await pi.exec(pythonDelVenv(recursos), [join(recursos, "scripts/ingesta/sesion.py"), "renderizar", "--vault", vault, "--curso", a.curso, "--doc", doc, "--pagina", String(pagina)], { timeout: 10000, signal });
      if (resultado.killed || resultado.code !== 0) throw new Error(fallaPython(resultado));
      // render: la imagen queda en el vault y md-log la embebe en la nota (C5).
      const render = rutaSegura(r, `_procesado/${doc}/render/${String(pagina).padStart(4, "0")}.png`);
      return { imagen: readFileSync(render).toString("base64"), cita: cita(d, doc, pagina), render };
    },
  };
}
