// Quiz, preguntas de desarrollo y preguntas del tutor dentro del texto (puente ctx.ui.preguntar). La correcta, la
// explicación y la respuesta esperada llegan del host recién después de responder; «Responder con mis palabras» cierra
// la tarjeta como cancelada, como Esc en la terminal.
import { useEffect, useRef, useState } from "react";
import type { Pedido } from "../tipos";
import { responder } from "../tienda";
import { ExplicacionPrevia, LETRAS, RespuestaEscrita } from "./Transcripcion";
import { Prosa } from "./Prosa";

type PedidoQuiz = Extract<Pedido, { clase: "quiz" }>;
type PedidoDesarrollo = Extract<Pedido, { clase: "desarrollo" }>;
type PedidoAsk = Extract<Pedido, { clase: "ask" }>;

const escribiendo = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  return !!t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable);
};

export function TarjetaQuiz({ p }: { p: PedidoQuiz }) {
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [nota, setNota] = useState("");
  const [conNota, setConNota] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const seguir = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const multi = p.modo === "multi-select";
  const c = p.correccion;

  const contestar = (respuesta: { noSe: boolean; elegidas: number[] }) => {
    if (enviado) return;
    setEnviado(true);
    void responder(p.id, { ...respuesta, ...(nota.trim() ? { nota: nota.trim() } : {}) });
  };
  const elegir = (indice: number) => {
    if (c || enviado) return;
    if (multi) setElegidas(xs => xs.includes(indice) ? xs.filter(x => x !== indice) : [...xs, indice]);
    else contestar({ noSe: false, elegidas: [indice] });
  };

  // Teclas a, b, c… y n («No sé») mientras no se esté escribiendo; Enter sigue después de la corrección.
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      if (escribiendo(ev) || ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector(".velo")) return;
      if (c) { if (ev.key === "Enter" && !p.cerrado) { ev.preventDefault(); void responder(p.id, { seguir: true }); } return; }
      const k = ev.key.toLowerCase();
      const i = LETRAS.indexOf(k);
      if (i >= 0 && i < p.opciones.length && k !== "n") { ev.preventDefault(); elegir(p.opciones[i].indice); }
      else if (k === "n") { ev.preventDefault(); contestar({ noSe: true, elegidas: [] }); }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });
  useEffect(() => { if (c) seguir.current?.focus({ preventScroll: true }); }, [c]);
  useEffect(() => { caja.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []);

  return (
    <>
    <ExplicacionPrevia texto={p.explicacionPrevia} />
    <div className="quiz vivo" ref={caja} role="group" aria-label="Pregunta del tutor">
      <p className="qmeta">{multi ? "Para comprobar, podés elegir varias" : "Para comprobar"}</p>
      <p className="qtexto">{p.pregunta}</p>
      {p.contexto && <p className="qcontexto">{p.contexto}</p>}
      <ul className="opciones">
        {p.opciones.map((o, i) => {
          const marca = c ? (c.correctas.includes(o.indice) ? "bien" : c.elegidas.includes(o.indice) ? "mal" : "") : elegidas.includes(o.indice) ? "elegida" : "";
          return (
            <li key={o.indice} className={marca}>
              <button onClick={() => elegir(o.indice)} disabled={!!c || enviado} aria-pressed={multi ? elegidas.includes(o.indice) : undefined}>
                <span className="letra">{LETRAS[i]}</span><span>{o.label}{o.description && <small>{o.description}</small>}</span>
              </button>
            </li>
          );
        })}
        <li className={`nose ${c?.noSe ? "mal" : ""}`}>
          <button onClick={() => contestar({ noSe: true, elegidas: [] })} disabled={!!c || enviado}><span className="letra">n</span><span>No sé</span></button>
        </li>
      </ul>
      {!c && (
        <>
          {conNota
            ? <input className="campo nota-quiz" value={nota} onChange={e => setNota(e.target.value)} placeholder="Tu nota: por qué elegís esa, o qué te hace dudar" autoFocus maxLength={1000} />
            : null}
          <div className="qacciones">
            {multi && <button className="boton chico" onClick={() => contestar({ noSe: false, elegidas })} disabled={!elegidas.length || enviado}>Responder</button>}
            {!conNota && <button className="enlace" onClick={() => setConNota(true)}>Agregar una nota</button>}
            <button className="enlace" onClick={() => void responder(p.id, null)} disabled={enviado}>Prefiero responder con mis palabras</button>
          </div>
          <p className="qayuda">{multi ? "Marcá con el mouse o con las teclas a, b, c y después Responder." : "Elegí con el mouse o con las teclas a, b, c."} La n es «No sé».</p>
        </>
      )}
      {c && (
        <>
          {c.nota && <p className="tu-nota">Tu nota: {c.nota}</p>}
          <div className="veredicto"><b className={c.correcto ? "bien" : "mal"}>{c.correcto ? "Bien." : c.noSe ? "Está bien no saber." : "No era esa."}</b>{c.explicacion && <Prosa texto={c.explicacion} margen={false} clase="veredicto-texto" />}</div>
          {!p.cerrado && <button ref={seguir} className="boton chico" onClick={() => void responder(p.id, { seguir: true })}>Seguir</button>}
        </>
      )}
    </div>
    </>
  );
}

