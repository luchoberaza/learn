// PDF.js para la ventana de PDF. pdf_viewer.mjs toma la biblioteca de globalThis.pdfjsLib al cargarse: este módulo
// se importa antes que él.
import * as pdfjsLib from "pdfjs-dist";
import trabajador from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(globalThis as { pdfjsLib?: typeof pdfjsLib }).pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = trabajador;

export * from "pdfjs-dist";
