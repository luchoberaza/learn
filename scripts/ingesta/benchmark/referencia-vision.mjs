#!/usr/bin/env node
// Solo referencia del benchmark (§4.2); no implementa la tool de transcripción de Fase 2.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadProject, piDir, vaultDir } from "../../lib/pi-sdk.mjs";

const salida = resolve(process.argv[2] || join(vaultDir, "_procesado/fase1/referencia-vision"));
if (!salida.startsWith(join(vaultDir, "_procesado") + "/")) throw new Error("La referencia debe guardarse bajo _procesado/.");
const control = JSON.parse(readFileSync(join(salida, "control.json"), "utf8"));
if (control.generador !== "pi-learning-ingesta") throw new Error("Prepará antes las imágenes con renderizar_referencia.py.");
const imagenes = JSON.parse(readFileSync(join(salida, "imagenes.json"), "utf8")).paginas;
const config = JSON.parse(readFileSync(join(piDir, "curso.config.json"), "utf8"));
if (imagenes.length > config.max_paginas_vision_sin_confirmar) throw new Error("Esta tanda necesita confirmación de gasto; no se envió ninguna página.");
if (existsSync(join(salida, "resultados.json"))) throw new Error("Ya hay un ensayo registrado. No se repiten llamadas ni se sobrescriben resultados automáticamente.");
const fd = join(salida, ".referencia.lock");
writeFileSync(fd, String(process.pid), { flag: "wx" });
const estado = { version: 1, candidato: "vision", modelo: config.modelo_vision, estado: "en_curso", pid: process.pid,
  nota: "Referencia automática, no verdad de terreno. Revisar contra el PDF original.", paginas: [] };
function guardar() {
  const temporal = join(salida, `.resultados-${process.pid}.tmp`);
  writeFileSync(temporal, JSON.stringify(estado, null, 2) + "\n");
  renameSync(temporal, join(salida, "resultados.json"));
}
guardar();
let proyecto;
try {
  proyecto = await loadProject();
  const registro = proyecto.session.modelRuntime;
  const [proveedor, ...partes] = config.modelo_vision.split("/");
  const modelo = registro.getModel(proveedor, partes.join("/"));
  if (!modelo) throw new Error("El modelo configurado no está disponible; no se eligió otro.");
  for (const entrada of imagenes) {
    const imagen = readFileSync(entrada.imagen);
    const hash = createHash("sha256").update(imagen).digest("hex");
    if (hash !== entrada.sha256_imagen) throw new Error("Cambió una imagen de referencia; no se envió.");
    const inicio = performance.now();
    const resultado = await registro.completeSimple(modelo, { messages: [{ role: "user", timestamp: Date.now(), content: [
      { type: "text", text: "Transcribí fielmente TODA esta única página, en su idioma original. No corrijas ni completes. Conservá títulos, numeración, encabezados y pies. Escribí toda la matemática en LaTeX ($…$ o $$…$$). Conservá las tablas, sus filas, columnas y celdas vacías en Markdown. Para figuras no tabulares escribí [Figura: descripción breve y fiel]. Marcá [ilegible] donde no puedas leer; no adivines. Devolvé solamente la transcripción." },
      { type: "image", mimeType: "image/png", data: imagen.toString("base64") },
    ] }] }, { maxTokens: 6000, reasoning: "off", signal: AbortSignal.timeout(180000) });
    const texto = resultado.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    const nombre = `${entrada.doc}-p${String(entrada.pagina).padStart(4, "0")}.md`;
    const completa = resultado.stopReason === "stop" && texto.trim().length > 0;
    writeFileSync(join(salida, nombre), `<!-- Referencia automática no validada · [[${entrada.fuente}#page=${entrada.pagina}]] -->\n\n${texto}\n`, { flag: "wx" });
    estado.paginas.push({ doc: entrada.doc, pagina: entrada.pagina, archivo: nombre, completa, stopReason: resultado.stopReason,
      segundos: (performance.now() - inicio) / 1000, uso: resultado.usage, sha256_imagen: hash, sha256_fuente: entrada.sha256_fuente });
    guardar();
  }
  estado.estado = estado.paginas.every(p => p.completa) ? "completado" : "completado_con_pendientes";
} catch (error) {
  estado.estado = "error";
  estado.aviso = "No se completó la referencia de visión; no se reintentó ni se cambió de modelo automáticamente.";
  console.error(estado.aviso);
  process.exitCode = 1;
} finally {
  guardar();
  if (proyecto) await proyecto.close();
}
console.log(JSON.stringify({ estado: estado.estado, modelo: estado.modelo, paginas: estado.paginas.length }));
