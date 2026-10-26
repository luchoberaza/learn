// Avisos de pi y de las extensiones (notify): abajo a la derecha, sin tapar la caja de texto. Un aviso largo (por
// ejemplo /progreso) se abre entero.
import { useState } from "react";
import { cerrarToast, usarTienda } from "../tienda";
import { Cerrar } from "./Iconos";
import { Dialogo } from "./Capas";

export function Avisos() {
  const toasts = usarTienda(e => e.toasts);
  const [abierto, setAbierto] = useState<string>();
  return (
    <>
      <div className="avisos" role="region" aria-label="Avisos" aria-live="polite">
        {toasts.map(t => {
          const lineas = t.texto.split("\n"), largo = lineas.length > 5 || t.texto.length > 420;
          return (
            <div key={t.id} className={`aviso ${t.nivel}`} role={t.nivel === "error" ? "alert" : "status"}>
              <p>{largo ? `${lineas.slice(0, 4).join("\n").slice(0, 380)}…` : t.texto}</p>
              {largo && <button className="enlace" onClick={() => setAbierto(t.texto)}>Ver todo</button>}
              {t.accion && <button className="enlace" onClick={() => { t.accion!.hacer(); cerrarToast(t.id); }}>{t.accion.texto}</button>}
              <button className="icono cerrar" onClick={() => cerrarToast(t.id)} aria-label="Cerrar el aviso"><Cerrar /></button>
            </div>
          );
        })}
      </div>
      {abierto && (
        <Dialogo titulo="Aviso" alCerrar={() => setAbierto(undefined)} ancho={720}>
          <pre className="aviso-completo">{abierto}</pre>
          <div className="acciones fin"><button className="boton" onClick={() => setAbierto(undefined)}>Cerrar</button></div>
        </Dialogo>
      )}
    </>
  );
}
