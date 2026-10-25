// El host (app/host/inicio.mjs) corre con el Node del sistema, el mismo que usa pi, para que la app use exactamente la
// instalación de pi 1.4.0 que verificó el amigo. Se habla por el canal IPC de Node.
import { app } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { EventEmitter } from "node:events";
import { join } from "node:path";

export type MensajeHost = { tipo: string; [clave: string]: unknown };

// En el instalador, la carpeta host/ va fuera del asar para que el Node del sistema pueda leerla.
export const carpetaApp = () => app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked");

export class Host extends EventEmitter {
  private proceso?: ChildProcess;
  private pendientes = new Map<string, { resolver: (v: unknown) => void; rechazar: (e: Error) => void; reloj: NodeJS.Timeout }>();
  private siguiente = 1;
  estado: "apagado" | "arrancando" | "listo" | "error" = "apagado";
  vault?: string;

  arrancar(vault: string, node = "node") {
    this.detener();
    this.vault = vault;
    this.estado = "arrancando";
    const entorno: NodeJS.ProcessEnv = { ...process.env };
    for (const clave of Object.keys(entorno)) if (clave.startsWith("ELECTRON_")) delete entorno[clave];
    let hijo: ChildProcess;
    try {
      hijo = fork(join(carpetaApp(), "host", "inicio.mjs"), ["--vault", vault], { execPath: node, cwd: existsSync(vault) ? vault : undefined, stdio: ["ignore", "pipe", "pipe", "ipc"], env: entorno, windowsHide: true });
    } catch (e) {
      this.estado = "error";
      this.emit("mensaje", { tipo: "error-fatal", mensaje: `No se pudo arrancar Node.js (${node}): ${(e as Error).message}. Instalalo desde «Preparar la computadora».` });
      return;
    }
    this.proceso = hijo;
    hijo.stdout?.on("data", d => registrar(String(d)));
    hijo.stderr?.on("data", d => registrar(String(d)));
    hijo.on("error", e => {
      this.estado = "error";
      this.emit("mensaje", { tipo: "error-fatal", mensaje: (e as NodeJS.ErrnoException).code === "ENOENT" ? "No se encontró Node.js. Instalalo desde «Preparar la computadora»." : `El proceso de pi falló: ${e.message}` });
    });
    hijo.on("message", (m: MensajeHost) => {
      if (m.tipo === "respuesta") {
        const p = this.pendientes.get(String(m.id));
        if (!p) return;
        this.pendientes.delete(String(m.id));
        clearTimeout(p.reloj);
        if (m.ok) p.resolver(m.datos); else p.rechazar(new Error(String(m.error ?? "Error del host")));
        return;
      }
      if (m.tipo === "listo") this.estado = "listo";
      if (m.tipo === "error-fatal") this.estado = "error";
      this.emit("mensaje", m);
    });
    hijo.on("exit", codigo => {
      if (this.proceso !== hijo) return;
      this.proceso = undefined;
      for (const [, p] of this.pendientes) { clearTimeout(p.reloj); p.rechazar(new Error("El proceso de pi se cerró.")); }
      this.pendientes.clear();
      if (this.estado !== "error") this.estado = "apagado";
      this.emit("salio", codigo);
    });
  }

  pedir(tipo: string, datos: unknown = {}, ms = 120000): Promise<unknown> {
    const hijo = this.proceso;
    if (!hijo?.connected) return Promise.reject(new Error("pi no está abierto."));
    const id = `a${this.siguiente++}`;
    return new Promise((resolver, rechazar) => {
      const reloj = setTimeout(() => { this.pendientes.delete(id); rechazar(new Error(`pi no respondió a «${tipo}».`)); }, ms);
      this.pendientes.set(id, { resolver, rechazar, reloj });
      hijo.send({ tipo, id, datos });
    });
  }

  enviar(mensaje: MensajeHost) { if (this.proceso?.connected) this.proceso.send(mensaje); }

  detener() {
    const hijo = this.proceso;
    if (!hijo) return;
    this.proceso = undefined;
    try { hijo.send({ tipo: "salir" }); } catch { /* ya cerró */ }
    setTimeout(() => { try { hijo.kill(); } catch { /* ya terminó */ } }, 3000).unref();
  }
}

// Registro del host en la carpeta de datos de la app (se rota a los 2 MB), para diagnosticar sin mirar la consola.
function registrar(texto: string) {
  try {
    const dir = join(app.getPath("userData"), "registros");
    mkdirSync(dir, { recursive: true });
    const archivo = join(dir, "host.log");
    try { if (statSync(archivo).size > 2 * 1024 * 1024) renameSync(archivo, join(dir, "host.anterior.log")); } catch { /* no existe todavía */ }
    appendFileSync(archivo, texto);
  } catch { /* sin disco: se descarta */ }
}
