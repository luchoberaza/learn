// La ventana de grabación (DA51): el video o audio de una clase con los controles del sistema, empezando en el segundo
// citado. Si llega otra cita de la misma grabación, salta ahí sin recargar.
import { useEffect, useRef, useState } from "react";
import { hora } from "../../../lib/texto.ts";

type Tema = "sistema" | "noche" | "dia";
interface Datos { titulo: string; url: string; segundo: number; video: boolean; tema: Tema }
interface ApiReproductor {
  datos(): Promise<Datos>;
  alIr(f: (segundo: number) => void): () => void;
  alTema(f: (tema: Tema) => void): () => void;
}
declare global { interface Window { reproductor: ApiReproductor } }

const aplicarTema = (tema: Tema) => { if (tema === "sistema") document.documentElement.removeAttribute("data-tema"); else document.documentElement.setAttribute("data-tema", tema); };

export function Reproductor() {
  const [datos, setDatos] = useState<Datos>();
  const [error, setError] = useState<string>();
  const [desde, setDesde] = useState(0);
  const medio = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    window.reproductor.datos().then(d => { aplicarTema(d.tema); document.title = `${d.titulo} · learn`; setDesde(d.segundo); setDatos(d); },
      e => setError(String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")));
    const fuera = [
      window.reproductor.alTema(aplicarTema),
      window.reproductor.alIr(segundo => { setDesde(segundo); const m = medio.current; if (m) { m.currentTime = segundo; void m.play().catch(() => {}); } }),
    ];
    return () => fuera.forEach(f => f());
  }, []);

  if (error) return <p className="aviso-reproductor">{error}</p>;
  if (!datos) return <span className="giro" />;
  return (
    <div className={datos.video ? "reproductor" : "reproductor solo-audio"}>
      <header className="barra-reproductor">
        <h1 className="titulo-reproductor" title={datos.titulo}>{datos.titulo}</h1>
        <span className="desde-reproductor">Desde {hora(desde)}</span>
      </header>
      <video ref={medio} className="medio" src={datos.url} controls autoPlay preload="auto" aria-label={`Grabación: ${datos.titulo}`}
        onLoadedMetadata={e => { e.currentTarget.currentTime = desde; }}
        onError={() => setError("Esta grabación no se puede reproducir acá (formato no soportado). La transcripción no depende de eso; abrila con tu reproductor.")} />
    </div>
  );
}
