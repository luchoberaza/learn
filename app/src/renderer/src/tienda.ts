// Estado de la interfaz: una sola tienda, alimentada por los mensajes del host y por las acciones de las pantallas.
// Las pantallas leen campos con usarTienda(e => e.campo): cada campo cambia de referencia sólo cuando cambia.
import { useSyncExternalStore } from "react";
import type { Ajustes, Aviso, Comando, Consumo, EstadoSesion, Estudio, Imagen, Item, Pagina, Pedido, ResumenCurso, Seguir, SesionGuardada } from "./tipos";
import { alMensajeSubagente, restaurarSubagentes } from "./componentes/Subagentes";
import { cuando, textoRinde } from "../../lib/consumo.ts";
import { escalaValida, pasoEscala } from "../../lib/escala.ts";

export type Ruta =
  | { pantalla: "inicio" }
  | { pantalla: "clase" }
  | { pantalla: "curso"; slug: string; pestana?: "indice" | "material" | "notas" | "estado" }
  | { pantalla: "tema"; slug: string; id: string }
  | { pantalla: "tema-libre" }
  | { pantalla: "nota"; ruta: string }
  | { pantalla: "crear-curso"; slug?: string }
  | { pantalla: "ajustes"; seccion?: string }
  | { pantalla: "preparar" }
  | { pantalla: "sesiones" };

// Una pestaña de la ventana principal (DA56): su pantalla y su historial, o un PDF. sesion es el archivo de la
// conversación de pi que vive en ella y titulo, el de esa conversación (para cuando pi está en otra). En un PDF, n sube
// cada vez que se pide ir a una página.
export interface Pestana {
  id: string;
  ruta: Ruta;
  historial: Ruta[];
  sesion?: string;
  titulo?: string;
  pdf?: { curso: string; doc: string; pagina?: number; titulo?: string; n: number };
  usada: number;
}

export interface Login {
  proveedor: string; nombre: string; metodo: string;
  eventos: { type: string; message?: string; url?: string; instructions?: string; userCode?: string; verificationUri?: string; links?: { url: string; label?: string }[] }[];
  pedido?: { id: string; tipo: string; mensaje: string; placeholder?: string; opciones?: { id: string; label: string; description?: string }[] };
  fin?: { ok: boolean; error?: string };
}

export interface Estado {
  // La pantalla y el historial de la pestaña activa (una copia de los suyos, para las pantallas).
  ruta: Ruta;
  historial: Ruta[];
  pestanas: Pestana[];
  activa: string;
  // La pestaña de la conversación que pi tiene abierta (una por vez).
  duena?: string;
  arranque: "cargando" | "sin-vault" | "arrancando" | "listo" | "error" | "cerrado";
  errorFatal?: string;
  info?: { vault: string; piDir: string; version: string; offline: boolean; aviso?: string };
  app?: { version: string; plataforma: string; datos: string; e2e: boolean };
  ajustes?: Ajustes;
  confianza?: string;
  sesion: EstadoSesion;
  items: Item[];
  trabajando: boolean;
  pensando: boolean;
  etiquetaTrabajando?: string;
  estados: Record<string, string>;
  widgets: Record<string, string[]>;
  pedidos: Pedido[];
  cola: number;
  avisos: Aviso[];
  toasts: Aviso[];
  cursos: ResumenCurso[];
  cursosListos: boolean;
  seguir?: Seguir | null;
  sesiones: SesionGuardada[];
  comandos: Comando[];
  panel?: { pagina?: Pagina; error?: string; cargando: boolean; fijo: boolean };
  pantallaPi?: { nombre: string; datos: any };
  login?: Login;
  textoEditor?: { texto: string; n: number };
  paleta: boolean;
  semanaFoco: Record<string, { minutos: number; bloques: number }>;
  consumo?: Consumo;
}

let siguientePestana = 1;
const pestanaNueva = (ruta: Ruta = { pantalla: "inicio" }, extra: Partial<Pestana> = {}): Pestana => ({ id: `p${siguientePestana++}`, ruta, historial: [], usada: Date.now(), ...extra });
const primera = pestanaNueva();

let estado: Estado = {
  ruta: primera.ruta, historial: [], pestanas: [primera], activa: primera.id, arranque: "cargando", sesion: {}, items: [], trabajando: false, pensando: false,
  estados: {}, widgets: {}, pedidos: [], cola: 0, avisos: [], toasts: [], cursos: [], cursosListos: false, sesiones: [], comandos: [], paleta: false, semanaFoco: {},
};
const oyentes = new Set<() => void>();
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
export const leer = () => estado;
export function cambiar(parcial: Partial<Estado> | ((e: Estado) => Partial<Estado>)) {
  estado = { ...estado, ...(typeof parcial === "function" ? parcial(estado) : parcial) };
  for (const f of oyentes) f();
}
export function usarTienda<T>(sel: (e: Estado) => T): T {
  return useSyncExternalStore(suscribir, () => sel(estado));
}

// ---------- Navegación ----------

// La pantalla de la pestaña activa cambia junto con su copia en la lista de pestañas.
function ponerRuta(e: Estado, ruta: Ruta, historial: Ruta[]): Partial<Estado> {
  return { ruta, historial, pestanas: e.pestanas.map(p => p.id === e.activa ? { ...p, ruta, historial } : p) };
}
const mismaRuta = (a: Ruta, b: Ruta) => JSON.stringify(a) === JSON.stringify(b);
export const pestanaActiva = (e: Estado) => e.pestanas.find(p => p.id === e.activa) ?? e.pestanas[0];
const hayDuena = (e: Estado) => !!e.duena && e.pestanas.some(p => p.id === e.duena);

