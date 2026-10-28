// La ventana: barra lateral, las pestañas con la pantalla de la ruta o un PDF, el panel de página a la derecha y las
// capas (diálogos, paleta, avisos).
import { useEffect, type CSSProperties } from "react";
import { abrirPestana, arrancar, cambiar, cambiarEscala, cerrarPanel, cerrarPestana, leer, navegar, pestanaActiva, pestanaVecina, plegarLateral, usarTienda } from "../tienda";
import { anchoLateral, LATERAL } from "../../../lib/escala.ts";
import { BarraPestanas } from "./Pestanas";
import { PestanaPdf } from "./PestanaPdf";
import { Lateral, LateralPlegada } from "./Lateral";
import { Inicio } from "./Inicio";
import { Clase } from "./Clase";
import { Curso } from "./Curso";
import { Tema } from "./Tema";
import { TemaLibre } from "./TemaLibre";
import { LectorNota } from "./LectorNota";
import { Sesiones } from "./Sesiones";
import { CrearCurso } from "./CrearCurso";
import { Ajustes } from "./Ajustes";
import { Preparar } from "./Preparar";
import { PanelPagina } from "./PanelPagina";
import { Paleta } from "./Paleta";
import { Capas } from "./Capas";
import { Avisos } from "./Avisos";
import { PanelSubagentes } from "./Subagentes";

function Pantalla() {
  const ruta = usarTienda(e => e.ruta);
  const arranque = usarTienda(e => e.arranque);
  // Preparar y Ajustes funcionan aunque pi no haya abierto (son del proceso principal de la app).
  if (ruta.pantalla === "preparar") return <Preparar />;
  if (ruta.pantalla === "ajustes" && arranque !== "listo") return <Ajustes />;
  if (arranque === "error" || arranque === "cerrado") return <SinPi />;
  if (arranque !== "listo") return <Abriendo />;
  switch (ruta.pantalla) {
    case "inicio": return <Inicio />;
    case "clase": return <Clase />;
    case "curso": return <Curso key={ruta.slug} slug={ruta.slug} pestana={ruta.pestana} />;
    case "tema": return <Tema key={`${ruta.slug}/${ruta.id}`} slug={ruta.slug} id={ruta.id} />;
    case "tema-libre": return <TemaLibre />;
    case "nota": return <LectorNota key={ruta.ruta} ruta={ruta.ruta} />;
    case "sesiones": return <Sesiones />;
    case "crear-curso": return <CrearCurso key={ruta.slug ?? ""} slug={ruta.slug} />;
    case "ajustes": return <Ajustes seccion={ruta.seccion} />;
  }
}

function Abriendo() {
  const vault = usarTienda(e => e.ajustes?.vault);
  return (
    <main className="pantalla centrada">
      <div className="vacio"><p className="serif fuerte" style={{ fontSize: 22, marginBottom: 8 }}>Abriendo learn…</p><p>{vault ? `Cargando pi y tus cursos desde ${vault}.` : "Un momento."}</p></div>
    </main>
  );
}

function SinPi() {
  const arranque = usarTienda(e => e.arranque);
  const error = usarTienda(e => e.errorFatal);
  const vault = usarTienda(e => e.ajustes?.vault);
  return (
    <main className="pantalla centrada">
      <div style={{ maxWidth: 560 }}>
        <h1 className="titulo-pantalla">{arranque === "cerrado" ? "pi se cerró" : "pi no pudo abrir"}</h1>
        <p className="vacio" style={{ marginBottom: 22 }}>{arranque === "cerrado" ? "El proceso que corre el tutor terminó. Tus clases y notas están guardadas." : error}</p>
        <div className="acciones">
          {vault && <button className="boton" onClick={() => void arrancar(vault)}>Volver a abrir</button>}
          <button className="fantasma" onClick={() => navegar({ pantalla: "preparar" })}>Preparar la computadora</button>
          <button className="enlace" onClick={() => void window.learn.abrirRegistros()}>Ver el registro</button>
        </div>
      </div>
    </main>
  );
}

