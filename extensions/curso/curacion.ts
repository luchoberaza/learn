import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { piDir, vaultDir, pythonDelVenv, PYTHON_TEXTO, WINDOWS } from "../../scripts/lib/pi-sdk.mjs";
import { python } from "./ingesta.ts";
import { elegir } from "../comun/elegir.ts";
import { fallaPython } from "./sesion.ts";

const patron = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// DA57: CURSOS.md y los demás textos fijos escriben el Python del venv como en Linux (.pi/.venv/bin/python). En Windows
// uv lo deja en Scripts\, y un modelo que copiaba el comando fallaba y salía a buscar otro Python en la máquina.
export const seccionPython = () => WINDOWS
  ? `Esta computadora es Windows: el Python de learn es ${PYTHON_TEXTO}. Donde CURSOS.md u otro texto diga .pi/.venv/bin/python, usá esa ruta; no busques otro Python.`
  : undefined;

async function ejecutar(pi: ExtensionAPI, accion: string, curso: string, extras: string[] = [], signal?: AbortSignal) {
  if (!patron.test(curso)) throw new Error("Curso inválido: indicá un slug sin tildes.");
  const r = await pi.exec(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta/cursos.py"), accion,
    "--vault", vaultDir, "--curso", curso, ...extras], { cwd: vaultDir, timeout: 30000, signal });
  if (!r.killed && (r.code === 0 || r.stdout.trim().startsWith("{"))) try { return JSON.parse(r.stdout); } catch { /* Salida cortada: como un fallo del entorno. */ }
  throw new Error(fallaPython(r));
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
        const c = args.trim(), r = await ejecutar(pi, "validar", c);
        // Estado de la preparación automática por tema: es informativo, sin él la validación igual vale.
        const preparacion: string[] = await python("estado", { vault: vaultDir, curso: c }, undefined, "preparacion.py").catch(() => []);
        const preparar = r.sin_transcripcion?.length ? `\n${r.sin_transcripcion.length} sin transcripción; preparalas sin modelo desde la raíz del vault:\n${PYTHON_TEXTO} .pi/scripts/ingesta/cursos.py manifiesto --curso ${c} --pendientes\n${PYTHON_TEXTO} .pi/scripts/ingesta/ingestar.py iniciar --manifiesto _procesado/manifiesto-${c}.json --salida cursos/${c}/_procesado` : "";
        pi.sendMessage({ customType: "curso-check", display: true, content: `${c}: ${r.ok ? "estructura válida" : "con errores"}; ${r.pendientes.length === 1 ? "1 página referida pendiente" : `${r.pendientes.length} páginas referidas pendientes`}.${preparar}\n${[...r.errores, ...r.avisos, ...preparacion].join("\n")}\nInforme: cursos/${c}/informe-ingesta.md`, details: r });
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
        const r = await pi.exec(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta/ingestar.py"), "estado",
          "--vault", vaultDir, "--salida", join(vaultDir, "cursos", curso, "_procesado")], { cwd: vaultDir, timeout: 10000 });
        let estado;
        try { estado = !r.killed && r.code === 0 ? JSON.parse(r.stdout) : undefined; } catch { /* Salida vacía o cortada. */ }
        if (!estado) throw new Error(!r.killed && r.code !== 0 && r.stdout.trim() || fallaPython(r));
        const resumen = `${curso}: ${estado.estado} · ${estado.procesadas}/${estado.solicitadas} · pendientes: ${estado.pendientes}${estado.editadas?.length ? ` · editadas: ${estado.editadas.length}` : ""}`;
        ctx.ui.setStatus("curso-ingesta", resumen);
        ctx.ui.notify([resumen, estado.error, estado.aviso].filter(Boolean).join("\n"), estado.error || estado.aviso ? "warning" : "info");
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
    // ui.confirm de pi dibuja «Yes»/«No»; Esc o un corte valen como no.
    const acepta = await elegir(ctx, `Guardar cambios del curso\n${r.copias.length === 1 ? "1 PDF nuevo" : `${r.copias.length} PDFs nuevos`}. Revisá el diff mostrado antes de confirmar. No se modifica progreso.yaml ni se reemplazan PDFs existentes.`, ["Sí, guardar los cambios", "No"], { signal }) === "Sí, guardar los cambios";
    if (!acepta) return { content: [{ type: "text", text: "Cambios rechazados; el curso se preservó." }], details: { cancelada: true } };
  }
  const guardado = await ejecutar(pi, "aplicar", args.curso, [...extras, "--base", r.base, "--huella", r.huella], signal);
  return { content: [{ type: "text", text: `Curso ${args.curso} guardado; ${guardado.copiados} PDFs copiados sin modificar los originales. Continuá con la ingesta y la revisión del informe.` }], details: guardado };
}
