import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// /fin, /estudiar y /simulacro: pi ya vació el editor, así que se corta el turno en curso en vez de perder el comando.
// La pregunta abierta recibe el motivo antes de que el aborto la cierre (md-log lo anota).
export async function cortarTurno(pi: ExtensionAPI, ctx: ExtensionCommandContext, motivo: string) {
  if (ctx.isIdle()) return;
  pi.events.emit("pregunta:corte", motivo);
  ctx.abort();
  await ctx.waitForIdle();
}

type Execute = (id: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) => Promise<any>;
// Una pregunta cerrada por el aborto termina el turno: si no, el loop arranca otra llamada con la señal abortada
// y pi-ai la muestra como «Error: This operation was aborted» (agent-loop.js:172, lazy.js:57-63).
export function cortable(pi: ExtensionAPI, execute: Execute): Execute {
  let motivo: string | undefined;
  pi.events.on("pregunta:corte", m => { motivo = String(m); });
  return async (id, params, signal, onUpdate, ctx) => {
    motivo = undefined;
    const r = await execute(id, params, signal, onUpdate, ctx);
    return signal?.aborted ? { ...r, terminate: true, details: { ...r.details, motivo: motivo ?? "al interrumpirse el turno" } } : r;
  };
}
