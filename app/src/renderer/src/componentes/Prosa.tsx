// Texto del tutor o de una nota: Markdown con fórmulas, diagramas, imágenes del vault y citas al margen.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { renderizar, type Cita } from "../lib/markdown";
import { dibujar } from "../lib/mermaid";
import { nombreDeArchivo } from "../../../lib/texto.ts";
import { abrirPagina, leer, pedir } from "../tienda";

// Las imágenes y miniaturas se piden una vez por sesión de la app.
const cacheImagenes = new Map<string, Promise<string | undefined>>();
function imagenDelVault(ruta: string, desde?: string) {
  const clave = `${desde ?? ""}|${ruta}`;
  if (!cacheImagenes.has(clave)) cacheImagenes.set(clave, pedir<{ mimeType: string; data: string }>("imagen", { ruta, desde }, true).then(r => r ? `data:${r.mimeType};base64,${r.data}` : undefined));
  return cacheImagenes.get(clave)!;
}
const cacheMiniaturas = new Map<string, Promise<string | undefined>>();
export function miniatura(cita: string) {
  if (!cacheMiniaturas.has(cita)) cacheMiniaturas.set(cita, window.learn.pedir<{ imagen: string }>("pagina", { cita: `[[${cita}]]`, origen: "cita" }).then(r => `data:image/png;base64,${r.imagen}`, () => undefined));
  return cacheMiniaturas.get(cita)!;
}
export function imagenRender(ruta: string) {
  if (!cacheImagenes.has(`render|${ruta}`)) cacheImagenes.set(`render|${ruta}`, pedir<{ mimeType: string; data: string }>("imagen-render", { ruta }, true).then(r => r ? `data:${r.mimeType};base64,${r.data}` : undefined));
  return cacheImagenes.get(`render|${ruta}`)!;
}

// Nombre legible del documento citado: el título del índice del curso, o el nombre del archivo.
export function tituloCita(c: { curso: string; archivo: string; pagina: number; alias?: string }) {
  if (c.alias) return c.alias;
  const doc = leer().cursos.find(x => x.slug === c.curso)?.documentos.find(d => d.archivo === c.archivo);
  return `${doc?.titulo ?? nombreDeArchivo(c.archivo)}, página ${c.pagina}`;
}

function Miniatura({ cita }: { cita: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const caja = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new IntersectionObserver(entradas => {
      if (!entradas.some(e => e.isIntersecting)) return;
      obs.disconnect();
      void miniatura(cita).then(s => setSrc(s ?? ""));
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cita]);
  return (
    <button ref={caja} className="miniatura" onClick={() => void abrirPagina({ cita: `[[${cita}]]`, origen: "cita" })} aria-label="Abrir la página">
      {src ? <img src={src} alt="" /> : src === "" ? <span className="apagado">Sin vista previa</span> : <span className="giro" />}
    </button>
  );
}

export function NotaAlMargen({ c }: { c: Cita }) {
  return (
    <div className="nota-margen">
      <span><b>{c.n}</b> {tituloCita(c)}</span>
      <Miniatura cita={c.destino} />
      <button className="enlace cita" onClick={() => void abrirPagina({ cita: `[[${c.destino}]]`, origen: "cita" })}>Abrir la página</button>
    </div>
  );
}

// Completa lo que el HTML dejó marcado: imágenes del vault, diagramas y llamadas a las citas.
function usarHidratacion(ref: React.RefObject<HTMLDivElement | null>, html: string, terminado: boolean, desde?: string) {
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    let vivo = true;
    for (const img of raiz.querySelectorAll<HTMLImageElement>("img.del-vault:not([src])")) {
      void imagenDelVault(img.dataset.vault!, desde).then(src => { if (!vivo) return; if (src) img.src = src; else img.replaceWith(Object.assign(document.createElement("span"), { className: "apagado", textContent: `(No se encontró la imagen ${img.dataset.vault})` })); });
    }
    if (terminado) for (const div of raiz.querySelectorAll<HTMLDivElement>(".mermaid[data-codigo]:not([data-dibujado])")) {
      div.dataset.dibujado = "1";
      void dibujar(div.dataset.codigo!).then(svg => { if (vivo) div.innerHTML = svg; }, () => { if (vivo) { div.classList.add("mermaid-error"); div.textContent = div.dataset.codigo!; } });
    }
    return () => { vivo = false; };
  }, [ref, html, terminado, desde]);
}

function alHacerClic(ev: React.MouseEvent | React.KeyboardEvent) {
  const sup = (ev.target as HTMLElement).closest<HTMLElement>("sup.llamada");
  if (!sup) return;
  if ("key" in ev && ev.key !== "Enter" && ev.key !== " ") return;
  ev.preventDefault();
  void abrirPagina({ cita: `[[${sup.dataset.cita}]]`, origen: "cita" });
}

// Prosa con su margen: las citas numeradas a la derecha, como notas de un libro.
export const Prosa = memo(function Prosa({ texto, terminado = true, margen = true, desde, clase = "prosa" }: { texto: string; terminado?: boolean; margen?: boolean; desde?: string; clase?: string }) {
  const { html, citas } = useMemo(() => renderizar(texto), [texto]);
  const ref = useRef<HTMLDivElement>(null);
  usarHidratacion(ref, html, terminado, desde);
  return (
    <div className={margen ? "con-margen" : undefined}>
      <div ref={ref} className={clase} onClick={alHacerClic} onKeyDown={alHacerClic} dangerouslySetInnerHTML={{ __html: html }} />
      {margen && citas.length > 0 && <aside className="margen">{citas.map(c => <NotaAlMargen key={c.destino} c={c} />)}</aside>}
    </div>
  );
});
