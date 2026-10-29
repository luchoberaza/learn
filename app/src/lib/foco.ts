// Temporizador de concentración (§11 del diseño): bloques de foco y descansos, sin interrumpir la clase.
// Lógica pura con el tiempo inyectado, para probarla sin relojes. La interfaz llama a tic() una vez por segundo con
// lo que pasa en la clase (pregunta abierta, simulacro) y reacciona a los eventos.
// Reglas:
// - al terminar un bloque con una pregunta abierta, el aviso de descanso espera a que se responda;
// - durante el simulacro el foco se pausa solo y vuelve a correr cuando termina;
// - el aviso nunca bloquea la caja de texto: el descanso empieza cuando el alumno lo pide.

export type Fase = "foco" | "descanso" | "descansoLargo";
export interface AjustesFoco { activo: boolean; foco: number; descanso: number; descansoLargo: number; ciclos: number; sonido: boolean }
export interface Reloj {
  fase: Fase;
  // esperando: la fase anterior terminó y la siguiente arranca cuando el alumno quiera.
  estado: "detenido" | "corriendo" | "pausado" | "esperando";
  restanteMs: number;
  hasta?: number;
  // Desde cuándo corre el tramo actual de foco (para sumar los minutos estudiados).
  desde?: number;
  bloques: number;
  pausaSimulacro: boolean;
  avisoDiferido: boolean;
}
export type EventoFoco =
  | { tipo: "sumar"; minutos: number; bloque: boolean }
  | { tipo: "aviso"; clase: "fin-foco" | "fin-descanso"; siguiente: Fase };
export interface Contexto { preguntaAbierta: boolean; simulacro: boolean }

const MINUTO = 60000;
export const duracion = (fase: Fase, a: AjustesFoco) => (fase === "foco" ? a.foco : fase === "descanso" ? a.descanso : a.descansoLargo) * MINUTO;

export function nuevo(a: AjustesFoco): Reloj {
  return { fase: "foco", estado: "detenido", restanteMs: duracion("foco", a), bloques: 0, pausaSimulacro: false, avisoDiferido: false };
}

export function restante(r: Reloj, ahora: number) {
  return r.estado === "corriendo" && r.hasta !== undefined ? Math.max(0, r.hasta - ahora) : r.restanteMs;
}

// Fracción hecha de la fase, para la línea fina bajo la barra de la clase.
export function avance(r: Reloj, a: AjustesFoco, ahora: number) {
  const total = duracion(r.fase, a);
  return total ? Math.min(1, Math.max(0, 1 - restante(r, ahora) / total)) : 0;
}

// Minutos de foco del tramo que corre, redondeados a décimas.
function tramo(r: Reloj, ahora: number): EventoFoco[] {
  if (r.fase !== "foco" || r.estado !== "corriendo" || r.desde === undefined) return [];
  const minutos = Math.round(((Math.min(ahora, r.hasta ?? ahora) - r.desde) / MINUTO) * 10) / 10;
  return minutos > 0 ? [{ tipo: "sumar", minutos, bloque: false }] : [];
}

export function iniciar(r: Reloj, ahora: number): Reloj {
  if (r.estado === "corriendo") return r;
  return { ...r, estado: "corriendo", hasta: ahora + r.restanteMs, desde: r.fase === "foco" ? ahora : undefined, pausaSimulacro: false, avisoDiferido: false };
}

export function pausar(r: Reloj, ahora: number, porSimulacro = false): { reloj: Reloj; eventos: EventoFoco[] } {
  if (r.estado !== "corriendo") return { reloj: r, eventos: [] };
  return { reloj: { ...r, estado: "pausado", restanteMs: restante(r, ahora), hasta: undefined, desde: undefined, pausaSimulacro: porSimulacro }, eventos: tramo(r, ahora) };
}

// Pasa a la fase siguiente sin esperar el final: en foco, cuenta lo estudiado pero no como bloque completo.
export function saltar(r: Reloj, a: AjustesFoco, ahora: number): { reloj: Reloj; eventos: EventoFoco[] } {
  const eventos = tramo(r, ahora);
  const siguiente: Fase = r.fase === "foco" ? ((r.bloques + 1) % Math.max(1, a.ciclos) === 0 ? "descansoLargo" : "descanso") : "foco";
  return { reloj: { ...r, fase: siguiente, estado: "esperando", restanteMs: duracion(siguiente, a), hasta: undefined, desde: undefined, pausaSimulacro: false, avisoDiferido: false }, eventos };
}

export function detener(r: Reloj, a: AjustesFoco, ahora: number): { reloj: Reloj; eventos: EventoFoco[] } {
  return { reloj: nuevo(a), eventos: tramo(r, ahora) };
}

