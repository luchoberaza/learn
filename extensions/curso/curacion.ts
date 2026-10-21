import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir } from "../../scripts/lib/pi-sdk.mjs";

const patron = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function ejecutar(pi: ExtensionAPI, accion: string, curso: string, extras: string[] = [], signal?: AbortSignal) {
  if (!patron.test(curso)) throw new Error("Curso inválido: indicá un slug sin tildes.");
  const r = await pi.exec(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/cursos.py"), accion,
    "--vault", vaultDir, "--curso", curso, ...extras], { cwd: vaultDir, timeout: 30000, signal });
  if (r.code !== 0 && !r.stdout.trim().startsWith("{")) throw new Error(r.stderr.trim() || "No se completó la operación.");
  return JSON.parse(r.stdout);
}

export function registrarCuracion(pi: ExtensionAPI) {
  const completar = (prefijo: string) => readdirSync(join(vaultDir, "cursos"), { withFileTypes: true })
    .filter(e => e.isDirectory() && patron.test(e.name) && e.name.startsWith(prefijo))
    .map(e => ({ value: e.name, label: e.name }));
  for (const nombre of ["curso-nuevo", "curso-agregar"]) {
    pi.registerCommand(nombre, {
      description: nombre === "curso-nuevo" ? "Preparar un curso desde PDFs seleccionados de _entrada/" : "Ampliar un curso con diff y confirmación antes de reemplazar el índice",
      getArgumentCompletions: nombre === "curso-agregar" ? completar : undefined,
      async handler(args, ctx) {
        if (!patron.test(args.trim().split(/\s+/)[0] || "")) {
          ctx.ui.notify(`Uso: /${nombre} <curso>${nombre === "curso-agregar" ? " [archivos…]" : ""}`, "warning");
          return;
        }
        pi.sendUserMessage(`/skill:${nombre} ${args.trim()}`, { expandPromptTemplates: true, deliverAs: "followUp" });
      },
    });
  }
  pi.registerCommand("curso-check", {
    description: "Validar estructura, referencias, progreso y páginas pendientes de un curso",
    getArgumentCompletions: completar,
    async handler(args, ctx) {
      try {
        const r = await ejecutar(pi, "validar", args.trim());
        pi.sendMessage({ customType: "curso-check", display: true, content: `${args.trim()}: ${r.ok ? "estructura válida" : "con errores"}; ${r.pendientes.length} páginas referidas pendientes.\n${[...r.errores, ...r.avisos].join("\n")}\nInforme: cursos/${args.trim()}/informe-ingesta.md`, details: r });
      } catch (e) { ctx.ui.notify(e instanceof Error ? e.message : "No se pudo validar el curso.", "error"); }
    },
  });
  pi.registerCommand("curso-estado", {
    description: "Consultar el proceso de ingesta y actualizar su indicador de estado",
    getArgumentCompletions: completar,
    async handler(args, ctx) {
      const curso = args.trim();
      if (!patron.test(curso)) { ctx.ui.notify("Uso: /curso-estado <curso>", "warning"); return; }
      try {
        const r = await pi.exec(join(piDir, ".venv/bin/python"), [join(piDir, "scripts/ingesta/ingestar.py"), "estado",
          "--vault", vaultDir, "--salida", join(vaultDir, "cursos", curso, "_procesado")], { cwd: vaultDir, timeout: 10000 });
        if (r.code !== 0) throw new Error(r.stdout.trim() || r.stderr.trim());
        const estado = JSON.parse(r.stdout);
        const resumen = `${curso}: ${estado.estado} · ${estado.procesadas}/${estado.solicitadas} · pendientes: ${estado.pendientes}`;
        ctx.ui.setStatus("curso-ingesta", resumen);
        ctx.ui.notify(resumen, "info");
      } catch (e) { ctx.ui.notify(e instanceof Error ? e.message : "No hay ingesta registrada.", "warning"); }
    },
  });
}

export async function guardarCurso(pi: ExtensionAPI, args: { curso: string; propuesta: string }, ctx: ExtensionContext,
  signal?: AbortSignal, informar?: (texto: string) => void): Promise<{ content: { type: "text"; text: string }[]; details: unknown }> {
  const extras = ["--propuesta", args.propuesta];
  const r = await ejecutar(pi, "revisar", args.curso, extras, signal);
  if (!r.diff && !r.copias.length) return { content: [{ type: "text", text: "Sin cambios; no se escribió ningún archivo." }], details: r.validacion };
  if (!r.nuevo) {
    if (!ctx.hasUI) throw new Error("Actualizar un curso existente requiere confirmación interactiva; no se guardó nada.");
    informar?.(r.diff);
    pi.sendMessage({ customType: "curso-diff", display: true, content: r.diff, details: undefined });
    const acepta = await ctx.ui.confirm("Guardar cambios del curso", `${r.copias.length} PDFs nuevos. Revisá el diff mostrado antes de confirmar. No se modifica progreso.yaml ni se reemplazan PDFs existentes.`, { signal });
    if (!acepta) return { content: [{ type: "text", text: "Cambios rechazados; el curso se preservó." }], details: { cancelada: true } };
  }
  const guardado = await ejecutar(pi, "aplicar", args.curso, [...extras, "--base", r.base, "--huella", r.huella], signal);
  return { content: [{ type: "text", text: `Curso ${args.curso} guardado; ${guardado.copiados} PDFs copiados sin modificar los originales. Continuá con la ingesta y la revisión del informe.` }], details: guardado };
}
