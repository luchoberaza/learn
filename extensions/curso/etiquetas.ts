// La línea en español con la que se ve cada tool del curso, sin argumentos ni texto del resultado (DA18).
// Sin pi-tui: la usan render.ts (terminal) y la app de escritorio, así las dos muestran lo mismo.
// Una tool nueva del curso necesita su fila acá.

export type Resultado = { content?: { type: string; text?: string }[]; details?: any };
type Fila = { llamada: (a: any) => string; hecho: (a: any, r: Resultado) => string; fallo: (r: Resultado) => string };

export const texto = (r: Resultado) => r.content?.find(c => c.type === "text")?.text ?? "";
const de = (a: any) => typeof a.doc === "string" && a.doc ? ` de ${a.doc}` : "";
const rango = (a: any) => Number.isInteger(a.desde) && Number.isInteger(a.hasta) ? ` PDF ${a.desde === a.hasta ? a.desde : `${a.desde}–${a.hasta}`}` : " el material";
const pagina = (a: any) => Number.isInteger(a.pagina) ? `: PDF ${a.pagina}${de(a)}` : "";
const cuantos = (lista: unknown, uno: string, varios: string) => Array.isArray(lista) ? `${lista.length} ${lista.length === 1 ? uno : varios}` : varios;
// Los errores propios ya son una línea en español; los de pi y Node (validación con los args crudos, aborto, traza de Python) no se muestran.
const motivo = (prefijo: string) => (r: Resultado) => {
  const t = texto(r).trim().split("\n")[0].replace(/^Progreso no guardado: /, "");
  if (!t || /^(Validation failed|Tool |Traceback)|aborted/.test(t)) return prefijo;
  return /^Disco lleno/.test(t) ? t : `${prefijo}: ${t}`;
};
const transcripcion = (r: Resultado) => {
  const d = r.details;
  return `${d.cancelada ? "Tanda cancelada: " : ""}${d.transcritas} transcritas, ${d.cache} en caché${d.fallidas?.length ? `, ${d.fallidas.length} fallidas` : ""}`;
};

// Nunca el texto de leer_paginas, leer_items ni buscar_material: una página del parcial trae soluciones de otras preguntas.
const filas: Record<string, Fila> = {
  leer_paginas: { llamada: a => `Leyendo${rango(a)}${de(a)}`, hecho: a => `Leí${rango(a)}${de(a)}`, fallo: () => "No se pudo leer el material" },
  leer_items: { llamada: a => `Leyendo ítems${de(a)}`, hecho: a => `Leí ${cuantos(a.ids, "ítem", "ítems")}${de(a)}`, fallo: () => "No se pudieron leer los ítems" },
  buscar_material: { llamada: () => "Buscando en el material…", hecho: () => "Busqué en el material", fallo: () => "No se pudo buscar en el material" },
  ver_pagina: { llamada: a => `Página original${pagina(a)}`, hecho: a => `Página original${pagina(a)}`, fallo: () => "Página original no disponible" },
  leer_sesion_anterior: { llamada: () => "Leyendo la sesión anterior", hecho: () => "Leí la sesión anterior", fallo: () => "No se pudo leer la sesión anterior" },
  registrar_progreso: { llamada: () => "Guardando progreso", hecho: (_a, r) => r.details?.sin_cambios ? "Progreso sin cambios" : "Progreso guardado", fallo: motivo("No se guardó el progreso") },
  investigar_tema: { llamada: () => "Verificación en segundo plano", fallo: () => "Verificación no disponible",
    hecho: (_a, r) => r.details?.cache ? "Caché de verificación" : r.details?.manual ? "Nota de verificación manual" : r.details?.pendiente ? "Verificación en curso"
      : texto(r).startsWith("Informe") ? "Verificación recibida" : "Verificación en segundo plano" },
  guardar_curso: { llamada: () => "Revisando los cambios del curso", fallo: motivo("No se guardó el curso"),
    hecho: (_a, r) => r.details?.cancelada ? "Cambios rechazados; el curso se preservó" : texto(r).startsWith("Sin cambios") ? "Curso sin cambios" : "Curso guardado" },
  transcribir_paginas: { llamada: a => `Transcribiendo ${cuantos(a.paginas, "página", "páginas")}${de(a)}`, hecho: (_a, r) => transcripcion(r),
    fallo: r => r.details?.fallidas ? transcripcion(r) : motivo("No se transcribió")(r) },
  guardar_items: { llamada: a => `Guardando ítems${de(a)}`, hecho: (a, r) => `Guardados ${r.details?.items ?? ""} ítems${de(a)}`, fallo: motivo("No se guardaron los ítems") },
};

export const TOOLS_DEL_CURSO = new Set(Object.keys(filas));

// Mientras corre: la etiqueta de la llamada (con los args a medio llegar, sólo la genérica). Nunca lanza: si algo falla, undefined.
export function etiquetaLlamada(nombre: string, args?: any): string | undefined {
  try { return filas[nombre]?.llamada(args ?? {}); } catch { return undefined; }
}
// Con el resultado final: la línea de éxito o de falla. Nunca lanza: si algo falla, undefined.
export function etiquetaResultado(nombre: string, args: any, resultado: Resultado, esError: boolean): string | undefined {
  const f = filas[nombre];
  if (!f) return undefined;
  try { return esError ? f.fallo(resultado) : f.hecho(args ?? {}, resultado); } catch { return undefined; }
}
// Lo único que se muestra de un resultado parcial: el diff que guardar_curso pide confirmar, entero, y el avance de una transcripción.
export function textoParcial(nombre: string, resultado: Resultado): string | undefined {
  return nombre === "guardar_curso" || nombre === "transcribir_paginas" ? texto(resultado) : undefined;
}
