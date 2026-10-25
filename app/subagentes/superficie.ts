/**
 * Surface selector for subagent panes: tmux (unchanged) or the learn desktop app.
 *
 * The learn app runs pi inside its own process and puts real terminals (node-pty, ConPTY on Windows) on
 * `globalThis.__piLearnSuperficie`, which it draws as panels. Without that object every call goes to tmux.ts
 * exactly as before, so the terminal setup is untouched. index.ts imports from here instead of ./tmux.ts.
 */
import * as tmux from "./tmux.ts";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type { PollResult } from "./tmux.ts";

interface AppSurface {
  crear(nombre: string): string;
  escribir(id: string, texto: string): void;
  leer(id: string, lineas: number): string;
  cerrar(id: string): void;
}
const app = (): AppSurface | undefined => (globalThis as { __piLearnSuperficie?: AppSurface }).__piLearnSuperficie;

export const shellEscape = tmux.shellEscape;
export const __pollForExitTest__ = tmux.__pollForExitTest__;

export function isTmuxAvailable(): boolean {
  return tmux.isTmuxAvailable();
}

export function isMuxAvailable(): boolean {
  return !!app() || tmux.isMuxAvailable();
}

export function muxSetupHint(): string {
  return app() ? "" : tmux.muxSetupHint();
}

export function createSurface(name: string): string {
  const a = app();
  return a ? a.crear(name) : tmux.createSurface(name);
}

export function createSurfaceSplit(name: string, direction: "left" | "right" | "up" | "down", fromSurface?: string): string {
  const a = app();
  return a ? a.crear(name) : tmux.createSurfaceSplit(name, direction, fromSurface);
}

export function sendCommand(surface: string, command: string): void {
  const a = app();
  if (!a) return tmux.sendCommand(surface, command);
  a.escribir(surface, command);
  a.escribir(surface, "\r");
}

export function sendLongCommand(surface: string, command: string, options?: { scriptPath?: string; scriptPreamble?: string }): string {
  if (!app()) return tmux.sendLongCommand(surface, command, options);
  const scriptPath = options?.scriptPath ?? join(tmpdir(), "pi-subagent-scripts", `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.sh`);
  mkdirSync(dirname(scriptPath), { recursive: true });
  const scriptParts = ["#!/bin/bash"];
  if (options?.scriptPreamble) scriptParts.push(options.scriptPreamble.trimEnd());
  scriptParts.push(command);
  writeFileSync(scriptPath, scriptParts.join("\n") + "\n", { mode: 0o755 });
  // The panel shell is bash (Git Bash on Windows): forward slashes work on every platform.
  sendCommand(surface, `bash ${shellEscape(scriptPath.replace(/\\/g, "/"))}`);
  return scriptPath;
}

export function readScreen(surface: string, lines = 50): string {
  const a = app();
  return a ? a.leer(surface, lines) : tmux.readScreen(surface, lines);
}

export async function readScreenAsync(surface: string, lines = 50): Promise<string> {
  const a = app();
  return a ? a.leer(surface, lines) : tmux.readScreenAsync(surface, lines);
}

export function closeSurface(surface: string): void {
  const a = app();
  return a ? a.cerrar(surface) : tmux.closeSurface(surface);
}

// Same contract as tmux.pollForExit, reading the app panel instead of tmux capture-pane.
export async function pollForExit(
  surface: string,
  signal: AbortSignal,
  options: { interval: number; sessionFile?: string; sentinelFile?: string; onTick?: (elapsed: number) => void },
): Promise<tmux.PollResult> {
  if (!app()) return tmux.pollForExit(surface, signal, options);
  const start = Date.now();
  const exitSidecar = (): tmux.PollResult | undefined => {
    if (!options.sessionFile) return undefined;
    try {
      const exitFile = `${options.sessionFile}.exit`;
      if (!existsSync(exitFile)) return undefined;
      const data = JSON.parse(readFileSync(exitFile, "utf-8"));
      rmSync(exitFile, { force: true });
      return tmux.__pollForExitTest__.interpretExitSidecar(data);
    } catch { return undefined; }
  };
  for (;;) {
    if (signal.aborted) throw new Error("Aborted while waiting for subagent to finish");
    const sidecar = exitSidecar();
    if (sidecar) return sidecar;
    if (options.sentinelFile && existsSync(options.sentinelFile)) return { reason: "sentinel", exitCode: 0 };
    try {
      const match = (await readScreenAsync(surface, 5)).match(/__SUBAGENT_DONE_(\d+)__/);
      if (match) return { reason: "sentinel", exitCode: parseInt(match[1], 10) };
    } catch {
      const late = exitSidecar();
      if (late) return late;
    }
    options.onTick?.(Math.floor((Date.now() - start) / 1000));
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("Aborted"));
      const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, options.interval);
      function onAbort() { clearTimeout(timer); reject(new Error("Aborted")); }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
