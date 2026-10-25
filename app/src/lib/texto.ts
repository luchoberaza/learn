// Utilidades de texto de la interfaz, sin dependencias: enlaces de Obsidian, el plan del tema, fechas y estados en
// palabras. Puras, para probarlas con node --test.

// ---------- Enlaces [[…]] ----------

export type Enlace =
  | { tipo: "cita"; destino: string; curso: string; archivo: string; pagina: number; alias?: string }
  | { tipo: "imagen"; destino: string; alias?: string }
  | { tipo: "pdf"; destino: string; pagina?: number; alias?: string }
  | { tipo: "nota"; destino: string; alias?: string };

// El contenido de un enlace de Obsidian, sin los corchetes: «cursos/redes/fuentes/bibliografia/kurose.pdf#page=54|Kurose».
export function analizarEnlace(contenido: string): Enlace {
  const [destino, ...resto] = contenido.split("|");
  const alias = resto.join("|").trim() || undefined;
  const limpio = destino.trim();
  const cita = /^cursos\/([a-z0-9-]+)\/(fuentes\/.+\.pdf)#page=(\d+)$/i.exec(limpio);
  if (cita) return { tipo: "cita", destino: limpio, curso: cita[1], archivo: cita[2], pagina: Number(cita[3]), alias };
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(limpio)) return { tipo: "imagen", destino: limpio, alias };
  const pdf = /^(.+\.pdf)(?:#page=(\d+))?$/i.exec(limpio);
  if (pdf) return { tipo: "pdf", destino: pdf[1], pagina: pdf[2] ? Number(pdf[2]) : undefined, alias };
  return { tipo: "nota", destino: limpio, alias };
}

// «kurose-ross-7.pdf» → «kurose ross 7», para nombrar una cita cuando el curso no dio el título.
export const nombreDeArchivo = (ruta: string) => (ruta.split("/").pop() ?? ruta).replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();

// ---------- Plan del tema ----------

// El plan se guarda como texto libre («los nodos en orden, con cita corta»): una lista numerada, renglones o flechas.
export function nodosDelPlan(plan: string | undefined): string[] {
  if (!plan?.trim()) return [];
  const renglones = plan.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const partes = renglones.length > 1 ? renglones : plan.split(/\s*(?:→|->|;|\s\d+[.)]\s)\s*/);
  return partes.map(p => p.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(p => p && !/^plan:?$/i.test(p));
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Sólo el nombre del nodo, sin la cita corta entre paréntesis ni lo que sigue a dos puntos o raya.
export const nombreNodo = (nodo: string) => nodo.replace(/\s*[([].*$/, "").replace(/\s+[—–:]\s.*$/, "").trim() || nodo;

// Cada nodo hecho si lo nombra lo que el alumno ya domina; el actual es el primero sin hacer.
export function marcarPlan(nodos: string[], dominados: string[]): { nombre: string; estado: "hecho" | "actual" | "pendiente" }[] {
  const firmes = dominados.map(normalizar).filter(Boolean);
  let actual = false;
  return nodos.map(n => {
    const clave = normalizar(nombreNodo(n));
    const hecho = !!clave && firmes.some(f => f.includes(clave) || (clave.length > 5 && clave.includes(f)));
    if (hecho) return { nombre: nombreNodo(n), estado: "hecho" as const };
    if (!actual) { actual = true; return { nombre: nombreNodo(n), estado: "actual" as const }; }
    return { nombre: nombreNodo(n), estado: "pendiente" as const };
  });
}

// ---------- Fechas ----------

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fechaLarga = (d: Date) => mayuscula(`${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`);

const momento = (d: Date) => { const h = d.getHours(); return h < 6 ? "de madrugada" : h < 13 ? "a la mañana" : h < 20 ? "a la tarde" : "a la noche"; };
const diasEntre = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000);

// «hace 5 minutos», «hoy a la tarde», «ayer a la noche», «el martes», «el 3 de octubre».
export function cuando(fecha: Date, ahora: Date) {
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60000), dias = diasEntre(fecha, ahora);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos === 1 ? "un minuto" : `${minutos} minutos`}`;
  if (dias === 0) return `hoy ${momento(fecha)}`;
  if (dias === 1) return `ayer ${momento(fecha)}`;
  if (dias < 7) return `el ${DIAS[fecha.getDay()]}`;
  return `el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}${fecha.getFullYear() !== ahora.getFullYear() ? ` de ${fecha.getFullYear()}` : ""}`;
}

// ---------- Cursos ----------

export const ES_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// «Redes de Computadoras 2026» → «redes-de-computadoras-2026».
export const slugDe = (nombre: string) => normalizar(nombre).replace(/\s+/g, "-").slice(0, 40).replace(/-+$/, "");

export type EstadoTema = "sin_empezar" | "en_curso" | "dominado" | "repasar";
export const ESTADOS: Record<EstadoTema, string> = { sin_empezar: "sin empezar", en_curso: "en curso", dominado: "dominado", repasar: "para repasar" };

// Lo que dice el índice al lado de cada tema (Inicio y curso), como en la maqueta aprobada.
export function estadoEnIndice(t: { id: string; estado: string; prerequisitosFaltan: string[] }, sugerido: string | undefined, nombres: Record<string, string>) {
  if (t.estado === "dominado") return { texto: "dominado", clase: "ok" };
  if (t.estado === "repasar") return { texto: "para repasar", clase: "rep" };
  if (t.estado === "en_curso") return { texto: t.id === sugerido ? "en curso, te conviene seguir acá" : "en curso", clase: t.id === sugerido ? "go" : "" };
  if (t.id === sugerido) return { texto: "te conviene seguir acá", clase: "go" };
  if (t.prerequisitosFaltan.length) return { texto: `después de ${t.prerequisitosFaltan.map(id => nombreCorto(nombres[id] ?? id)).join(" y ")}`, clase: "" };
  return { texto: "sin empezar", clase: "" };
}
// «Capa de transporte» → «Transporte»; un nombre corto para «después de…».
export const nombreCorto = (nombre: string) => mayuscula(nombre.replace(/^(capa|unidad|tema)\s+de(l| la| los| las)?\s+/i, "").trim());

// «12 de 40 páginas» en un texto de estado → fracción, para la barrita de avance.
export function fraccion(texto: string | undefined): number | undefined {
  const m = texto ? /(\d+)\s*(?:\/|de)\s*(\d+)/.exec(texto) : null;
  if (!m || !Number(m[2])) return undefined;
  return Math.min(1, Number(m[1]) / Number(m[2]));
}

// Quita los emojis de adelante que pi usa en la terminal («📚 redes › Retardos»).
export const sinEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}️\s]+/u, "").trim();
