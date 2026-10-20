// Búsqueda pura: el mismo JSON de Python se podrá leer durante la sesión sin OCR ni módulos nativos.
export interface Fragmento {
  doc: string;
  titulo: string;
  tipo: string;
  pagina: number;
  seccion: string | null;
  texto: string;
  cita: string;
  calidad: number;
  pendiente: boolean;
  largo: number;
  frecuencias: Record<string, number>;
}
export interface IndiceBM25 {
  version: number;
  normalizacion: string;
  k1: number;
  b: number;
  cantidad: number;
  largo_promedio: number;
  df: Record<string, number>;
  fragmentos: Fragmento[];
}
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
}
export function tokenizar(texto: string): string[] {
  return normalizar(texto).match(/[a-z0-9]{2,64}/g) ?? [];
}
export function buscar(indice: IndiceBM25, consulta: string, limite = 5, tipo?: string) {
  if (indice.version !== 1 || indice.normalizacion !== "NFD-sin-tildes-v1") {
    throw new Error("Índice incompatible; reconstruí busqueda.json con la ingesta.");
  }
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new Error("El límite debe estar entre 1 y 100.");
  const terminos = [...new Set(tokenizar(consulta))];
  if (!terminos.length || indice.cantidad === 0) return [];
  const resultados = [];
  for (const fragmento of indice.fragmentos) {
    if (tipo && fragmento.tipo !== tipo) continue;
    let puntaje = 0;
    for (const termino of terminos) {
      const tf = fragmento.frecuencias[termino] ?? 0;
      if (!tf) continue;
      const df = indice.df[termino] ?? 0;
      const idf = Math.log(1 + (indice.cantidad - df + 0.5) / (df + 0.5));
      const denominador = tf + indice.k1 * (1 - indice.b + indice.b * fragmento.largo / Math.max(1, indice.largo_promedio));
      puntaje += idf * tf * (indice.k1 + 1) / denominador;
    }
    if (puntaje > 0) {
      const { frecuencias, texto, largo, ...material } = fragmento;
      resultados.push({ ...material, puntaje, fragmento: fragmento.texto.slice(0, 400) });
    }
  }
  return resultados.sort((a, b) => b.puntaje - a.puntaje || a.doc.localeCompare(b.doc) || a.pagina - b.pagina).slice(0, limite);
}
