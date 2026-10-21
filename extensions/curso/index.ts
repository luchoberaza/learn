import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir } from "../../scripts/lib/pi-sdk.mjs";
import { python, transcribir } from "./ingesta.ts";

const slug = Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" });
const paginas = Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 });

function salida(curso: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(curso)) throw new Error("Curso inválido: usá su slug, no una ruta.");
  const carpeta = join(vaultDir, "cursos", curso);
  if (!existsSync(carpeta) || lstatSync(carpeta).isSymbolicLink()) throw new Error("El curso no existe o es un enlace simbólico. Preparalo primero; no se creó automáticamente.");
  return join(carpeta, "_procesado");
}

export default function (pi: ExtensionAPI) {
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
