/**
 * modelos — el modelo principal de esta máquina (DA49) y el registro de consumo y cupos (DA48).
 *
 * - Modelo principal: `.pi/settings.json` fija el del repo y pi lo hace ganar sobre el que se elige con /model, así
 *   que cada sesión nueva volvía a él. Con `modelo_principal` en curso.config.local.json (no versionado), las sesiones
 *   nuevas de la clase arrancan con ése, si tiene credenciales. No toca una sesión retomada, un `--model` explícito,
 *   el researcher ni los subagentes.
 * - Subagentes (DA58): los de agents/*.md fijan su modelo. Si ése no tiene credenciales, van con el de la conversación.
 * - Consumo: cada respuesta del modelo deja una línea (proveedor, modelo, tokens, costo según el catálogo de pi) en la
 *   carpeta del agente; los cupos que el proveedor informa en las cabeceras quedan en cupos.json. Lo lee la app.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerConfigLocal, piDir } from "../scripts/lib/pi-sdk.mjs";
import { agotadoDeCabeceras, anotarConsulta, anotarConsumo, anotarCupo, cupoDeCabeceras, leerCupos } from "../scripts/lib/consumo.mjs";

// Las herramientas que esperan al alumno: su respuesta abre una consulta nueva, como un mensaje.
const DEL_ALUMNO = new Set(["quiz", "ask_user_question"]);

// El modelo que fija el frontmatter de agents/<nombre>.md, si lo hay.
function modeloDelAgente(recursos: string, nombre: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(nombre)) return undefined;
  try {
    const cabecera = readFileSync(join(recursos, "agents", `${nombre}.md`), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    return cabecera?.match(/^model:\s*(.+?)\s*$/m)?.[1];
  } catch { return undefined; }
}
// Si «proveedor/modelo» (con su :thinking, si lo trae) tiene credenciales. Sin proveedor lo resuelve pi: no se toca.
function conCredenciales(ctx: Pick<ExtensionContext, "modelRegistry">, nombre: string) {
  const barra = nombre.indexOf("/");
  if (barra < 1) return true;
  const modelo = ctx.modelRegistry.find(nombre.slice(0, barra), nombre.slice(barra + 1).replace(/:(off|minimal|low|medium|high|xhigh)$/, ""));
  return Boolean(modelo && ctx.modelRegistry.hasConfiguredAuth(modelo));
}

export default function modelos(pi: ExtensionAPI) {
  registrarModelos(pi);
}

// recursos: el .pi/ cuya curso.config.local.json se lee (los tests usan uno temporal).
export function registrarModelos(pi: ExtensionAPI, recursos = piDir) {
  const origen = process.env.LEARN_ORIGEN || (process.env.PI_SUBAGENT_NAME ? "subagente" : "clase");
  const conModeloExplicito = process.argv.some(a => a === "--model" || a.startsWith("--model="));
  let consulta: string | undefined;
  let usadoAlEmpezar: { clave: string; usado: number; renueva?: number } | undefined;

  pi.on("session_start", async (evento, ctx) => {
    if (origen !== "clase" || conModeloExplicito || (evento.reason !== "startup" && evento.reason !== "new")) return;
    const nombre = leerConfigLocal(recursos).modelo_principal;
    const barra = nombre?.indexOf("/") ?? -1;
    if (!nombre || barra < 1) return;
    const modelo = ctx.modelRegistry.find(nombre.slice(0, barra), nombre.slice(barra + 1));
    if (!modelo || !ctx.modelRegistry.hasConfiguredAuth(modelo)) return;
    if (ctx.model?.provider === modelo.provider && ctx.model?.id === modelo.id) return;
    await pi.setModel(modelo);
  });

  // DA58: el repo fija en agents/*.md un modelo de openai-codex, y learn tiene que andar con la clave que tenga el alumno.
  // Si el modelo del subagente (el que pide la llamada o el de su agente) no tiene credenciales, va el de la conversación.
  pi.on("tool_call", (evento, ctx) => {
    if (evento.toolName !== "subagent" || !ctx.model || !ctx.modelRegistry.hasConfiguredAuth(ctx.model)) return;
    const input = evento.input as { agent?: unknown; model?: unknown };
    const pedido = typeof input.model === "string" && input.model ? input.model : typeof input.agent === "string" ? modeloDelAgente(recursos, input.agent) : undefined;
    if (!pedido || conCredenciales(ctx, pedido)) return;
    input.model = `${ctx.model.provider}/${ctx.model.id}`;
  });

  // Una consulta es cada vez que el alumno actúa: un mensaje o la respuesta a un quiz o a una pregunta del tutor (que
  // llegan dentro del mismo turno). Cada una deja una marca, aunque el tutor no llame al modelo antes de la siguiente
  // (tres quizzes juntos), para que el promedio por consulta sea por acción del alumno.
  const abrirConsulta = (modelo?: { provider: string; id: string }) => {
    cerrarConsulta();
    consulta = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (!modelo) return;
    const clave = `${modelo.provider}/${modelo.id}`;
    if (origen === "clase") anotarConsulta({ origen, proveedor: modelo.provider, modelo: modelo.id, consulta });
    const corta = leerCupos()[clave]?.ventanas?.[0];
    if (corta) usadoAlEmpezar = { clave, usado: corta.usado, renueva: corta.renueva };
  };
  // Cuánto de la ventana corta gastó la consulta: con eso la app estima cuántas quedan hasta que se renueve.
  const cerrarConsulta = () => {
    const inicio = usadoAlEmpezar;
    usadoAlEmpezar = undefined;
    if (!inicio) return;
    const ahora = leerCupos()[inicio.clave]?.ventanas?.[0];
    const mismaVentana = !inicio.renueva || !ahora?.renueva || Math.abs(ahora.renueva - inicio.renueva) < 120000;
    if (!ahora || !mismaVentana || ahora.usado < inicio.usado) return;
    const previos: number[] = leerCupos()[inicio.clave]?.porConsulta ?? [];
    anotarCupo(inicio.clave, { porConsulta: [...previos, Math.round((ahora.usado - inicio.usado) * 100) / 100].slice(-30) });
  };
  pi.on("agent_start", (_evento, ctx) => abrirConsulta(ctx.model));
  pi.on("tool_execution_end", (evento, ctx) => { if (DEL_ALUMNO.has(evento.toolName) && !evento.isError) abrirConsulta(ctx.model); });
  pi.on("agent_end", () => cerrarConsulta());
  pi.on("message_end", evento => {
    const m = evento.message;
    if (m.role !== "assistant" || !m.usage) return;
    anotarConsumo({ origen, proveedor: m.provider, modelo: m.model, consulta, usage: m.usage });
  });
  pi.on("after_provider_response", (evento, ctx) => {
    const modelo = ctx.model;
    if (!modelo) return;
    const clave = `${modelo.provider}/${modelo.id}`;
    if (evento.status === 429) return anotarCupo(clave, { agotado: agotadoDeCabeceras(evento.headers) });
    const cupo = cupoDeCabeceras(modelo.provider, evento.headers);
    if (!cupo) return;
    anotarCupo(clave, { ...cupo, agotado: undefined });
  });
}