// Se navega en la pestaña activa (DA56), con dos excepciones: una pestaña de PDF no cambia de pantalla (se va a la
// última pestaña usada, o a una nueva) y la clase se muestra en la pestaña que tiene la conversación de pi.
export function navegar(ruta: Ruta) {
  const e = leer();
  if (ruta.pantalla === "clase" && hayDuena(e) && e.duena !== e.activa) return void irAPestana(e.duena!, ruta);
  if (pestanaActiva(e).pdf) {
    const otra = e.pestanas.filter(p => !p.pdf).sort((a, b) => b.usada - a.usada)[0];
    return void (otra ? irAPestana(otra.id, ruta) : abrirPestana(ruta, false));
  }
  if (ruta.pantalla === "clase") cambiar({ duena: e.activa });
  cambiar(e => ({ ...ponerRuta(e, ruta, [...e.historial.slice(-30), e.ruta]), paleta: false }));
}
export function volver() {
  cambiar(e => e.historial.length && !pestanaActiva(e).pdf ? ponerRuta(e, e.historial[e.historial.length - 1], e.historial.slice(0, -1)) : {});
}

// La barra lateral se pliega a una franja (DA54); queda así en los próximos arranques.
export function plegarLateral(plegada = !leer().ajustes?.lateral?.plegada) {
  void guardarAjustes({ lateral: { ...leer().ajustes?.lateral, plegada } });
}

// ---------- Pestañas (DA56) ----------

const insertarDespues = (e: Estado, p: Pestana) => {
  const i = e.pestanas.findIndex(x => x.id === e.activa);
  return [...e.pestanas.slice(0, i + 1), p, ...e.pestanas.slice(i + 1)];
};
// Al pasar a un PDF, la ruta sigue siendo la de la pantalla anterior: queda montada detrás y, al volver, sigue igual.
const usarPestana = (e: Estado, id: string): Partial<Estado> => {
  const p = e.pestanas.find(x => x.id === id)!;
  const usada = e.pestanas.map(x => x.id === id ? { ...x, usada: Date.now() } : x);
  return p.pdf ? { activa: id, paleta: false, pestanas: usada } : { activa: id, ruta: p.ruta, historial: p.historial, paleta: false, pestanas: usada };
};

// Una pestaña nueva, activa: al final (el botón + y Ctrl+T) o al lado de la actual (lo que se abre desde una pantalla).
export function abrirPestana(ruta: Ruta = { pantalla: "inicio" }, alFinal = true) {
  const p = pestanaNueva(ruta);
  cambiar(e => ({ pestanas: alFinal ? [...e.pestanas, p] : insertarDespues(e, p), ...(ruta.pantalla === "clase" && !hayDuena(e) ? { duena: p.id } : {}) }));
  cambiar(e => usarPestana(e, p.id));
  return p.id;
}

// Pasar a una pestaña. Si muestra una clase que no es la conversación abierta en pi, pi cambia a la suya (y si el tutor
// está respondiendo, antes se pregunta). Devuelve si se pasó.
export async function activarPestana(id: string) {
  const e = leer(), p = e.pestanas.find(x => x.id === id);
  if (!p) return false;
  if (id === e.activa) return true;
  if (!p.pdf && p.ruta.pantalla === "clase" && !(await traerConversacion(id))) return false;
  cambiar(e => usarPestana(e, id));
  return true;
}

// Ir a una pestaña para mostrar ahí una pantalla: su conversación se trae sólo si esa pantalla es la clase.
async function irAPestana(id: string, ruta: Ruta) {
  if (ruta.pantalla === "clase" && !(await traerConversacion(id))) return;
  cambiar(e => usarPestana(e, id));
  if (!mismaRuta(leer().ruta, ruta)) navegar(ruta);
}

export function pestanaVecina(paso: 1 | -1) {
  const e = leer(), i = e.pestanas.findIndex(p => p.id === e.activa);
  void activarPestana(e.pestanas[(i + paso + e.pestanas.length) % e.pestanas.length].id);
}

// Cerrar una pestaña no borra su conversación: queda en Sesiones. La última no se cierra: vuelve a Inicio.
export async function cerrarPestana(id = leer().activa) {
  const e = leer(), i = e.pestanas.findIndex(p => p.id === id);
  if (i < 0) return;
  if (e.pestanas.length === 1) {
    const p = pestanaNueva();
    cambiar(e => ({ pestanas: [p], activa: p.id, ruta: p.ruta, historial: [], duena: e.duena === id ? undefined : e.duena }));
    return;
  }
  if (id === e.activa) {
    const resto = e.pestanas.filter(p => p.id !== id);
    if (!(await activarPestana(resto[Math.min(i, resto.length - 1)].id))) return;
  }
  cambiar(e => ({ pestanas: e.pestanas.filter(p => p.id !== id), duena: e.duena === id ? undefined : e.duena }));
}

// Arrastrar una pestaña: queda antes o después de otra.
export function moverPestana(id: string, junto: string, despues: boolean) {
  if (id === junto) return;
  cambiar(e => {
    const p = e.pestanas.find(x => x.id === id);
    if (!p) return {};
    const resto = e.pestanas.filter(x => x.id !== id), i = resto.findIndex(x => x.id === junto);
    if (i < 0) return {};
    return { pestanas: [...resto.slice(0, i + (despues ? 1 : 0)), p, ...resto.slice(i + (despues ? 1 : 0))] };
  });
}

const tituloDeSesion = (s: EstadoSesion) => s.curso ? (s.curso.nombreTema ?? nombreTema(s.curso.curso, s.curso.tema)) : s.nombre;

export function tituloPestana(e: Estado, p: Pestana): string {
  if (p.pdf) return p.pdf.titulo ?? e.cursos.find(c => c.slug === p.pdf!.curso)?.documentos.find(d => d.id === p.pdf!.doc)?.titulo ?? "PDF";
  const r = p.ruta;
  switch (r.pantalla) {
    case "clase": return (p.id === e.duena ? tituloDeSesion(e.sesion) ?? (e.items.length ? undefined : "Conversación nueva") : p.titulo) ?? "Conversación";
    case "inicio": return "Inicio";
    case "curso": return nombreCurso(r.slug);
    case "tema": return nombreTema(r.slug, r.id);
    case "tema-libre": return "Tema libre";
    case "nota": return r.ruta.split("/").pop()!.replace(/\.md$/, "");
    case "crear-curso": return "Crear curso";
    case "ajustes": return "Ajustes";
    case "preparar": return "Preparar la computadora";
    case "sesiones": return "Sesiones";
  }
}

