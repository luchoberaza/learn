import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir } from "../../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "./ingesta.ts";
import { guardarCurso, registrarCuracion } from "./curacion.ts";
import { registrarSesion } from "./sesion.ts";

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
  const sesion = registrarSesion(pi);
  pi.registerTool({
    name: "leer_paginas", label: "Leer páginas", description: "Leer transcripciones del curso activo por páginas PDF (base 1). Devuelve citas y texto acotado; si falta o es dudoso, consultá ver_pagina.",
    parameters: Type.Object({ doc: slug, desde: Type.Integer({ minimum: 1 }), hasta: Type.Integer({ minimum: 1 }) }), executionMode: "sequential",
    async execute(_id, args) { return { content: [{ type: "text", text: sesion.leer_paginas(args) }], details: undefined }; },
  });
  pi.registerTool({
    name: "buscar_material", label: "Buscar material", description: "Buscar material del curso activo mediante BM25 sin tildes. Devuelve ubicaciones y fragmentos, sin OCR.",
    parameters: Type.Object({ consulta: Type.String({ minLength: 1, maxLength: 500 }), tipo: Type.Optional(Type.Union([Type.Literal("bibliografia"), Type.Literal("ejercicios"), Type.Literal("evaluaciones"), Type.Literal("soluciones"), Type.Literal("programa"), Type.Literal("otros")])) }), executionMode: "sequential",
    async execute(_id, args) { return { content: [{ type: "text", text: sesion.buscar_material(args) }], details: undefined }; },
  });
  pi.registerTool({
    name: "leer_items", label: "Leer ítems", description: "Leer ítems del curso activo. Por defecto sólo enunciados; incluir_solucion se usa después del intento del estudiante y sólo devuelve soluciones explícitamente vinculadas.",
    parameters: Type.Object({ doc: slug, ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 100 }), incluir_solucion: Type.Optional(Type.Boolean()) }), executionMode: "sequential",
    async execute(_id, args) { return { content: [{ type: "text", text: sesion.leer_items(args) }], details: undefined }; },
  });
  pi.registerTool({
    name: "ver_pagina", label: "Ver página original", description: "Mostrar la imagen original de una página PDF del curso activo, con render local y caché. No ejecuta OCR ni llama al modelo de visión.",
    parameters: Type.Object({ doc: slug, pagina: Type.Integer({ minimum: 1 }) }), executionMode: "sequential",
    async execute(_id, args, signal) {
      const r = await sesion.ver_pagina(args, signal);
      return { content: [{ type: "text", text: r.cita }, { type: "image", data: r.imagen, mimeType: "image/png" }], details: undefined };
    },
  });
  pi.registerTool({
    name: "guardar_curso", label: "Revisar y guardar curso",
    description: "Preparación: valida una propuesta JSON en _procesado/ y copia PDFs nuevos desde _entrada/. Para un curso existente muestra el diff y exige confirmación humana real, sin autoaprobación desde argumentos. Rechaza ediciones concurrentes y conserva fuentes y progreso existentes.",
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
        const config = JSON.parse(readFileSync(join(piDir, "curso.config.json"), "utf8"));
        const { resumen, usage } = await transcribir(ctx, { vault: vaultDir, salida: raiz, doc: args.doc, paginas: args.paginas }, config, signal,
          texto => onUpdate?.({ content: [{ type: "text", text: texto }], details: undefined }));
        return { content: [{ type: "text", text: `${resumen.cancelada ? "Tanda cancelada. " : ""}Transcritas: ${resumen.transcritas}; caché: ${resumen.cache}; fallidas: ${resumen.fallidas.join(", ") || "ninguna"}; pendientes de calidad: ${resumen.pendientes.join(", ") || "ninguna nueva"}. La fidelidad requiere revisión humana. ${resumen.avisos.join(" ")}` }],
          details: resumen, usage, isError: resumen.fallidas.length > 0 };
      });
    },
  });
  pi.registerTool({
    name: "guardar_items", label: "Guardar ítems del documento",
    description: "Solo preparación: guarda en items.yaml la segmentación hecha por el agente tras leer las transcripciones con visión. Conservá los ids originales y no inventes enunciados ni soluciones. Valida páginas y referencias, y preserva ediciones manuales. Devuelve ids y cantidades, no soluciones.",
    parameters: Type.Object({ curso: slug, doc: slug,
      items: Type.Array(Type.Object({ id: Type.String({ minLength: 1, maxLength: 80 }), paginas,
        enunciado: Type.String({ minLength: 1, maxLength: 50000 }),
        solucion: Type.Optional(Type.Object({ doc: slug, id: Type.String({ minLength: 1, maxLength: 80 }) })),
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
