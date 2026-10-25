// Todas las sesiones del vault (pi-learn --resume, /resume), más importar una sesión guardada.
import { useEffect } from "react";
import { cambiar, nuevaSesion, refrescarInicio } from "../tienda";
import { ListaSesiones } from "./Capas";

export function Sesiones() {
  useEffect(() => { void refrescarInicio(); }, []);
  return (
    <main className="pantalla pagina-lectura">
      <h1 className="titulo-pantalla">Sesiones</h1>
      <p className="vacio" style={{ marginBottom: 22 }}>Cada clase y cada conversación queda guardada. Elegí una para retomarla donde quedó.</p>
      <div className="acciones" style={{ marginBottom: 28 }}>
        <button className="fantasma" onClick={() => void nuevaSesion()}>Sesión nueva</button>
        <button className="enlace" onClick={() => cambiar({ pantallaPi: { nombre: "import", datos: {} } })}>Importar una sesión…</button>
      </div>
      <ListaSesiones />
    </main>
  );
}
