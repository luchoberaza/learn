// Lector de notas (§9.7): las notas de la clase con la misma tipografía, callouts de Obsidian, fotos, páginas mostradas
// y fórmulas. Obsidian pasa a ser opcional: «Abrir en Obsidian» usa obsidian://.
import { useEffect, useState } from "react";
import { pedir, usarTienda, volver } from "../tienda";
import { Prosa } from "./Prosa";

export function LectorNota({ ruta }: { ruta: string }) {
  const [texto, setTexto] = useState<string | null>();
  const vault = usarTienda(e => e.info?.vault);
  useEffect(() => {
    let vivo = true;
    const leerNota = () => void pedir<{ texto: string }>("nota", { ruta }, true).then(r => { if (vivo) setTexto(r?.texto ?? null); });
    leerNota();
    // La nota de una clase abierta crece mientras estudiás: se relee cada tanto.
    const t = setInterval(leerNota, 5000);
    return () => { vivo = false; clearInterval(t); };
  }, [ruta]);
  const nombre = ruta.split("/").pop()?.replace(/\.md$/, "") ?? ruta;
  return (
    <main className="pantalla pagina-lectura nota">
      <p className="miga-pantalla"><button className="enlace" onClick={volver}>Volver</button></p>
      <h1 className="titulo-pantalla">{nombre}</h1>
      <div className="acciones" style={{ marginBottom: 30 }}>
        {vault && <button className="fantasma" onClick={() => void window.learn.abrirExterno(`obsidian://open?path=${encodeURIComponent(`${vault}/${ruta}`)}`)}>Abrir en Obsidian</button>}
        <button className="enlace" onClick={() => void window.learn.mostrarEnCarpeta(ruta)}>Mostrar en la carpeta</button>
      </div>
      {texto === undefined ? <p className="apagado"><span className="giro" /> Abriendo la nota…</p>
        : texto === null ? <p className="aviso-bloque error">No se pudo leer la nota {ruta}.</p>
        : texto.trim() ? <Prosa texto={texto} desde={ruta} clase="prosa nota-prosa" />
        : <p className="vacio">La nota todavía está vacía: se llena a medida que avanza la clase.</p>}
    </main>
  );
}
