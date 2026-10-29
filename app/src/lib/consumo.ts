// Textos del medidor de consumo (DA48), aparte para probarlos sin la interfaz. Cada cuenta en su unidad: dólares, %
// de una ventana, pedidos del día o, en los modelos gratis, pedidos y tokens usados.
import type { CuentaConsumo, ModeloConsumo } from "../renderer/src/tipos";

const num = (n: number, decimales = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
export const dinero = (n: number) => num(n, n >= 1000 ? 0 : 2);
// Las estimaciones se redondean: «≈ 10.600», no «≈ 10.602».
export function aproximado(n: number) {
  const r = n < 100 ? Math.floor(n) : n < 1000 ? Math.floor(n / 10) * 10 : Math.floor(n / 100) * 100;
  return num(r);
}
export const pedidosTexto = (n: number) => n === 1 ? "1 pedido" : `${num(n)} pedidos`;
// «950», «126 mil», «1 millón», «1,5 millones»: para la tabla; tokensTexto le agrega «de tokens» o «tokens».
export function tokensCorto(n: number) {
  if (n < 1000) return num(n);
  if (n < 1e6) return `${num(Math.round(n / 1000))} mil`;
  const millones = Math.round(n / 1e5) / 10;
  return millones === 1 ? "1 millón" : `${num(millones, Number.isInteger(millones) ? 0 : 1)} millones`;
}
export const tokensTexto = (n: number) => `${tokensCorto(n)} ${n >= 1e6 ? "de tokens" : "tokens"}`;
export function nombreVentana(minutos?: number) {
  if (!minutos) return "la ventana";
  if (minutos === 10080) return "la semana";
  if (minutos === 1440) return "el día";
  if (minutos % 60 === 0) return `${minutos / 60} horas`;
  return `${minutos} minutos`;
}
export function cuando(ms: number, ahora = Date.now()) {
  const d = new Date(ms), hoy = new Date(ahora);
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (d.toDateString() === hoy.toDateString()) return `a las ${hora}`;
  const manana = new Date(ahora + 86400000);
  if (d.toDateString() === manana.toDateString()) return `mañana a las ${hora}`;
  return `el ${d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;
}

export type TextoCuenta = { principal: string; secundario?: string; libre?: number; nivel: "ok" | "aviso" | "mal" };
const nivel = (libre?: number): TextoCuenta["nivel"] => libre === undefined ? "ok" : libre < 0.1 ? "mal" : libre < 0.25 ? "aviso" : "ok";

// Lo que queda en una cuenta, en su propia unidad: dólares, % de una ventana o pedidos del día.
export function textoCuenta(c: CuentaConsumo, ahora = Date.now()): TextoCuenta {
  if (c.agotado) return { principal: "Sin cupo por ahora", secundario: c.agotado.hasta ? `vuelve ${cuando(c.agotado.hasta, ahora)}` : "el proveedor cortó por cupo", libre: 0, nivel: "mal" };
  if (c.tipo === "dinero" && c.queda !== undefined) {
    const moneda = c.moneda ?? "USD";
    const libre = c.limite ? Math.max(0, Math.min(1, c.queda / c.limite)) : undefined;
    return { principal: c.limite ? `${dinero(c.queda)} de ${dinero(c.limite)} ${moneda}` : `Te quedan ${dinero(c.queda)} ${moneda}`,
      secundario: c.renueva && c.fuente === "tu plan" && c.plan?.tipo === "mensual" ? `se renueva ${cuando(c.renueva, ahora)}` : c.fuente === "el proveedor" ? "según el proveedor" : undefined,
      libre, nivel: nivel(libre) };
  }
  if (c.tipo === "ventanas" && c.ventanas?.length) {
    const [corta, larga] = c.ventanas;
    const libre = Math.min(...c.ventanas.map(v => (100 - v.usado) / 100));
    const partes = [corta.renueva ? `se renueva ${cuando(corta.renueva, ahora)}` : undefined, larga ? `${nombreVentana(larga.minutos)}: ${num(100 - larga.usado)} % libre` : undefined].filter(Boolean);
    return { principal: `${num(100 - corta.usado)} % libre de ${nombreVentana(corta.minutos)}`, secundario: partes.join(" · ") || undefined, libre, nivel: nivel(libre) };
  }
  if (c.tipo === "pedidos" && c.pedidos) {
    const p = c.pedidos, gratis = p.gratis ? " gratis" : "";
    if (p.quedan === undefined) return { principal: `Hoy: ${num(p.usados ?? 0)} pedidos`, secundario: "Poné el límite diario de tu plan para ver cuántos quedan", nivel: "ok" };
    const libre = p.limite ? p.quedan / p.limite : undefined;
    return { principal: p.limite ? `Quedan ${num(p.quedan)} de ${num(p.limite)} pedidos${gratis} hoy` : `Quedan ${num(p.quedan)} pedidos${gratis} hoy`,
      secundario: p.renueva ? `se renueva ${cuando(p.renueva, ahora)}` : undefined, libre, nivel: nivel(libre) };
  }
  if (c.tipo === "local") return { principal: "Modelo local, sin límite", nivel: "ok" };
  if (c.tipo === "sin-dato") return { principal: "El cupo aparece después de la primera respuesta", nivel: "ok" };
  // Sin dólares que contar: lo que se usó hoy, en pedidos y tokens.
  const hoy = `Hoy: ${pedidosTexto(c.uso.hoy.pedidos)} · ${tokensTexto(c.uso.hoy.tokens)}`;
  if (c.tipo === "gratis") return { principal: hoy, secundario: "el límite diario lo pone el proveedor", nivel: "ok" };
  if (c.tipo === "suscripcion") return { principal: hoy, secundario: "el cupo de tu plan está en la página del proveedor", nivel: "ok" };
  return { principal: `Este período: ${dinero(c.gastado)} USD`, secundario: "Configurá tu plan para ver cuánto queda", nivel: "ok" };
}

// Cuánto rinde un modelo: las consultas que quedan si se sabe, si no cuántas entran en un dólar.
export function textoRinde(m: ModeloConsumo) {
  if (m.agotado) return "sin cupo por ahora";
  if (m.quedan !== undefined) return `≈ ${aproximado(m.quedan)} ${m.quedan === 1 ? "consulta" : "consultas"}`;
  if (m.gratis) return "sin costo";
  if (m.porDolar !== undefined) return `≈ ${aproximado(m.porDolar)} por USD`;
  return "sin precio conocido";
}
