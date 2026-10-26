// Proceso principal: la ventana, el host de pi y lo que la interfaz no puede hacer sola (diálogos, archivos, instalar).
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from "electron";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guardarAjustes, leerAjustes, leerFoco, sumarFoco, type Ajustes } from "./ajustes.js";
import { Host } from "./host.js";
import { diagnostico, instalar } from "./sistema.js";
import { crearVisores } from "./visor.js";

const aqui = fileURLToPath(new URL(".", import.meta.url));
if (process.platform === "linux") app.commandLine.appendSwitch("ozone-platform-hint", "auto");
// Las pruebas de punta a punta usan su propia carpeta de datos, para no tocar los ajustes de quien usa la app.
if (process.env.LEARN_APP_DATOS) app.setPath("userData", resolve(process.env.LEARN_APP_DATOS));

const host = new Host();
let ventana: BrowserWindow | undefined;
const aVentana = (canal: string, datos: unknown) => { if (ventana && !ventana.isDestroyed()) ventana.webContents.send(canal, datos); };
host.on("mensaje", m => aVentana("host:mensaje", m));
host.on("salio", codigo => aVentana("host:mensaje", { tipo: "host-cerrado", codigo }));
const visores = crearVisores(host, aqui, () => ventana);

function aplicarTema(tema: Ajustes["tema"]) { nativeTheme.themeSource = tema === "noche" ? "dark" : tema === "dia" ? "light" : "system"; }

