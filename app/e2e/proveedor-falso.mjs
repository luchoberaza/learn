// Proveedor falso de pi-ai (fauxProvider, el mismo que usan los tests de learn) para probar la app sin red ni modelo.
// El host lo carga si PI_LEARN_E2E apunta a este archivo; el guion de respuestas sale de PI_LEARN_E2E_GUION, un módulo que
// exporta por defecto (ai) => FauxResponseStep[] (mensajes de texto, llamadas a tools como quiz o leer_paginas, etc.).
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const i = process.argv.indexOf("--vault");
const vault = resolve(i > 0 ? process.argv[i + 1] : process.cwd());
const { importDependenciaPi } = await import(pathToFileURL(join(vault, ".pi/scripts/lib/pi-sdk.mjs")).href);
export const ai = await importDependenciaPi("@earendil-works/pi-ai");

export const faux = ai.fauxProvider({
  provider: "faux",
  models: [{ id: "tutor-de-prueba", name: "Tutor de prueba", contextWindow: 200000, maxTokens: 8000, input: ["text", "image"] }],
  // Escribe a una velocidad visible, como un modelo real, para probar el texto en tandas.
  tokensPerSecond: Number(process.env.PI_LEARN_E2E_TOKENS ?? 600),
});

const guion = process.env.PI_LEARN_E2E_GUION ? (await import(pathToFileURL(resolve(process.env.PI_LEARN_E2E_GUION)).href)).default(ai) : [];
faux.setResponses(guion);

export default function proveedorFalso(pi) {
  pi.registerProvider(faux.provider);
}