export function App() {
  const panel = usarTienda(e => e.panel);
  const ruta = usarTienda(e => e.ruta);
  // Sólo los ids de los PDF y si hay uno a la vista: pasar de página en un PDF no redibuja la ventana entera.
  const pdfs = usarTienda(e => e.pestanas.filter(p => p.pdf).map(p => p.id).join(" "));
  const activa = usarTienda(e => e.activa);
  const enPdf = usarTienda(e => !!pestanaActiva(e).pdf);
  const lateral = usarTienda(e => e.ajustes?.lateral);
  const anchoPanel = usarTienda(e => e.ajustes?.anchoPanel);
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
      if (mod && k === "k") { ev.preventDefault(); cambiar(e => ({ paleta: !e.paleta })); return; }
      if (mod && ev.key === ",") { ev.preventDefault(); navegar({ pantalla: "ajustes" }); return; }
      // Pestañas (DA56) y barra lateral (DA54), salvo con un diálogo abierto.
      if (mod && !document.querySelector(".velo")) {
        if (k === "t" && !ev.shiftKey) { ev.preventDefault(); abrirPestana(); return; }
        if (k === "w") { ev.preventDefault(); void cerrarPestana(); return; }
        if (ev.ctrlKey && (k === "tab" || k === "pagedown" || k === "pageup")) { ev.preventDefault(); pestanaVecina(k === "pageup" || (k === "tab" && ev.shiftKey) ? -1 : 1); return; }
        if (k === "b" && !ev.shiftKey) { ev.preventDefault(); plegarLateral(); return; }
      }
      // Escala de la interfaz (DA55); en una pestaña de PDF, Ctrl + y Ctrl − agrandan el documento.
      if (mod && !pestanaActiva(leer()).pdf) {
        const paso = k === "+" || k === "=" || ev.code === "NumpadAdd" ? 1 : k === "-" || ev.code === "NumpadSubtract" ? -1 : k === "0" || ev.code === "Numpad0" ? 0 : undefined;
        if (paso !== undefined) { ev.preventDefault(); cambiarEscala(paso); return; }
      }
      if (ev.key === "Escape" && !ev.defaultPrevented) {
        const e = leer();
        if (e.paleta) return cambiar({ paleta: false });
        if (e.panel && !e.panel.fijo && !document.querySelector(".velo")) cerrarPanel();
      }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, []);
  // Un panel sin fijar se cierra al cambiar de pantalla.
  useEffect(() => { const p = leer().panel; if (p && !p.fijo) cerrarPanel(); }, [ruta]);
  // Los anchos guardados (DA54) van como variables de la ventana; el tirador las cambia en vivo mientras se arrastra.
  const plegada = !!lateral?.plegada;
  const estilo = { "--lat": `${plegada ? LATERAL.plegada : anchoLateral(lateral?.ancho)}px`, ...(anchoPanel ? { "--panel": `${anchoPanel}px` } : {}) } as CSSProperties;
  // La pantalla queda montada (oculta) mientras se ve un PDF: al volver, la clase sigue donde estaba.
  return (
    <div className={`ventana ${panel ? "con-panel" : ""} ${plegada ? "plegada" : ""}`} style={estilo}>
      {plegada ? <LateralPlegada /> : <Lateral />}
      <div className="zona">
        <BarraPestanas />
        <div className="marco-pantalla">
          <div className={`capa-pantalla ${enPdf ? "oculta" : ""}`} inert={enPdf}><Pantalla /></div>
          {pdfs && pdfs.split(" ").map(id => <PestanaPdf key={id} id={id} activa={id === activa} />)}
        </div>
      </div>
      {panel && <PanelPagina />}
      <PanelSubagentes />
      <Paleta />
      <Capas />
      <Avisos />
    </div>
  );
}
