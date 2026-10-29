// La barra de pestañas (DA56), como la de un navegador: cada pestaña es una pantalla con su conversación, o un PDF.
// El + abre otra en Inicio; el clic del medio cierra y arrastrar cambia el orden. La pestaña de la conversación de pi
// late mientras el tutor trabaja.
import { useState } from "react";
import { abrirPestana, abrirSesion, activarPestana, cerrarPestana, leer, moverPestana, tituloPestana, usarTienda } from "../tienda";
import { Cerrar, Hoja, Mas, PestanaNueva } from "./Iconos";

// Una sesión de una lista (Sesiones, «Otras clases»): el clic la retoma acá; Ctrl+clic, el clic del medio o este botón,
// en una pestaña nueva.
export function retomarDesdeLista(ruta: string) {
  return {
    onClick: (ev: React.MouseEvent) => void abrirSesion(ruta, ev.ctrlKey || ev.metaKey),
    onAuxClick: (ev: React.MouseEvent) => { if (ev.button === 1) { ev.preventDefault(); void abrirSesion(ruta, true); } },
  };
}
export function BotonPestanaNueva({ ruta }: { ruta: string }) {
  return <button className="icono en-pestana" onClick={() => void abrirSesion(ruta, true)} aria-label="Abrir en una pestaña nueva" title="Abrir en una pestaña nueva"><PestanaNueva /></button>;
}

export function BarraPestanas() {
  const pestanas = usarTienda(e => e.pestanas);
  const activa = usarTienda(e => e.activa);
  const duena = usarTienda(e => e.duena);
  const trabajando = usarTienda(e => e.trabajando);
  // Los títulos salen de la sesión, de los cursos y de si la conversación ya empezó.
  usarTienda(e => e.sesion); usarTienda(e => e.cursos); usarTienda(e => e.items.length > 0);
  const [arrastrada, setArrastrada] = useState<string>();
  const [marca, setMarca] = useState<{ id: string; despues: boolean }>();
  const e = leer();
  const soltar = (id: string, despues: boolean) => { if (arrastrada) moverPestana(arrastrada, id, despues); setArrastrada(undefined); setMarca(undefined); };
  return (
    <div className="barra-pestanas" role="tablist" aria-label="Pestañas"
      onDragOver={ev => { if (arrastrada && ev.target === ev.currentTarget) ev.preventDefault(); }}
      onDrop={ev => { if (ev.target === ev.currentTarget && pestanas.length) { ev.preventDefault(); soltar(pestanas[pestanas.length - 1].id, true); } }}>
      {pestanas.map(p => {
        const titulo = tituloPestana(e, p), on = p.id === activa;
        return (
          <div key={p.id} className={`pestana ${on ? "activa" : ""} ${p.id === arrastrada ? "arrastrada" : ""} ${marca?.id === p.id ? (marca.despues ? "marca-despues" : "marca-antes") : ""}`}
            draggable
            onDragStart={ev => { setArrastrada(p.id); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", titulo); }}
            onDragOver={ev => {
              if (!arrastrada) return;
              ev.preventDefault();
              const r = ev.currentTarget.getBoundingClientRect(), despues = ev.clientX > r.left + r.width / 2;
              if (marca?.id !== p.id || marca.despues !== despues) setMarca({ id: p.id, despues });
            }}
            onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setMarca(m => m?.id === p.id ? undefined : m); }}
            onDrop={ev => { ev.preventDefault(); soltar(p.id, marca?.id === p.id ? marca.despues : false); }}
            onDragEnd={() => { setArrastrada(undefined); setMarca(undefined); }}
            onMouseDown={ev => { if (ev.button === 1) ev.preventDefault(); }}
            onAuxClick={ev => { if (ev.button === 1) { ev.preventDefault(); void cerrarPestana(p.id); } }}
            title={titulo}>
            <button role="tab" aria-selected={on} className="pestana-boton" onClick={() => void activarPestana(p.id)}>
              {p.pdf ? <Hoja /> : p.id === duena && trabajando && <span className="latido" aria-label="el tutor está trabajando" />}
              <span className="pestana-titulo">{titulo}</span>
            </button>
            <button className="pestana-cerrar" onClick={() => void cerrarPestana(p.id)} aria-label={`Cerrar la pestaña ${titulo}`} title="Cerrar (Ctrl W)"><Cerrar /></button>
          </div>
        );
      })}
      <button className="icono pestana-nueva" onClick={() => abrirPestana()} aria-label="Pestaña nueva" title="Pestaña nueva (Ctrl T)"><Mas /></button>
    </div>
  );
}
