// Mermaid se carga recién cuando aparece el primer diagrama (es pesado) y toma los colores del tema activo.
let cargado: Promise<typeof import("mermaid").default> | undefined;
let temaAplicado = "";
let contador = 0;

const variable = (nombre: string) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

async function mermaid() {
  cargado ??= import("mermaid").then(m => m.default);
  const m = await cargado;
  const tema = [variable("--bg"), variable("--text"), variable("--accent")].join();
  if (tema !== temaAplicado) {
    temaAplicado = tema;
    m.initialize({
      startOnLoad: false, securityLevel: "strict", theme: "base",
      fontFamily: getComputedStyle(document.body).fontFamily,
      themeVariables: {
        background: variable("--bg"), primaryColor: variable("--raised"), primaryTextColor: variable("--strong"), primaryBorderColor: variable("--accent"),
        lineColor: variable("--muted"), secondaryColor: variable("--side"), tertiaryColor: variable("--bg"), textColor: variable("--text"),
        mainBkg: variable("--raised"), nodeBorder: variable("--accent"), clusterBkg: variable("--side"), edgeLabelBackground: variable("--bg"), fontSize: "15px",
      },
    });
  }
  return m;
}

export async function dibujar(codigo: string): Promise<string> {
  const m = await mermaid();
  const { svg } = await m.render(`diagrama-${++contador}`, codigo);
  return svg;
}
