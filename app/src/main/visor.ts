// Ventanas de PDF (DA47): cada documento del curso entero en su propia ventana, que se puede mover a otro monitor y
// cerrar. También alimenta las pestañas de PDF de la ventana principal (DA56). El host arma la copia para leer (cada página vedada cambiada por una hoja en blanco, host/paginas.mjs) y la
// ventana recibe sólo esa copia. Al volver a una ventana se pregunta de nuevo: si cambió lo vedado, se recarga.
import { app, BrowserWindow, ipcMain, nativeTheme, screen, shell, type WebContents } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { guardarAjustes, leerAjustes } from "./ajustes.js";
import type { Host } from "./host.js";

interface Lectura { curso: string; doc: string; titulo: string; total: number; pagina: number; vedadas: number[]; archivo: string; clave: string }
export interface PedidoPdf { cita?: string; curso?: string; doc?: string; pagina?: number }

// Lo que PDF.js pide aparte del documento: mapas de caracteres, fuentes estándar y decodificadores de imágenes.
const DATOS_PDFJS: Record<string, string> = { cMapUrl: "cmaps", standardFontDataUrl: "standard_fonts", wasmUrl: "wasm" };
// Sin pi no cambia lo vedado: una ventana abierta sigue con lo que tenía.
const SIN_PI = /pi no está abierto|pi no respondió|proceso de pi se cerró/;