// Antes de cambiar la conversación de pi: si el tutor está respondiendo, se pregunta si cortar la respuesta.
async function puedeCambiar() {
  const e = leer();
  if (!e.trabajando) return true;
  const duena = e.pestanas.find(p => p.id === e.duena);
  const nombre = duena ? tituloPestana(e, duena) : tituloDeSesion(e.sesion) ?? "la conversación abierta";
  if (!(await confirmarApp("El tutor está respondiendo", `Para pasar a otra conversación hay que cortar la respuesta en «${nombre}». La conversación queda guardada y sigue cuando vuelvas a su pestaña.`, "Cortar y cambiar", "Esperar"))) return false;
  await cortar();
  return true;
}

// Una conversación sin mensajes no llega a guardarse: su pestaña la suelta y, si vuelve a la clase, empieza otra.
function soltarConversacionVacia() {
  const e = leer();
  if (e.items.length || !e.duena) return;
  cambiar({ pestanas: e.pestanas.map(p => p.id === e.duena ? { ...p, sesion: undefined, titulo: undefined } : p) });
}

// Que pi tenga abierta la conversación de una pestaña: la suya si tiene una; si no, la abierta (si no es de otra
// pestaña) o una nueva.
async function traerConversacion(id: string) {
  const e = leer(), p = e.pestanas.find(x => x.id === id);
  if (!p) return false;
  const propia = p.sesion ? p.sesion === e.sesion.archivo : !hayDuena(e) || e.duena === id;
  if (propia) { cambiar({ duena: id }); return true; }
  if (!(await puedeCambiar())) return false;
  soltarConversacionVacia();
  cambiar({ duena: id });
  const s = (p.sesion && await pedir<EstadoSesion>("abrir-sesion", { ruta: p.sesion }, true)) || await pedir<EstadoSesion>("nueva-sesion");
  if (s) cambiar({ sesion: s });
  return !!s;
}

// Antes de abrir o empezar una conversación desde la pestaña activa: la pestaña se queda con la conversación de pi.
// «otra» si era de otra pestaña: la acción tiene que empezar una nueva para no pisar aquélla.
async function tomarConversacion(): Promise<"propia" | "otra" | undefined> {
  const e = leer();
  if (!hayDuena(e) || e.duena === e.activa) { cambiar({ duena: e.activa }); return "propia"; }
  if (!(await puedeCambiar())) return undefined;
  soltarConversacionVacia();
  cambiar({ duena: e.activa });
  return "otra";
}

// Una conversación nueva en la pestaña activa (tema libre, armado de un curso, sesión nueva).
export async function nuevaConversacion() {
  if (!(await tomarConversacion())) return false;
  return !!(await pedir("nueva-sesion"));
}

// Al abrir la app (o al volver a abrir pi), la pestaña activa que mostraba una clase vuelve a su conversación.
async function retomarPestanaActiva() {
  const e = leer(), p = pestanaActiva(e);
  if (!p.pdf && p.ruta.pantalla === "clase") await traerConversacion(p.id);
}

const PANTALLAS = new Set(["inicio", "clase", "curso", "tema", "tema-libre", "nota", "crear-curso", "ajustes", "sesiones"]);
const texto = (v: unknown) => typeof v === "string" ? v : undefined;
function rutaGuardada(r: any): Ruta | undefined {
  if (!r || !PANTALLAS.has(r.pantalla)) return undefined;
  if ((r.pantalla === "curso" || r.pantalla === "tema") && !texto(r.slug)) return undefined;
  if (r.pantalla === "tema" && !texto(r.id)) return undefined;
  if (r.pantalla === "nota" && !texto(r.ruta)) return undefined;
  return r as Ruta;
}

// Las pestañas vuelven en el próximo arranque si es el mismo vault: la pantalla de cada una (sin historial), su
// conversación y los PDF en la página donde quedaron.
function restaurarPestanas(a: Ajustes) {
  const g = a.pestanas;
  if (!g || g.vault !== a.vault || !Array.isArray(g.lista)) return;
  const lista: Pestana[] = [];
  for (const x of g.lista as any[]) {
    if (x?.pdf && texto(x.pdf.curso) && texto(x.pdf.doc)) lista.push(pestanaNueva({ pantalla: "inicio" }, { pdf: { curso: x.pdf.curso, doc: x.pdf.doc, pagina: Number(x.pdf.pagina) || undefined, titulo: texto(x.pdf.titulo), n: 0 } }));
    else { const ruta = rutaGuardada(x?.ruta); if (ruta) lista.push(pestanaNueva(ruta, { sesion: texto(x.sesion), titulo: texto(x.titulo) })); }
  }
  if (!lista.length) return;
  const activa = lista[Math.min(Math.max(0, Math.trunc(Number(g.activa)) || 0), lista.length - 1)];
  cambiar({ pestanas: lista, activa: activa.id, ruta: activa.ruta, historial: [] });
}

let guardando: ReturnType<typeof setTimeout> | undefined, ultimasGuardadas = "";
function guardarPestanas() {
  clearTimeout(guardando);
  guardando = setTimeout(() => {
    const e = leer(), vault = e.ajustes?.vault;
    if (!vault) return;
    const lista = e.pestanas.map(p => p.pdf ? { pdf: { curso: p.pdf.curso, doc: p.pdf.doc, pagina: p.pdf.pagina, titulo: p.pdf.titulo } }
      : { ruta: p.ruta.pantalla === "preparar" ? { pantalla: "inicio" } : p.ruta, sesion: p.sesion, titulo: p.titulo });
    const pestanas = { vault, lista, activa: e.pestanas.findIndex(p => p.id === e.activa) };
    const json = JSON.stringify(pestanas);
    if (json === ultimasGuardadas) return;
    ultimasGuardadas = json;
    void window.learn.ajustes({ pestanas }).catch(() => {});
  }, 800);
}
let pestanasVistas = estado.pestanas, activaVista = estado.activa;
suscribir(() => {
  if (estado.pestanas === pestanasVistas && estado.activa === activaVista) return;
  pestanasVistas = estado.pestanas; activaVista = estado.activa;
  guardarPestanas();
});

