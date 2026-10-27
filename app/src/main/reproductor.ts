// Ventanas de grabación (DA51): un video o audio de clase del curso, en su propia ventana y en el segundo citado
// ([[cursos/<curso>/fuentes/<tipo>/clase.mp4#t=725]]). La ventana no ve rutas: pide su grabación por learn-medio://<permiso>,
// que sólo sirve los archivos que abrió la ventana principal, con rangos de bytes para poder saltar a cualquier minuto.
import { app, BrowserWindow, ipcMain, nativeTheme, protocol, screen, shell } from "electron";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { Readable } from "node:stream";
import { guardarAjustes, leerAjustes } from "./ajustes.js";

const TIPOS: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".mkv": "video/x-matroska", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac",
};
export const EXTENSIONES_GRABACION = Object.keys(TIPOS).map(e => e.slice(1));
export const esGrabacion = (ruta: string) => extname(ruta).toLowerCase() in TIPOS;
const CITA = /^\[\[cursos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(fuentes\/[^#\]|\n]+)#t=(\d+)(?:\|[^\]\n]*)?\]\]$/i;

export interface PedidoGrabacion { cita: string; titulo?: string }
interface Abierta { ventana: BrowserWindow; permiso: string; archivo: string; titulo: string; segundo: number; video: boolean }

// learn-medio tiene que estar registrado antes de que la app esté lista (lo llama index.ts al cargar).
export function registrarEsquemaGrabacion() {
  protocol.registerSchemesAsPrivileged([{ scheme: "learn-medio", privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
}

// Lo que pide un <video> o <audio>: el archivo entero o un rango de bytes (206), para empezar en el medio y adelantar.
function servir(archivo: string, rango: string | null): Response {
  const total = statSync(archivo).size, tipo = TIPOS[extname(archivo).toLowerCase()];
  const m = /^bytes=(\d*)-(\d*)$/.exec(rango ?? "");
  if (!m || (!m[1] && !m[2])) {
    return new Response(Readable.toWeb(createReadStream(archivo)) as ReadableStream, { status: 200, headers: { "Content-Type": tipo, "Content-Length": String(total), "Accept-Ranges": "bytes" } });
  }
  // «bytes=-500» son los últimos 500.
  const desde = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2])), hasta = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
  if (desde >= total || desde > hasta) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  return new Response(Readable.toWeb(createReadStream(archivo, { start: desde, end: hasta })) as ReadableStream, { status: 206, headers: {
    "Content-Type": tipo, "Content-Length": String(hasta - desde + 1), "Content-Range": `bytes ${desde}-${hasta}/${total}`, "Accept-Ranges": "bytes" } });
}

export function crearReproductores(aqui: string, principal: () => BrowserWindow | undefined, vault: () => string | undefined) {
  const abiertas = new Map<string, Abierta>();
  const deVentana = (wc: Electron.WebContents) => [...abiertas.values()].find(a => !a.ventana.isDestroyed() && a.ventana.webContents === wc);

  protocol.handle("learn-medio", pedido => {
    const permiso = new URL(pedido.url).hostname;
    const a = [...abiertas.values()].find(x => x.permiso === permiso && !x.ventana.isDestroyed());
    if (!a) return new Response(null, { status: 404 });
    return servir(a.archivo, pedido.headers.get("range"));
  });

  // De la cita al archivo, sólo dentro de cursos/<curso>/fuentes/ del vault abierto y sin salir por enlaces.
  function resolver(cita: string) {
    const m = CITA.exec(cita.trim()), base = vault();
    if (!m || !base || !esGrabacion(m[2]) || m[2].split("/").some(p => p === ".." || p === "." || !p)) throw new Error("Esa cita no es de una grabación del curso.");
    const fuentes = join(base, "cursos", m[1], "fuentes"), archivo = join(base, "cursos", m[1], ...m[2].split("/"));
    if (!existsSync(archivo) || !realpathSync(archivo).startsWith(realpathSync(fuentes) + sep)) throw new Error("La grabación no está en el curso.");
    return { id: `${m[1]}/${m[2]}`, archivo, segundo: Number(m[3]), nombre: m[2].split("/").pop()! };
  }

  function abrir(pedido: PedidoGrabacion) {
    const { id, archivo, segundo, nombre } = resolver(String(pedido?.cita ?? ""));
    const titulo = typeof pedido.titulo === "string" && pedido.titulo.trim() ? pedido.titulo.trim().slice(0, 200) : nombre;
    const previa = abiertas.get(id);
    if (previa && !previa.ventana.isDestroyed()) {
      previa.segundo = segundo;
      previa.ventana.webContents.send("reproductor:ir", segundo);
      if (previa.ventana.isMinimized()) previa.ventana.restore();
      previa.ventana.focus();
      return;
    }
    const a = leerAjustes(), p = principal(), video = TIPOS[extname(archivo).toLowerCase()].startsWith("video/");
    const area = screen.getDisplayMatching(p && !p.isDestroyed() ? p.getBounds() : screen.getPrimaryDisplay().bounds).workArea;
    const ancho = Math.min(a.reproductor?.ancho ?? (video ? 960 : 640), area.width), alto = Math.min(a.reproductor?.alto ?? (video ? 640 : 260), area.height);
    const corrida = (abiertas.size % 6) * 28;
    const ventana = new BrowserWindow({
      width: ancho, height: alto, minWidth: 420, minHeight: 220,
      x: Math.min(area.x + Math.round((area.width - ancho) / 2) + corrida, area.x + area.width - ancho),
      y: Math.min(area.y + Math.round((area.height - alto) / 2) + corrida, area.y + area.height - alto),
      title: `${titulo} · learn`, backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1b26" : "#e6e7ed", show: false,
      icon: join(app.getAppPath(), "recursos", "icono.png"),
      webPreferences: { preload: join(aqui, "../preload/reproductor.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    });
    ventana.setMenu(null);
    abiertas.set(id, { ventana, permiso: randomUUID(), archivo, titulo, segundo, video });
    ventana.once("ready-to-show", () => ventana.show());
    ventana.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
    ventana.webContents.on("will-navigate", e => e.preventDefault());
    ventana.on("close", () => { const b = ventana.getNormalBounds(); guardarAjustes({ reproductor: { ancho: b.width, alto: b.height } }); });
    ventana.on("closed", () => { if (abiertas.get(id)?.ventana === ventana) abiertas.delete(id); });
    if (process.env.ELECTRON_RENDERER_URL) void ventana.loadURL(`${process.env.ELECTRON_RENDERER_URL}/reproductor.html`);
    else void ventana.loadFile(join(aqui, "../renderer/reproductor.html"));
  }

  ipcMain.handle("reproductor:abrir", (e, pedido: PedidoGrabacion) => {
    if (e.sender !== principal()?.webContents) throw new Error("Sólo la ventana principal abre grabaciones.");
    return abrir(pedido);
  });
  ipcMain.handle("reproductor:datos", e => {
    const a = deVentana(e.sender);
    if (!a) throw new Error("Esta ventana ya no tiene una grabación abierta.");
    return { titulo: a.titulo, url: `learn-medio://${a.permiso}/`, segundo: a.segundo, video: a.video, tema: leerAjustes().tema };
  });

  return {
    cerrarTodas() { for (const { ventana } of abiertas.values()) if (!ventana.isDestroyed()) ventana.close(); abiertas.clear(); },
    // Las de un curso que se elimina (DA53).
    cerrarCurso(slug: string) { for (const [id, { ventana }] of abiertas) if (id.startsWith(`${slug}/`)) { if (!ventana.isDestroyed()) ventana.close(); abiertas.delete(id); } },
    tema(tema: string) { for (const { ventana } of abiertas.values()) if (!ventana.isDestroyed()) ventana.webContents.send("reproductor:tema", tema); },
  };
}
