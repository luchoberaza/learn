// Qué ve la interfaz. Regla de oro (DA18 y «nunca la solución antes del intento»): nada sale del host salvo lo que se
// arma acá, campo por campo. Nunca: args ni resultados de las tools del curso, la respuesta correcta o la explicación de
// un quiz antes de que el alumno responda, la respuesta esperada de una pregunta de desarrollo antes de que la
// conteste, mensajes ocultos (display:false) ni bloques de razonamiento.

const QA = new Set(["quiz", "ask_user_question", "pregunta_desarrollo"]);
// Sus argumentos traen la respuesta (correctAnswer, respuesta_esperada): nunca se guardan para la interfaz.
const CON_RESPUESTA = new Set(["quiz", "pregunta_desarrollo"]);
// Tools cuya llamada y salida se pueden mostrar plegadas, como en pi (fuera del curso, al armar un curso, subagentes).
const LIMITE_SALIDA = 4000;

const textoDe = contenido => typeof contenido === "string" ? contenido
  : Array.isArray(contenido) ? contenido.filter(b => b?.type === "text").map(b => b.text ?? "").join("\n") : "";
const imagenesDe = contenido => Array.isArray(contenido)
  ? contenido.filter(b => b?.type === "image" && typeof b.data === "string" && /^image\/(png|jpeg|webp|gif)$/.test(b.mimeType)).map(b => ({ mimeType: b.mimeType, data: b.data }))
  : [];