// Una pestaña restaurada puede ser de un curso que ya no está: vuelve a Inicio (o se cierra, si era su PDF).
function limpiarPestanas(cursos: ResumenCurso[]) {
  const hay = new Set(cursos.map(c => c.slug));
  const huerfana = (r: Ruta) => (r.pantalla === "curso" || r.pantalla === "tema") && !hay.has(r.slug);
  cambiar(e => {
    let pestanas = e.pestanas.filter(p => !p.pdf || hay.has(p.pdf.curso))
      .map(p => huerfana(p.ruta) || p.historial.some(huerfana) ? { ...p, ruta: huerfana(p.ruta) ? { pantalla: "inicio" } as Ruta : p.ruta, historial: p.historial.filter(r => !huerfana(r)) } : p);
    if (pestanas.length === e.pestanas.length && pestanas.every((p, i) => p === e.pestanas[i])) return {};
    if (!pestanas.length) pestanas = [pestanaNueva()];
    const activa = pestanas.find(p => p.id === e.activa) ?? pestanas[0];
    return { pestanas, activa: activa.id, ruta: activa.ruta, historial: activa.historial, duena: pestanas.some(p => p.id === e.duena) ? e.duena : undefined };
  });
}

// ---------- Escala de la interfaz (DA55) ----------

export function cambiarEscala(paso: 1 | -1 | 0) {
  const actual = escalaValida(leer().ajustes?.escala), nueva = pasoEscala(actual, paso);
  if (nueva !== actual) void guardarAjustes({ escala: nueva });
}

// ---------- Avisos ----------

let siguienteAviso = 1;
export function avisar(texto: string, nivel: Aviso["nivel"] = "info", accion?: Aviso["accion"]) {
  const a: Aviso = { id: siguienteAviso++, texto, nivel, hora: Date.now(), accion };
  cambiar(e => ({ avisos: [...e.avisos.slice(-60), a], toasts: [...e.toasts.slice(-3), a] }));
  if (nivel !== "error") setTimeout(() => cerrarToast(a.id), accion ? 20000 : nivel === "info" ? 7000 : 12000);
}
export const cerrarToast = (id: number) => cambiar(e => ({ toasts: e.toasts.filter(t => t.id !== id) }));
const error = (e: unknown) => avisar(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(e), "error");

// ---------- Host ----------

export async function pedir<T = any>(tipo: string, datos?: unknown, silencioso = false): Promise<T | undefined> {
  try { return await window.learn.pedir<T>(tipo, datos); }
  catch (e) { if (!silencioso) error(e); return undefined; }
}

function upsert(items: Item[], item: Item): Item[] {
  const i = items.findIndex(x => x.id === item.id && (x.tipo === item.tipo || (x.tipo === "herramienta" && item.tipo === "herramienta")));
  if (i < 0) return [...items, item];
  const copia = items.slice();
  copia[i] = item;
  return copia;
}

let refresco: ReturnType<typeof setTimeout> | undefined;
// Después de cada turno el progreso, la preparación o el índice pueden haber cambiado: se relee sin apuro.
function refrescarLuego() {
  clearTimeout(refresco);
  refresco = setTimeout(() => { void refrescarCursos(); void refrescarInicio(); void refrescarConsumo(); }, 600);
}