function crearVentana() {
  const a = leerAjustes();
  aplicarTema(a.tema);
  ventana = new BrowserWindow({
    width: a.ventana?.ancho ?? 1320, height: a.ventana?.alto ?? 860, x: a.ventana?.x, y: a.ventana?.y, minWidth: 960, minHeight: 620,
    title: "learn", backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1b26" : "#e6e7ed", show: false, autoHideMenuBar: true,
    icon: join(app.getAppPath(), "recursos", "icono.png"),
    webPreferences: { preload: join(aqui, "../preload/index.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  if (a.ventana?.maximizada) ventana.maximize();
  ventana.once("ready-to-show", () => ventana?.show());
  // Los enlaces externos se abren en el navegador; la app nunca navega fuera de su página.
  ventana.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  ventana.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:") && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "\0")) { e.preventDefault(); if (/^https?:\/\//.test(url)) void shell.openExternal(url); } });
  ventana.on("close", () => {
    if (!ventana) return;
    const b = ventana.getNormalBounds();
    guardarAjustes({ ventana: { ancho: b.width, alto: b.height, x: b.x, y: b.y, maximizada: ventana.isMaximized() } });
  });
  // Las ventanas de PDF dependen de la principal: se cierran con ella.
  ventana.on("closed", () => visores.cerrarTodas());
  if (process.env.ELECTRON_RENDERER_URL) void ventana.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void ventana.loadFile(join(aqui, "../renderer/index.html"));
}

const vaultActual = () => host.vault ?? leerAjustes().vault;
// Una ruta relativa del vault, sin salir de él.
function enVault(relativa: string) {
  const vault = vaultActual();
  if (!vault) throw new Error("Todavía no hay una carpeta de vault elegida.");
  const ruta = resolve(vault, relativa);
  if (!ruta.startsWith(resolve(vault))) throw new Error("La ruta sale del vault.");
  return ruta;
}

ipcMain.handle("app:info", () => ({ version: app.getVersion(), plataforma: process.platform, datos: app.getPath("userData"), e2e: !!process.env.PI_LEARN_E2E }));
ipcMain.handle("app:ajustes", (_e, cambios?: Partial<Ajustes>) => {
  if (!cambios) return leerAjustes();
  const nuevo = guardarAjustes(cambios);
  if (cambios.tema) { aplicarTema(nuevo.tema); visores.tema(nuevo.tema); }
  return nuevo;
});
ipcMain.handle("app:elegir-carpeta", async (_e, titulo: string) => {
  const r = await dialog.showOpenDialog(ventana!, { title: titulo, properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? undefined : r.filePaths[0];
});
const FILTROS = {
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
  imagen: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif", "bmp"] }],
  nota: [{ name: "Notas Markdown", extensions: ["md"] }],
  sesion: [{ name: "Sesiones de pi", extensions: ["jsonl"] }],
};
ipcMain.handle("app:elegir-archivos", async (_e, filtro: keyof typeof FILTROS) => {
  const r = await dialog.showOpenDialog(ventana!, { defaultPath: filtro === "nota" ? vaultActual() : undefined,
    properties: filtro === "pdf" || filtro === "imagen" ? ["openFile", "multiSelections"] : ["openFile"], filters: FILTROS[filtro] ?? FILTROS.pdf });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle("app:arrancar", (_e, vault: string) => { visores.cerrarTodas(); guardarAjustes({ vault }); host.arrancar(vault, leerAjustes().node || "node"); return host.estado; });
ipcMain.handle("app:estado-host", () => ({ estado: host.estado, vault: host.vault }));
ipcMain.handle("host:pedir", (_e, tipo: string, datos: unknown) => host.pedir(tipo, datos));
ipcMain.on("host:enviar", (_e, mensaje) => host.enviar(mensaje));
ipcMain.handle("sistema:diagnostico", () => diagnostico(vaultActual(), leerAjustes().node || "node"));
ipcMain.handle("sistema:instalar", (_e, accion: string, vault?: string) =>
  instalar(accion, vault ?? vaultActual(), linea => aVentana("sistema:salida", { accion, linea }), leerAjustes().node || "node")
    .catch(e => { aVentana("sistema:salida", { accion, linea: `Error: ${(e as Error).message}` }); return 1; }));
// Copia PDFs a _entrada/ sin tocar los originales; un nombre repetido se numera.
ipcMain.handle("archivos:a-entrada", (_e, rutas: string[]) => {
  const entrada = enVault("_entrada");
  mkdirSync(entrada, { recursive: true });
  return rutas.filter(r => extname(r).toLowerCase() === ".pdf" && existsSync(r)).map(r => {
    let nombre = basename(r), n = 1;
    while (existsSync(join(entrada, nombre))) nombre = `${basename(r, ".pdf")}-${++n}.pdf`;
    copyFileSync(r, join(entrada, nombre));
    return nombre;
  });
});
// Los PDFs que ya esperan en _entrada/ (para elegir cuáles van a un curso).
ipcMain.handle("archivos:entrada", () => {
  const entrada = enVault("_entrada");
  if (!existsSync(entrada)) return [];
  return readdirSync(entrada, { withFileTypes: true }).filter(d => d.isFile() && extname(d.name).toLowerCase() === ".pdf")
    .map(d => ({ nombre: d.name, bytes: statSync(join(entrada, d.name)).size })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
});
ipcMain.handle("archivos:leer-imagen", (_e, ruta: string) => {
  const ext = extname(ruta).toLowerCase();
  const mime = ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" } as Record<string, string>)[ext];
  return mime ? { mimeType: mime, data: readFileSync(ruta).toString("base64"), nombre: basename(ruta) } : { ruta, nombre: basename(ruta) };
});
// Una foto HEIC o BMP no se puede mandar como imagen: va como ruta, como en la terminal (md-log la convierte si hay ImageMagick).
ipcMain.handle("archivos:temporal", (_e, nombre: string, base64: string) => {
  const dir = join(tmpdir(), "learn-app"); mkdirSync(dir, { recursive: true });
  const ruta = join(dir, `${Date.now()}-${basename(nombre).replace(/[^\w.-]/g, "_")}`);
  writeFileSync(ruta, Buffer.from(base64, "base64"));
  return ruta;
});
// curso.config.local.json: los modelos y el Tesseract de esta máquina, sin tocar el curso.config.json versionado.
ipcMain.handle("archivos:config-local", (_e, cambios?: Record<string, string | undefined>) => {
  const archivo = enVault(".pi/curso.config.local.json");
  let actual: Record<string, string> = {};
  try { actual = JSON.parse(readFileSync(archivo, "utf8")); } catch { /* no había */ }
  let base: Record<string, unknown> = {};
  try { base = JSON.parse(readFileSync(enVault(".pi/curso.config.json"), "utf8")); } catch { /* sin learn */ }
  if (!cambios) return { base, local: actual };
  const nuevo = { ...actual };
  for (const [k, v] of Object.entries(cambios)) if (["modelo_vision", "modelo_researcher", "ruta_tesseract"].includes(k)) { if (v) nuevo[k] = v; else delete nuevo[k]; }
  writeFileSync(archivo, `${JSON.stringify(nuevo, null, 2)}\n`);
  return { base, local: nuevo };
});
// Una nota vacía para una clase de tema libre (teach fuera de un curso), que md-log va a llenar.
ipcMain.handle("archivos:nota-libre", (_e, tema: string) => {
  const slug = tema.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "tema";
  const dir = enVault("notas-libres"); mkdirSync(dir, { recursive: true });
  const fecha = new Date().toLocaleDateString("sv-SE");
  let ruta = join(dir, `${fecha}-${slug}.md`), n = 1;
  while (existsSync(ruta)) ruta = join(dir, `${fecha}-${slug}-${++n}.md`);
  writeFileSync(ruta, "", { flag: "wx" });
  return ruta;
});
ipcMain.handle("app:abrir-externo", (_e, url: string) => { if (/^(https?|obsidian):\/\//.test(url)) return shell.openExternal(url); });
ipcMain.handle("app:abrir-en-vault", (_e, relativa: string) => shell.openPath(enVault(relativa)));
ipcMain.handle("app:mostrar-en-carpeta", (_e, relativa: string) => shell.showItemInFolder(enVault(relativa)));
ipcMain.handle("app:abrir-registros", () => shell.openPath(join(app.getPath("userData"), "registros")));
ipcMain.handle("app:copiar", (_e, texto: string) => clipboard.writeText(texto));
ipcMain.handle("app:foco", (_e, suma?: { dia: string; minutos: number; bloque: boolean }) => suma ? sumarFoco(suma.dia, suma.minutos, suma.bloque) : leerFoco());
ipcMain.handle("app:titulo", (_e, titulo: string) => ventana?.setTitle(titulo ? `${titulo} · learn` : "learn"));
ipcMain.handle("app:salir", () => app.quit());

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });
  void app.whenReady().then(() => {
    crearVentana();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
  });
  app.on("window-all-closed", () => { host.detener(); if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => host.detener());
}
