import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Los hijos se lanzan con --no-extensions. El registro explícito les permite
// cargar solo el paquete que respalda las herramientas de su allowlist.
export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => {
    const api = (globalThis as any).__pi_interactive_subagents;
    const extension = fileURLToPath(new URL("../npm/node_modules/pi-web-access/dist/index.js", import.meta.url));
    if (!api?.registerToolExtension || !existsSync(extension)) return;
    for (const name of ["web_search", "web_fetch"]) {
      api.registerToolExtension(name, extension);
    }
  });
}