function alMensaje(m: any) {
  if (typeof m?.tipo === "string" && m.tipo.startsWith("subagente-")) return alMensajeSubagente(m);
  switch (m?.tipo) {
    case "confianza": return cambiar({ confianza: m.carpeta, arranque: "arrancando" });
    case "listo":
      cambiar({ arranque: "listo", info: { vault: m.vault, piDir: m.piDir, version: m.version, offline: m.offline, aviso: m.aviso }, confianza: undefined, errorFatal: undefined });
      if (m.aviso) avisar(m.aviso, "advertencia");
      void refrescarCursos(); void refrescarInicio(); void refrescarConsumo();
      void pedir<Comando[]>("comandos", {}, true).then(c => c && cambiar({ comandos: c }));
      if (m.subagentes && !m.subagentes.disponible) avisar(`Los subagentes no van a poder abrir sus paneles: ${m.subagentes.motivo}`, "advertencia");
      void retomarPestanaActiva();
      return;
    case "error-fatal": return cambiar({ arranque: "error", errorFatal: m.mensaje });
    case "host-cerrado": return cambiar(e => e.arranque === "error" ? {} : { arranque: "cerrado", trabajando: false, pedidos: [] });
    case "transcripcion": return cambiar({ items: m.items ?? [], pedidos: [], pensando: false });
    case "sesion": {
      const { tipo: _t, ...s } = m;
      // La pestaña de la conversación sigue a pi: /new, duplicar o empezar desde un mensaje la cambian ahí mismo.
      cambiar(e => {
        const p = e.pestanas.find(x => x.id === e.duena), titulo = tituloDeSesion(s);
        const pestanas = p && !p.pdf && (p.sesion !== s.archivo || p.titulo !== titulo) ? e.pestanas.map(x => x === p ? { ...p, sesion: s.archivo, titulo } : x) : e.pestanas;
        return { sesion: s, trabajando: !!s.trabajando, pestanas };
      });
      const c = s.curso;
      void window.learn.titulo(c ? `${nombreCurso(c.curso)} · ${c.nombreTema ?? nombreTema(c.curso, c.tema)}` : s.nombre ?? "");
      return;
    }
    case "trabajando":
      cambiar({ trabajando: !!m.activo, ...(m.activo ? {} : { pensando: false, etiquetaTrabajando: undefined, cola: 0 }) });
      if (!m.activo) refrescarLuego();
      return;
    case "tutor-texto": return cambiar(e => {
      if (!m.texto?.trim()) return { items: m.enCurso ? e.items : e.items.filter(x => !(x.tipo === "tutor" && x.id === m.id)), pensando: m.enCurso ? e.pensando : false };
      return { items: upsert(e.items, { tipo: "tutor", id: m.id, texto: m.texto, enCurso: !!m.enCurso }), pensando: false };
    });
    case "pensando": return cambiar({ pensando: true });
    case "item": return cambiar(e => ({
      items: upsert(e.items, m.item),
      // La tarjeta en vivo del quiz (o de desarrollo) se reemplaza por la ya corregida de la transcripción.
      pedidos: m.item?.tipo === "quiz" || m.item?.tipo === "desarrollo" ? e.pedidos.filter(p => p.id !== m.item.id) : e.pedidos,
    }));
    case "item-cambio": return cambiar(e => {
      const previo = e.items.find(x => x.id === m.id);
      if (previo) return { items: e.items.map(x => x.id === m.id ? { ...x, ...m.cambios } : x), pedidos: e.pedidos.filter(p => p.id !== m.id) };
      const p = e.pedidos.find(x => x.id === m.id);
      if (p?.clase === "ask") {
        const item: Item = { tipo: "pregunta", id: p.id, pregunta: p.pregunta, contexto: p.contexto, modo: p.modo, opciones: p.opciones.map(o => ({ indice: o.indice, label: o.label })), ...m.cambios };
        return { items: [...e.items, item], pedidos: e.pedidos.filter(x => x.id !== m.id) };
      }
      return { pedidos: e.pedidos.filter(x => x.id !== m.id) };
    });
    case "estado": return cambiar(e => {
      const estados = { ...e.estados };
      if (m.texto) estados[m.clave] = m.texto; else delete estados[m.clave];
      return { estados };
    });
    case "widget": return cambiar(e => {
      const widgets = { ...e.widgets };
      if (Array.isArray(m.lineas) && m.lineas.length) widgets[m.clave] = m.lineas.map(String); else delete widgets[m.clave];
      return { widgets };
    });
    case "cola": return cambiar({ cola: m.pendientes ?? 0 });
    case "nombre-sesion": return cambiar(e => ({ sesion: { ...e.sesion, nombre: m.nombre },
      pestanas: e.sesion.curso ? e.pestanas : e.pestanas.map(p => p.id === e.duena && !p.pdf ? { ...p, titulo: m.nombre } : p) }));
    case "aviso": return avisar(String(m.texto ?? ""), m.nivel === "error" ? "error" : m.nivel === "advertencia" ? "advertencia" : "info");
    case "pedido": {
      const { tipo: _t, ...p } = m;
      return cambiar(e => ({ pedidos: [...e.pedidos.filter(x => x.id !== p.id), p as Pedido] }));
    }
    case "pedido-cerrado": return cambiar(e => ({
      // Un quiz ya corregido (o una de desarrollo ya respondida) queda a la vista hasta que llegue su resultado; lo demás se cierra.
      pedidos: e.pedidos.flatMap(p => p.id !== m.id ? [p] : (p.clase === "quiz" || p.clase === "desarrollo") && p.correccion ? [{ ...p, cerrado: true }] : []),
    }));
    case "correccion": {
      const { tipo: _t, id, ...c } = m;
      return cambiar(e => ({ pedidos: e.pedidos.map(p => p.id !== id ? p : p.clase === "quiz" ? { ...p, correccion: c } : p.clase === "desarrollo" ? { ...p, correccion: c } : p) }));
    }
    case "pantalla": return abrirPantallaPi(m.nombre, m.datos ?? {});
    case "pedido-salir": void window.learn.salir(); return;
    case "titulo": void window.learn.titulo(String(m.texto ?? "")); return;
    case "etiqueta-trabajando": return cambiar({ etiquetaTrabajando: m.texto || undefined });
    case "etiqueta-pensando": return;
    case "texto-editor": return cambiar(e => ({ textoEditor: { texto: String(m.texto ?? ""), n: (e.textoEditor?.n ?? 0) + 1 } }));
    case "login-pedido": return cambiar(e => e.login ? { login: { ...e.login, pedido: { id: m.id, ...m.pedido } } } : {});
    case "login-cerrado": return cambiar(e => e.login && e.login.pedido?.id === m.id ? { login: { ...e.login, pedido: undefined } } : {});
    case "login-evento": {
      if (m.evento?.type === "auth_url" && m.evento.url) void window.learn.abrirExterno(m.evento.url);
      return cambiar(e => e.login ? { login: { ...e.login, eventos: [...e.login.eventos, m.evento] } } : {});
    }
    case "login-fin":
      if (m.ok) avisar(`Sesión iniciada con ${leer().login?.nombre ?? m.proveedor}.`);
      return cambiar(e => e.login ? { login: { ...e.login, pedido: undefined, fin: { ok: !!m.ok, error: m.error } } } : {});
    default: return;
  }
}

// Comandos de pi que piden una pantalla (los manda el host cuando se escriben con /).
function abrirPantallaPi(nombre: string, datos: any) {
  if (nombre === "resume") return navegar({ pantalla: "sesiones" });
  if (["model", "thinking", "scoped-models"].includes(nombre)) return navegar({ pantalla: "ajustes", seccion: "modelos" });
  if (["login", "logout"].includes(nombre)) return navegar({ pantalla: "ajustes", seccion: "cuentas" });
  if (nombre === "settings") return navegar({ pantalla: "ajustes" });
  if (nombre === "quit") { void window.learn.salir(); return; }
  if (nombre === "copy") { void copiarUltimo(); return; }
  if (nombre === "import" && datos?.argumentos) { void importarSesion(datos.argumentos); return; }
  if (nombre === "clone") { void pedir("clonar").then(r => r && avisar("Sesión duplicada: seguís en la copia.")); return; }
  if (["session", "tree", "fork", "changelog", "hotkeys", "trust", "name", "md-log", "import"].includes(nombre)) cambiar({ pantallaPi: { nombre, datos } });
}

// ---------- Arranque ----------

