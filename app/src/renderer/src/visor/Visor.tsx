// La ventana de PDF (DA47): el documento entero con PDF.js, abierto en la página citada. Lectura continua, búsqueda,
// zoom, miniaturas e índice del PDF. Lo que llega ya viene filtrado por el host: las páginas vedadas son hojas en blanco.
import { useEffect, useRef, useState } from "react";
import { AnnotationMode, getDocument, type PDFDocumentProxy, type RenderTask } from "./pdfjs";
import { EventBus, FindState, LinkTarget, PDFFindController, PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { Ancho, Buscar, Cerrar, Contraste, Derecha, Izquierda, Lateral, Mas, Menos } from "../componentes/Iconos";
import type { DatosPdf, Tema } from "./tipos";

type Entrada = { title: string; dest: string | unknown[] | null; url: string | null; items: Entrada[] };
type Lado = "paginas" | "indice";
type Lector = { viewer: PDFViewer; enlaces: PDFLinkService; bus: EventBus; doc?: PDFDocumentProxy };
type Hallazgos = { actual: number; total: number; estado?: number };

const AJUSTES = ["auto", "page-width", "page-fit"];
const ANCHO_MINIATURA = 116;
// Preferencias de esta computadora (panel lateral, página oscura): si no hay almacenamiento, vale lo de siempre.
const preferencia = (clave: string) => { try { return localStorage.getItem(clave); } catch { return null; } };
const recordar = (clave: string, valor: string) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
const sinPrefijo = (e: unknown) => e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(e);
// El tema de la app, como en la ventana principal: «sistema» deja decidir al sistema operativo.
const aplicarTema = (tema: Tema) => { if (tema === "sistema") document.documentElement.removeAttribute("data-tema"); else document.documentElement.setAttribute("data-tema", tema); };

// PDF.js pide los mapas de caracteres, las fuentes estándar y los decodificadores wasm al proceso principal: no hay red.
class DatosPorIpc {
  constructor(_opciones: unknown) {}
  fetch({ kind, filename }: { kind: string; filename: string }) { return window.visor.recurso(kind, filename); }
}

export function Visor() {
  const caja = useRef<HTMLDivElement>(null), campo = useRef<HTMLInputElement>(null), lector = useRef<Lector>(undefined);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [error, setError] = useState("");
  const [titulo, setTitulo] = useState("");
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [pagina, setPagina] = useState(1);
  const [escribiendo, setEscribiendo] = useState<string>();
  const [escala, setEscala] = useState<{ valor: number; ajuste?: string }>({ valor: 1 });
  const [consulta, setConsulta] = useState("");
  const [hallazgos, setHallazgos] = useState<Hallazgos>();
  const [lado, setLado] = useState<Lado | null>(() => (preferencia("visor:lado") as Lado | "" | null) || null);
  const [oscuro, setOscuro] = useState(() => preferencia("visor:oscuro") === "1");
  const [indice, setIndice] = useState<Entrada[]>([]);

  useEffect(() => {
    const bus = new EventBus();
    const enlaces = new PDFLinkService({ eventBus: bus, externalLinkTarget: LinkTarget.BLANK, externalLinkRel: "noopener noreferrer nofollow" });
    const viewer = new PDFViewer({ container: caja.current!, eventBus: bus, linkService: enlaces, findController: new PDFFindController({ eventBus: bus, linkService: enlaces }),
      removePageBorders: true, annotationMode: AnnotationMode.ENABLE });
    enlaces.setViewer(viewer);
    const l: Lector = { viewer, enlaces, bus };
    lector.current = l;
    bus.on("pagechanging", (e: { pageNumber: number }) => setPagina(e.pageNumber));
    bus.on("scalechanging", (e: { scale: number; presetValue?: string }) => setEscala({ valor: e.scale, ajuste: e.presetValue }));
    bus.on("updatefindmatchescount", (e: { matchesCount: { current: number; total: number } }) => setHallazgos(h => ({ ...h, actual: e.matchesCount.current, total: e.matchesCount.total })));
    bus.on("updatefindcontrolstate", (e: { state: number; matchesCount: { current: number; total: number } }) => setHallazgos({ actual: e.matchesCount.current, total: e.matchesCount.total, estado: e.state }));

    // La primera vez abre en la página citada; al recargar (cambió lo vedado) se queda donde estaba, salvo que una cita pida otra.
    async function cargar(paginaPedida?: number) {
      const primera = !l.doc, antes = { pagina: viewer.currentPageNumber, escala: viewer.currentScaleValue };
      try {
        const d: DatosPdf = await window.visor.datos();
        aplicarTema(d.tema);
        // Las fuentes estándar que el PDF no trae salen de PDF.js y no del sistema: se ven igual en Windows y en Linux.
        const nuevo = await getDocument({ data: d.bytes, BinaryDataFactory: DatosPorIpc, useWorkerFetch: false, useSystemFonts: false, cMapUrl: "pdfjs/cmaps/", cMapPacked: true,
          standardFontDataUrl: "pdfjs/standard_fonts/", wasmUrl: "pdfjs/wasm/" }).promise;
        const viejo = l.doc, destino = Math.min(paginaPedida ?? (primera ? d.pagina : antes.pagina), nuevo.numPages);
        l.doc = nuevo;
        bus.on("pagesinit", () => { viewer.currentScaleValue = primera || !antes.escala ? "auto" : antes.escala; viewer.currentPageNumber = destino; }, { once: true });
        viewer.setDocument(nuevo);
        enlaces.setDocument(nuevo, null);
        document.title = `${d.titulo} · learn`;
        setTitulo(d.titulo); setDoc(nuevo); setPagina(destino); setEstado("listo");
        if (!primera) { setConsulta(""); setHallazgos(undefined); }
        void viejo?.loadingTask.destroy();
        nuevo.getOutline().then(o => setIndice((o ?? []) as Entrada[]), () => setIndice([]));
        if (primera) caja.current?.focus();
      } catch (e) {
        setError((e as { name?: string })?.name === "PasswordException" ? "Este PDF tiene contraseña y la ventana no lo puede abrir." : sinPrefijo(e));
        setEstado("error");
      }
    }
    void cargar();
    const quitar = [
      window.visor.alIr(p => { if (l.doc) viewer.currentPageNumber = Math.min(Math.max(p, 1), l.doc.numPages); }),
      window.visor.alRecargar(p => void cargar(p)),
      window.visor.alTema(aplicarTema),
      // Dejó de poder mostrarse (por ejemplo, el documento pasó a tener soluciones): se saca de la ventana.
      window.visor.alError(m => {
        viewer.setDocument(null as unknown as PDFDocumentProxy); enlaces.setDocument(null, null);
        void l.doc?.loadingTask.destroy(); l.doc = undefined;
        setDoc(undefined); setError(m); setEstado("error");
      }),
    ];
    return () => { quitar.forEach(q => q()); void l.doc?.loadingTask.destroy(); };
  }, []);

  // Ctrl + rueda (o el gesto de pellizcar del touchpad) agranda alrededor del puntero; con un ajuste puesto, se rehace al
  // cambiar el tamaño de la ventana o al abrir y cerrar el panel.
  useEffect(() => {
    const c = caja.current!;
    const rueda = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      lector.current?.viewer.updateScale({ scaleFactor: Math.exp(-e.deltaY / 400), origin: [e.clientX, e.clientY] });
    };
    const tamano = new ResizeObserver(() => {
      const v = lector.current?.viewer;
      if (v?.pdfDocument && AJUSTES.includes(v.currentScaleValue)) v.currentScaleValue = v.currentScaleValue;
    });
    c.addEventListener("wheel", rueda, { passive: false });
    tamano.observe(c);
    return () => { c.removeEventListener("wheel", rueda); tamano.disconnect(); };
  }, []);

  const buscar = (texto: string, tipo: "" | "again", anterior = false) =>
    lector.current?.bus.dispatch("find", { source: null, type: tipo, query: texto, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: anterior, matchDiacritics: false });
  const cambiarConsulta = (texto: string) => {
    setConsulta(texto);
    if (texto.trim()) buscar(texto, "");
    else { lector.current?.bus.dispatch("findbarclose", { source: null }); setHallazgos(undefined); }
  };
  const irA = (n: number) => {
    const v = lector.current?.viewer;
    if (v?.pdfDocument && Number.isInteger(n) && n > 0) v.currentPageNumber = Math.min(n, v.pagesCount);
  };
  const irAEntrada = (e: Entrada) => {
    if (e.dest) void lector.current?.enlaces.goToDestination(e.dest as string);
    else if (e.url) window.open(e.url, "_blank");
  };
  const cambiarLado = (nuevo: Lado | null) => { setLado(nuevo); recordar("visor:lado", nuevo ?? ""); };
  const cambiarOscuro = () => { setOscuro(!oscuro); recordar("visor:oscuro", oscuro ? "0" : "1"); };

  // Atajos: la ventana no tiene menú, así que los maneja ella.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const v = lector.current?.viewer, mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === "w") { e.preventDefault(); window.close(); return; }
      if (mod && k === "f") { e.preventDefault(); campo.current?.focus(); campo.current?.select(); return; }
      if (!v?.pdfDocument) return;
      if (mod && (k === "+" || k === "=")) { e.preventDefault(); v.increaseScale(); }
      else if (mod && k === "-") { e.preventDefault(); v.decreaseScale(); }
      else if (mod && k === "0") { e.preventDefault(); v.currentScaleValue = "auto"; }
      else if ((k === "f3" || (mod && k === "g")) && consulta.trim()) { e.preventDefault(); buscar(consulta, "again", e.shiftKey); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [consulta]);

  const total = doc?.numPages ?? 0;
  const resultado = !consulta.trim() || !hallazgos ? ""
    : hallazgos.estado === FindState.PENDING ? "Buscando…"
    : hallazgos.total ? `${hallazgos.actual} de ${hallazgos.total}`
    : hallazgos.estado === FindState.NOT_FOUND ? "Sin resultados" : "";
  const alAncho = escala.ajuste === "page-width";

  return (
    <div className={`visor ${oscuro ? "oscuro" : ""}`}>
      <header className="barra-visor">
        <button className={`icono ${lado ? "activo" : ""}`} aria-pressed={!!lado} disabled={!doc} onClick={() => cambiarLado(lado ? null : "paginas")}
          aria-label="Miniaturas e índice" title={lado ? "Ocultar las miniaturas" : "Ver las miniaturas y el índice"}><Lateral /></button>
        <span className="titulo-visor" title={titulo}>{titulo}</span>
        <div className="grupo-visor" role="group" aria-label="Páginas">
          <button className="icono" disabled={!doc || pagina <= 1} onClick={() => irA(pagina - 1)} aria-label="Página anterior" title="Página anterior"><Izquierda /></button>
          <input className="numero-pagina" aria-label="Página" inputMode="numeric" disabled={!doc} value={escribiendo ?? String(pagina)}
            onFocus={e => { setEscribiendo(String(pagina)); e.currentTarget.select(); }}
            onChange={e => setEscribiendo(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setEscribiendo(undefined)}
            onKeyDown={e => {
              if (e.key === "Enter") { irA(Number(escribiendo)); caja.current?.focus(); }
              else if (e.key === "Escape") caja.current?.focus();
            }} />
          <span className="de-total">de {total || "…"}</span>
          <button className="icono" disabled={!doc || pagina >= total} onClick={() => irA(pagina + 1)} aria-label="Página siguiente" title="Página siguiente"><Derecha /></button>
        </div>
        <span className="separador-visor" />
        <div className="grupo-visor" role="group" aria-label="Tamaño">
          <button className="icono" disabled={!doc} onClick={() => lector.current?.viewer.decreaseScale()} aria-label="Achicar" title="Achicar (Ctrl −)"><Menos /></button>
          <span className="zoom">{Math.round(escala.valor * 100)} %</span>
          <button className="icono" disabled={!doc} onClick={() => lector.current?.viewer.increaseScale()} aria-label="Agrandar" title="Agrandar (Ctrl +)"><Mas /></button>
          <button className={`icono ${alAncho ? "activo" : ""}`} disabled={!doc} aria-pressed={alAncho} aria-label="Ajustar al ancho" title={alAncho ? "Volver al tamaño automático" : "Ajustar al ancho de la ventana"}
            onClick={() => { const v = lector.current?.viewer; if (v) v.currentScaleValue = alAncho ? "auto" : "page-width"; }}><Ancho /></button>
        </div>
        <span className="separador-visor" />
        <div className="buscador-visor">
          <Buscar />
          <input ref={campo} value={consulta} placeholder="Buscar en el PDF" aria-label="Buscar en el PDF" disabled={!doc} spellCheck={false}
            onChange={e => cambiarConsulta(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && consulta.trim()) { e.preventDefault(); buscar(consulta, "again", e.shiftKey); }
              else if (e.key === "Escape") { cambiarConsulta(""); caja.current?.focus(); }
            }} />
          {consulta && <button className="limpiar" onClick={() => { cambiarConsulta(""); campo.current?.focus(); }} aria-label="Borrar la búsqueda" title="Borrar la búsqueda"><Cerrar /></button>}
        </div>
        <span className="cuenta-visor" aria-live="polite">{resultado}</span>
        <button className={`icono ${oscuro ? "activo" : ""}`} aria-pressed={oscuro} onClick={cambiarOscuro} aria-label="Página oscura"
          title={oscuro ? "Volver a la página blanca" : "Página oscura, para leer de noche"}><Contraste /></button>
      </header>
      <div className="cuerpo-visor">
        {lado && doc && (
          <aside className="lateral-visor" aria-label="Miniaturas e índice">
            {indice.length > 0 && (
              <div className="pestanas-lateral" role="tablist">
                <button role="tab" aria-selected={lado === "paginas"} onClick={() => cambiarLado("paginas")}>Páginas</button>
                <button role="tab" aria-selected={lado === "indice"} onClick={() => cambiarLado("indice")}>Índice</button>
              </div>
            )}
            {lado === "indice" && indice.length > 0
              ? <ul className="indice-pdf">{indice.map((e, i) => <EntradaIndice key={i} e={e} nivel={0} ir={irAEntrada} />)}</ul>
              : <Miniaturas doc={doc} actual={pagina} ir={irA} />}
          </aside>
        )}
        <div className="zona-pdf">
          <div ref={caja} className="caja-pdf" tabIndex={0} aria-label={titulo ? `${titulo}, página ${pagina} de ${total}` : "PDF"}><div className="pdfViewer" /></div>
          {estado !== "listo" && (
            <div className="estado-visor">
              {estado === "cargando"
                ? <p className="apagado"><span className="giro" /> Abriendo el PDF…</p>
                : <div><p className="fuerte">{error}</p><button className="fantasma" onClick={() => window.close()}>Cerrar la ventana</button></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Las miniaturas se dibujan recién cuando aparecen en el panel: un libro de cientos de páginas no se dibuja entero.
function Miniaturas({ doc, actual, ir }: { doc: PDFDocumentProxy; actual: number; ir: (n: number) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  const [proporcion, setProporcion] = useState(1.414);
  useEffect(() => { void doc.getPage(1).then(p => { const v = p.getViewport({ scale: 1 }); setProporcion(v.height / v.width); }, () => {}); }, [doc]);
  useEffect(() => { lista.current?.querySelector(`[data-pagina="${actual}"]`)?.scrollIntoView({ block: "nearest" }); }, [actual]);
  return (
    <div className="miniaturas" ref={lista}>
      {Array.from({ length: doc.numPages }, (_, i) => <Miniatura key={i} doc={doc} numero={i + 1} activa={i + 1 === actual} ir={ir} proporcion={proporcion} />)}
    </div>
  );
}

function Miniatura({ doc, numero, activa, ir, proporcion }: { doc: PDFDocumentProxy; numero: number; activa: boolean; ir: (n: number) => void; proporcion: number }) {
  const boton = useRef<HTMLButtonElement>(null), lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let tarea: RenderTask | undefined, empezada = false;
    const observador = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || empezada) return;
      empezada = true;
      observador.disconnect();
      try {
        const p = await doc.getPage(numero), c = lienzo.current;
        if (!c) return;
        const vista = p.getViewport({ scale: (ANCHO_MINIATURA * devicePixelRatio) / p.getViewport({ scale: 1 }).width });
        c.width = Math.round(vista.width); c.height = Math.round(vista.height);
        tarea = p.render({ canvas: c, viewport: vista });
        await tarea.promise;
      } catch { /* cancelada o documento cerrado */ }
    });
    observador.observe(boton.current!);
    return () => { observador.disconnect(); tarea?.cancel(); };
  }, [doc, numero]);
  return (
    <button ref={boton} data-pagina={numero} className={activa ? "activa" : ""} onClick={() => ir(numero)} aria-label={`Página ${numero}`} aria-current={activa ? "page" : undefined}>
      <canvas ref={lienzo} width={ANCHO_MINIATURA} height={Math.round(ANCHO_MINIATURA * proporcion)} />
      <span>{numero}</span>
    </button>
  );
}

function EntradaIndice({ e, nivel, ir }: { e: Entrada; nivel: number; ir: (e: Entrada) => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <li>
      <div className="entrada-indice" style={{ paddingLeft: 4 + nivel * 14 }}>
        {e.items.length > 0
          ? <button className={`desplegar ${abierta ? "abierta" : ""}`} aria-expanded={abierta} aria-label={abierta ? "Plegar" : "Desplegar"} onClick={() => setAbierta(!abierta)}><Derecha /></button>
          : <span className="desplegar" />}
        <button className="titulo-entrada" onClick={() => ir(e)} title={e.title}>{e.title}</button>
      </div>
      {abierta && <ul>{e.items.map((h, i) => <EntradaIndice key={i} e={h} nivel={nivel + 1} ir={ir} />)}</ul>}
    </li>
  );
}
