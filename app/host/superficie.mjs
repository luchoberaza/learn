// Superficie «app» de pi-interactive-subagents (app/subagentes/superficie.ts): cada subagente corre en una terminal
// real (node-pty: ConPTY en Windows, PTY en Linux) con bash, como un panel de tmux. Lo que el paquete lee de la
// pantalla sale de un emulador sin dibujo (@xterm/headless) y la app dibuja el panel con xterm.js; el alumno puede
// escribirle al subagente como en tmux. Todo es sincrónico, igual que los comandos de tmux que reemplaza.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const COLUMNAS = 100, FILAS = 30, HISTORIA = 400_000;

// bash del sistema: Git Bash en Windows (pi ya lo requiere), /bin/bash en Linux.
export function bashDelSistema(env = process.env) {
  if (env.PI_LEARN_BASH && existsSync(env.PI_LEARN_BASH)) return env.PI_LEARN_BASH;
  if (process.platform !== "win32") return existsSync("/bin/bash") ? "/bin/bash" : "bash";
  const candidatos = [join(env.ProgramFiles ?? "C:\\Program Files", "Git", "bin", "bash.exe"), join(env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
    join(env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe")];
  const git = spawnSync("where", ["git"], { encoding: "utf8", windowsHide: true }).stdout?.split(/\r?\n/).find(Boolean);
  if (git) candidatos.push(join(dirname(dirname(git)), "bin", "bash.exe"));
  return candidatos.find(c => existsSync(c));
}

export async function crearSuperficie({ enviar, cwd, env = process.env }) {
  let pty, Terminal;
  try {
    pty = (await import("@lydell/node-pty")).default;
    Terminal = (await import("@xterm/headless")).default.Terminal;
  } catch (e) { return { disponible: false, motivo: `No se pudo cargar la terminal de los subagentes (${e?.message ?? e}).` }; }
  const bash = bashDelSistema(env);
  if (!bash) return { disponible: false, motivo: "No se encontró bash (Git Bash en Windows): los subagentes lo necesitan." };

  const paneles = new Map();
  let numero = 0;
  const entorno = { ...env, TERM: "xterm-256color", COLORTERM: "truecolor" };
  for (const clave of Object.keys(entorno)) if (clave.startsWith("ELECTRON_") || clave === "TMUX" || clave === "TMUX_PANE") delete entorno[clave];

  function panel(id) {
    const p = paneles.get(id);
    if (!p) throw new Error(`can't find pane: ${id}`);
    return p;
  }

  const superficie = {
    crear(nombre) {
      const id = `app-${++numero}`;
      const terminal = new Terminal({ cols: COLUMNAS, rows: FILAS, scrollback: 5000, allowProposedApi: true });
      const proceso = pty.spawn(bash, process.platform === "win32" ? ["--login", "-i"] : ["-i"], { name: "xterm-256color", cols: COLUMNAS, rows: FILAS, cwd, env: entorno });
      const p = { id, nombre: String(nombre || "subagente"), terminal, proceso, vivo: true, historia: "", pendiente: "", reloj: undefined, listo: false, cola: [], espera: undefined };
      const volcar = () => { p.reloj = undefined; if (p.pendiente) { enviar({ tipo: "subagente-datos", id, datos: p.pendiente }); p.pendiente = ""; } };
      // Lo que se escribe antes de que el shell muestre su prompt se perdería (Git Bash con --login tarda más que
      // los 300 ms que espera el paquete): se guarda y se manda cuando la salida se aquieta, o a los 6 s.
      const listo = () => { if (p.listo) return; p.listo = true; clearTimeout(p.espera); if (p.vivo) for (const x of p.cola.splice(0)) proceso.write(x); };
      const tope = setTimeout(listo, 6000);
      tope.unref?.();
      proceso.onData(d => {
        if (!p.listo) { clearTimeout(p.espera); p.espera = setTimeout(listo, 300); }
        terminal.write(d);
        p.historia = (p.historia + d).slice(-HISTORIA);
        p.pendiente += d;
        p.reloj ??= setTimeout(volcar, 30);
      });
      proceso.onExit(({ exitCode }) => {
        p.vivo = false;
        volcar();
        // Si el shell murió (lo cerró el alumno o se cayó), el paquete lo ve como un fin con ese código, en lugar de
        // esperar para siempre como con un panel de tmux cerrado a mano. Windows da códigos negativos al cortar un
        // proceso (-1073741510): el paquete sólo reconoce dígitos, así que va 130, «interrumpido», como en bash.
        const codigo = Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255 ? exitCode : 130;
        terminal.write(`\r\n__SUBAGENT_DONE_${codigo}__\r\n`);
        enviar({ tipo: "subagente-fin", id, codigo });
      });
      paneles.set(id, p);
      enviar({ tipo: "subagente-abierto", id, nombre: p.nombre });
      return id;
    },
    escribir(id, texto) {
      const p = panel(id);
      if (!p.vivo) return;
      if (p.listo) p.proceso.write(String(texto)); else p.cola.push(String(texto));
    },
    // Como tmux capture-pane -S -<lineas>: las últimas líneas de la historia y la pantalla visible.
    leer(id, lineas = 50) {
      const b = panel(id).terminal.buffer.active, salida = [];
      for (let i = Math.max(0, b.baseY - Math.max(1, lineas)); i < b.length; i++) salida.push(b.getLine(i)?.translateToString(true) ?? "");
      return salida.join("\n");
    },
    cerrar(id) {
      const p = panel(id);
      if (p.vivo) { try { p.proceso.kill(); } catch { /* ya terminó */ } }
      p.vivo = false;
      enviar({ tipo: "subagente-cerrado", id });
      // La pantalla queda un rato por si el paquete la relee al terminar.
      setTimeout(() => { p.terminal.dispose(); paneles.delete(id); }, 60000).unref();
    },
  };

  return {
    disponible: true, bash, superficie,
    lista: () => [...paneles.values()].map(p => ({ id: p.id, nombre: p.nombre, vivo: p.vivo, historia: p.historia })),
    teclear: (id, datos) => superficie.escribir(id, datos),
    tamano: (id, cols, rows) => {
      const p = panel(id), c = Math.max(20, Math.min(400, cols | 0)), r = Math.max(5, Math.min(200, rows | 0));
      p.terminal.resize(c, r);
      if (p.vivo) p.proceso.resize(c, r);
    },
    cerrarPorElAlumno: id => { const p = panel(id); if (p.vivo) try { p.proceso.kill(); } catch { /* ya terminó */ } },
    cerrarTodo: () => { for (const p of paneles.values()) if (p.vivo) try { p.proceso.kill(); } catch { /* ya terminó */ } },
  };
}
