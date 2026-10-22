import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Activo } from "./material.ts";
import { renderizar } from "./render.ts";

export function registrarPresentacion(pi: ExtensionAPI, actual: () => { a: Activo } | undefined) {
  pi.registerToolRenderer(renderizar);
  // pi las restaura a «Working» y «Thinking...» al recargar o cambiar de sesión, antes de cada session_start.
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWorkingMessage("Trabajando…");
    ctx.ui.setHiddenThinkingLabel("Pensando…");
  });
}
