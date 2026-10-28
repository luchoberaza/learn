// Escala de la interfaz (DA55) y anchos de los paneles (DA54): los usan el proceso principal y la interfaz.

// Los mismos pasos que un navegador: Ctrl + y Ctrl − van de uno al siguiente.
export const ESCALAS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

// Una escala guardada fuera de la lista (escrita a mano o de otra versión) se lleva a la más cercana.
export function escalaValida(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 1;
  return ESCALAS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
}

// paso 0 vuelve al 100 %; en los extremos se queda donde está.
export function pasoEscala(actual: number, paso: 1 | -1 | 0): number {
  if (paso === 0) return 1;
  const i = ESCALAS.indexOf(escalaValida(actual));
  return ESCALAS[Math.min(Math.max(i + paso, 0), ESCALAS.length - 1)];
}

// La barra lateral y el panel de página se arrastran entre estos anchos (en px de la interfaz). El panel, además, nunca
// pasa del 60 % de la ventana ni deja la pantalla con menos de 360 px.
export const LATERAL = { normal: 256, min: 200, max: 420, plegada: 44 };
export const PANEL = { min: 300, maxFraccion: 0.6, pantallaMin: 360 };

export const anchoLateral = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(Math.max(v, LATERAL.min), LATERAL.max)) : LATERAL.normal;

// El ancho del panel para una ventana de cierto ancho y una barra lateral de cierto ancho.
export function anchoPanel(v: number, ventana: number, lateral: number): number {
  const max = Math.max(PANEL.min, Math.min(ventana * PANEL.maxFraccion, ventana - lateral - PANEL.pantallaMin));
  return Math.round(Math.min(Math.max(v, PANEL.min), max));
}
