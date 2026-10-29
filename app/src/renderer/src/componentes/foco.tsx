// Temporizador de concentración en la interfaz: un solo reloj para toda la app (src/lib/foco.ts tiene las reglas).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as F from "../../../lib/foco.ts";
import { cambiar, leer, usarTienda } from "../tienda";

interface EstadoFoco { reloj?: F.Reloj; aviso?: { clase: "fin-foco" | "fin-descanso"; siguiente: F.Fase } }
let estado: EstadoFoco = {};
const oyentes = new Set<() => void>();
const poner = (p: Partial<EstadoFoco>) => { estado = { ...estado, ...p }; for (const f of oyentes) f(); };
const ajustes = () => leer().ajustes?.foco ?? { activo: true, foco: 25, descanso: 5, descansoLargo: 15, ciclos: 4, sonido: true };
const reloj = () => estado.reloj ?? F.nuevo(ajustes());

function procesar(r: { reloj: F.Reloj; eventos: F.EventoFoco[] }) {
  poner({ reloj: r.reloj });
  for (const e of r.eventos) {
    if (e.tipo === "sumar") void window.learn.foco({ dia: F.dia(new Date()), minutos: e.minutos, bloque: e.bloque }).then(h => cambiar({ semanaFoco: h }));
    else { poner({ aviso: { clase: e.clase, siguiente: e.siguiente } }); if (ajustes().sonido) campana(); }
  }
}

export const foco = {
  empezar: () => { poner({ aviso: undefined }); procesar({ reloj: F.iniciar(F.conAjustes(reloj(), ajustes()), Date.now()), eventos: [] }); },
  pausar: () => procesar(F.pausar(reloj(), Date.now())),
  reanudar: () => procesar({ reloj: F.iniciar(reloj(), Date.now()), eventos: [] }),
  saltar: () => { poner({ aviso: undefined }); procesar(F.saltar(reloj(), ajustes(), Date.now())); },
  detener: () => { poner({ aviso: undefined }); procesar(F.detener(reloj(), ajustes(), Date.now())); },
  cerrarAviso: () => poner({ aviso: undefined }),
};

// Un tic por segundo con lo que pasa en la clase: pregunta abierta y simulacro.
setInterval(() => {
  const r = estado.reloj;
  if (!r || r.estado === "detenido") return;
  const e = leer();
  const preguntaAbierta = e.pedidos.some(p => !p.cerrado && (p.clase === "quiz" || p.clase === "desarrollo" || p.clase === "ask"));
  procesar(F.tic(r, ajustes(), Date.now(), { preguntaAbierta, simulacro: !!e.sesion.simulacro }));
}, 1000);

export function usarFoco() {
  const e = useSyncExternalStore(f => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => estado);
  // El intervalo sólo fuerza a redibujar: la hora se toma al dibujar, así el reloj arranca en 25:00 y no en 25:01.
  const [, setTic] = useState(0);
  useEffect(() => { const t = setInterval(() => setTic(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const ahora = Date.now();
  const r = e.reloj ?? F.nuevo(ajustes());
  return { reloj: r, aviso: e.aviso, restante: F.restante(r, ahora), avance: F.avance(r, ajustes(), ahora) };
}

// Una campana suave hecha con WebAudio: sin archivos de sonido.
function campana() {
  try {
    const ctx = new AudioContext(), t = ctx.currentTime;
    for (const [frecuencia, retraso] of [[660, 0], [880, 0.18]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = frecuencia;
      g.gain.setValueAtTime(0, t + retraso);
      g.gain.linearRampToValueAtTime(0.12, t + retraso + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + retraso + 1.2);
      o.connect(g).connect(ctx.destination);
      o.start(t + retraso); o.stop(t + retraso + 1.3);
    }
    setTimeout(() => void ctx.close(), 2000);
  } catch { /* sin audio */ }
}

const NOMBRE_FASE: Record<F.Fase, string> = { foco: "Foco", descanso: "Descanso", descansoLargo: "Descanso largo" };

// «Foco 15:32» en la barra de la clase, con sus controles en un menú chico.
export function IndicadorFoco() {
  const { reloj: r, restante } = usarFoco();
  const activo = usarTienda(e => e.ajustes?.foco.activo ?? true);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!caja.current?.contains(ev.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  if (!activo) return null;
  const etiqueta = r.estado === "detenido" ? "Empezar un bloque de foco" : `${NOMBRE_FASE[r.fase]} ${F.mmss(restante)}${r.estado === "pausado" ? ", en pausa" : ""}`;
  return (
    <div className="foco" ref={caja}>
      <button className="foco-boton" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={etiqueta} title="Temporizador de foco">
        {r.estado === "detenido" ? <span>Foco</span> : <><span>{NOMBRE_FASE[r.fase]}{r.estado === "pausado" ? " en pausa" : r.estado === "esperando" ? " listo" : ""}</span><b>{F.mmss(restante)}</b></>}
      </button>
      {abierto && (
        <div className="menu-flotante foco-menu" role="menu">
          {r.pausaSimulacro && <p className="ayuda" style={{ margin: "0 10px 6px" }}>En pausa durante el simulacro.</p>}
          {(r.estado === "detenido" || r.estado === "esperando") && <button role="menuitem" onClick={() => { foco.empezar(); setAbierto(false); }}>{r.fase === "foco" ? `Empezar ${ajustes().foco} minutos de foco` : `Empezar el descanso de ${r.fase === "descanso" ? ajustes().descanso : ajustes().descansoLargo} minutos`}</button>}
          {r.estado === "corriendo" && <button role="menuitem" onClick={() => { foco.pausar(); setAbierto(false); }}>Pausar</button>}
          {r.estado === "pausado" && <button role="menuitem" onClick={() => { foco.reanudar(); setAbierto(false); }}>Seguir</button>}
          {r.estado !== "detenido" && <button role="menuitem" onClick={() => { foco.saltar(); setAbierto(false); }}>{r.fase === "foco" ? "Pasar al descanso" : "Saltar el descanso"}</button>}
          {r.estado !== "detenido" && <button role="menuitem" onClick={() => { foco.detener(); setAbierto(false); }}>Apagar el temporizador</button>}
        </div>
      )}
    </div>
  );
}

export function LineaFoco() {
  const { reloj: r, avance } = usarFoco();
  if (r.estado === "detenido") return null;
  return <span className={`linea-foco ${r.fase !== "foco" ? "descanso" : ""}`} style={{ width: `${avance * 100}%` }} aria-hidden />;
}

// El aviso de fin de bloque: una franja que no tapa la caja de texto y espera a que el alumno decida.
export function AvisoFoco() {
  const { aviso, reloj: r } = usarFoco();
  if (!aviso) return null;
  const a = ajustes();
  const texto = aviso.clase === "fin-foco"
    ? `Terminó el bloque de foco. ${r.fase === "descansoLargo" ? `Te toca un descanso largo de ${a.descansoLargo} minutos.` : `Tomate ${a.descanso} minutos.`}`
    : "Se terminó el descanso.";
  return (
    <div className="aviso-foco" role="status">
      <span>{texto}</span>
      <button className="enlace" onClick={foco.empezar}>{aviso.clase === "fin-foco" ? "Empezar el descanso" : "Otro bloque de foco"}</button>
      {aviso.clase === "fin-foco" && <button className="enlace" onClick={() => { foco.saltar(); foco.empezar(); }}>Seguir con otro bloque</button>}
      <button className="enlace" onClick={foco.cerrarAviso}>Después</button>
    </div>
  );
}