const recortar = (t, max = LIMITE_SALIDA) => t.length > max ? `${t.slice(0, max)}\n… (${t.length - max} caracteres más)` : t;
// /skill:teach y las skills de cursos llegan como un mensaje del alumno con el SKILL.md entero adentro: como md-log,
// se muestra sólo qué skill se cargó y lo que escribió el alumno.
function mensajeAlumno(id, contenido) {
  const skills = [];
  const texto = textoDe(contenido).replace(/<skill\b([^>]*)>[\s\S]*?<\/skill>/g, (_m, attrs) => { skills.push(/name="([^"]+)"/.exec(attrs)?.[1] ?? "skill"); return ""; }).trim();
  const imagenes = imagenesDe(contenido);
  if (!texto && !imagenes.length && !skills.length) return undefined;
  return { tipo: "alumno", id, texto, imagenes, ...(skills.length ? { skills } : {}) };
}

// Resumen legible de la llamada a una tool general, sin volcar el objeto entero.
function entradaDe(nombre, args = {}) {
  if (typeof args.command === "string") return args.command;
  if (typeof args.path === "string") return args.path;
  if (typeof args.query === "string") return args.query;
  if (typeof args.url === "string") return args.url;
  if (typeof args.task === "string") return `${args.agent ? `${args.agent}: ` : ""}${args.task}`;
  try { return recortar(JSON.stringify(args), 600); } catch { return ""; }
}
const NOMBRES = { bash: "Comando", powershell: "PowerShell", read: "Lectura de archivo", write: "Archivo escrito", edit: "Archivo editado", grep: "Búsqueda en archivos",
  find: "Búsqueda de archivos", ls: "Listado de carpeta", web_search: "Búsqueda web", web_fetch: "Lectura web", subagent: "Subagente", subagent_message: "Mensaje a subagente",
  subagents_list: "Subagentes disponibles", safe_bash: "Comando" };

export function crearFiltro({ etiquetas }) {
  const herramientaCurso = nombre => etiquetas.TOOLS_DEL_CURSO.has(nombre);

  function itemHerramienta(id, nombre, args, resultado, estado) {
    if (herramientaCurso(nombre)) {
      const linea = estado === "corriendo" ? etiquetas.etiquetaLlamada(nombre, args)
        : etiquetas.etiquetaResultado(nombre, args, resultado ?? {}, estado === "error");
      const parcial = estado === "corriendo" && resultado ? etiquetas.textoParcial(nombre, resultado) : undefined;
      return { tipo: "herramienta", id, nombre, curso: true, linea: linea ?? "", estado, ...(parcial ? { parcial } : {}) };
    }
    const salida = resultado ? recortar(textoDe(resultado.content)) : "";
    return { tipo: "herramienta", id, nombre, curso: false, linea: NOMBRES[nombre] ?? nombre, estado, detalle: { entrada: entradaDe(nombre, args), salida } };
  }

  // Un quiz terminado: lo que vio el alumno, ya corregido. Cancelado o descartado no muestra opciones ni la correcta.
  function resultadoQuiz(d) {
    if (!d || typeof d !== "object") return { estado: "cancelado" };
    if (d.status === "unavailable") return { estado: "descartado", mensaje: d.message ?? "" };
    if (d.status !== "answered") return { estado: "cancelado", ...(d.motivo ? { motivo: d.motivo } : {}) };
    return { estado: "respondido", opciones: (d.options ?? []).map(o => ({ indice: o.index, label: o.label })),
      resultado: { elegidas: (d.answers ?? []).map(a => a.index), correctas: d.correctIndices ?? [], correcto: d.correct === true, noSe: d.dontKnow === true,
        ...(d.note ? { nota: d.note } : {}), ...(d.explanation ? { explicacion: d.explanation } : {}) } };
  }
  // Una pregunta de desarrollo terminada (DA52): lo que escribió y la respuesta esperada, que ya vio al responder.
  function resultadoDesarrollo(d) {
    if (!d || typeof d !== "object" || d.status !== "answered") return { estado: d?.status === "unavailable" ? "descartado" : "cancelado", ...(d?.message ? { mensaje: d.message } : {}), ...(d?.motivo ? { motivo: d.motivo } : {}) };
    return { estado: "respondido", resultado: { noSe: d.dontKnow === true, ...(typeof d.answer === "string" ? { texto: d.answer } : {}), ...(typeof d.expected === "string" ? { esperada: d.expected } : {}) } };
  }
  // La explicación de la pregunta (clase, DA52) la vio el alumno antes de responder: va con la pregunta.
  const conClase = d => typeof d?.clase === "string" && d.clase ? { explicacionPrevia: d.clase } : {};
  const itemDesarrollo = (id, d = {}) => ({ tipo: "desarrollo", id, pregunta: d.question ?? "", contexto: d.context, ...conClase(d), ...resultadoDesarrollo(d) });
  function resultadoPregunta(d) {
    if (!d || typeof d !== "object" || d.status !== "answered") return { estado: d?.status === "unavailable" ? "descartado" : "cancelado", ...(d?.motivo ? { motivo: d.motivo } : {}) };
    return { estado: "respondido", respuestas: (d.answers ?? []).map(a => a.type === "option" ? { tipo: "option", indice: a.index, label: a.label } : { tipo: a.type, texto: a.label }) };
  }

  // La transcripción de una rama guardada (al abrir o retomar una sesión), con las mismas reglas que en vivo.
  function transcripcion(entradas) {
    const items = [], llamadas = new Map();
    for (const e of entradas) {
      if (e?.type === "compaction") { items.push({ tipo: "separador", id: e.id, texto: "La clase se resumió para seguir con menos contexto." }); continue; }
      if (e?.type === "branch_summary") { items.push({ tipo: "separador", id: e.id, texto: "Se volvió a un punto anterior de la clase." }); continue; }
      if (e?.type === "custom_message") { if (e.display) items.push({ tipo: "sistema", id: e.id, clase: e.customType === "curso-diff" ? "diff" : "info", texto: textoDe(e.content) }); continue; }
      if (e?.type !== "message" || !e.message) continue;
      const m = e.message;
      if (m.role === "user") {
        const item = mensajeAlumno(e.id, m.content);
        if (item) items.push(item);
      } else if (m.role === "assistant") {
        const texto = (m.content ?? []).filter(b => b?.type === "text").map(b => b.text).join("\n\n").trim();
        if (texto) items.push({ tipo: "tutor", id: e.id, texto, enCurso: false });
        for (const b of m.content ?? []) if (b?.type === "toolCall") llamadas.set(b.id, { nombre: b.name, args: CON_RESPUESTA.has(b.name) ? undefined : b.arguments });
        if (m.stopReason === "error" && m.errorMessage) items.push({ tipo: "error", id: `${e.id}-error`, texto: m.errorMessage });
      } else if (m.role === "toolResult") {
        const llamada = llamadas.get(m.toolCallId) ?? { nombre: m.toolName };
        // Una pregunta que la guardia no mostró (faltaba la explicación, DA52) no existe para el alumno.
        if (CON_RESPUESTA.has(m.toolName) && m.details?.interno) continue;
        if (m.toolName === "quiz") {
          const d = m.details ?? {};
          if (d.status === "unavailable" && !d.options) { items.push({ tipo: "aviso-linea", id: m.toolCallId, texto: d.message ?? "" }); continue; }
          items.push({ tipo: "quiz", id: m.toolCallId, pregunta: d.question ?? "", contexto: d.context, ...conClase(d), modo: d.mode ?? "single-select", ...resultadoQuiz(d) });
        } else if (m.toolName === "pregunta_desarrollo") {
          const d = m.details ?? {};
          if (d.status === "unavailable" && !d.question) { items.push({ tipo: "aviso-linea", id: m.toolCallId, texto: d.message ?? "" }); continue; }
          items.push(itemDesarrollo(m.toolCallId, d));
        } else if (m.toolName === "ask_user_question") {
          const d = m.details ?? {}, args = llamada.args ?? {};
          items.push({ tipo: "pregunta", id: m.toolCallId, pregunta: d.question ?? args.question ?? "", contexto: d.context, modo: d.mode ?? "single-select",
            opciones: (Array.isArray(args.options) ? args.options : []).map((o, i) => ({ indice: i + 1, label: String(o?.label ?? "") })), ...resultadoPregunta(d) });
        } else {
          items.push(itemHerramienta(m.toolCallId, m.toolName, llamada.args, m, m.isError ? "error" : "hecha"));
          if (m.toolName === "ver_pagina" && !m.isError && typeof m.details?.render === "string") items.push(itemPagina(m.toolCallId, m));
        }
      } else if (m.role === "custom") {
        if (m.display) items.push({ tipo: "sistema", id: e.id, clase: m.customType === "curso-diff" ? "diff" : "info", texto: textoDe(m.content) });
      }
    }
    return items;
  }
  function itemPagina(id, resultado) {
    return { tipo: "pagina", id: `${id}-pagina`, render: resultado.details.render, cita: textoDe(resultado.content).trim() };
  }

  // Eventos en vivo → mensajes para la interfaz. Devuelve una lista (puede estar vacía).
  // Cada mensaje del tutor lleva un id propio: responseId no lo dan todos los proveedores y dos mensajes pueden
  // compartir el mismo milisegundo.
  let numeroTutor = 0, idTutor;
  // tool_execution_end no repite los argumentos: se guardan del inicio para la línea final.
  const argumentos = new Map();
  const argsDe = ev => { if (ev.args !== undefined) return ev.args; return argumentos.get(ev.toolCallId); };
  function evento(ev) {
    switch (ev?.type) {
      case "agent_start": return [{ tipo: "trabajando", activo: true }];
      case "agent_settled": return [{ tipo: "trabajando", activo: false, abortado: !!ev.aborted }];
      case "message_start":
      case "message_update":
      case "message_end": {
        const m = ev.message;
        if (!m) return [];
        if (m.role === "assistant") {
          if (ev.type === "message_start" || !idTutor) idTutor = `tutor-${++numeroTutor}`;
          const id = idTutor;
          const texto = (m.content ?? []).filter(b => b?.type === "text").map(b => b.text ?? "").join("\n\n");
          const pensando = (m.content ?? []).some(b => b?.type === "thinking") && !texto;
          const fin = ev.type === "message_end";
          const salida = [];
          if (texto.trim() || fin) salida.push({ tipo: "tutor-texto", id, texto, enCurso: !fin });
          if (pensando && !fin) salida.push({ tipo: "pensando" });
          if (fin && m.stopReason === "error" && m.errorMessage) salida.push({ tipo: "item", item: { tipo: "error", id: `${id}-error`, texto: m.errorMessage } });
          if (fin) idTutor = undefined;
          return salida;
        }
        if (ev.type !== "message_end") return [];
        if (m.role === "user") {
          const item = mensajeAlumno(String(m.timestamp ?? Date.now()), m.content);
          return item ? [{ tipo: "item", item }] : [];
        }
        if (m.role === "custom" && m.display) return [{ tipo: "item", item: { tipo: "sistema", id: String(m.timestamp ?? Date.now()), clase: m.customType === "curso-diff" ? "diff" : "info", texto: textoDe(m.content) } }];
        return [];
      }
      case "tool_execution_start":
        if (QA.has(ev.toolName)) return [{ tipo: "qa-inicio", id: ev.toolCallId, nombre: ev.toolName }];
        argumentos.set(ev.toolCallId, ev.args);
        return [{ tipo: "item", item: itemHerramienta(ev.toolCallId, ev.toolName, ev.args, undefined, "corriendo") }];
      case "tool_execution_update":
        if (QA.has(ev.toolName)) return [];
        if (herramientaCurso(ev.toolName)) {
          const parcial = etiquetas.textoParcial(ev.toolName, ev.partialResult ?? {});
          return parcial ? [{ tipo: "item", item: itemHerramienta(ev.toolCallId, ev.toolName, argsDe(ev), ev.partialResult, "corriendo") }] : [];
        }
        return [];
      case "tool_execution_end": {
        const args = argsDe(ev);
        argumentos.delete(ev.toolCallId);
        if (CON_RESPUESTA.has(ev.toolName) && ev.result?.details?.interno) return [{ tipo: "qa-fin", id: ev.toolCallId }];
        if (ev.toolName === "quiz") {
          const d = ev.result?.details ?? {};
          if (d.status === "unavailable" && !d.options) return [{ tipo: "item", item: { tipo: "aviso-linea", id: ev.toolCallId, texto: d.message ?? "" } }, { tipo: "qa-fin", id: ev.toolCallId }];
          return [{ tipo: "item", item: { tipo: "quiz", id: ev.toolCallId, pregunta: d.question ?? "", contexto: d.context, ...conClase(d), modo: d.mode ?? "single-select", ...resultadoQuiz(d) } }, { tipo: "qa-fin", id: ev.toolCallId }];
        }
        if (ev.toolName === "pregunta_desarrollo") {
          const d = ev.result?.details ?? {};
          if (d.status === "unavailable" && !d.question) return [{ tipo: "item", item: { tipo: "aviso-linea", id: ev.toolCallId, texto: d.message ?? "" } }, { tipo: "qa-fin", id: ev.toolCallId }];
          return [{ tipo: "item", item: itemDesarrollo(ev.toolCallId, d) }, { tipo: "qa-fin", id: ev.toolCallId }];
        }
        if (ev.toolName === "ask_user_question") {
          const d = ev.result?.details ?? {};
          return [{ tipo: "item-cambio", id: ev.toolCallId, cambios: resultadoPregunta(d) }, { tipo: "qa-fin", id: ev.toolCallId }];
        }
        const salida = [{ tipo: "item", item: itemHerramienta(ev.toolCallId, ev.toolName, args, ev.result, ev.isError ? "error" : "hecha") }];
        if (ev.toolName === "ver_pagina" && !ev.isError && typeof ev.result?.details?.render === "string") salida.push({ tipo: "item", item: itemPagina(ev.toolCallId, ev.result) });
        return salida;
      }
      case "compaction_start": return [{ tipo: "estado", clave: "compactando", texto: "Resumiendo la clase…" }];
      case "compaction_end": return [{ tipo: "estado", clave: "compactando", texto: undefined },
        ...(ev.result ? [{ tipo: "item", item: { tipo: "separador", id: `compactacion-${Date.now()}`, texto: "La clase se resumió para seguir con menos contexto." } }] : [])];
      case "auto_retry_start": return [{ tipo: "estado", clave: "reintento", texto: `El proveedor falló; reintento ${ev.attempt} de ${ev.maxAttempts}…` }];
      case "auto_retry_end": return [{ tipo: "estado", clave: "reintento", texto: undefined }];
      case "queue_update": return [{ tipo: "cola", pendientes: (ev.steering?.length ?? 0) + (ev.followUp?.length ?? 0) }];
      case "session_info_changed": return [{ tipo: "nombre-sesion", nombre: ev.name }];
      default: return [];
    }
  }

  return { evento, transcripcion, resultadoQuiz };
}
