import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { vaultDir } from "../../scripts/lib/pi-sdk.mjs";
import { vivo } from "./preparacion.ts";

// La ingesta base que lanza la skill por bash (ingestar.py iniciar): barra sobre el editor y, al terminar, un turno del agente para seguir el armado.
type Estado = { estado: string; pid?: number; solicitadas?: number; procesadas?: number; pendientes?: number; documento?: string | null; pagina?: number | null; error?: string; aviso?: string };
type Inicio = { tipo: "inicio"; curso: string; salida: string };

const FINALES = new Set(["completada", "completada_con_pendientes", "interrumpida", "error"]);
const BARRA = 20;

function leerEstado(salida: string): Estado | undefined {
  let e: Estado;
  try { e = JSON.parse(readFileSync(resolve(salida, "estado-ingesta.json"), "utf8")); } catch { return undefined; }
  // Como `ingestar.py estado`: un proceso muerto sin estado final se cortó.
  if (e.pid && !vivo(e.pid)) {
    if (e.estado === "en_curso") return { ...e, estado: "interrumpida", aviso: "el proceso terminó sin cerrar la ingesta" };
    if (e.estado === "iniciando") return { ...e, estado: "error", error: "el proceso terminó al arrancar" };
  }
  return e;
}

// Sólo una salida de un curso del vault: cursos/<slug>/_procesado.
function cursoDe(vault: string, salida: string) {
  const partes = relative(vault, salida).split(sep);
  return partes.length === 3 && partes[0] === "cursos" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(partes[1]) && partes[2] === "_procesado" ? partes[1] : undefined;
}

export function linea(curso: string, e: Estado) {
  const total = e.solicitadas || 0, hechas = Math.min(e.procesadas || 0, total), lleno = total ? Math.round(hechas / total * BARRA) : 0;
  const donde = e.documento ? ` · ${e.documento}${e.pagina ? ` p. ${e.pagina}` : ""}` : "";
  return `⏳ Ingesta de ${curso}  [${"█".repeat(lleno)}${"░".repeat(BARRA - lleno)}]  ${hechas}/${total} páginas · ${total ? Math.floor(hechas / total * 100) : 0}%${donde}`;
}

export function registrarIngestaFondo(pi: ExtensionAPI, vault = vaultDir, intervalo = 2000) {
  const mirando = new Map<string, { curso: string; timer: NodeJS.Timeout }>();
  let ctxActual: ExtensionContext | undefined;
  const ui = (f: (c: ExtensionContext) => void) => { try { if (ctxActual) f(ctxActual); } catch { /* ctx viejo tras /reload. */ } };
  const clave = (salida: string) => `curso-ingesta:${salida}`;

  function terminar(salida: string, curso: string, e: Estado) {
    const m = mirando.get(salida);
    if (m) clearInterval(m.timer);
    mirando.delete(salida);
    ui(c => c.ui.setWidget(clave(salida), undefined));
    pi.appendEntry("curso-ingesta", { tipo: "fin", salida, estado: e.estado });
    const cifras = `${e.procesadas ?? 0}/${e.solicitadas ?? 0} páginas, ${e.pendientes ?? 0} pendientes`;
    const ok = e.estado === "completada" || e.estado === "completada_con_pendientes";
    ui(c => c.ui.notify(ok ? `Ingesta de ${curso} terminada: ${cifras}.` : `La ingesta de ${curso} se cortó (${e.estado}): ${e.error || e.aviso || cifras}.`, ok ? "info" : "warning"));
    pi.sendMessage({ customType: "curso-ingesta", display: false, details: e, content: ok
      ? `La ingesta base de ${curso} terminó (${e.estado}: ${cifras}). Seguí con el armado del curso según la skill: validar, cruzar, informe y la tabla tema → material para el usuario.`
      : `La ingesta base de ${curso} se cortó (${e.estado}: ${e.error || e.aviso || cifras}). Informáselo al usuario y proponé reanudar con el mismo manifiesto; no la relances sin su OK.` },
    { triggerTurn: true, deliverAs: "followUp" });
  }

  function mirar(salida: string, curso: string) {
    if (mirando.has(salida)) return;
    const paso = () => {
      const e = leerEstado(salida);
      if (!e) return;
      if (FINALES.has(e.estado)) terminar(salida, curso, e);
      else ui(c => c.ui.setWidget(clave(salida), [linea(curso, e)]));
    };
    mirando.set(salida, { curso, timer: setInterval(paso, intervalo).unref() });
    paso();
  }

  pi.on("tool_result", (event, ctx) => {
    ctxActual = ctx;
    if (event.toolName !== "bash" || event.isError) return;
    const comando = String((event.input as { command?: unknown }).command ?? "");
    if (!/ingestar\.py\s+iniciar\b/.test(comando)) return;
    // shortcut: toma la primera --salida del comando; una cadena con varias ingestas mira sólo esa.
    const ruta = comando.match(/--salida[=\s]+(["']?)([^\s"']+)\1/)?.[2];
    if (!ruta) return;
    const salida = resolve(ctx.cwd, ruta), curso = cursoDe(vault, salida);
    // Si `iniciar` ya devolvió el estado final (todo en caché), el agente lo leyó en el resultado: no hay qué avisar.
    if (!curso || mirando.has(salida) || FINALES.has(leerEstado(salida)?.estado ?? "")) return;
    pi.appendEntry("curso-ingesta", { tipo: "inicio", curso, salida } satisfies Inicio);
    mirar(salida, curso);
  });

  pi.on("session_start", (_event, ctx) => {
    ctxActual = ctx;
    // Inicios sin fin en la rama: se retoman tras /reload, /resume o un kill.
    const abiertos = new Map<string, Inicio>();
    for (const e of ctx.sessionManager.getBranch()) if (e.type === "custom" && e.customType === "curso-ingesta") {
      const d = e.data as any;
      if (d?.tipo === "inicio" && typeof d.salida === "string" && cursoDe(vault, d.salida) === d.curso) abiertos.set(d.salida, d);
      else if (d?.tipo === "fin") abiertos.delete(d.salida);
    }
    for (const { salida, curso } of abiertos.values()) mirar(salida, curso);
  });

  pi.on("session_shutdown", () => {
    for (const { timer } of mirando.values()) clearInterval(timer);
    mirando.clear();
  });
}