let iniciado = false;
export async function iniciar() {
  if (iniciado) return;
  iniciado = true;
  window.learn.alMensaje(alMensaje);
  const [app, ajustes, host] = await Promise.all([window.learn.info(), window.learn.ajustes(), window.learn.estadoHost()]);
  cambiar({ app, ajustes });
  aplicarTema(ajustes.tema);
  restaurarPestanas(ajustes);
  void window.learn.foco().then(h => cambiar({ semanaFoco: h }));
  if (host.estado === "listo" || host.estado === "arrancando") {
    // La ventana se recargó con el host vivo: se pide de nuevo lo que hace falta. La conversación abierta es de la
    // pestaña que la tenía.
    cambiar({ arranque: "listo" });
    const s = await pedir<EstadoSesion>("estado", {}, true);
    if (s) cambiar(e => ({ sesion: s, duena: e.pestanas.find(p => !p.pdf && p.sesion && p.sesion === s.archivo)?.id }));
    void retomarPestanaActiva();
    void refrescarCursos(); void refrescarInicio(); void refrescarConsumo();
    void pedir<Comando[]>("comandos", {}, true).then(c => c && cambiar({ comandos: c }));
    void pedir<{ id: string; nombre: string; vivo: boolean; historia: string }[]>("subagentes", {}, true).then(l => { if (l?.length) restaurarSubagentes(l); });
    return;
  }
  if (!ajustes.vault) return cambiar(e => ({ arranque: "sin-vault", ...ponerRuta(e, { pantalla: "preparar" }, []) }));
  await arrancar(ajustes.vault);
}

export async function arrancar(vault: string) {
  // pi vuelve a abrir con una conversación nueva: ninguna pestaña la tiene todavía. Con otro vault, las pestañas del
  // anterior no sirven: queda sólo la activa, sin conversación.
  cambiar(e => {
    if (e.ajustes?.vault === vault) return { duena: undefined };
    const p = { ...pestanaActiva(e), sesion: undefined, titulo: undefined, pdf: undefined };
    if (pestanaActiva(e).pdf) p.ruta = { pantalla: "inicio" };
    return { duena: undefined, pestanas: [p], activa: p.id, ruta: p.ruta, historial: p.historial };
  });
  cambiar({ arranque: "arrancando", errorFatal: undefined, items: [], pedidos: [], sesion: {}, cursos: [], cursosListos: false, seguir: undefined });
  await window.learn.arrancar(vault);
  const a = await window.learn.ajustes();
  cambiar({ ajustes: a });
}

export function responderConfianza(aceptar: boolean) {
  window.learn.enviarHost({ tipo: "confianza", aceptar });
  cambiar({ confianza: undefined });
}

export function aplicarTema(tema: Ajustes["tema"]) {
  const raiz = document.documentElement;
  if (tema === "sistema") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", tema);
}

export async function guardarAjustes(cambios: Partial<Ajustes>) {
  const a = await window.learn.ajustes(cambios);
  cambiar({ ajustes: a });
  if (cambios.tema) aplicarTema(a.tema);
  if (cambios.planes) void refrescarConsumo();
  return a;
}

// ---------- Datos ----------

export async function refrescarCursos() {
  const c = await pedir<ResumenCurso[]>("cursos", {}, true);
  if (!c) return;
  const primeraVez = !leer().cursosListos;
  cambiar({ cursos: c, cursosListos: true });
  if (primeraVez) limpiarPestanas(c);
}
export async function refrescarInicio() {
  const [seguir, sesiones] = await Promise.all([pedir<Seguir>("seguir", {}, true), pedir<SesionGuardada[]>("sesiones", {}, true)]);
  cambiar({ seguir: seguir ?? null, sesiones: sesiones ?? [] });
}
// ---------- Consumo (DA48) ----------

const avisadosConsumo = new Set<string>();
export async function refrescarConsumo() {
  const c = await pedir<Consumo>("consumo", { planes: leer().ajustes?.planes ?? {} }, true);
  if (!c || c.sinRegistro) return;
  cambiar({ consumo: c });
  avisarSiEscasea(c);
}
// Una vez por umbral y por modelo en cada apertura de la app, con el modelo que alcanzaría para bastante más.
function avisarSiEscasea(c: Consumo) {
  const a = c.actual, cuenta = a && c.cuentas.find(x => x.proveedor === a.proveedor);
  if (!a || !cuenta) return;
  const s = c.sugerido;
  const accion = s ? { texto: `Usar ${s.nombre}`, hacer: () => void elegirModelo(s.proveedor, s.id, s.nombre) } : undefined;
  const alternativa = s ? ` Con ${s.nombre} ${s.gratis ? "no tiene costo" : `serían ${textoRinde(s)}`}.` : "";
  let clave: string, texto: string;
  if (cuenta.agotado) {
    clave = `${a.clave}:agotado:${cuenta.agotado.desde}`;
    texto = `La cuenta de ${cuenta.nombre} llegó a su límite por ahora${cuenta.agotado.hasta ? `: vuelve ${cuando(cuenta.agotado.hasta)}` : ""}.${alternativa}`;
  } else {
    if (a.quedan === undefined || a.quedan >= 30) return;
    clave = `${a.clave}:${a.quedan < 10 ? 10 : 30}`;
    texto = `Te quedan ${textoRinde(a)} con ${a.nombre}.${alternativa}`;
  }
  if (avisadosConsumo.has(clave)) return;
  avisadosConsumo.add(clave);
  avisar(texto, "advertencia", accion);
}
// El modelo de la clase: se cambia en la sesión y queda como modelo principal de esta computadora (DA49).
export async function elegirModelo(proveedor: string, id: string, nombre?: string) {
  const r = await pedir<EstadoSesion>("elegir-modelo", { proveedor, id });
  if (!r) return false;
  cambiar({ sesion: r });
  await window.learn.configLocal({ modelo_principal: `${proveedor}/${id}` }).catch(() => undefined);
  avisar(`La clase sigue con ${nombre ?? r.modelo?.nombre ?? id}. Queda elegido en esta computadora.`);
  void refrescarConsumo();
  return true;
}

export const nombreCurso = (slug: string) => leer().cursos.find(c => c.slug === slug)?.nombre ?? slug;
export const nombreTema = (slug: string, id: string) => leer().cursos.find(c => c.slug === slug)?.temas.find(t => t.id === id)?.nombre ?? id;

// ---------- Clase ----------

