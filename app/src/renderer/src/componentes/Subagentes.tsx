// Paneles de subagentes (§7.4): cada subagente (los que dibujan diagramas, el researcher de un tema libre, scout,
// worker…) corre en su terminal y se ve acá como en un panel de tmux. Se le puede escribir igual que en la terminal.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Cerrar } from "./Iconos";

export interface Subagente { id: string; nombre: string; vivo: boolean; codigo?: number; cerrado?: boolean }
interface Estado { lista: Subagente[]; abierto: boolean; activo?: string }
let estado: Estado = { lista: [], abierto: false };
const oyentes = new Set<() => void>();
const poner = (p: Partial<Estado>) => { estado = { ...estado, ...p }; for (const f of oyentes) f(); };
const historias = new Map<string, string>();
const terminales = new Map<string, Terminal>();

export function alMensajeSubagente(m: any) {
  switch (m.tipo) {
    case "subagente-abierto":
      historias.set(m.id, "");
      return poner({ lista: [...estado.lista.filter(s => s.id !== m.id), { id: m.id, nombre: m.nombre, vivo: true }], abierto: true, activo: m.id });
    case "subagente-datos":
      historias.set(m.id, ((historias.get(m.id) ?? "") + m.datos).slice(-400_000));
      terminales.get(m.id)?.write(m.datos);
      return;
    case "subagente-fin": return poner({ lista: estado.lista.map(s => s.id === m.id ? { ...s, vivo: false, codigo: m.codigo } : s) });
    case "subagente-cerrado": return poner({ lista: estado.lista.map(s => s.id === m.id ? { ...s, vivo: false, cerrado: true } : s) });
  }
}
// Al recargar la ventana con el host vivo, se recuperan los paneles y lo que mostraban.
export function restaurarSubagentes(lista: { id: string; nombre: string; vivo: boolean; historia: string }[]) {
  for (const s of lista) historias.set(s.id, s.historia);
  poner({ lista: lista.map(s => ({ id: s.id, nombre: s.nombre, vivo: s.vivo, cerrado: !s.vivo })), activo: lista.find(s => s.vivo)?.id ?? estado.activo });
}
export const abrirSubagentes = () => poner({ abierto: true, activo: estado.activo ?? estado.lista[0]?.id });
export function usarSubagentes() {
  return useSyncExternalStore(f => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => estado);
}

const color = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function Consola({ s }: { s: Subagente }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono"), fontSize: 13, cursorBlink: true, scrollback: 5000, allowProposedApi: true,
      theme: { background: color("--codigo"), foreground: color("--text"), cursor: color("--accent"), selectionBackground: color("--wash-fuerte") },
    });
    const ajuste = new FitAddon();
    term.loadAddon(ajuste);
    term.open(caja.current!);
    term.write(historias.get(s.id) ?? "");
    terminales.set(s.id, term);
    const tamano = () => {
      try { ajuste.fit(); } catch { return; }
      window.learn.enviarHost({ tipo: "subagente-tamano", datos: { id: s.id, cols: term.cols, rows: term.rows } });
    };
    const escribir = term.onData(d => window.learn.enviarHost({ tipo: "subagente-escribir", datos: { id: s.id, datos: d } }));
    const obs = new ResizeObserver(() => tamano());
    obs.observe(caja.current!);
    setTimeout(tamano, 50);
    term.focus();
    return () => { obs.disconnect(); escribir.dispose(); terminales.delete(s.id); term.dispose(); };
  }, [s.id]);
  // El margen va afuera: el ajuste de xterm mide el contenedor directo de la terminal.
  return <div className="consola-subagente"><div className="consola-interior" ref={caja} /></div>;
}

export function PanelSubagentes() {
  const { lista, abierto, activo } = usarSubagentes();
  if (!lista.length || !abierto) return null;
  const actual = lista.find(s => s.id === activo) ?? lista[lista.length - 1];
  return (
    <section className="panel-subagentes" aria-label="Subagentes">
      <header>
        <div className="pestanas-subagentes" role="tablist">
          {lista.map(s => (
            <button key={s.id} role="tab" aria-selected={s.id === actual.id} onClick={() => poner({ activo: s.id })}>
              {s.vivo && <span className="latido" aria-hidden />}{s.nombre}{!s.vivo && <span className="apagado">{s.codigo !== undefined && s.codigo !== 0 && !s.cerrado ? `, terminó con ${s.codigo}` : ", terminado"}</span>}
            </button>
          ))}
        </div>
        {actual.vivo && <button className="enlace" onClick={() => window.learn.enviarHost({ tipo: "subagente-cerrar", datos: { id: actual.id } })}>Detener este subagente</button>}
        {!actual.vivo && <button className="enlace" onClick={() => { historias.delete(actual.id); const resto = lista.filter(s => s.id !== actual.id); poner({ lista: resto, activo: resto[resto.length - 1]?.id }); }}>Quitar</button>}
        <button className="icono" onClick={() => poner({ abierto: false })} aria-label="Ocultar los subagentes" title="Ocultar"><Cerrar /></button>
      </header>
      <Consola key={actual.id} s={actual} />
    </section>
  );
}
