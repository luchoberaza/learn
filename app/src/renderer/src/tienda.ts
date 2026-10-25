// Estado de la interfaz: una sola tienda, alimentada por los mensajes del host y por las acciones de las pantallas.
// Las pantallas leen campos con usarTienda(e => e.campo): cada campo cambia de referencia sólo cuando cambia.
import { useSyncExternalStore } from "react";
import type { Ajustes, Aviso, Comando, EstadoSesion, Imagen, Item, Pagina, Pedido, ResumenCurso, Seguir, SesionGuardada } from "./tipos";
import { alMensajeSubagente, restaurarSubagentes } from "./componentes/Subagentes";

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

export interface Login {
  proveedor: string; nombre: string; metodo: string;
  eventos: { type: string; message?: string; url?: string; instructions?: string; userCode?: string; verificationUri?: string; links?: { url: string; label?: string }[] }[];
  pedido?: { id: string; tipo: string; mensaje: string; placeholder?: string; opciones?: { id: string; label: string; description?: string }[] };
  fin?: { ok: boolean; error?: string };
}

export interface Estado {
  ruta: Ruta;
  historial: Ruta[];
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
}

let estado: Estado = {
  ruta: { pantalla: "inicio" }, historial: [], arranque: "cargando", sesion: {}, items: [], trabajando: false, pensando: false,
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

export function navegar(ruta: Ruta) {
  cambiar(e => ({ ruta, historial: [...e.historial.slice(-30), e.ruta], paleta: false }));
}
export function volver() {
  cambiar(e => e.historial.length ? { ruta: e.historial[e.historial.length - 1], historial: e.historial.slice(0, -1) } : {});
}

// ---------- Avisos ----------

let siguienteAviso = 1;
export function avisar(texto: string, nivel: Aviso["nivel"] = "info") {
  const a: Aviso = { id: siguienteAviso++, texto, nivel, hora: Date.now() };
  cambiar(e => ({ avisos: [...e.avisos.slice(-60), a], toasts: [...e.toasts.slice(-3), a] }));
  if (nivel !== "error") setTimeout(() => cerrarToast(a.id), nivel === "info" ? 7000 : 12000);
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
  refresco = setTimeout(() => { void refrescarCursos(); void refrescarInicio(); }, 600);
}

function alMensaje(m: any) {
  if (typeof m?.tipo === "string" && m.tipo.startsWith("subagente-")) return alMensajeSubagente(m);
  switch (m?.tipo) {
    case "confianza": return cambiar({ confianza: m.carpeta, arranque: "arrancando" });
    case "listo":
      cambiar({ arranque: "listo", info: { vault: m.vault, piDir: m.piDir, version: m.version, offline: m.offline, aviso: m.aviso }, confianza: undefined, errorFatal: undefined });
      if (m.aviso) avisar(m.aviso, "advertencia");
      void refrescarCursos(); void refrescarInicio();
      void pedir<Comando[]>("comandos", {}, true).then(c => c && cambiar({ comandos: c }));
      if (m.subagentes && !m.subagentes.disponible) avisar(`Los subagentes no van a poder abrir sus paneles: ${m.subagentes.motivo}`, "advertencia");
      return;
    case "error-fatal": return cambiar({ arranque: "error", errorFatal: m.mensaje });
    case "host-cerrado": return cambiar(e => e.arranque === "error" ? {} : { arranque: "cerrado", trabajando: false, pedidos: [] });
    case "transcripcion": return cambiar({ items: m.items ?? [], pedidos: [], pensando: false });
    case "sesion": {
      const { tipo: _t, ...s } = m;
      cambiar({ sesion: s, trabajando: !!s.trabajando });
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
      // La tarjeta en vivo del quiz se reemplaza por el quiz ya corregido de la transcripción.
      pedidos: m.item?.tipo === "quiz" ? e.pedidos.filter(p => p.id !== m.item.id) : e.pedidos,
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
    case "nombre-sesion": return cambiar(e => ({ sesion: { ...e.sesion, nombre: m.nombre } }));
    case "aviso": return avisar(String(m.texto ?? ""), m.nivel === "error" ? "error" : m.nivel === "advertencia" ? "advertencia" : "info");
    case "pedido": {
      const { tipo: _t, ...p } = m;
      return cambiar(e => ({ pedidos: [...e.pedidos.filter(x => x.id !== p.id), p as Pedido] }));
    }
    case "pedido-cerrado": return cambiar(e => ({
      // Un quiz ya corregido queda a la vista hasta que llegue su resultado; lo demás se cierra.
      pedidos: e.pedidos.flatMap(p => p.id !== m.id ? [p] : p.clase === "quiz" && p.correccion ? [{ ...p, cerrado: true }] : []),
    }));
    case "correccion": {
      const { tipo: _t, id, ...c } = m;
      return cambiar(e => ({ pedidos: e.pedidos.map(p => p.id === id && p.clase === "quiz" ? { ...p, correccion: c } : p) }));
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
  void window.learn.foco().then(h => cambiar({ semanaFoco: h }));
  if (host.estado === "listo" || host.estado === "arrancando") {
    // La ventana se recargó con el host vivo: se pide de nuevo lo que hace falta.
    cambiar({ arranque: "listo" });
    const s = await pedir<EstadoSesion>("estado", {}, true);
    if (s) cambiar({ sesion: s });
    void refrescarCursos(); void refrescarInicio();
    void pedir<Comando[]>("comandos", {}, true).then(c => c && cambiar({ comandos: c }));
    void pedir<{ id: string; nombre: string; vivo: boolean; historia: string }[]>("subagentes", {}, true).then(l => { if (l?.length) restaurarSubagentes(l); });
    return;
  }
  if (!ajustes.vault) return cambiar({ arranque: "sin-vault", ruta: { pantalla: "preparar" } });
  await arrancar(ajustes.vault);
}

export async function arrancar(vault: string) {
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
  return a;
}

// ---------- Datos ----------

export async function refrescarCursos() {
  const c = await pedir<ResumenCurso[]>("cursos", {}, true);
  if (c) cambiar({ cursos: c, cursosListos: true });
}
export async function refrescarInicio() {
  const [seguir, sesiones] = await Promise.all([pedir<Seguir>("seguir", {}, true), pedir<SesionGuardada[]>("sesiones", {}, true)]);
  cambiar({ seguir: seguir ?? null, sesiones: sesiones ?? [] });
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
  if (p && p.clase !== "quiz" && p.clase !== "ask") cambiar(e => ({ pedidos: e.pedidos.filter(x => x.id !== id) }));
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
// cambiar»); en una sesión nueva si la actual es otra conversación (tema libre, armado de un curso).
export async function estudiar(slug: string, temaId: string) {
  if (!(await otraInstancia(slug))) return;
  const e = leer();
  if (!e.sesion.curso && e.items.length) await pedir("nueva-sesion");
  navegar({ pantalla: "clase" });
  await enviar(`/estudiar ${slug} ${temaId}`);
}

export async function seguirClase(s: Seguir) {
  if (!s.curso) return;
  if (s.accion === "estudiar") return estudiar(s.curso.curso, s.curso.tema);
  if (leer().sesion.archivo !== s.ruta) {
    if (!(await otraInstancia(s.curso.curso))) return;
    const r = await pedir("abrir-sesion", { ruta: s.ruta });
    if (!r) return;
  }
  navegar({ pantalla: "clase" });
}

export async function abrirSesion(ruta: string) {
  if (leer().sesion.archivo !== ruta) {
    const d = await pedir<{ curso?: { curso: string } }>("detalle-sesion", { ruta }, true);
    if (d?.curso && !(await otraInstancia(d.curso.curso))) return;
    if (!(await pedir("abrir-sesion", { ruta }))) return;
  }
  navegar({ pantalla: "clase" });
}

export async function nuevaSesion() {
  await pedir("nueva-sesion");
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
  const r = await pedir<{ cancelado: boolean }>("importar", { ruta });
  if (r && !r.cancelado) { avisar("Sesión importada."); navegar({ pantalla: "clase" }); }
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

// ---------- Diálogos propios de la app (no de pi) ----------

type Confirmacion = { titulo: string; mensaje: string; si: string; no: string; resolver: (v: boolean) => void };
let confirmacionActual: Confirmacion | undefined;
const oyentesConfirmacion = new Set<() => void>();
export function confirmarApp(titulo: string, mensaje: string, si = "Sí", no = "Cancelar"): Promise<boolean> {
  return new Promise(resolver => {
    confirmacionActual?.resolver(false);
    confirmacionActual = { titulo, mensaje, si, no, resolver: v => { confirmacionActual = undefined; for (const f of oyentesConfirmacion) f(); resolver(v); } };
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
