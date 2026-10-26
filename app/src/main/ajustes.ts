// Ajustes y datos propios de la app (no del vault ni del progreso): carpeta del vault, tema visual, temporizador de foco
// y sus minutos por día, y el plan de cada cuenta para el medidor de consumo. Viven en la carpeta de datos de la app y
// se escriben de forma atómica.
import { app } from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Tema = "sistema" | "noche" | "dia";
// Cómo se paga cada cuenta (DA48): créditos o presupuesto por mes, un saldo cargado, un plan gratis o sin tope.
export interface Plan { tipo: "mensual" | "saldo" | "gratis" | "sin-tope"; monto?: number; dia?: number; desde?: string; pedidosDia?: number; preset?: string }
export interface AjustesFoco { activo: boolean; foco: number; descanso: number; descansoLargo: number; ciclos: number; sonido: boolean }
export interface Ajustes {
  vault?: string;
  tema: Tema;
  node?: string;
  panelFijo: boolean;
  foco: AjustesFoco;
  ventana?: { ancho: number; alto: number; x?: number; y?: number; maximizada?: boolean };
  visor?: { ancho: number; alto: number };
  planes?: Record<string, Plan>;
}
export interface DiaFoco { minutos: number; bloques: number }
export type HistorialFoco = Record<string, DiaFoco>;

const POR_DEFECTO: Ajustes = { tema: "sistema", panelFijo: false, foco: { activo: true, foco: 25, descanso: 5, descansoLargo: 15, ciclos: 4, sonido: true } };

const carpeta = () => { const d = app.getPath("userData"); mkdirSync(d, { recursive: true }); return d; };
function leer<T>(nombre: string, defecto: T): T {
  try { return { ...defecto, ...JSON.parse(readFileSync(join(carpeta(), nombre), "utf8")) }; } catch { return defecto; }
}
function escribir(nombre: string, datos: unknown) {
  const archivo = join(carpeta(), nombre), temporal = `${archivo}.${process.pid}.tmp`;
  writeFileSync(temporal, JSON.stringify(datos, null, 2));
  renameSync(temporal, archivo);
}

export function leerAjustes(): Ajustes {
  const a = leer<Ajustes>("ajustes.json", POR_DEFECTO);
  return { ...POR_DEFECTO, ...a, foco: { ...POR_DEFECTO.foco, ...a.foco } };
}
export function guardarAjustes(cambios: Partial<Ajustes>): Ajustes {
  const nuevo = { ...leerAjustes(), ...cambios };
  escribir("ajustes.json", nuevo);
  return nuevo;
}
export const leerFoco = (): HistorialFoco => leer<HistorialFoco>("foco.json", {});
// Suma minutos de foco a un día (fecha local AAAA-MM-DD).
export function sumarFoco(dia: string, minutos: number, bloque: boolean): HistorialFoco {
  const h = leerFoco();
  const d = h[dia] ?? { minutos: 0, bloques: 0 };
  h[dia] = { minutos: Math.round((d.minutos + minutos) * 10) / 10, bloques: d.bloques + (bloque ? 1 : 0) };
  escribir("foco.json", h);
  return h;
}
