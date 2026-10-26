import { cpSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

// La ventana de PDF (DA47) pide al proceso principal los mapas de caracteres, las fuentes estándar y los decodificadores
// wasm de PDF.js (main/visor.ts): van junto a ella. Sin quickjs: los scripts de los PDF no se ejecutan.
const datosPdfjs = (): Plugin => ({
  name: "datos-pdfjs",
  apply: "build",
  writeBundle(opciones) {
    for (const d of ["cmaps", "standard_fonts", "wasm"])
      cpSync(resolve("node_modules/pdfjs-dist", d), resolve(opciones.dir!, "pdfjs", d), { recursive: true, filter: f => !basename(f).startsWith("quickjs") });
  },
});

export default defineConfig({
  main: {
    build: { outDir: "out/main", rollupOptions: { external: ["electron"] } },
  },
  // El preload corre en un renderer con sandbox: tiene que ser CommonJS. Uno para la ventana principal y otros, mínimos,
  // para las ventanas de PDF y de grabación.
  preload: {
    build: { outDir: "out/preload", rollupOptions: { input: { index: resolve("src/preload/index.ts"), visor: resolve("src/preload/visor.ts"), reproductor: resolve("src/preload/reproductor.ts") }, output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    root: "src/renderer",
    build: { outDir: "out/renderer", chunkSizeWarningLimit: 4000, rollupOptions: { input: { index: resolve("src/renderer/index.html"), visor: resolve("src/renderer/visor.html"), reproductor: resolve("src/renderer/reproductor.html") } } },
    plugins: [react(), datosPdfjs()],
  },
});
