import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// Sin pi-tui (los tests importan las extensiones con Node, sin los alias de pi): desde U+1100 cuenta doble, así ninguna línea pasa el ancho.
const ancho = (s: string) => [...s].reduce((n, c) => n + (c.codePointAt(0)! < 0x1100 ? 1 : 2), 0);
function partir(texto: string, max: number) {
  const lineas: string[] = [];
  for (const parrafo of texto.replace(/\t/g, "   ").split("\n")) {
    let resto = [...parrafo];
    do {
      let i = 0, n = 0;
      while (i < resto.length && n + ancho(resto[i]) <= max) n += ancho(resto[i++]);
      const espacio = i < resto.length ? resto.lastIndexOf(" ", i) : -1;
      if (espacio > 0) i = espacio + 1;
      i = Math.max(i, 1);
      lineas.push(resto.slice(0, i).join("").trimEnd());
      resto = resto.slice(i);
    } while (resto.length);
  }
  return lineas;
}

// pi 1.4.0 dibuja la ayuda de ui.select en inglés, sin forma de cambiarla (extension-selector.js:42-46): en la terminal va el mismo selector con la ayuda en español.
export function elegir(ctx: Pick<ExtensionContext, "mode" | "ui">, titulo: string, opciones: string[], opts?: { signal?: AbortSignal }): Promise<string | undefined> {
  if (ctx.mode !== "tui") return ctx.ui.select(titulo, opciones, opts);
  return ctx.ui.custom<string | undefined>((tui, theme, kb, done) => {
    const cortar = () => done(undefined);
    if (opts?.signal?.aborted) cortar();
    else opts?.signal?.addEventListener("abort", cortar, { once: true });
    let elegida = 0;
    return {
      render(columnas: number) {
        const lineas: string[] = [], borde = theme.fg("border", "─".repeat(Math.max(1, columnas))), max = Math.max(1, columnas - 2);
        const texto = (t: string, estilo: (s: string) => string) => { for (const l of partir(t, max)) lineas.push(` ${estilo(l)}`); };
        lineas.push(borde, "");
        texto(titulo, s => theme.fg("accent", theme.bold(s)));
        lineas.push("");
        opciones.forEach((o, i) => texto(i === elegida ? `→ ${o}` : `  ${o}`, s => theme.fg(i === elegida ? "accent" : "text", s)));
        lineas.push("");
        const ayuda = [["↑↓", "moverse"], [kb.getKeys("tui.select.confirm").join("/"), "elegir"], [kb.getKeys("tui.select.cancel").join("/"), "cancelar"]];
        const plana = ayuda.map(p => p.join(" ")).join("  ");
        if (ancho(plana) <= max) lineas.push(` ${ayuda.map(([teclas, accion]) => theme.fg("dim", teclas) + theme.fg("muted", ` ${accion}`)).join("  ")}`);
        else texto(plana, s => theme.fg("muted", s));
        lineas.push("", borde);
        return lineas;
      },
      invalidate() {},
      handleInput(tecla: string) {
        if (kb.matches(tecla, "app.tools.expand")) ctx.ui.setToolsExpanded(!ctx.ui.getToolsExpanded());
        else if (kb.matches(tecla, "tui.select.up") || tecla === "k") elegida = Math.max(0, elegida - 1);
        else if (kb.matches(tecla, "tui.select.down") || tecla === "j") elegida = Math.min(opciones.length - 1, elegida + 1);
        else if (kb.matches(tecla, "tui.select.confirm") || tecla === "\n") { if (opciones[elegida] !== undefined) done(opciones[elegida]); return; }
        else if (kb.matches(tecla, "tui.select.cancel")) return done(undefined);
        tui.requestRender();
      },
      dispose: () => opts?.signal?.removeEventListener("abort", cortar),
    };
  });
}
