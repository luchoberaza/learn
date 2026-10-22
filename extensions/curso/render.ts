import type { ToolRendererResolver } from "@earendil-works/pi-coding-agent";
import { Container, Text, TruncatedText } from "@earendil-works/pi-tui";

type Resultado = { content?: { type: string; text?: string }[]; details?: any };
type Fila = { llamada: (a: any) => string; hecho: (a: any, r: Resultado) => string; fallo: (r: Resultado) => string };

const texto = (r: Resultado) => r.content?.find(c => c.type === "text")?.text ?? "";
const de = (a: any) => typeof a.doc === "string" && a.doc ? ` de ${a.doc}` : "";
const rango = (a: any) => Number.isInteger(a.desde) && Number.isInteger(a.hasta) ? ` PDF ${a.desde === a.hasta ? a.desde : `${a.desde}–${a.hasta}`}` : " el material";
const pagina = (a: any) => Number.isInteger(a.pagina) ? `: PDF ${a.pagina}${de(a)}` : "";
const cuantos = (lista: unknown, uno: string, varios: string) => Array.isArray(lista) ? `${lista.length} ${lista.length === 1 ? uno : varios}` : varios;
// Los errores propios ya son una línea en español; los de pi (validación con los args crudos, aborto) no se muestran.
const motivo = (prefijo: string) => (r: Resultado) => {
  const t = texto(r).trim().split("\n")[0].replace(/^Progreso no guardado: /, "");
  if (!t || /^(Validation failed|Tool |Operation aborted)/.test(t)) return prefijo;
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

// Una línea por llamada: mientras corre, la de la llamada; con el resultado final, sólo la del resultado.
// Si un renderer lanza, pi muestra los args crudos o las primeras líneas del resultado: nunca lanzan.
export const renderizar: ToolRendererResolver = (nombre, next) => {
  const f = filas[nombre], base = next();
  if (!f || base?.renderCall || base?.renderResult) return base;
  return {
    renderShell: "self",
    renderCall(args, theme, ctx) {
      try {
        if (!ctx.isPartial) return new Container();
        // Con los args a medio llegar (streaming) sólo la etiqueta genérica.
        return new TruncatedText(theme.fg("muted", f.llamada(ctx.argsComplete && args ? args : {})), ctx.outputPad, 0);
      } catch { return new Container(); }
    },
    renderResult(result, { isPartial }, theme, ctx) {
      try {
        // guardar_curso pide confirmar el diff que manda como parcial: es lo único que se muestra entero.
        if (isPartial) return nombre === "guardar_curso" ? new Text(theme.fg("toolOutput", texto(result)), ctx.outputPad, 0)
          : nombre === "transcribir_paginas" ? new TruncatedText(theme.fg("muted", texto(result)), ctx.outputPad, 0) : new Container();
        return new TruncatedText(ctx.isError ? theme.fg("warning", f.fallo(result)) : theme.fg("muted", f.hecho(ctx.args ?? {}, result)), ctx.outputPad, 0);
      } catch { return new Container(); }
    },
  };
};
