#!/usr/bin/env node
// Corre un comando con un plazo, como `timeout -k 5 <plazo> <cmd> < tarea.md > salida.md 2> error.txt; echo $? > codigo`,
// pero en Node, así anda igual en Linux y en Windows (sin sh ni coreutils).
// Uso: node vigilante.mjs <carpeta-del-trabajo> <plazo-en-segundos> -- <comando> [argumentos…]
// Contrato que lee researcher.ts: en la carpeta, `codigo` aparece completo (se escribe codigo.tmp y se renombra) con el
// código del hijo, 124 si venció el plazo y el hijo terminó al pedírselo, o 137 si hubo que matarlo a la fuerza.
// Ni el vigilante ni el hijo usan la carpeta como directorio actual: Windows no deja borrarla mientras un proceso la tenga.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [carpeta, plazoTexto, separador, comando, ...args] = process.argv.slice(2);
const plazo = Number(plazoTexto);
if (!carpeta || separador !== "--" || !comando || !Number.isFinite(plazo) || plazo <= 0) {
  process.stderr.write("Uso: node vigilante.mjs <carpeta-del-trabajo> <plazo-en-segundos> -- <comando> [argumentos…]\n");
  process.exit(2);
}
const GRACIA = 5000;
const windows = process.platform === "win32";
const archivo = nombre => join(carpeta, nombre);

function terminar(codigo) {
  writeFileSync(archivo("codigo.tmp"), `${codigo}\n`);
  renameSync(archivo("codigo.tmp"), archivo("codigo"));
  process.exit(0);
}

const entrada = openSync(archivo("tarea.md"), "r"), salida = openSync(archivo("salida.md"), "w"), errores = openSync(archivo("error.txt"), "w");
// En POSIX el hijo encabeza su propio grupo, para cortar también a sus nietos; en Windows el árbol se corta con taskkill.
const hijo = spawn(comando, args, { cwd: tmpdir(), stdio: [entrada, salida, errores], detached: !windows, windowsHide: true });
for (const fd of [entrada, salida, errores]) closeSync(fd);

let vencido = false, forzado = false;
function senal(nombre) {
  try {
    if (windows) spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", ...(nombre === "SIGKILL" ? ["/F"] : [])], { stdio: "ignore", windowsHide: true });
    else process.kill(-hijo.pid, nombre);
  } catch { /* ya terminó */ }
}
const reloj = setTimeout(() => {
  vencido = true;
  senal("SIGTERM");
  setTimeout(() => { forzado = true; senal("SIGKILL"); }, GRACIA).unref();
}, plazo * 1000);
// Si al vigilante le piden terminar (no un SIGKILL), se lo pasa al hijo, como hace timeout.
for (const nombre of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(nombre, () => senal(nombre));

hijo.on("error", error => {
  clearTimeout(reloj);
  writeFileSync(archivo("error.txt"), `${error.message}\n`, { flag: "a" });
  terminar(127);
});
hijo.on("exit", (codigo, senalRecibida) => {
  clearTimeout(reloj);
  if (vencido) terminar(forzado ? 137 : 124);
  terminar(codigo ?? 128 + (senalRecibida === "SIGKILL" ? 9 : 15));
});