export function crearVisores(host: Host, aqui: string, principal: () => BrowserWindow | undefined) {
  const abiertas = new Map<string, { ventana: BrowserWindow; lectura: Lectura; revisada: number }>();
  const carpeta = () => join(app.getPath("userData"), "lectura");
  // Empaquetados, junto a la ventana (electron.vite.config.ts); en desarrollo, del paquete.
  const datosPdfjs = () => { const junto = join(aqui, "../renderer/pdfjs"); return existsSync(junto) ? junto : join(app.getAppPath(), "node_modules/pdfjs-dist"); };
  const deVentana = (wc: WebContents) => [...abiertas.values()].find(a => !a.ventana.isDestroyed() && a.ventana.webContents === wc);

  async function abrir(pedido: PedidoPdf) {
    const lectura = await host.pedir("lectura", { ...pedido, carpeta: carpeta() }) as Lectura;
    const id = `${lectura.curso}/${lectura.doc}`, previa = abiertas.get(id);
    if (previa && !previa.ventana.isDestroyed()) {
      // Si la ventana todavía está cargando, el aviso se pierde pero sus datos ya traen la página pedida.
      const recargar = previa.lectura.clave !== lectura.clave;
      previa.lectura = lectura;
      previa.ventana.webContents.send(recargar ? "visor:recargar" : "visor:ir", lectura.pagina);
      previa.revisada = Date.now();
      if (previa.ventana.isMinimized()) previa.ventana.restore();
      previa.ventana.focus();
      return;
    }
    const a = leerAjustes(), p = principal();
    const area = screen.getDisplayMatching(p && !p.isDestroyed() ? p.getBounds() : screen.getPrimaryDisplay().bounds).workArea;
    const ancho = Math.min(a.visor?.ancho ?? 980, area.width), alto = Math.min(a.visor?.alto ?? area.height - 40, area.height);
    // Cada ventana nueva un poco corrida, para que no tape del todo a la anterior.
    const corrida = (abiertas.size % 6) * 28;
    const ventana = new BrowserWindow({
      width: ancho, height: alto, minWidth: 520, minHeight: 420,
      x: Math.min(area.x + Math.round((area.width - ancho) / 2) + corrida, area.x + area.width - ancho),
      y: Math.min(area.y + Math.round((area.height - alto) / 2) + corrida, area.y + area.height - alto),
      title: `${lectura.titulo} · learn`, backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1b26" : "#e6e7ed", show: false,
      icon: join(app.getAppPath(), "recursos", "icono.png"),
      webPreferences: { preload: join(aqui, "../preload/visor.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    });
    // Sin el menú de la app: ni recargar ni herramientas de desarrollo; los atajos de lectura los maneja la ventana.
    ventana.setMenu(null);
    abiertas.set(id, { ventana, lectura, revisada: Date.now() });
    ventana.once("ready-to-show", () => ventana.show());
    // Los enlaces externos del PDF se abren en el navegador; la ventana nunca navega fuera de su página.
    ventana.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
    ventana.webContents.on("will-navigate", (e, url) => { e.preventDefault(); if (/^https?:\/\//.test(url)) void shell.openExternal(url); });
    ventana.on("focus", () => void revisar(id));
    ventana.on("close", () => { const b = ventana.getNormalBounds(); guardarAjustes({ visor: { ancho: b.width, alto: b.height } }); });
    ventana.on("closed", () => { if (abiertas.get(id)?.ventana === ventana) abiertas.delete(id); });
    if (process.env.ELECTRON_RENDERER_URL) void ventana.loadURL(`${process.env.ELECTRON_RENDERER_URL}/visor.html`);
    else void ventana.loadFile(join(aqui, "../renderer/visor.html"));
  }

  // Al volver a la ventana: si se rindió o se reservó un ejercicio, o cambió el material, llega la copia nueva.
  async function revisar(id: string) {
    const a = abiertas.get(id);
    if (!a || Date.now() - a.revisada < 3000) return;
    a.revisada = Date.now();
    try {
      const l = await host.pedir("lectura", { curso: a.lectura.curso, doc: a.lectura.doc, carpeta: carpeta() }) as Lectura;
      if (l.clave !== a.lectura.clave && !a.ventana.isDestroyed()) { a.lectura = l; a.ventana.webContents.send("visor:recargar"); }
    } catch (e) {
      const mensaje = (e as Error).message;
      if (!SIN_PI.test(mensaje) && !a.ventana.isDestroyed()) { abiertas.delete(id); a.ventana.webContents.send("visor:error", mensaje); }
    }
  }

  ipcMain.handle("visor:abrir", (e, pedido: PedidoPdf) => {
    if (e.sender !== principal()?.webContents) throw new Error("Sólo la ventana principal abre PDFs.");
    return abrir(pedido);
  });
  ipcMain.handle("visor:datos", e => {
    const a = deVentana(e.sender);
    if (!a) throw new Error("Esta ventana ya no tiene un PDF abierto.");
    const { titulo, total, pagina, vedadas, clave } = a.lectura;
    return { titulo, total, pagina, vedadas, clave, tema: leerAjustes().tema, bytes: readFileSync(a.lectura.archivo) };
  });
  // Una pestaña de PDF de la ventana principal (DA56): la misma copia para leer que recibe una ventana. Sin los bytes,
  // sólo la clave, para saber al volver a la pestaña si cambió lo vedado.
  ipcMain.handle("visor:pestana", async (e, pedido: PedidoPdf, conBytes = true) => {
    if (e.sender !== principal()?.webContents) throw new Error("Sólo la ventana principal abre pestañas de PDF.");
    const l = await host.pedir("lectura", { ...pedido, carpeta: carpeta() }) as Lectura;
    const { curso, doc, titulo, total, pagina, vedadas, clave } = l;
    return { curso, doc, titulo, total, pagina, vedadas, clave, tema: leerAjustes().tema, ...(conBytes ? { bytes: readFileSync(l.archivo) } : {}) };
  });
  ipcMain.handle("visor:recurso", (e, tipo: string, nombre: string) => {
    const sub = DATOS_PDFJS[tipo];
    if ((!deVentana(e.sender) && e.sender !== principal()?.webContents) || !sub || typeof nombre !== "string" || basename(nombre) !== nombre) throw new Error("Recurso de PDF.js inválido.");
    return readFileSync(join(datosPdfjs(), sub, nombre));
  });

  return {
    cerrarTodas() { for (const { ventana } of abiertas.values()) if (!ventana.isDestroyed()) ventana.close(); abiertas.clear(); },
    // Las de un curso que se elimina (DA53).
    cerrarCurso(slug: string) { for (const [id, { ventana }] of abiertas) if (id.startsWith(`${slug}/`)) { if (!ventana.isDestroyed()) ventana.close(); abiertas.delete(id); } },
    // Noche, Día o el del sistema, como la ventana principal (el tema se cambia en Ajustes).
    tema(tema: string) { for (const { ventana } of abiertas.values()) if (!ventana.isDestroyed()) ventana.webContents.send("visor:tema", tema); },
  };
}
