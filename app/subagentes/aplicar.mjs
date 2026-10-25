#!/usr/bin/env node
// Paneles de subagentes en la app: agrega superficie.ts al paquete pi-interactive-subagents instalado en .pi/ y hace
// que su index.ts la use en lugar de tmux.ts. Sin la app (en la terminal) el paquete sigue usando tmux igual que antes.
// Es un parche local y reversible mientras el paquete no traiga la superficie (fork fijado o PR a su autor: ver
// informes/interfaz.md). Uso: node aplicar.mjs [--vault <carpeta>] [--quitar] [--estado]
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const IMPORT_TMUX = /\}\s*from\s*"\.\/tmux\.ts";/;
const IMPORT_SUPERFICIE = /\}\s*from\s*"\.\/superficie\.ts";/;

export const carpetaPaquete = vault => join(vault, ".pi", "git", "github.com", "amosblomqvist", "pi-interactive-subagents", "pi-extension", "subagents");

export function estado(vault) {
  const dir = carpetaPaquete(vault), index = join(dir, "index.ts");
  if (!existsSync(index)) return { instalado: false, aplicado: false };
  const texto = readFileSync(index, "utf8");
  const propia = readFileSync(join(aqui, "superficie.ts"), "utf8");
  const copia = existsSync(join(dir, "superficie.ts")) ? readFileSync(join(dir, "superficie.ts"), "utf8") : undefined;
  // Si el paquete ya trae su propia superficie (fork o versión nueva), no se toca.
  return { instalado: true, aplicado: IMPORT_SUPERFICIE.test(texto) && !!copia, propia: copia === propia };
}

export function aplicar(vault) {
  const dir = carpetaPaquete(vault), index = join(dir, "index.ts");
  if (!existsSync(index)) throw new Error("No está instalado pi-interactive-subagents en .pi/: instalá primero los paquetes de pi.");
  const texto = readFileSync(index, "utf8");
  if (IMPORT_SUPERFICIE.test(texto) && existsSync(join(dir, "superficie.ts"))) {
    if (estado(vault).propia) return "ya estaba";
    // Una superficie que no es la de la app (por ejemplo, la del fork) se respeta.
    if (!readFileSync(join(dir, "superficie.ts"), "utf8").includes("__piLearnSuperficie")) return "el paquete ya trae otra superficie";
  }
  if (!IMPORT_TMUX.test(texto) && !IMPORT_SUPERFICIE.test(texto)) throw new Error("El index.ts del paquete no importa ./tmux.ts como se esperaba: revisá la versión fijada.");
  copyFileSync(join(aqui, "superficie.ts"), join(dir, "superficie.ts"));
  if (IMPORT_TMUX.test(texto)) writeFileSync(index, texto.replace(IMPORT_TMUX, '} from "./superficie.ts";'));
  return "aplicado";
}

export function quitar(vault) {
  const dir = carpetaPaquete(vault), raiz = resolve(dir, "../..");
  if (!existsSync(dir)) return "no instalado";
  try { execFileSync("git", ["-C", raiz, "checkout", "--", "pi-extension/subagents/index.ts"], { stdio: "ignore" }); }
  catch { const index = join(dir, "index.ts"); writeFileSync(index, readFileSync(index, "utf8").replace(IMPORT_SUPERFICIE, '} from "./tmux.ts";')); }
  rmSync(join(dir, "superficie.ts"), { force: true });
  return "quitado";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--vault");
  const vault = resolve(i > 0 ? process.argv[i + 1] : join(aqui, "../../.."));
  try {
    if (process.argv.includes("--estado")) console.log(JSON.stringify(estado(vault)));
    else console.log(process.argv.includes("--quitar") ? quitar(vault) : aplicar(vault));
  } catch (e) { console.error(e.message); process.exit(1); }
}
