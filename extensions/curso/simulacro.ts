import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { reservas, type Activo, type DatosCurso, type Ref } from "./material.ts";
import { ordenar, type registrarSesion } from "./sesion.ts";

type Simulacro = Ref & { log: string; tema: string };
type Sesion = { a: Activo; d: DatosCurso };

const pedido = (ctx: Pick<ExtensionContext, "sessionManager">) => {
  const s = ctx.sessionManager.getBranch().findLast(x => x.type === "custom" && x.customType === "curso-simulacro");
  return s?.type === "custom" ? s.data as Simulacro | null : undefined;
};
// El simulacro en curso: el último pedido de la rama (sobrevive /compact, /resume y un kill), del log activo y sin rendir.
// /fin y el cambio de tema lo cierran porque cambian o cierran el log.
export function enCurso(ctx: Pick<ExtensionContext, "sessionManager">, e?: Sesion): Simulacro | undefined {
  const s = pedido(ctx), reservado = s && e?.d.progreso.temas[s.tema]?.reservado;
  if (!s || s.log !== e?.a.log || (Array.isArray(reservado) && reservado.some(r => r?.doc === s.doc && r?.id === s.id && r?.usado))) return;
  return s;
}
// Tiempo proporcional del examen real según curso.md: «2 horas» y «5 preguntas» → 24 min por pregunta.
export function tiempo(contrato: string) {
  const t = contrato.match(/(\d+(?:[.,]\d+)?)\s*(horas?|minutos)\b/i), n = contrato.match(/(\d+)\s+preguntas\b/i);
  if (!t || !n || !Number(n[1])) return;
  return { minutos: Math.round(Number(t[1].replace(",", ".")) * (/^h/i.test(t[2]) ? 60 : 1) / Number(n[1])), examen: `${t[1]} ${t[2]} para ${n[1]} preguntas` };
}

export function registrarSimulacro(pi: ExtensionAPI, sesion: Pick<ReturnType<typeof registrarSesion>, "actual">) {
  const nombre = (e: Sesion) => e.d.temas.find(t => t.id === e.a.tema)?.nombre || e.a.tema;
  const barra = (ctx: ExtensionContext) => { const e = sesion.actual(); if (e && enCurso(ctx, e)) ctx.ui.setStatus("curso", `📝 Simulacro · ${nombre(e)}`); };
  pi.on("session_start", (_event, ctx) => barra(ctx));
  pi.on("session_tree", (_event, ctx) => barra(ctx));
  pi.registerCommand("simulacro", {
    description: "Rendir el ítem de evaluación reservado del tema como en el examen: enunciado tal cual, tiempo oficial, sin pistas y corrección al final",
    async handler(_args, ctx) {
      const e = sesion.actual();
      if (!e) { ctx.ui.notify("Empezá con /estudiar <tema> y después /simulacro.", "info"); return; }
      if (enCurso(ctx, e)) { ctx.ui.notify(`Ya estás en el simulacro de «${nombre(e)}»: entregá tu resolución o terminá con /fin.`, "info"); return; }
      const x = e.a.adHoc ? undefined : reservas(e.r, e.d)[e.a.tema], item = x && e.d.items[x.doc]?.find(i => i.id === x.id);
      if (!x || !item) { ctx.ui.notify(`«${nombre(e)}» no tiene un ítem de evaluación reservado para simulacro: faltan parciales de este tema en el material.`, "info"); return; }
      // Como /fin: pi ya vació el editor, así que se corta el turno en curso (p. ej. un quiz abierto) en vez de perder el comando.
      if (!ctx.isIdle()) { ctx.abort(); await ctx.waitForIdle(); }
      pi.appendEntry("curso-simulacro", { log: e.a.log, tema: e.a.tema, doc: x.doc, id: x.id });
      ctx.ui.setStatus("curso", `📝 Simulacro · ${nombre(e)}`);
      const t = tiempo(e.d.contrato), puntos = typeof item.puntos === "number" ? `${item.puntos} puntos` : item.puntos;
      ordenar(pi, `Simulacro de «${nombre(e)}». Presentá ahora, tal cual, este ítem de evaluación reservado${puntos ? ` con su puntaje oficial (${puntos})` : ""}, ${t ? `con el tiempo proporcional del examen real: ~${t.minutos} min (${t.examen})` : "sin tiempo: curso.md no fija la duración del examen"}, y pedí la resolución en texto o foto. Hasta la entrega no des pistas ni correcciones ni confirmes resultados parciales; si pregunta algo, respondé sólo lo que dice el enunciado. Cuando entregue: pedí la solución oficial con leer_items e incluir_solucion:true, corregí contra ella como en la práctica tipo evaluación, mapeá cada error a un nodo del tema, dá un veredicto honesto, llamá registrar_progreso con el intento (doc ${x.doc}, item ${x.id}, resultado y puntaje) y proponé un plan de repaso ordenado por peso en el examen.\n\nÍtem ${x.doc}/${x.id}:\n${item.enunciado}`);
    },
  });
  // Las reglas siguen en el prompt aunque /compact resuma la orden.
  pi.on("before_agent_start", (event, ctx) => {
    const s = enCurso(ctx, sesion.actual());
    if (s) event.systemPromptOptions.sections.simulacro = `Simulacro en curso del ítem reservado ${s.doc}/${s.id}: hasta que el estudiante entregue su resolución no des pistas, correcciones ni resultados parciales. Al entregar, corregí contra la solución oficial (leer_items con incluir_solucion:true) y registrá el intento con registrar_progreso.`;
    else delete event.systemPromptOptions.sections.simulacro;
  });
  // registrar_progreso marca usado el reservado (progreso.py): ahí termina el simulacro.
  pi.on("tool_execution_end", (event, ctx) => {
    const e = sesion.actual(), s = pedido(ctx);
    if (event.toolName !== "registrar_progreso" || !e || !s || s.log !== e.a.log || enCurso(ctx, e)) return;
    pi.appendEntry("curso-simulacro", null);
    ctx.ui.setStatus("curso", `📚 ${e.a.curso} › ${nombre(e)}`);
  });
}
