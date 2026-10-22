import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Activo } from "./material.ts";
import { renderizar } from "./render.ts";

export function registrarPresentacion(pi: ExtensionAPI, actual: () => { a: Activo } | undefined) {
  pi.registerToolRenderer(renderizar);
}