export async function enviar(texto: string, imagenes: Imagen[] = [], modo?: "steer" | "followUp") {
  const r = await pedir<{ disposicion: string }>("enviar", { texto, imagenes, modo });
  return r?.disposicion;
}
export async function enviarYEsperar(texto: string) {
  return pedir<{ disposicion: string }>("enviar", { texto, esperar: true });
}
export const cortar = () => pedir("cortar");
// Un diálogo de las extensiones (select, confirm, input, editor) se cierra al responder; el quiz y las preguntas se
// reemplazan por su resultado cuando termina la tool.
export async function responder(id: string, respuesta: unknown) {
  const p = leer().pedidos.find(x => x.id === id);
  if (p && p.clase !== "quiz" && p.clase !== "desarrollo" && p.clase !== "ask") cambiar(e => ({ pedidos: e.pedidos.filter(x => x.id !== id) }));
  const r = await pedir<{ abierto: boolean }>("responder", { pedido: id, respuesta });
  if (r && !r.abierto) cambiar(e => ({ pedidos: e.pedidos.filter(x => x.id !== id) }));
}

// Hay una clase abierta de este curso en otro pi (por ejemplo pi-learn en la terminal)? Se confirma antes.
async function otraInstancia(slug: string): Promise<boolean> {
  const otras = await pedir<{ curso: string; tema: string; sesion?: string }[]>("instancias", {}, true) ?? [];
  const o = otras.find(x => x.curso === slug && x.sesion !== leer().sesion.archivo);
  if (!o) return true;
  return confirmarApp(`Hay otra ventana de pi con una clase abierta de ${nombreCurso(slug)} (${nombreTema(slug, o.tema)}), por ejemplo pi-learn en la terminal.`,
    "Abrir la misma clase en dos lugares mezcla la nota y el progreso. Cerrala allá con /fin antes de seguir acá, o seguí igual si ya no la usás.", "Seguir igual");
}

// Empezar o cambiar de tema, como /estudiar: en la misma sesión si hay una clase (la extensión pregunta «Guardar y
// cambiar»); en una sesión nueva si la actual es otra conversación (tema libre, armado de un curso). modo: «desde-cero»
// o «fortalecer» (DA52); sin él, seguir donde quedó.
// Desde una pestaña que no tiene la conversación abierta, la clase empieza en una conversación nueva (DA56).
export async function estudiar(slug: string, temaId: string, modo?: string) {
  if (!(await otraInstancia(slug))) return;
  const toma = await tomarConversacion();
  if (!toma) return;
  const e = leer();
  if (toma === "otra" || (!e.sesion.curso && e.items.length)) await pedir("nueva-sesion");
  navegar({ pantalla: "clase" });
  await enviar(`/estudiar ${slug} ${temaId}${modo && modo !== "seguir" ? ` ${modo}` : ""}`);
}

// Modos y mezclas de preguntas del .pi (undefined si es anterior a DA52) y la mezcla elegida en esta máquina.
export async function opcionesEstudio(): Promise<Estudio | undefined> {
  return (await pedir<Estudio | undefined>("estudio", {}, true)) ?? undefined;
}
// Automático es lo de siempre: no queda escrito, como con /preguntas en la terminal.
export async function elegirPreguntas(id: string) {
  await window.learn.configLocal({ preguntas: id === "automatico" ? undefined : id });
}

export async function seguirClase(s: Seguir) {
  if (!s.curso) return;
  if (s.accion === "estudiar") return estudiar(s.curso.curso, s.curso.tema);
  return retomar(s.ruta, false, s.curso.curso);
}

// Retomar una sesión guardada, en la pestaña activa o en una nueva (DA56). Si ya está en una pestaña, se va a ésa.
export async function abrirSesion(ruta: string, enPestanaNueva = false) {
  return retomar(ruta, enPestanaNueva);
}

async function retomar(ruta: string, enPestanaNueva: boolean, curso?: string) {
  const ya = leer().pestanas.find(p => !p.pdf && p.sesion === ruta);
  if (ya) return irAPestana(ya.id, { pantalla: "clase" });
  if (leer().sesion.archivo !== ruta) {
    if (curso === undefined) curso = (await pedir<{ curso?: { curso: string } }>("detalle-sesion", { ruta }, true))?.curso?.curso;
    if (curso && !(await otraInstancia(curso))) return;
  }
  if (enPestanaNueva) {
    const p = pestanaNueva({ pantalla: "clase" }, { sesion: ruta });
    cambiar(e => ({ pestanas: insertarDespues(e, p) }));
    if (!(await activarPestana(p.id))) cambiar(e => ({ pestanas: e.pestanas.filter(x => x.id !== p.id) }));
    return;
  }
  if (!(await tomarConversacion())) return;
  if (leer().sesion.archivo !== ruta && !(await pedir("abrir-sesion", { ruta }))) return;
  navegar({ pantalla: "clase" });
}

export async function nuevaSesion() {
  if (!(await nuevaConversacion())) return;
  navegar({ pantalla: "clase" });
}

export async function copiarUltimo() {
  const r = await pedir<{ texto: string }>("ultimo-texto");
  if (!r?.texto) return avisar("Todavía no hay un mensaje del tutor para copiar.", "advertencia");
  await window.learn.copiar(r.texto);
  avisar("Copiaste el último mensaje del tutor.");
}

export async function importarSesion(ruta: string) {
  if (!(await confirmarApp("Importar una sesión", `Se reemplaza la sesión actual por ${ruta}. La actual queda guardada y se puede retomar.`, "Importar"))) return;
  if (!(await tomarConversacion())) return;
  const r = await pedir<{ cancelado: boolean }>("importar", { ruta });
  if (r && !r.cancelado) { avisar("Sesión importada."); navegar({ pantalla: "clase" }); }
}