export function tic(r: Reloj, a: AjustesFoco, ahora: number, ctx: Contexto): { reloj: Reloj; eventos: EventoFoco[] } {
  const eventos: EventoFoco[] = [];
  // El simulacro manda: el foco se pausa y vuelve solo si lo pausó él.
  if (ctx.simulacro && r.estado === "corriendo") return pausar(r, ahora, true);
  if (!ctx.simulacro && r.estado === "pausado" && r.pausaSimulacro) r = iniciar(r, ahora);
  if (r.estado === "corriendo" && restante(r, ahora) <= 0) {
    if (r.fase === "foco") {
      const bloques = r.bloques + 1, siguiente: Fase = bloques % Math.max(1, a.ciclos) === 0 ? "descansoLargo" : "descanso";
      eventos.push({ tipo: "sumar", minutos: Math.round(((r.hasta! - (r.desde ?? r.hasta! - duracion("foco", a))) / MINUTO) * 10) / 10, bloque: true });
      r = { ...r, fase: siguiente, estado: "esperando", restanteMs: duracion(siguiente, a), hasta: undefined, desde: undefined, bloques, avisoDiferido: ctx.preguntaAbierta };
      if (!ctx.preguntaAbierta) eventos.push({ tipo: "aviso", clase: "fin-foco", siguiente });
    } else {
      r = { ...r, fase: "foco", estado: "esperando", restanteMs: duracion("foco", a), hasta: undefined, desde: undefined };
      eventos.push({ tipo: "aviso", clase: "fin-descanso", siguiente: "foco" });
    }
    return { reloj: r, eventos };
  }
  if (r.avisoDiferido && !ctx.preguntaAbierta) {
    r = { ...r, avisoDiferido: false };
    eventos.push({ tipo: "aviso", clase: "fin-foco", siguiente: r.fase });
  }
  return { reloj: r, eventos };
}

// Un cambio de ajustes con el reloj quieto vuelve a medir la fase con la duración nueva.
export function conAjustes(r: Reloj, a: AjustesFoco): Reloj {
  return r.estado === "detenido" || r.estado === "esperando" ? { ...r, restanteMs: duracion(r.fase, a) } : r;
}

export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ---------- Historial: minutos por día (fecha local AAAA-MM-DD) ----------

export type Historial = Record<string, { minutos: number; bloques: number }>;
export const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const restarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12);

// Días seguidos con foco hasta hoy; si hoy todavía no hubo, la racha que viene de ayer sigue viva.
export function racha(h: Historial, hoy: Date) {
  let n = 0, i = (h[dia(hoy)]?.minutos ?? 0) > 0 ? 0 : 1;
  while ((h[dia(restarDias(hoy, i))]?.minutos ?? 0) > 0) { n++; i++; }
  return n;
}

const INICIALES = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
export function semana(h: Historial, hoy: Date) {
  return Array.from({ length: 7 }, (_, k) => {
    const d = restarDias(hoy, 6 - k);
    return { dia: dia(d), etiqueta: INICIALES[d.getDay()], minutos: h[dia(d)]?.minutos ?? 0, hoy: k === 6 };
  });
}

const NUMEROS = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince",
  "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"];
export const enPalabras = (n: number, femenino = false) => n === 1 ? (femenino ? "una" : "un") : n <= 20 ? NUMEROS[n] : String(n);

// 75 → «una hora y cuarto»; 30 → «media hora»; 20 → «veinte minutos».
export function duracionEnPalabras(minutos: number) {
  const m = Math.round(minutos / 5) * 5;
  if (minutos > 0 && m === 0) return "menos de cinco minutos";
  const h = Math.floor(m / 60), r = m % 60;
  const horas = h === 1 ? "una hora" : `${enPalabras(h, true)} horas`;
  if (!h) return r === 30 ? "media hora" : `${enPalabras(r)} minutos`;
  if (!r) return horas;
  if (r === 15) return `${horas} y cuarto`;
  if (r === 30) return `${horas} y media`;
  return `${horas} y ${enPalabras(r)} minutos`;
}

// La frase de «Tu semana» en Inicio.
export function fraseSemana(h: Historial, hoy: Date) {
  const d = h[dia(hoy)], n = racha(h, hoy);
  const partes: string[] = [];
  if (d && d.minutos > 0) {
    partes.push(`Hoy estudiaste ${duracionEnPalabras(d.minutos)}${d.bloques ? ` en ${d.bloques === 1 ? "un bloque" : `${enPalabras(d.bloques)} bloques`} de foco` : ""}.`);
    if (n > 1) partes.push(`Llevás ${enPalabras(n)} días seguidos.`);
  } else {
    partes.push("Hoy todavía no empezaste un bloque de foco.");
    if (n > 0) partes.push(n === 1 ? "Ayer estudiaste: si hoy hacés un bloque, sumás dos días seguidos." : `Venís de ${enPalabras(n)} días seguidos.`);
  }
  return partes.join(" ");
}
