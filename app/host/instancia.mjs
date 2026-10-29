// Otro pi con una clase abierta en este vault (por ejemplo, pi-learn en una terminal): se avisa antes de abrir la misma
// sesión dos veces, el problema que DA8 resolvió en la terminal con una sola sesión de tmux por carpeta.
// Se lee el registro propio que sesion.ts escribe en cada curso (.sesion-activa.json, DA16).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// En Node, process.kill(pid, 0) sólo consulta (también en Windows); un pid ajeno sin permiso existe igual.
export function procesoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

export function clasesAbiertasPorOtros(vault, propioPid = process.pid) {
  const dir = join(vault, "cursos");
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    try {
      const r = JSON.parse(readFileSync(join(dir, d.name, ".sesion-activa.json"), "utf8"));
      if (r.pid !== propioPid && procesoVivo(r.pid)) salida.push({ curso: r.curso, tema: r.tema, sesion: r.sesion, pid: r.pid });
    } catch { /* sin registro en ese curso */ }
  }
  return salida;
}