// Se responde escribiendo (DA52). Después de responder se ve la respuesta esperada; al seguir, el tutor corrige.
export function TarjetaDesarrollo({ p }: { p: PedidoDesarrollo }) {
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const seguir = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const c = p.correccion;
  const contestar = (r: { noSe: boolean; texto?: string }) => { if (enviado) return; setEnviado(true); void responder(p.id, r); };

  useEffect(() => {
    if (!c) return;
    const teclas = (ev: KeyboardEvent) => {
      if (escribiendo(ev) || ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector(".velo")) return;
      if (ev.key === "Enter" && !p.cerrado) { ev.preventDefault(); void responder(p.id, { seguir: true }); }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });
  useEffect(() => { if (c) seguir.current?.focus({ preventScroll: true }); }, [c]);
  useEffect(() => { caja.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []);

  return (
    <>
    <ExplicacionPrevia texto={p.explicacionPrevia} />
    <div className="quiz desarrollo vivo" ref={caja} role="group" aria-label="Pregunta del tutor">
      <p className="qmeta">Para comprobar, con tus palabras</p>
      <p className="qtexto">{p.pregunta}</p>
      {p.contexto && <p className="qcontexto">{p.contexto}</p>}
      {!c ? (
        <div className="respuesta-libre">
          <textarea className="campo" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribí tu respuesta" autoFocus disabled={enviado} maxLength={20000}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && texto.trim()) { e.preventDefault(); contestar({ noSe: false, texto }); } }} />
          <div className="qacciones">
            <button className="boton chico" disabled={!texto.trim() || enviado} onClick={() => contestar({ noSe: false, texto })}>Responder</button>
            <button className="enlace" disabled={enviado} onClick={() => contestar({ noSe: true })}>No sé</button>
            <button className="enlace" disabled={enviado} onClick={() => void responder(p.id, null)}>Prefiero responder en el chat</button>
          </div>
          <p className="qayuda">Ctrl+Enter también responde. Después vas a ver la respuesta esperada.</p>
        </div>
      ) : (
        <>
          <RespuestaEscrita r={c} />
          {!p.cerrado && <><button ref={seguir} className="boton chico" onClick={() => void responder(p.id, { seguir: true })}>Seguir</button><p className="qayuda">Al seguir, el tutor corrige tu respuesta.</p></>}
        </>
      )}
    </div>
    </>
  );
}

export function TarjetaPregunta({ p }: { p: PedidoAsk }) {
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [otra, setOtra] = useState("");
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const contestar = (respuestas: unknown[]) => { if (enviado) return; setEnviado(true); void responder(p.id, { respuestas }); };
  useEffect(() => { caja.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []);
  useEffect(() => {
    if (p.modo !== "single-select") return;
    const teclas = (ev: KeyboardEvent) => {
      if (escribiendo(ev) || ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector(".velo")) return;
      const n = Number(ev.key);
      if (n >= 1 && n <= p.opciones.length) { ev.preventDefault(); contestar([{ tipo: "option", indice: p.opciones[n - 1].indice }]); }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });

  return (
    <div className="pregunta vivo" ref={caja} role="group" aria-label="Pregunta del tutor">
      <p className="qtexto">{p.pregunta}</p>
      {p.contexto && <Prosa texto={p.contexto} margen={false} clase="qcontexto" />}
      {p.modo === "text" ? (
        <div className="respuesta-libre">
          <textarea className="campo" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribí tu respuesta" autoFocus
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && texto.trim()) { e.preventDefault(); contestar([{ tipo: "text", texto }]); } }} />
          <div className="qacciones"><button className="boton chico" disabled={!texto.trim() || enviado} onClick={() => contestar([{ tipo: "text", texto }])}>Responder</button></div>
        </div>
      ) : (
        <>
          <ul className="opciones">
            {p.opciones.map((o, i) => (
              <li key={o.indice} className={elegidas.includes(o.indice) ? "elegida" : ""}>
                <button disabled={enviado} aria-pressed={p.modo === "multi-select" ? elegidas.includes(o.indice) : undefined}
                  onClick={() => p.modo === "single-select" ? contestar([{ tipo: "option", indice: o.indice }]) : setElegidas(xs => xs.includes(o.indice) ? xs.filter(x => x !== o.indice) : [...xs, o.indice])}>
                  <span className="letra">{p.modo === "single-select" ? i + 1 : elegidas.includes(o.indice) ? "✓" : "·"}</span><span>{o.label}{o.description && <small>{o.description}</small>}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="otra">
            <input className="campo" value={otra} onChange={e => setOtra(e.target.value)} placeholder={p.etiquetaOtra || "Otra respuesta"} disabled={enviado}
              onKeyDown={e => { if (e.key === "Enter" && otra.trim()) { e.preventDefault(); contestar([...(p.modo === "multi-select" ? elegidas.map(i => ({ tipo: "option", indice: i })) : []), { tipo: "other", texto: otra }]); } }} />
          </div>
          <div className="qacciones">
            {(p.modo === "multi-select" || otra.trim()) && (
              <button className="boton chico" disabled={enviado || (!elegidas.length && !otra.trim())}
                onClick={() => contestar([...(p.modo === "multi-select" ? elegidas.map(i => ({ tipo: "option", indice: i })) : []), ...(otra.trim() ? [{ tipo: "other", texto: otra }] : [])])}>Responder</button>
            )}
            <button className="enlace" disabled={enviado} onClick={() => void responder(p.id, null)}>Prefiero responder con mis palabras</button>
          </div>
          {p.modo === "single-select" && <p className="qayuda">Elegí con el mouse o con las teclas 1 a {p.opciones.length}.</p>}
        </>
      )}
    </div>
  );
}
