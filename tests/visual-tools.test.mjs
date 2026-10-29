import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { augmentedPath, chromeCandidates, findChrome } from "../extensions/visual-tools/tools/_common.ts";
import { piDir } from "../scripts/lib/pi-sdk.mjs";

const herramientas = join(piDir, "extensions/visual-tools");
const mmdc = join(herramientas, "node_modules/@mermaid-js/mermaid-cli/src/cli.js");
const navegador = findChrome();
const sinRender = !existsSync(mmdc) ? "sin las dependencias de visual-tools (npm ci --omit=dev --prefix .pi/extensions/visual-tools)" : !navegador ? "sin Chrome, Chromium ni Edge instalado" : false;

test("visualize: busca Chrome, Chromium o Edge en Windows, Linux y macOS", () => {
  const win = chromeCandidates({ ProgramFiles: "C:\\PF", "ProgramFiles(x86)": "C:\\PF86", LOCALAPPDATA: "C:\\LA" }, "win32");
  assert.ok(win.includes(join("C:\\PF", "Google", "Chrome", "Application", "chrome.exe")));
  assert.ok(win.includes(join("C:\\PF86", "Microsoft", "Edge", "Application", "msedge.exe")), "Edge viene con Windows 11");
  assert.ok(win.includes(join("C:\\LA", "Google", "Chrome", "Application", "chrome.exe")));
  assert.ok(chromeCandidates({}, "linux").includes("/usr/bin/chromium"));
  assert.ok(chromeCandidates({}, "darwin")[0].startsWith("/Applications/Google Chrome.app"));
  // PI_VISUAL_CHROME manda si existe; sin ningún candidato, no inventa una ruta.
  const falso = join(mkdtempSync(join(tmpdir(), "visual-")), "mi-chrome");
  writeFileSync(falso, "");
  assert.equal(findChrome({ PI_VISUAL_CHROME: falso }, "win32"), falso);
  assert.equal(findChrome({ ProgramFiles: "Z:\\no", "ProgramFiles(x86)": "Z:\\no", LOCALAPPDATA: "Z:\\no" }, "win32"), undefined);
});

test("visualize: el PATH de los renders usa el separador de la plataforma", () => {
  const p = augmentedPath(["uno", "dos"].join(delimiter));
  assert.ok(p.endsWith(["uno", "dos"].join(delimiter)));
  if (process.platform === "win32") assert.equal(p, ["uno", "dos"].join(";"), "en Windows no se agregan carpetas de macOS ni se une con «:»");
  else assert.ok(p.startsWith("/opt/local/bin:"));
});

test("visualize: Mermaid se dibuja con mmdc, el Node de pi y el navegador encontrado", { skip: sinRender, timeout: 180000 }, t => {
  const dir = mkdtempSync(join(tmpdir(), "visual-mermaid-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "d.mmd"), "graph LR\n  A[Transmisión] --> B[Propagación] --> C[Encolamiento]\n");
  writeFileSync(join(dir, "p.json"), JSON.stringify({ executablePath: navegador, args: ["--no-sandbox"] }));
  // La misma línea que render_mermaid: process.execPath + cli.js de mermaid-cli (sin el .cmd de Windows).
  execFileSync(process.execPath, [mmdc, "-i", join(dir, "d.mmd"), "-o", join(dir, "d.png"), "-p", join(dir, "p.json"), "-s", "2", "-b", "white"],
    { env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "1" }, timeout: 150000, stdio: "pipe", windowsHide: true });
  assert.equal(readFileSync(join(dir, "d.png")).subarray(1, 4).toString(), "PNG");
});

test("visualize: un SVG se dibuja con el navegador cuando no hay rsvg-convert ni magick", { skip: sinRender, timeout: 120000 }, t => {
  const dir = mkdtempSync(join(tmpdir(), "visual-svg-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "d.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#bb9af7"/><text x="20" y="50">retardo</text></svg>');
  execFileSync(process.execPath, [join(herramientas, "tools/svg-chrome.mjs"), join(dir, "d.svg"), join(dir, "d.png"), navegador], { timeout: 100000, stdio: "pipe", windowsHide: true });
  const png = readFileSync(join(dir, "d.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  // 200×80 a escala 2: el PNG mide 400×160.
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [400, 160]);
});
