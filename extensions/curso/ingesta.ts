import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model, Usage } from "@earendil-works/pi-ai";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { piDir, pythonDelVenv } from "../../scripts/lib/pi-sdk.mjs";
import { anotarConsumo } from "../../scripts/lib/consumo.mjs";
import { elegir } from "../comun/elegir.ts";

export function python(accion: string, datos: object, signal?: AbortSignal, script: "vision.py" | "progreso.py" | "preparacion.py" = "vision.py"): Promise<any> {
  return new Promise((resolve, reject) => {
    const hijo = spawn(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta", script), accion],
      { stdio: ["pipe", "pipe", "pipe"], signal, timeout: 30000 });
    let salida = "", error = "";
    hijo.stdout.on("data", bloque => { salida += bloque; });
    hijo.stderr.on("data", bloque => { error += bloque; });
    // Sin venv, spawn falla con «spawn … ENOENT» en inglés.
    hijo.on("error", e => reject((e as NodeJS.ErrnoException).code === "ENOENT" ? new Error("Falta el entorno de ingesta (Python): corré .pi/scripts/doctor.") : e));
    hijo.stdin.on("error", reject);
    hijo.on("close", codigo => {
      if (codigo !== 0) return reject(new Error(error.trim() || "No se completó la operación local."));
      try { resolve(JSON.parse(salida)); } catch { reject(new Error("El entorno de ingesta (Python) devolvió un resultado inválido: corré .pi/scripts/doctor.")); }
    });
    hijo.stdin.end(JSON.stringify(datos));
  });
}

// Fallas del proveedor que se repetirían en cada llamada siguiente: la tanda se corta en la primera (las mismas causas que sesion.ts).
export function corteModelo(error = "") {
  return /usage limit|quota|rate.?limit|\b429\b|too many requests/i.test(error) ? "el proveedor rechazó el pedido por cuota o límite de uso; esperá o cambiá de modelo con /model"
    : /api key|unauthori[sz]ed|\b40[13]\b|authenticat|credential|expired|\/login/i.test(error) ? "faltan o vencieron las credenciales del modelo; ejecutá /login"
    : /fetch failed|network|connection|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|socket/i.test(error) ? "sin conexión con el proveedor del modelo; revisá la red" : undefined;
}

type Solicitud = { vault: string; salida: string; doc: string; paginas: number[] };
type Config = { modelo_vision: string; max_paginas_vision_sin_confirmar: number; umbral_calidad_pagina: number };

// Por qué un modelo no sirve para visión, o undefined si sirve (sin llamarlo).
async function sinVision(ctx: Pick<ExtensionContext, "modelRegistry">, modelo: Model<Api> | undefined, nombre: string) {
  if (!modelo?.input.includes("image")) return `${nombre} no existe o no acepta imágenes; revisá modelo_vision en curso.config.json`;
  // hasConfiguredAuth lee un snapshot que puede estar viejo; como pi, se confirma con la resolución real (un error lo informa la llamada).
  const credenciales = ctx.modelRegistry.hasConfiguredAuth(modelo) || await ctx.modelRegistry.getProviderAuth(modelo.provider).catch(() => true);
  return credenciales ? undefined : `no hay credenciales para ${modelo.provider}; ejecutá /login`;
}
// El modelo de visión configurado o, si no sirve, el de la conversación cuando acepta imágenes y tiene credenciales
// (DA58): el repo fija uno de openai-codex y learn tiene que andar con la clave que tenga el alumno. reemplaza es el
// configurado que no sirvió. Si ninguno sirve, por qué el configurado no.
export async function modeloVision(ctx: Pick<ExtensionContext, "modelRegistry" | "model">, nombre: string): Promise<{ modelo: Model<Api>; nombre: string; reemplaza?: string } | { motivo: string }> {
  const separador = nombre.indexOf("/");
  const modelo = ctx.modelRegistry.find(nombre.slice(0, separador), nombre.slice(separador + 1));
  const motivo = await sinVision(ctx, modelo, nombre);
  if (!motivo) return { modelo: modelo!, nombre };
  const actual = ctx.model, deActual = actual && `${actual.provider}/${actual.id}`;
  if (actual && deActual !== nombre && !await sinVision(ctx, actual, deActual!)) return { modelo: actual, nombre: deActual!, reemplaza: nombre };
  return { motivo };
}

