import type { ToolRendererResolver } from "@earendil-works/pi-coding-agent";
import { Container, Text, TruncatedText } from "@earendil-works/pi-tui";
import { etiquetaLlamada, etiquetaResultado, texto, TOOLS_DEL_CURSO } from "./etiquetas.ts";

// Una línea por llamada: mientras corre, la de la llamada; con el resultado final, sólo la del resultado.
// Las líneas salen de etiquetas.ts, que comparte la app de escritorio.
// Si un renderer lanza, pi muestra los args crudos o las primeras líneas del resultado: nunca lanzan.
export const renderizar: ToolRendererResolver = (nombre, next) => {
  const base = next();
  if (!TOOLS_DEL_CURSO.has(nombre) || base?.renderCall || base?.renderResult) return base;
  return {
    renderShell: "self",
    renderCall(args, theme, ctx) {
      try {
        if (!ctx.isPartial) return new Container();
        // Con los args a medio llegar (streaming) sólo la etiqueta genérica.
        const linea = etiquetaLlamada(nombre, ctx.argsComplete && args ? args : {});
        return linea === undefined ? new Container() : new TruncatedText(theme.fg("muted", linea), ctx.outputPad, 0);
      } catch { return new Container(); }
    },
    renderResult(result, { isPartial }, theme, ctx) {
      try {
        // guardar_curso pide confirmar el diff que manda como parcial: es lo único que se muestra entero.
        if (isPartial) return nombre === "guardar_curso" ? new Text(theme.fg("toolOutput", texto(result)), ctx.outputPad, 0)
          : nombre === "transcribir_paginas" ? new TruncatedText(theme.fg("muted", texto(result)), ctx.outputPad, 0) : new Container();
        const linea = etiquetaResultado(nombre, ctx.args ?? {}, result, !!ctx.isError);
        if (linea === undefined) return new Container();
        return new TruncatedText(ctx.isError ? theme.fg("warning", linea) : theme.fg("muted", linea), ctx.outputPad, 0);
      } catch { return new Container(); }
    },
  };
};
