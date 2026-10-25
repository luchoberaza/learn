// Lo que viaja entre el host y la interfaz (ver app/host/filtro.mjs e interfaz.mjs) y la API del preload.

export type Imagen = { mimeType: string; data: string };

export type Item =
  | { tipo: "alumno"; id: string; texto: string; imagenes: Imagen[]; skills?: string[] }
  | { tipo: "tutor"; id: string; texto: string; enCurso: boolean }
  | { tipo: "herramienta"; id: string; nombre: string; curso: true; linea: string; estado: EstadoHerramienta; parcial?: string }
  | { tipo: "herramienta"; id: string; nombre: string; curso: false; linea: string; estado: EstadoHerramienta; detalle: { entrada: string; salida: string } }
  | ItemQuiz
  | ItemPregunta
  | { tipo: "sistema"; id: string; clase: "info" | "diff"; texto: string }
  | { tipo: "pagina"; id: string; render: string; cita: string }
  | { tipo: "separador"; id: string; texto: string }
  | { tipo: "error"; id: string; texto: string }
  | { tipo: "aviso-linea"; id: string; texto: string };
export type EstadoHerramienta = "corriendo" | "hecha" | "error";

export interface ItemQuiz {
  tipo: "quiz"; id: string; pregunta: string; contexto?: string; modo: string;
  estado: "respondido" | "cancelado" | "descartado"; mensaje?: string; motivo?: string;
  opciones?: { indice: number; label: string }[];
  resultado?: { elegidas: number[]; correctas: number[]; correcto: boolean; noSe: boolean; nota?: string; explicacion?: string };
}
export interface ItemPregunta {
  tipo: "pregunta"; id: string; pregunta: string; contexto?: string; modo: string;
  opciones: { indice: number; label: string }[];
  estado: "respondido" | "cancelado" | "descartado"; motivo?: string;
  respuestas?: ({ tipo: "option"; indice: number; label: string } | { tipo: "other" | "text"; texto: string })[];
}

export type Pedido =
  | { id: string; clase: "quiz"; pregunta: string; contexto?: string; modo: "single-select" | "multi-select"; opciones: { indice: number; label: string; description?: string }[]; correccion?: Correccion; cerrado?: boolean }
  | { id: string; clase: "ask"; pregunta: string; contexto?: string; modo: "text" | "single-select" | "multi-select"; opciones: { indice: number; label: string; value: string; description?: string }[]; etiquetaOtra: string; cerrado?: boolean }
  | { id: string; clase: "select"; titulo: string; opciones: string[]; cerrado?: boolean }
  | { id: string; clase: "confirm"; titulo: string; mensaje: string; cerrado?: boolean }
  | { id: string; clase: "input"; titulo: string; placeholder?: string; cerrado?: boolean }
  | { id: string; clase: "editor"; titulo: string; prefill?: string; cerrado?: boolean };
export interface Correccion { correctas: number[]; correcto: boolean; noSe: boolean; elegidas: number[]; explicacion?: string; nota?: string }

export interface EstadoSesion {
  archivo?: string; nombre?: string;
  curso?: { curso: string; tema: string; adHoc: boolean; nombreTema?: string; nota?: string; sinNota: boolean };
  simulacro?: { tema: string; desde: string };
  modelo?: { proveedor: string; id: string; nombre: string };
  pensamiento?: string; trabajando?: boolean;
}