export async function transcribir(ctx: Pick<ExtensionContext, "modelRegistry" | "model" | "hasUI" | "ui" | "mode">,
  solicitud: Solicitud, config: Config, signal?: AbortSignal, informar?: (texto: string) => void) {
  if (!Array.isArray(solicitud.paginas) || !solicitud.paginas.length || solicitud.paginas.some(n => !Number.isSafeInteger(n) || n < 1)) {
    throw new Error("Indicá páginas PDF enteras y positivas (base 1).");
  }
  if (!Number.isSafeInteger(config.max_paginas_vision_sin_confirmar) || config.max_paginas_vision_sin_confirmar < 1 ||
      !Number.isFinite(config.umbral_calidad_pagina) || config.umbral_calidad_pagina < 0 || config.umbral_calidad_pagina > 1) {
    throw new Error("Límite de visión o umbral de calidad inválido en curso.config.json.");
  }
  if (typeof config.modelo_vision !== "string" || config.modelo_vision.indexOf("/") < 1) throw new Error("Modelo de visión inválido en curso.config.json.");
  const paginas = [...new Set(solicitud.paginas)].sort((a, b) => a - b);
  const resumen = { solicitadas: paginas.length, transcritas: 0, cache: 0, fallidas: [] as number[], pendientes: [] as number[], avisos: [] as string[], cancelada: false, corte: undefined as string | undefined };
  const vision = await modeloVision(ctx, config.modelo_vision);
  if ("motivo" in vision) {
    resumen.fallidas.push(...paginas);
    resumen.avisos.push(`Visión no disponible: ${vision.motivo}.`);
    return { resumen, usage: undefined };
  }
  const { modelo, nombre } = vision;
  if (vision.reemplaza) resumen.avisos.push(`Visión con ${nombre}, el modelo de la conversación: ${vision.reemplaza} no tiene credenciales o no acepta imágenes.`);
  if (paginas.length > config.max_paginas_vision_sin_confirmar) {
    if (!ctx.hasUI) throw new Error(`La tanda de ${paginas.length} páginas necesita confirmación interactiva; no se envió ninguna página.`);
    // ui.confirm de pi dibuja «Yes»/«No»; Esc o un corte valen como no.
    resumen.cancelada = await elegir(ctx, `Confirmar gasto de visión\nSolicitaste ${paginas.length} páginas con ${nombre}. Se reutilizará la caché disponible. ¿Autorizás esta tanda?`,
      ["Sí, transcribir", "No"], { signal }) !== "Sí, transcribir";
    if (resumen.cancelada) return { resumen, usage: undefined };
  }
  let usage: Usage | undefined;
  for (const pagina of paginas) {
    if (signal?.aborted) { resumen.cancelada = true; break; }
    informar?.(`${solicitud.doc}: página PDF ${pagina} (${resumen.transcritas + resumen.cache + resumen.fallidas.length + 1}/${paginas.length}).`);
    let preparada;
    let etapa = "preparar";
    // La caché y lo guardado llevan el modelo que transcribe de verdad, no el configurado que no sirvió (DA58).
    const datos = { ...solicitud, pagina, modelo: nombre, umbral: config.umbral_calidad_pagina };
    try {
      preparada = await python("preparar", datos, signal);
      if (preparada.cache) { resumen.cache++; continue; }
      const imagen = readFileSync(preparada.imagen);
      if (createHash("sha256").update(imagen).digest("hex") !== preparada.sha256_imagen) throw new Error("Cambió el render.");
      etapa = "modelo";
      const llamada = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(180000)]);
      const respuesta = await ctx.modelRegistry.streamSimple(modelo, { messages: [{ role: "user", timestamp: Date.now(), content: [
        { type: "text", text: preparada.prompt },
        { type: "image", mimeType: "image/png", data: imagen.toString("base64") },
      ] }] }, { maxTokens: 8000, reasoning: "off", maxRetries: 0, signal: llamada }).result();
      anotarConsumo({ origen: "preparación", proveedor: modelo.provider, modelo: modelo.id, usage: respuesta.usage });
      if (!usage) usage = structuredClone(respuesta.usage);
      else {
        for (const k of ["input", "output", "cacheRead", "cacheWrite", "cacheWrite1h", "reasoning", "totalTokens"] as const) usage[k] = (usage[k] || 0) + (respuesta.usage[k] || 0);
        for (const k of ["input", "output", "cacheRead", "cacheWrite", "total"] as const) usage.cost[k] += respuesta.usage.cost[k];
      }
      const texto = respuesta.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      // «aborted» sin un corte del usuario es el plazo de 3 minutos (pi-ai lo informa como «Request was aborted»).
      if (respuesta.stopReason !== "stop" || !texto.trim()) throw new Error(respuesta.stopReason === "aborted" ? "el modelo no respondió en 3 minutos" : respuesta.errorMessage || "respuesta vacía o cortada.");
      etapa = "guardar";
      const guardada = await python("guardar", { ...datos, ...preparada, texto, completa: true, uso: respuesta.usage,
        umbral: config.umbral_calidad_pagina }, signal);
      resumen.transcritas++;
      if (guardada.pendiente) resumen.pendientes.push(pagina);
    } catch (error) {
      // Una cancelación del usuario no es un fallo: la página queda como estaba.
      if (signal?.aborted) { resumen.cancelada = true; break; }
      const mensaje = error instanceof Error ? error.message : String(error);
      resumen.corte = etapa === "modelo" ? corteModelo(mensaje) : undefined;
      resumen.fallidas.push(pagina);
      resumen.avisos.push(`PDF ${pagina}: ${etapa === "modelo" ? `Visión no disponible: ${mensaje.slice(0, 200)}${resumen.corte ? ` (${resumen.corte}); no se enviaron las páginas siguientes` : ""}` : mensaje.slice(0, 350)}`);
      if (preparada && !preparada.cache) {
        // Nunca reemplaza texto ajeno; una página base buena sólo queda marcada para reintentar.
        try { await python("fallar", { ...datos, ...preparada }, AbortSignal.timeout(10000)); }
        catch { resumen.avisos.push(`PDF ${pagina}: no se pudo actualizar el estado; se preservaron los archivos existentes.`); }
      }
      if (resumen.corte) break;
    }
  }
  return { resumen, usage };
}
