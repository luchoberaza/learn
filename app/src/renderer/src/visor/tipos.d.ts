// Lo que expone el preload de la ventana de PDF (src/preload/visor.ts).
export type Tema = "sistema" | "noche" | "dia";
export interface DatosPdf { titulo: string; total: number; pagina: number; vedadas: number[]; clave: string; tema: Tema; bytes: Uint8Array }

export interface ApiVisor {
  datos(): Promise<DatosPdf>;
  recurso(tipo: string, nombre: string): Promise<Uint8Array>;
  alIr(f: (pagina: number) => void): () => void;
  alRecargar(f: (pagina?: number) => void): () => void;
  alError(f: (mensaje: string) => void): () => void;
  alTema(f: (tema: Tema) => void): () => void;
}

// De dónde saca el lector su documento: el preload de su ventana o, en una pestaña (DA56), la ventana principal.
export type FuentePdf = ApiVisor;

declare global { interface Window { visor: ApiVisor } }
