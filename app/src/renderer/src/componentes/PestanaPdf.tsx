// Una pestaña de PDF (DA56): el mismo lector de la ventana de PDF (DA47), con la copia para leer que pide la ventana
// principal. Como la ventana, al volver a la pestaña (o a la app con la pestaña a la vista) pregunta si cambió lo
// vedado y, si cambió, recarga. Queda montada aunque no se vea: al volver, el documento sigue donde estaba.
import { lazy, Suspense, useEffect, useState } from "react";
import { cerrarPestana, datosPdf, usarTienda } from "../tienda";
import type { DatosPdf, FuentePdf } from "../visor/tipos";

// PDF.js y sus estilos se cargan con la primera pestaña de PDF, no al abrir la app.
const Visor = lazy(() => Promise.all([import("../visor/Visor"), import("../visor/estilos")]).then(([m]) => ({ default: m.Visor })));
// Sin pi no cambia lo vedado: la pestaña sigue con lo que tenía.
const SIN_PI = /pi no está abierto|pi no respondió|proceso de pi se cerró/;
const sinPrefijo = (e: unknown) => e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(e);

type Fuente = FuentePdf & { revisar(): Promise<void>; ir(pagina: number): void };

function crearFuente(curso: string, doc: string, pagina?: number): Fuente {
  const ir = new Set<(p: number) => void>(), recargar = new Set<(p?: number) => void>(), errores = new Set<(m: string) => void>();
  const escuchar = <T,>(lista: Set<T>) => (f: T) => { lista.add(f); return () => { lista.delete(f); }; };
  let clave: string | undefined, revisada = Date.now(), vigente = true;
  return {
    async datos() {
      const d = await window.learn.pdfPestana({ curso, doc, pagina });
      clave = d.clave; revisada = Date.now();
      return d as DatosPdf;
    },
    recurso: (tipo, nombre) => window.learn.recursoPdf(tipo, nombre),
    alIr: escuchar(ir), alRecargar: escuchar(recargar), alError: escuchar(errores),
    // El tema lo pone la ventana principal.
    alTema: () => () => {},
    async revisar() {
      if (!clave || !vigente || Date.now() - revisada < 3000) return;
      revisada = Date.now();
      try {
        const l = await window.learn.pdfPestana({ curso, doc }, false);
        if (l.clave !== clave) { clave = l.clave; recargar.forEach(f => f()); }
      } catch (e) {
        const mensaje = sinPrefijo(e);
        if (!SIN_PI.test(mensaje)) { vigente = false; errores.forEach(f => f(mensaje)); }
      }
    },
    ir: p => ir.forEach(f => f(p)),
  };
}

function Abriendo() {
  return <div className="estado-pestana-pdf"><p className="apagado"><span className="giro" /> Abriendo el PDF…</p></div>;
}

export function PestanaPdf({ id, activa }: { id: string; activa: boolean }) {
  const listo = usarTienda(e => e.arranque === "listo");
  // Al cerrarse, la pestaña puede dejar de estar un instante antes de que la ventana la saque.
  const pdf = usarTienda(e => e.pestanas.find(x => x.id === id)?.pdf);
  const [fuente] = useState(() => crearFuente(pdf!.curso, pdf!.doc, pdf!.pagina));
  const n = pdf?.n ?? 0, pagina = pdf?.pagina;
  useEffect(() => { if (activa) void fuente.revisar(); }, [activa]);
  useEffect(() => {
    if (!activa) return;
    const alVolver = () => void fuente.revisar();
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, [activa]);
  // Pedirlo otra vez desde la app lleva a la página pedida.
  useEffect(() => { if (n) fuente.ir(pagina ?? 1); }, [n]);
  if (!pdf) return null;
  return (
    <div className={`pestana-pdf ${activa ? "" : "oculta"}`} inert={!activa} role="tabpanel" aria-label={pdf.titulo ?? "PDF"}>
      {listo
        ? <Suspense fallback={<Abriendo />}>
          <Visor fuente={fuente} pestana={{ activa, cerrar: () => void cerrarPestana(id), alPagina: n => datosPdf(id, { pagina: n }), alTitulo: t => datosPdf(id, { titulo: t }) }} />
        </Suspense>
        : <Abriendo />}
    </div>
  );
}
