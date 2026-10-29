import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir, leerConfig } from "../../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "./ingesta.ts";
import { guardarCurso, registrarCuracion, seccionPython } from "./curacion.ts";
import { registrarSesion } from "./sesion.ts";
import { registrarPresentacion } from "./presentacion.ts";
import { registrarResearcher } from "./researcher.ts";
import { registrarProgreso } from "./progreso.ts";
import { registrarPreparacion } from "./preparacion.ts";
import { registrarIngestaFondo } from "./ingesta-fondo.ts";
import { enCurso, registrarSimulacro } from "./simulacro.ts";

const slug = Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" });
const paginas = Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 });

function salida(curso: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(curso)) throw new Error("Curso inválido: usá su slug, no una ruta.");
  const carpeta = join(vaultDir, "cursos", curso);
  if (!existsSync(carpeta) || lstatSync(carpeta).isSymbolicLink()) throw new Error("El curso no existe o es un enlace simbólico. Preparalo primero; no se creó automáticamente.");
  return join(carpeta, "_procesado");
}

export default function (pi: ExtensionAPI) {
  registrarCuracion(pi);
  registrarIngestaFondo(pi);
  const sesion = registrarSesion(pi);
  // Fuera de una clase, que no tiene bash, el prompt dice cuál es el Python de learn en esta máquina (DA57).
  pi.on("before_agent_start", event => {
    const python = sesion.actual() ? undefined : seccionPython();
    if (python) event.systemPromptOptions.sections.python = python;
    else delete event.systemPromptOptions.sections.python;
  });
  registrarPreparacion(pi, sesion);
  const progreso = registrarProgreso(pi, sesion);
  registrarSimulacro(pi, sesion);
  registrarPresentacion(pi, sesion.actual);
  const textoProgreso = Type.String({ minLength: 1, maxLength: 2000 });
  const listaProgreso = Type.Array(textoProgreso, { maxItems: 100 });
  const fecha = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
  pi.registerTool({
    name: "leer_sesion_anterior", label: "Leer sesión sin cierre",
    description: "Lee el último log del tema sin registro final. Devuelve su principio y su final (práctica y cierre) y el SHA para reconstruir sin inventar respuestas. No modifica notas ni progreso.",
    parameters: Type.Object({}), executionMode: "sequential", execute: progreso.leerAnterior,
  });
  pi.registerTool({
    name: "registrar_progreso", label: "Guardar progreso del curso",
    description: "Fusiona evidencia observada del tema activo, valida y guarda atómicamente con .bak. Mandá sólo lo nuevo desde el último guardado: lo omitido se conserva; sólo resumen es obligatorio y estado/proximo_paso/objetivo/plan van cuando cambian. Para quitar una falla superada, pasala en falla_resuelta con su texto exacto del borde; una falla nueva saca ese concepto de conceptos_firmes. No inventes resultados ni puntajes. cierre:true al terminar; el log se cierra tras el mensaje final. Para reconstruir leé leer_sesion_anterior y usá su log/SHA; requiere confirmación humana. Ad hoc no crea temas persistentes.",
    parameters: Type.Object({
      estado: Type.Optional(Type.Union([Type.Literal("sin_empezar"), Type.Literal("en_curso"), Type.Literal("dominado"), Type.Literal("repasar")])),
      borde: Type.Optional(Type.Object({ domina: Type.Optional(listaProgreso), falla: Type.Optional(listaProgreso) })), conceptos_firmes: Type.Optional(listaProgreso),
      falla_resuelta: Type.Optional(Type.Array(textoProgreso, { maxItems: 100, description: "textos exactos de borde.falla que ya no fallan" })),
      errores_de_concepto: Type.Optional(Type.Array(Type.Object({ descripcion: textoProgreso, detectado: Type.Optional(fecha), resuelto: Type.Optional(Type.Boolean()) }), { maxItems: 100 })),
      ejercicios: Type.Optional(Type.Array(Type.Object({ doc: slug, item: Type.String({ minLength: 1, maxLength: 2000, description: "id tal como lo muestra leer_items; el inciso va en notas" }), fecha: Type.Optional(fecha),
        resultado: Type.Union([Type.Literal("correcto"), Type.Literal("parcial"), Type.Literal("incorrecto")]),
        puntaje: Type.Optional(Type.String({ maxLength: 200 })), notas: Type.Optional(Type.String({ maxLength: 2000 })) }), { maxItems: 100 })),
      discrepancias: Type.Optional(listaProgreso), proximo_paso: Type.Optional(textoProgreso), resumen: textoProgreso, cierre: Type.Optional(Type.Boolean()),
      objetivo: Type.Optional(Type.String({ minLength: 1, maxLength: 300, description: "objetivo acordado con el estudiante; reemplaza al guardado" })),
      plan: Type.Optional(Type.String({ minLength: 1, maxLength: 1500, description: "nodos del plan aprobado en orden, cada uno con su cita corta (doc y PDF p.); reemplaza al guardado" })),
      reconstruir_log: Type.Optional(Type.String()), huella_log: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
    }), executionMode: "sequential",
    execute: (...args) => {
      const e = sesion.actual();
      if (!e) throw new Error("No hay curso activo. Usá /estudiar.");
      return withFileMutationQueue(e.r, () => progreso.registrar(...args));
    },
  });
  const investigar = registrarResearcher(pi, sesion.actual, sesion.refrescar, vaultDir, piDir);
  pi.registerTool({
    name: "investigar_tema", label: "Verificar material del curso",
    description: "Researcher asíncrono anclado al curso activo. alcance: mapa/primeros principios con caché, afirmaciones opcionales; verificar: 1–3 afirmaciones sin reemplazar el mapa. Adjunta páginas preparadas y citas; seguí con el probe sin esperar al hijo. Si falla, continuá con el material sin atribuir verificación externa.",
    parameters: Type.Object({ modo: Type.Union([Type.Literal("alcance"), Type.Literal("verificar")]), afirmaciones: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 1500 }), { maxItems: 3 })) }),
    executionMode: "sequential", execute: investigar,
  });
  pi.registerTool({
    name: "leer_paginas", label: "Leer páginas", description: "Leer transcripciones del curso activo por páginas PDF (base 1). Devuelve citas y texto acotado; si falta o es dudoso, consultá ver_pagina. En evaluaciones omite las soluciones y los enlaces, y rechaza documentos de soluciones; despues_del_intento:true sólo cuando el estudiante ya entregó su intento. En una grabación de clase cada página es un tramo de 5 minutos, y cada párrafo trae el enlace a su minuto (#t=).",
    parameters: Type.Object({ doc: slug, desde: Type.Integer({ minimum: 1 }), hasta: Type.Integer({ minimum: 1 }), despues_del_intento: Type.Optional(Type.Boolean()) }), executionMode: "sequential",
    async execute(_id, args) { return { content: [{ type: "text", text: sesion.leer_paginas(args) }], details: sesion.grabacion(args.doc, args.desde) }; },
  });
  pi.registerTool({
    name: "buscar_material", label: "Buscar material", description: "Buscar material del curso activo mediante BM25 sin tildes. Devuelve ubicaciones y fragmentos, sin OCR. De evaluaciones y soluciones devuelve sólo la ubicación: leé esos enunciados con leer_items.",
    parameters: Type.Object({ consulta: Type.String({ minLength: 1, maxLength: 500 }), tipo: Type.Optional(Type.Union([Type.Literal("bibliografia"), Type.Literal("ejercicios"), Type.Literal("evaluaciones"), Type.Literal("soluciones"), Type.Literal("programa"), Type.Literal("otros")])) }), executionMode: "sequential",
    async execute(_id, args) { return { content: [{ type: "text", text: sesion.buscar_material(args) }], details: undefined }; },
  });
  pi.registerTool({
    name: "leer_items", label: "Leer ítems", description: "Leer ítems del curso activo. Por defecto sólo enunciados (con su puntaje oficial si consta), y en evaluaciones cita «PDF p. N» sin enlace porque la página trae la solución; incluir_solucion se usa después del intento del estudiante y sólo devuelve soluciones explícitamente vinculadas (de un documento de soluciones o del mismo parcial), con sus enlaces. Un ítem reservado para /simulacro sólo se lee durante el simulacro.",
    parameters: Type.Object({ doc: slug, ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 100 }), incluir_solucion: Type.Optional(Type.Boolean()) }), executionMode: "sequential",
    async execute(_id, args, _signal, _update, ctx) { return { content: [{ type: "text", text: sesion.leer_items(args, enCurso(ctx, sesion.actual())) }], details: undefined }; },
  });
  pi.registerTool({
    name: "ver_pagina", label: "Ver página original", description: "Mostrar la imagen original de una página PDF del curso activo, con render local y caché. No ejecuta OCR ni llama al modelo de visión. En evaluaciones y soluciones la imagen trae la solución: exige despues_del_intento:true, sólo cuando el estudiante ya entregó su intento. Una grabación no tiene páginas para ver.",
    parameters: Type.Object({ doc: slug, pagina: Type.Integer({ minimum: 1 }), despues_del_intento: Type.Optional(Type.Boolean()) }), executionMode: "sequential",
    async execute(_id, args, signal) {
      const r = await sesion.ver_pagina(args, signal);
      return { content: [{ type: "text", text: r.cita }, { type: "image", data: r.imagen, mimeType: "image/png" }], details: { render: r.render } };
    },
  });
  pi.registerTool({
    name: "guardar_curso", label: "Revisar y guardar curso",
    description: "Preparación: valida una propuesta JSON en _procesado/ y copia PDFs y grabaciones nuevos desde _entrada/. Para un curso existente muestra el diff y exige confirmación humana real, sin autoaprobación desde argumentos. Rechaza ediciones concurrentes y conserva fuentes y progreso existentes.",
    parameters: Type.Object({ curso: slug, propuesta: Type.String({ minLength: 1 }) }),
    executionMode: "sequential",
    execute: (_id, args, signal, onUpdate, ctx) => guardarCurso(pi, args, ctx, signal,
      texto => onUpdate?.({ content: [{ type: "text", text: texto }], details: undefined })),
  });
  pi.registerTool({
    name: "transcribir_paginas", label: "Transcribir páginas con visión",
    description: "Solo preparación: transcribe páginas ya ingeridas con el modelo de visión configurado, fuera del contexto principal. Siempre para ejercicios/evaluaciones/soluciones y para páginas dudosas. Guarda Markdown y devuelve solo un resumen. Superar el límite configurado requiere confirmación; no inventa texto ni reintenta automáticamente.",
    parameters: Type.Object({ curso: slug, doc: slug, paginas }),
    executionMode: "sequential",
    async execute(_id, args, signal, onUpdate, ctx) {
      const raiz = salida(args.curso);
      return withFileMutationQueue(raiz, async () => {
        const config = leerConfig(piDir);
        const { resumen, usage } = await transcribir(ctx, { vault: vaultDir, salida: raiz, doc: args.doc, paginas: args.paginas }, config, signal,
          texto => onUpdate?.({ content: [{ type: "text", text: texto }], details: undefined }));
        return { content: [{ type: "text", text: `${resumen.cancelada ? "Tanda cancelada. " : ""}Transcritas: ${resumen.transcritas}; caché: ${resumen.cache}; fallidas: ${resumen.fallidas.join(", ") || "ninguna"}; pendientes de calidad: ${resumen.pendientes.join(", ") || "ninguna nueva"}. La fidelidad requiere revisión humana. ${resumen.avisos.join(" ")}` }],
          details: resumen, usage, isError: resumen.fallidas.length > 0 };
      });
    },
  });
  pi.registerTool({
    name: "guardar_items", label: "Guardar ítems del documento",
    description: "Solo preparación: guarda en items.yaml la segmentación hecha por el agente tras leer las transcripciones con visión. Conservá los ids originales («Pregunta 3» → '3') y no inventes enunciados ni soluciones. Una solución integrada en el mismo documento es otro ítem con solucion_de: '<id del enunciado>'; puntos es el puntaje oficial si consta («(8 puntos)» → 8). Valida páginas y referencias, y preserva ediciones manuales. Devuelve ids y cantidades, no soluciones.",
    parameters: Type.Object({ curso: slug, doc: slug,
      items: Type.Array(Type.Object({ id: Type.String({ minLength: 1, maxLength: 80 }), paginas,
        enunciado: Type.String({ minLength: 1, maxLength: 50000 }),
        solucion: Type.Optional(Type.Object({ doc: slug, id: Type.String({ minLength: 1, maxLength: 80 }) })),
        solucion_de: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
        puntos: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.String({ minLength: 1, maxLength: 40 })])),
      }), { minItems: 1, maxItems: 1000 }),
    }), executionMode: "sequential",
    async execute(_id, args, signal) {
      const raiz = salida(args.curso);
      return withFileMutationQueue(raiz, async () => {
        const resultado = await python("items", { vault: vaultDir, salida: raiz, doc: args.doc, items: args.items }, signal);
        return { content: [{ type: "text", text: `Guardados ${resultado.items} ítems de ${args.doc}: ${resultado.ids.join(", ")}. Pendientes de revisión humana.` }], details: resultado };
      });
    },
  });
}
