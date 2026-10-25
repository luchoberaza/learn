// La ventana: barra lateral, la pantalla de la ruta, el panel de página a la derecha y las capas (diálogos, paleta, avisos).
import { useEffect } from "react";
import { arrancar, cambiar, cerrarPanel, leer, navegar, usarTienda } from "../tienda";
import { Lateral } from "./Lateral";
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
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); cambiar(e => ({ paleta: !e.paleta })); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === ",") { ev.preventDefault(); navegar({ pantalla: "ajustes" }); return; }
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
  return (
    <div className={`ventana ${panel ? "con-panel" : ""}`}>
      <Lateral />
      <Pantalla />
      {panel && <PanelPagina />}
      <PanelSubagentes />
      <Paleta />
      <Capas />
      <Avisos />
    </div>
  );
}
