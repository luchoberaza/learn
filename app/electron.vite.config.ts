import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: { outDir: "out/main", rollupOptions: { external: ["electron"] } },
  },
  // El preload corre en un renderer con sandbox: tiene que ser CommonJS.
  preload: {
    build: { outDir: "out/preload", rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    root: "src/renderer",
    build: { outDir: "out/renderer", chunkSizeWarningLimit: 4000 },
    plugins: [react()],
  },
});
