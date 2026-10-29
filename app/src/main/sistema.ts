// «Preparar la computadora»: el diagnóstico es el doctor de learn (scripts/doctor --sin-red) y cada faltante tiene una
// acción que lo resuelve. En Windows se instala con winget y micromamba (sin permisos de administrador para el OCR);
// en Linux se corre todo lo que no pide sudo y se muestra el comando de pacman para lo demás.
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const WINDOWS = process.platform === "win32";
export type Chequeo = { estado: "ok" | "falla" | "aviso" | "info"; nombre: string; detalle: string };
export type Salida = (linea: string) => void;

// Corre un comando y pasa su salida línea por línea. En Windows npm, pi y winget se encuentran a través de la shell.
export function correr(comando: string, args: string[], opciones: { cwd?: string; env?: NodeJS.ProcessEnv; salida?: Salida; shell?: boolean } = {}): Promise<number> {
  return new Promise(resolver => {
    const conShell = opciones.shell ?? (WINDOWS && ["npm", "pi", "winget", "npx"].includes(comando));
    const hijo = conShell
      ? spawn([comando, ...args.map(a => /[\s"]/.test(a) ? `"${a.replaceAll('"', '\\"')}"` : a)].join(" "), { cwd: opciones.cwd, env: opciones.env ?? process.env, shell: true, windowsHide: true })
      : spawn(comando, args, { cwd: opciones.cwd, env: opciones.env ?? process.env, windowsHide: true });
    const linea = (d: Buffer) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) opciones.salida?.(l); };
    hijo.stdout?.on("data", linea);
    hijo.stderr?.on("data", linea);
    hijo.on("error", e => { opciones.salida?.(`No se pudo ejecutar ${comando}: ${e.message}`); resolver(127); });
    hijo.on("exit", codigo => resolver(codigo ?? 1));
  });
}

function version(comando: string, args = ["--version"]): string | undefined {
  const r = spawnSync(WINDOWS && ["npm", "pi"].includes(comando) ? `${comando} ${args.join(" ")}` : comando, WINDOWS && ["npm", "pi"].includes(comando) ? [] : args,
    { encoding: "utf8", timeout: 15000, shell: WINDOWS && ["npm", "pi"].includes(comando), windowsHide: true });
  return r.status === 0 ? (r.stdout || "").trim().split(/\r?\n/)[0] : undefined;
}

// Lo mínimo para arrancar la app (Node, pi, Git y el vault) y, si eso está, el doctor completo de learn.
export async function diagnostico(vault: string | undefined, node = "node"): Promise<{ basicos: Chequeo[]; doctor: Chequeo[]; opcionales: Chequeo[]; listoParaAbrir: boolean }> {
  // ImageMagick no es obligatorio: md-log lo usa para guardar fotos HEIC o BMP en la nota.
  const magick = version("magick", ["-version"]);
  const opcionales: Chequeo[] = [{ estado: magick ? "ok" : "info", nombre: "ImageMagick (opcional)",
    detalle: magick ? magick.replace(/^Version: /, "") : "Sin ImageMagick, las fotos HEIC o BMP del celular no se guardan en la nota (las JPG y PNG sí)." }];
  const v = { node: version(node), pi: version("pi"), git: version("git") };
  const basicos: Chequeo[] = [
    { estado: v.node ? "ok" : "falla", nombre: "Node.js", detalle: v.node ?? "No está instalado: pi lo necesita." },
    { estado: v.pi === "1.4.0" ? "ok" : v.pi ? "aviso" : "falla", nombre: "pi", detalle: v.pi ? (v.pi === "1.4.0" ? "1.4.0, la versión fijada" : `${v.pi}: learn está verificado con 1.4.0`) : "No está instalado." },
    { estado: v.git ? "ok" : "falla", nombre: "Git", detalle: v.git ?? "No está instalado: hace falta para traer learn y sus paquetes." },
    { estado: vault && existsSync(join(vault, ".pi", "scripts", "doctor")) ? "ok" : "falla", nombre: "Carpeta del vault", detalle: vault ? (existsSync(join(vault, ".pi")) ? vault : `${vault} no tiene learn (.pi/)`) : "Todavía no elegiste la carpeta." },
  ];
  const listoParaAbrir = basicos.every(c => c.estado !== "falla");
  if (!listoParaAbrir || !vault) return { basicos, doctor: [], opcionales, listoParaAbrir };
  const lineas: string[] = [];
  await correr(node, [join(vault, ".pi", "scripts", "doctor"), "--sin-red"], { cwd: vault, salida: l => lineas.push(l) });
  const doctor = lineas.map(l => /^([✓✗!·]) ([^:]+): ?(.*)$/.exec(l) ?? /^([!·]) (.+?)()$/.exec(l)).filter(Boolean)
    .map(m => ({ estado: ({ "✓": "ok", "✗": "falla", "!": "aviso", "·": "info" } as const)[m![1] as "✓"], nombre: m![2].trim(), detalle: m![3].trim() }));
  return { basicos, doctor, opcionales, listoParaAbrir };
}

const PAQUETES = ["git:github.com/amosblomqvist/pi-interactive-subagents@c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7", "npm:pi-web-access@0.42.0"];

// Las acciones de instalación, cada una idempotente (repetirla no rompe nada).
export async function instalar(accion: string, vault: string | undefined, salida: Salida, node = "node"): Promise<number> {
  const pi = vault ? join(vault, ".pi") : undefined;
  const winget = (id: string) => correr("winget", ["install", "--id", id, "-e", "--silent", "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"], { salida });
  switch (accion) {
    case "node": return WINDOWS ? winget("OpenJS.NodeJS") : (salida("En Arch / Omarchy: sudo pacman -S nodejs npm"), 1);
    case "git": return WINDOWS ? winget("Git.Git") : (salida("En Arch / Omarchy: sudo pacman -S git"), 1);
    case "uv": return WINDOWS ? winget("astral-sh.uv") : correr("sh", ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"], { salida });
    case "magick": return WINDOWS ? winget("ImageMagick.ImageMagick") : (salida("En Arch / Omarchy: sudo pacman -S imagemagick"), 1);
    case "pi": return correr("npm", ["install", "--global", "--ignore-scripts", "@earendil-works/pi-coding-agent@1.4.0"], { salida });
    case "learn": {
      if (!vault) return (salida("Elegí primero la carpeta del vault."), 1);
      mkdirSync(vault, { recursive: true });
      for (const d of ["_entrada", "cursos"]) mkdirSync(join(vault, d), { recursive: true });
      if (existsSync(join(vault, ".pi"))) return (salida("Ya hay un .pi/ en esta carpeta: no se toca."), 0);
      return correr("git", ["-c", "core.autocrlf=false", "clone", "-b", "cursos", "https://github.com/santi-esquerre/learn", ".pi"], { cwd: vault, salida });
    }
    case "venv": {
      if (!pi) return 1;
      const uv = uvEjecutable();
      return correr(uv, ["sync", "--project", join(pi, "scripts", "ingesta"), "--python", "3.13.13", "--python-preference", "only-managed", "--locked"],
        { cwd: vault, salida, env: { ...process.env, UV_PROJECT_ENVIRONMENT: join(pi, ".venv") } });
    }
    case "paquetes": {
      if (!pi || !vault) return 1;
      for (const p of PAQUETES) { const c = await correr("pi", ["install", "--local", "--approve", p], { cwd: vault, salida }); if (c) return c; }
      // pi install vuelve a escribir un rango con ^ en npm/package.json; el proyecto lo fija a la versión exacta (SETUP).
      await correr("git", ["-C", pi, "checkout", "--", "npm/package.json", "npm/package-lock.json"], { salida });
      const c = await correr("npm", ["ci", "--ignore-scripts", "--prefix", join(pi, "npm")], { cwd: vault, salida });
      return c || instalar("visual", vault, salida, node);
    }
    // Los diagramas de visualize: mermaid-cli con el Chrome, Chromium o Edge del sistema (sin bajar otro navegador).
    case "visual": return pi ? correr("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", join(pi, "extensions", "visual-tools")],
      { cwd: vault, salida, env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "1" } }) : 1;
    case "config": return pi ? correr(node, [join(pi, "scripts", "instalar-config")], { cwd: vault, salida }) : 1;
    case "ocr": return pi ? instalarOcr(pi, salida) : 1;
    default: salida(`Acción desconocida: ${accion}`); return 1;
  }
}

function uvEjecutable() {
  if (spawnSync("uv", ["--version"], { windowsHide: true }).status === 0) return "uv";
  const enlace = join(homedir(), "AppData", "Local", "Microsoft", "WinGet", "Links", "uv.exe");
  return WINDOWS && existsSync(enlace) ? enlace : join(homedir(), ".local", "bin", "uv");
}

// Tesseract 5.5.2 (la versión de la instalación del amigo) con español e inglés y Ghostscript, en un entorno de
// micromamba de la carpeta del usuario: no pide permisos de administrador. Queda fijado en curso.config.local.json.
async function instalarOcr(pi: string, salida: Salida): Promise<number> {
  const base = WINDOWS ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "pi-learning") : join(homedir(), ".cache", "pi-learning");
  const mamba = join(base, WINDOWS ? "micromamba.exe" : "micromamba"), entorno = join(base, "ocr");
  mkdirSync(base, { recursive: true });
  if (!existsSync(mamba)) {
    salida("Descargando micromamba…");
    await descargar(`https://github.com/mamba-org/micromamba-releases/releases/latest/download/micromamba-${WINDOWS ? "win-64" : "linux-64"}`, mamba);
    if (!WINDOWS) spawnSync("chmod", ["+x", mamba]);
  }
  const tesseract = WINDOWS ? join(entorno, "Library", "bin", "tesseract.exe") : join(entorno, "bin", "tesseract");
  if (!existsSync(tesseract)) {
    salida("Instalando Tesseract 5.5.2 y Ghostscript (conda-forge)…");
    const c = await correr(mamba, ["create", "-y", "-q", "-p", entorno, "-c", "conda-forge", "tesseract=5.5.2", "ghostscript", "libcurl"], { salida, env: { ...process.env, MAMBA_ROOT_PREFIX: join(base, "raiz") } });
    if (c) return c;
  }
  // El paquete de Windows no trae los idiomas: los modelos rápidos oficiales de español e inglés.
  const idiomas = WINDOWS ? join(entorno, "Library", "share", "tessdata") : join(entorno, "share", "tessdata");
  mkdirSync(idiomas, { recursive: true });
  for (const l of ["spa", "eng", "osd"]) {
    if (existsSync(join(idiomas, `${l}.traineddata`))) continue;
    salida(`Descargando el idioma ${l}…`);
    await descargar(`https://github.com/tesseract-ocr/tessdata_fast/raw/main/${l}.traineddata`, join(idiomas, `${l}.traineddata`));
  }
  const local = join(pi, "curso.config.local.json");
  let config: Record<string, string> = {};
  try { config = JSON.parse(readFileSync(local, "utf8")); } catch { /* no había */ }
  writeFileSync(local, `${JSON.stringify({ ...config, ruta_tesseract: tesseract }, null, 2)}\n`);
  salida(`Listo: ruta_tesseract = ${tesseract} (en curso.config.local.json).`);
  return 0;
}

async function descargar(url: string, destino: string) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${url} (${r.status}).`);
  mkdirSync(dirname(destino), { recursive: true });
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
}
