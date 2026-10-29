// DA51: grabaciones de clase en el lado del tutor. leer_paginas por tramos con el enlace a cada minuto, las citas #t=, el
// dossier, lo que falta transcribir, las etiquetas, la barra de la ingesta y las anclas del researcher; sin modelos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cita, citaSegundo, documento, dossier, esGrabacion, faltantesTema, hora, leerPaginas } from "../extensions/curso/material.ts";
import { etiquetaResultado } from "../extensions/curso/etiquetas.ts";
import { linea } from "../extensions/curso/ingesta-fondo.ts";
import { prepararInvestigacion } from "../extensions/curso/researcher.ts";
import { piDir } from "../scripts/lib/pi-sdk.mjs";

const CLASE = "fuentes/bibliografia/clase-3.mp4";
function curso(t) {
  const vault = mkdtempSync(join(tmpdir(), "pi-grabacion-")), raiz = join(vault, "cursos/redes");
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  const tema = { id: "retardos", nombre: "Retardos", alias: [], unidad: 1, prerequisitos: [], objetivos: ["O1.2"],
    bibliografia: [{ doc: "libro", seccion: "1.4", paginas: [1, 1] }, { doc: "clase-3", seccion: "Retardo de cola", paginas: [2, 3] }] };
  const d = { curso: "redes", nombre: "Redes", contrato: "# Objetivos\n- O1.2: Calcular retardos.\n", temas: [tema],
    documentos: [{ id: "libro", titulo: "Libro", tipo: "bibliografia", archivo: "fuentes/bibliografia/libro.pdf", paginas: 1, prioridad: "principal" },
      { id: "clase-3", titulo: "Clase 3 grabada", tipo: "bibliografia", archivo: CLASE, paginas: 3, prioridad: "complementaria" }],
    items: {}, progreso: { temas: {}, historial: [] }, avisos: [], validacion: { errores: [], avisos: [], pendientes: [] } };
  const escribir = (relativa, texto) => { mkdirSync(join(raiz, relativa, ".."), { recursive: true }); writeFileSync(join(raiz, relativa), texto); };
  escribir("_procesado/libro/paginas/0001.md", "<!-- p. PDF 1 -->\n\nEl retardo nodal tiene cuatro partes.");
  escribir("_procesado/libro/calidad.json", JSON.stringify({ paginas: { 1: { ruta: "digital", pendiente: false } } }));
  // El tramo 2 está transcripto; el 3, todavía no.
  escribir("_procesado/clase-3/paginas/0002.md", `<!-- tramo 2 de 3 · 5:05–10:40 · [[${CLASE}#t=300]] -->\n\n[5:06] El retardo de cola crece con la intensidad de tráfico.\n\n[9:58] Repetimos el cálculo con otro enlace.\n`);
  escribir("_procesado/clase-3/calidad.json", JSON.stringify({ paginas: { 2: { ruta: "transcripcion", pendiente: false, inicio: 305.85, fin: 640.25,
    avisos: ["Audio dudoso cerca de 9:58: escuchá la grabación antes de citarlo textual."] } } }));
  return { vault, raiz, d, tema, escribir };
}

test("una grabación es un documento del curso y se cita al segundo de cada tramo", t => {
  const { d } = curso(t);
  assert.equal(documento(d, "clase-3").archivo, CLASE);
  assert.ok(esGrabacion({ archivo: "x/clase.MKV" }) && !esGrabacion({ archivo: "x/libro.pdf" }));
  assert.equal(cita(d, "clase-3", 3), `[[cursos/redes/${CLASE}#t=600]]`);
  assert.equal(cita(d, "libro", 1), "[[cursos/redes/fuentes/bibliografia/libro.pdf#page=1]]");
  assert.equal(citaSegundo(d, "clase-3", 754.9), `[[cursos/redes/${CLASE}#t=754]]`);
  assert.deepEqual([hora(5), hora(754), hora(3725)], ["0:05", "12:34", "1:02:05"]);
  // Un archivo que no es PDF ni grabación no es material.
  d.documentos.push({ id: "notas", titulo: "Notas", tipo: "otros", archivo: "fuentes/otros/notas.txt", paginas: 1 });
  assert.throws(() => documento(d, "notas"), /Documento no identificado/);
});

