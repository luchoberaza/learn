import { convertToLlm, serializeConversation, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Activo } from "./material.ts";
import { renderizar } from "./render.ts";

const SISTEMA = "Resumís sesiones de estudio entre un estudiante y su tutor. No continúes la conversación ni respondas sus preguntas: escribí sólo el resumen.";
// La plantilla de pi está en inglés (Goal/Progress/Blocked) y sus instrucciones sólo se agregan al final: se reemplaza entera.
const INSTRUCCIONES = `Resumí la conversación de arriba para que el tutor siga sin volver a preguntar lo ya visto. En español rioplatense, breve, con exactamente estas secciones:

## Curso y tema
Curso, tema, ruta del log y objetivo o plan de la clase.

## Borde
Qué domina y qué falla el estudiante, con la evidencia observada.

## Práctica
Cada pregunta, quiz o ítem con su resultado real tal como lo registró la herramienta (correcta, incorrecta, «No sé», cancelada). Lo que el estudiante no respondió va como «pendiente, sin responder»: nunca lo califiques ni inventes su respuesta.

## Próximo paso
La pregunta pendiente, si la hay, y lo que sigue.

## Datos
Citas [[…#page=N]], fórmulas y valores que hagan falta para seguir.`;

export function registrarPresentacion(pi: ExtensionAPI, actual: () => { a: Activo } | undefined) {
  pi.registerToolRenderer(renderizar);
  // pi las restaura a «Working» y «Thinking...» al recargar o cambiar de sesión, antes de cada session_start.
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWorkingMessage("Trabajando…");
    ctx.ui.setHiddenThinkingLabel("Pensando…");
  });
  pi.on("session_before_compact", async ({ preparation: p, customInstructions, signal }, ctx) => {
    const modelo = ctx.model;
    if (!modelo) return;
    // Si algo falla, pi sigue con su propio resumen: compactar nunca corta la sesión.
    try {
      // Sin clase activa (preparar un curso, después de /fin) sirve más la plantilla de pi, que conserva rutas y decisiones.
      const e = actual();
      if (!e) return;
      const pedido = [
        `<conversation>\n${serializeConversation(convertToLlm([...p.messagesToSummarize, ...p.turnPrefixMessages]))}\n</conversation>`,
        p.previousSummary && `<previous-summary>\n${p.previousSummary}\n</previous-summary>\nIntegrá el resumen anterior sin perder nada de él.`,
        `Sesión activa: curso ${e.a.curso}, tema ${e.a.tema}, log ${e.a.log}.`,
        INSTRUCCIONES,
        customInstructions && `Además: ${customInstructions}`,
      ].filter(Boolean).join("\n\n");
      const r = await ctx.modelRegistry.streamSimple(modelo, { systemPrompt: SISTEMA, messages: [{ role: "user", content: [{ type: "text", text: pedido }], timestamp: Date.now() }] },
        { signal, ...(modelo.reasoning && ctx.thinkingLevel && ctx.thinkingLevel !== "off" ? { reasoning: ctx.thinkingLevel } : {}) }).result();
      const summary = r.content.flatMap(c => c.type === "text" ? [c.text] : []).join("\n").trim();
      if (r.stopReason !== "stop" || !summary) return;
      return { compaction: { summary, firstKeptEntryId: p.firstKeptEntryId, tokensBefore: p.tokensBefore, usage: r.usage } };
    } catch { return; }
  });
}
