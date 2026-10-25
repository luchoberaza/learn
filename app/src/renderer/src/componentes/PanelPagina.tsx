// Panel de página (§9.3): el dibujo de la página del PDF que ya genera sesion.py, con las reglas de ver_pagina que
// aplica el host. Se puede fijar para que quede abierto mientras seguís la clase.
import { useState } from "react";
import { abrirPagina, cambiar, cerrarPanel, guardarAjustes, usarTienda } from "../tienda";
import { Cerrar, Chincheta, Derecha, Izquierda, Lupa } from "./Iconos";

export function PanelPagina() {
  const panel = usarTienda(e => e.panel);
  const [grande, setGrande] = useState(false);
  if (!panel) return null;
  const p = panel.pagina;
  const fijar = () => { const fijo = !panel.fijo; cambiar({ panel: { ...panel, fijo } }); void guardarAjustes({ panelFijo: fijo }); };
  return (
    <aside className="panel-pagina" aria-label="Página del material">
      <header>
        <div className="panel-titulo">{p ? <><b>{p.titulo}</b><span>Página {p.pagina} de {p.total}</span></> : <b>Página</b>}</div>
        <button className="icono" onClick={() => setGrande(!grande)} aria-label={grande ? "Ajustar al ancho" : "Ver más grande"} title={grande ? "Ajustar al ancho" : "Ver más grande"}><Lupa mas={!grande} /></button>
        <button className={`icono ${panel.fijo ? "activo" : ""}`} onClick={fijar} aria-pressed={panel.fijo} aria-label={panel.fijo ? "Soltar el panel" : "Fijar el panel"} title={panel.fijo ? "Soltar: se cierra al cambiar de pantalla" : "Fijar: queda abierto mientras estudiás"}><Chincheta puesta={panel.fijo} /></button>
        <button className="icono" onClick={cerrarPanel} aria-label="Cerrar el panel" title="Cerrar (Esc)"><Cerrar /></button>
      </header>
      <div className={`panel-cuerpo ${grande ? "grande" : ""}`}>
        {panel.error && <p className="aviso-bloque">{panel.error}</p>}
        {panel.cargando && !p && <p className="apagado"><span className="giro" /> Dibujando la página…</p>}
        {p && <img src={`data:image/png;base64,${p.imagen}`} alt={`${p.titulo}, página ${p.pagina}`} style={{ opacity: panel.cargando ? 0.5 : 1 }} />}
      </div>
      {p && (
        <footer>
          {p.restringido
            ? <span className="ayuda">Esta página es de una evaluación: se abre sólo desde la cita del tutor, sin avanzar.</span>
            : <>
              <button className="icono" disabled={!p.anterior || panel.cargando} onClick={() => void abrirPagina({ curso: p.curso, doc: p.doc, pagina: p.anterior, origen: "panel" })} aria-label="Página anterior"><Izquierda /></button>
              <span className="apagado">{p.anterior === undefined && p.siguiente === undefined ? "" : "Las páginas reservadas para el simulacro se saltean."}</span>
              <button className="icono" disabled={!p.siguiente || panel.cargando} onClick={() => void abrirPagina({ curso: p.curso, doc: p.doc, pagina: p.siguiente, origen: "panel" })} aria-label="Página siguiente"><Derecha /></button>
            </>}
        </footer>
      )}
    </aside>
  );
}
