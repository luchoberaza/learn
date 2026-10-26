/**
 * modelos — el modelo principal de esta máquina (DA49) y el registro de consumo y cupos (DA48).
 *
 * - Modelo principal: `.pi/settings.json` fija el del repo y pi lo hace ganar sobre el que se elige con /model, así
 *   que cada sesión nueva volvía a él. Con `modelo_principal` en curso.config.local.json (no versionado), las sesiones
 *   nuevas de la clase arrancan con ése, si tiene credenciales. No toca una sesión retomada, un `--model` explícito,
 *   el researcher ni los subagentes.
 * - Consumo: cada respuesta del modelo deja una línea (proveedor, modelo, tokens, costo según el catálogo de pi) en la
 *   carpeta del agente; los cupos que el proveedor informa en las cabeceras quedan en cupos.json. Lo lee la app.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { leerConfigLocal, piDir } from "../scripts/lib/pi-sdk.mjs";
import { agotadoDeCabeceras, anotarConsulta, anotarConsumo, anotarCupo, cupoDeCabeceras, leerCupos } from "../scripts/lib/consumo.mjs";

// Las herramientas que esperan al alumno: su respuesta abre una consulta nueva, como un mensaje.
const DEL_ALUMNO = new Set(["quiz", "ask_user_question"]);

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