// Eliminar un curso (DA53): el host dice si algo lo está usando; la confirmación cuenta qué se va y que queda en la papelera.
export async function eliminarCurso(slug: string) {
  const info = await pedir<{ notas: number; bloqueo?: string }>("curso-a-eliminar", { slug });
  if (!info) return;
  if (info.bloqueo) return avisar(info.bloqueo, "advertencia");
  const c = leer().cursos.find(x => x.slug === slug), nombre = c?.nombre ?? slug;
  const temas = c?.temas.filter(t => t.estado !== "sin_empezar").length ?? 0, docs = c?.documentos.length ?? 0;
  const contenido = [
    info.notas ? (info.notas === 1 ? "una nota de clase" : `${info.notas} notas de clase`) : "",
    temas ? (temas === 1 ? "el progreso de un tema" : `el progreso de ${temas} temas`) : "",
    docs ? (docs === 1 ? "la copia del único documento del material" : `las copias de los ${docs} documentos del material`) : "",
  ].filter(Boolean);
  const mensaje = `Va a la papelera la carpeta cursos/${slug}${contenido.length ? `, con:\n${contenido.map(x => `· ${x}`).join("\n")}` : "."}\n\nLos PDFs de _entrada/ no se tocan. Si te arrepentís, restaurá la carpeta desde la papelera.`;
  if (!(await confirmarApp(`¿Eliminar ${nombre}?`, mensaje, "Eliminar el curso", "Cancelar", true))) return;
  try { await window.learn.eliminarCurso(slug); } catch (e) { return error(e); }
  // Volver atrás no puede llevar a una pantalla del curso que ya no está, en ninguna pestaña; sus PDF se cierran.
  const delCurso = (r: Ruta) => ("slug" in r && r.slug === slug) || (r.pantalla === "nota" && r.ruta.startsWith(`cursos/${slug}/`));
  for (const p of leer().pestanas.filter(x => x.pdf?.curso === slug)) await cerrarPestana(p.id);
  cambiar(e => ({
    pestanas: e.pestanas.map(p => p.pdf ? p : { ...p, ruta: p.id === e.activa || delCurso(p.ruta) ? { pantalla: "inicio" } : p.ruta, historial: p.historial.filter(r => !delCurso(r)) }),
  }));
  cambiar(e => usarPestana(e, e.activa));
  await Promise.all([refrescarCursos(), refrescarInicio()]);
  avisar(`Se eliminó ${nombre}. Quedó en la papelera, por si querés recuperarlo.`);
}

// ---------- Panel de página ----------

export async function abrirPagina(args: { cita?: string; curso?: string; doc?: string; pagina?: number; origen: "cita" | "ver_pagina" | "tema" | "material" | "panel" }) {
  cambiar(e => ({ panel: { ...(e.panel ?? { fijo: !!e.ajustes?.panelFijo }), cargando: true, error: undefined } }));
  try {
    const p = await window.learn.pedir<Pagina>("pagina", args);
    cambiar(e => ({ panel: { fijo: e.panel?.fijo ?? false, cargando: false, pagina: p } }));
  } catch (err) {
    const texto = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(err);
    cambiar(e => ({ panel: { fijo: e.panel?.fijo ?? false, cargando: false, error: texto, pagina: e.panel?.pagina } }));
  }
}
export const cerrarPanel = () => cambiar({ panel: undefined });

// La ventana de grabación (DA51): el video o audio de una clase en su propia ventana, en el segundo citado.
export async function abrirGrabacion(cita: string, titulo?: string) {
  try { await window.learn.abrirGrabacion({ cita, titulo }); } catch (e) { error(e); }
}
// El documento entero, en la página pedida: en su propia ventana (DA47) o en una pestaña de la ventana principal (DA56),
// como se elija al abrirlo. Si ya está en una pestaña, se va a ésa.
export async function abrirPdf(pedido: { curso: string; doc: string; pagina?: number }, donde: "ventana" | "pestana") {
  if (donde === "ventana") { try { await window.learn.abrirPdf(pedido); } catch (e) { error(e); } return; }
  const ya = leer().pestanas.find(p => p.pdf?.curso === pedido.curso && p.pdf.doc === pedido.doc);
  if (ya) {
    cambiar(e => ({ pestanas: e.pestanas.map(p => p === ya ? { ...p, pdf: { ...p.pdf!, pagina: pedido.pagina ?? p.pdf!.pagina, n: p.pdf!.n + 1 } } : p) }));
    await activarPestana(ya.id);
    return;
  }
  const p = pestanaNueva({ pantalla: "inicio" }, { pdf: { curso: pedido.curso, doc: pedido.doc, pagina: pedido.pagina, n: 0 } });
  cambiar(e => ({ pestanas: insertarDespues(e, p) }));
  await activarPestana(p.id);
}
// Lo que cuenta la pestaña de PDF: la página donde está (para volver a abrirla ahí) y el título del documento.
export const datosPdf = (id: string, cambios: { pagina?: number; titulo?: string }) =>
  cambiar(e => ({ pestanas: e.pestanas.map(p => p.id === id && p.pdf ? { ...p, pdf: { ...p.pdf, ...cambios } } : p) }));

// ---------- Diálogos propios de la app (no de pi) ----------

// peligro: el botón de aceptar va en rojo y el foco arranca en cancelar, para que un Enter no borre nada.
type Confirmacion = { titulo: string; mensaje: string; si: string; no: string; peligro: boolean; resolver: (v: boolean) => void };
let confirmacionActual: Confirmacion | undefined;
const oyentesConfirmacion = new Set<() => void>();
export function confirmarApp(titulo: string, mensaje: string, si = "Sí", no = "Cancelar", peligro = false): Promise<boolean> {
  return new Promise(resolver => {
    confirmacionActual?.resolver(false);
    confirmacionActual = { titulo, mensaje, si, no, peligro, resolver: v => { confirmacionActual = undefined; for (const f of oyentesConfirmacion) f(); resolver(v); } };
    for (const f of oyentesConfirmacion) f();
  });
}
export function usarConfirmacion() {
  return useSyncExternalStore(f => { oyentesConfirmacion.add(f); return () => { oyentesConfirmacion.delete(f); }; }, () => confirmacionActual);
}

// ---------- Inicio de sesión con un proveedor ----------

export async function iniciarLogin(proveedor: string, nombre: string, metodo: string) {
  cambiar({ login: { proveedor, nombre, metodo, eventos: [] } });
  await pedir("iniciar-sesion", { proveedor, metodo });
}
export function responderLogin(valor: string | undefined) {
  const l = leer().login;
  if (!l?.pedido) return;
  void pedir("login-respuesta", { id: l.pedido.id, valor, cancelar: valor === undefined });
  cambiar({ login: { ...l, pedido: undefined } });
}
export function cerrarLogin() {
  const l = leer().login;
  if (l && !l.fin) void pedir("cancelar-login");
  cambiar({ login: undefined });
}