test("leer_paginas de una grabación: cada párrafo con el enlace a su minuto, el aviso de transcripción y lo que falta", t => {
  const { raiz, d } = curso(t);
  const texto = leerPaginas(raiz, d, "clase-3", 2, 3);
  assert.match(texto, /^\[Transcripción automática del audio: .*pizarrón no está\./);
  assert.match(texto, new RegExp(`Tramo 2 \\(5:05–10:40\\):\\n\\[5:06\\] El retardo de cola crece con la intensidad de tráfico\\. \\[\\[cursos/redes/${CLASE.replace(/[.]/g, "\\.")}#t=306\\]\\]`));
  assert.match(texto, /\[9:58\] Repetimos el cálculo con otro enlace\. \[\[cursos\/redes\/[^\]]+#t=598\]\]/);
  assert.match(texto, /\[Audio dudoso cerca de 9:58: escuchá la grabación antes de citarlo textual\.\]/);
  assert.match(texto, /Tramo 3 \(desde 10:00\): sin transcripción todavía; se transcribe en la preparación del curso\. No lo cites\./);
  assert.ok(!texto.includes("<!--") && !texto.includes("ver_pagina"), texto);
  assert.throws(() => leerPaginas(raiz, d, "clase-3", 2, 4), /Rango de tramos inválido: clase-3 tiene 3 tramos de 5 minutos/);
});

test("el dossier nombra los tramos de la grabación y lo que falta transcribir no manda a ver_pagina", t => {
  const { raiz, d, tema } = curso(t);
  const texto = dossier(raiz, d, tema, 3000, 1500);
  assert.match(texto, /- leer_paginas clase-3 tramos 2–3 \(grabación, desde 5:00\) · Retardo de cola · Clase 3 grabada \(complementaria\)/);
  assert.match(texto, /- leer_paginas libro PDF 1–1 · 1\.4 · Libro/);
  assert.deepEqual(faltantesTema(raiz, d, tema), ["clase-3 tramos 2–3 (1 de 2 sin transcribir: la grabación se transcribe en la preparación del curso; no la cites hasta entonces)"]);
  assert.match(texto, /Preparación del tema: sin texto confiable todavía en clase-3 tramos 2–3 \([^)]+\)\.(?!.*ver_pagina)/);
});

test("etiquetas y barra: leer una grabación dice desde qué minuto; transcribir un tramo se ve en la barra", () => {
  assert.equal(etiquetaResultado("leer_paginas", { doc: "clase-3", desde: 2, hasta: 3 }, { details: { grabacion: true, desde: "5:00" } }, false), "Leí la grabación de clase-3 desde 5:00");
  assert.equal(etiquetaResultado("leer_paginas", { doc: "libro", desde: 1, hasta: 2 }, {}, false), "Leí PDF 1–2 de libro");
  assert.match(linea("redes", { estado: "en_curso", solicitadas: 12, procesadas: 3, documento: "clase-3", pagina: 2, detalle: "Transcribiendo clase-3: tramo 2 de 9 (desde 5:00)" }),
    /3\/12 páginas · 25% · Transcribiendo clase-3: tramo 2 de 9 \(desde 5:00\)$/);
});

test("el researcher recibe los tramos de la grabación como anclas con su enlace #t=", t => {
  const c = curso(t);
  const { tarea, citas } = prepararInvestigacion(c.vault, piDir, c.d, c.tema, "alcance");
  assert.ok(citas.includes(`[[cursos/redes/${CLASE}#t=300]]`), citas.join(" "));
  assert.match(tarea, /clase-3\/paginas\/0002\.md" → \[\[cursos\/redes\/[^\]]+#t=300\]\]/);
});