export interface ResumenTema {
  id: string; nombre: string; unidad?: number; alias: string[]; estado: string;
  prerequisitos: string[]; prerequisitosFaltan: string[]; objetivos: string[];
  bibliografia: { doc: string; seccion?: string; paginas?: number[] }[];
  progreso: { proximoPaso?: string; objetivo?: string; plan?: string; domina: string[]; falla: string[]; conceptosFirmes: string[]; errores: string[];
    ejercicios: { doc?: string; item?: string; resultado?: string; puntaje?: string | number; fecha?: string }[]; actualizado?: string };
  simulacroDisponible: boolean;
}
export interface ResumenCurso {
  slug: string; nombre: string; contrato?: string; avisos: string[]; error?: string;
  temas: ResumenTema[]; orden: string[]; sugerido?: string;
  documentos: { id: string; titulo: string; tipo: string; paginas: number; archivo: string; prioridad?: number; restringido?: boolean }[];
  examen?: { minutosPorPregunta: number; descripcion: string };
  ingesta?: { estado: string; procesadas: number; solicitadas: number; pendientes: number; documento?: string; pagina?: number };
}

export interface Pagina { curso: string; doc: string; pagina: number; titulo: string; total: number; anterior?: number; siguiente?: number; restringido: boolean; imagen: string }
export interface SesionGuardada { ruta: string; id: string; nombre?: string; modificada: string; mensajes: number; primerMensaje: string }
export interface Seguir { ruta: string; nombre?: string; curso?: { curso: string; tema: string; adHoc: boolean }; abierta: boolean; nota?: string; ultimaFrase?: string; modificada: string; accion: "retomar" | "estudiar" }
export interface Comando { nombre: string; descripcion: string; origen: "learn" | "skill" | "pi" }
export interface NotaResumen { ruta: string; nombre: string; modificada: string }
export interface Aviso { id: number; texto: string; nivel: "info" | "advertencia" | "error"; hora: number }

export interface Ajustes {
  vault?: string; tema: "sistema" | "noche" | "dia"; node?: string; panelFijo: boolean;
  foco: { activo: boolean; foco: number; descanso: number; descansoLargo: number; ciclos: number; sonido: boolean };
}
export type Chequeo = { estado: "ok" | "falla" | "aviso" | "info"; nombre: string; detalle: string };

export interface ApiLearn {
  info(): Promise<{ version: string; plataforma: string; datos: string; e2e: boolean }>;
  ajustes(cambios?: Partial<Ajustes>): Promise<Ajustes>;
  elegirCarpeta(titulo: string): Promise<string | undefined>;
  elegirArchivos(filtro: "pdf" | "imagen" | "nota" | "sesion"): Promise<string[]>;
  arrancar(vault: string): Promise<string>;
  estadoHost(): Promise<{ estado: string; vault?: string }>;
  pedir<T = any>(tipo: string, datos?: unknown): Promise<T>;
  enviarHost(mensaje: unknown): void;
  alMensaje(f: (m: any) => void): () => void;
  diagnostico(): Promise<{ basicos: Chequeo[]; doctor: Chequeo[]; opcionales: Chequeo[]; listoParaAbrir: boolean }>;
  instalar(accion: string, vault?: string): Promise<number>;
  alSalidaSistema(f: (m: { accion: string; linea: string }) => void): () => void;
  aEntrada(rutas: string[]): Promise<string[]>;
  listarEntrada(): Promise<{ nombre: string; bytes: number }[]>;
  rutaDeArchivo(archivo: File): string;
  leerImagen(ruta: string): Promise<{ mimeType?: string; data?: string; ruta?: string; nombre: string }>;
  temporal(nombre: string, base64: string): Promise<string>;
  configLocal(cambios?: Record<string, string | undefined>): Promise<{ base: Record<string, unknown>; local: Record<string, string> }>;
  notaLibre(tema: string): Promise<string>;
  abrirExterno(url: string): Promise<void>;
  abrirEnVault(relativa: string): Promise<string>;
  mostrarEnCarpeta(relativa: string): Promise<void>;
  abrirRegistros(): Promise<string>;
  copiar(texto: string): Promise<void>;
  foco(suma?: { dia: string; minutos: number; bloque: boolean }): Promise<Record<string, { minutos: number; bloques: number }>>;
  titulo(titulo: string): Promise<void>;
  salir(): Promise<void>;
}

declare global { interface Window { learn: ApiLearn } }
