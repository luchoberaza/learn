// La clase (§9.3): columna de lectura con notas al margen, el quiz dentro del texto, la barra con el foco, Simulacro,
// Terminar clase y el menú; abajo la caja de texto. La misma pantalla sirve para el tema libre y el armado de un curso.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { marcarPlan, nodosDelPlan, sinEmoji } from "../../../lib/texto.ts";
import { mmss } from "../../../lib/foco.ts";
import { cambiar, confirmarApp, copiarUltimo, enviar, navegar, nuevaSesion, pedir, usarTienda, avisar } from "../tienda";
import type { ResumenCurso } from "../tipos";
import { ItemTranscripcion } from "./Transcripcion";
import { TarjetaPregunta, TarjetaQuiz } from "./Tarjetas";
import { Compositor } from "./Compositor";
import { AvisoFoco, IndicadorFoco, LineaFoco } from "./foco";
import { Menu } from "./Iconos";
import { MenuFlotante } from "./Capas";

function RelojExamen({ desde, minutos }: { desde: string; minutos?: number }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const pasado = Math.max(0, ahora - new Date(desde).getTime());
  if (!minutos) return <span className="reloj-examen">Simulacro, {mmss(pasado)}</span>;
  const total = minutos * 60000, resta = total - pasado;
  return (
    <span className={`reloj-examen ${resta < 0 ? "pasado" : resta < total * 0.15 ? "poco" : ""}`} title={`Tiempo proporcional del examen: ${minutos} minutos`}>
      {resta >= 0 ? <>Quedan <b>{mmss(resta)}</b> de {minutos}:00</> : <>Pasaste el tiempo por <b>{mmss(-resta)}</b></>}
    </span>
  );
}

function MenuClase() {
  const sesion = usarTienda(e => e.sesion);
  const mdLog = usarTienda(e => e.estados["md-log"]);
  const vault = usarTienda(e => e.info?.vault);
  const nota = sesion.curso && !sesion.curso.sinNota ? sesion.curso.nota : undefined;
  const opciones: { texto: string; accion: () => void; peligro?: boolean }[] = [
    { texto: "Resumir la clase para seguir con menos contexto", accion: () => void pedir("compactar", {}) },
    ...(nota ? [{ texto: "Leer la nota de la clase", accion: () => navegar({ pantalla: "nota", ruta: nota }) },
      { texto: "Abrir la nota en Obsidian", accion: () => vault && void window.learn.abrirExterno(`obsidian://open?path=${encodeURIComponent(`${vault}/${nota}`)}`) }] : []),
    mdLog
      ? { texto: `Dejar de registrar en ${sinEmoji(mdLog)}`, accion: () => void enviar("/md-unlog") }
      : { texto: "Registrar la clase en una nota…", accion: () => cambiar({ pantallaPi: { nombre: "md-log", datos: {} } }) },
    { texto: "Nombrar la sesión…", accion: () => cambiar({ pantallaPi: { nombre: "name", datos: {} } }) },
    { texto: "Copiar el último mensaje del tutor", accion: () => void copiarUltimo() },
    { texto: "Volver a un punto anterior…", accion: () => cambiar({ pantallaPi: { nombre: "tree", datos: {} } }) },
    { texto: "Empezar otra sesión desde un mensaje…", accion: () => cambiar({ pantallaPi: { nombre: "fork", datos: {} } }) },
    { texto: "Duplicar la sesión", accion: () => void pedir("clonar").then(r => r && avisar("Sesión duplicada: seguís en la copia.")) },
    { texto: "Exportar a HTML", accion: () => void pedir<{ ruta: string }>("exportar", {}).then(r => r && avisar(`Exportaste la sesión en ${r.ruta}`)) },
    { texto: "Información de la sesión", accion: () => cambiar({ pantallaPi: { nombre: "session", datos: {} } }) },
    { texto: "Sesión nueva", accion: () => void nuevaSesion() },
  ];
  return <MenuFlotante etiqueta="Más opciones de la clase" icono={<Menu />} opciones={opciones} />;
}

function Barra({ curso }: { curso?: ResumenCurso }) {
  const sesion = usarTienda(e => e.sesion);
  const items = usarTienda(e => e.items.length);
  const c = sesion.curso;
  const tema = c ? curso?.temas.find(t => t.id === c.tema) : undefined;
  const nombreTema = c?.nombreTema ?? tema?.nombre ?? c?.tema;
  const terminar = async () => {
    if (await confirmarApp("¿Terminar la clase?", "El tutor guarda lo que viste y lo que falta en tu progreso, y cierra la nota con un resumen y el próximo paso.", "Terminar la clase", "Seguir estudiando")) void enviar("/fin");
  };
  return (
    <header className={`barra-clase ${sesion.simulacro ? "examen" : ""}`}>
      <span className="miga">
        {c ? <>{curso?.nombre ?? c.curso} / <b>{sesion.simulacro ? `Simulacro de ${nombreTema}` : nombreTema}</b></>
          : <b>{sesion.nombre ?? (items ? "Conversación" : "Conversación nueva")}</b>}
      </span>
      <span className="separa" />
      {sesion.simulacro ? <RelojExamen desde={sesion.simulacro.desde} minutos={curso?.examen?.minutosPorPregunta} /> : <IndicadorFoco />}
      {c && !c.adHoc && !sesion.simulacro && (
        <button className="fantasma" onClick={() => void enviar("/simulacro")} title={tema && !tema.simulacroDisponible ? "Este tema todavía no tiene un ítem reservado para simulacro" : "Rendir el ítem reservado como en el examen"}>Simulacro</button>
      )}
      {c && <button className="fantasma" onClick={() => void terminar()}>Terminar clase</button>}
      <MenuClase />
      {!sesion.simulacro && <LineaFoco />}
    </header>
  );
}

function Plan({ curso }: { curso?: ResumenCurso }) {
  const c = usarTienda(e => e.sesion.curso);
  const tema = c && curso?.temas.find(t => t.id === c.tema);
  if (!tema) return null;
  const nodos = marcarPlan(nodosDelPlan(tema.progreso.plan), [...tema.progreso.domina, ...tema.progreso.conceptosFirmes]);
  return (
    <div className="encabezado-clase">
      <h1 className="serif">{tema.nombre}</h1>
      {nodos.length > 0 && <ol className="plan" aria-label="Plan del tema">{nodos.map((n, i) => <li key={i} className={n.estado}>{i + 1} {n.nombre}</li>)}</ol>}
      {tema.progreso.objetivo && <p className="objetivo">Objetivo: {tema.progreso.objetivo}</p>}
    </div>
  );
}

function Trabajando() {
  const trabajando = usarTienda(e => e.trabajando);
  const pensando = usarTienda(e => e.pensando);
  const etiqueta = usarTienda(e => e.etiquetaTrabajando);
  const compactando = usarTienda(e => e.estados.compactando);
  const reintento = usarTienda(e => e.estados.reintento);
  const escribiendo = usarTienda(e => { const u = e.items[e.items.length - 1]; return u?.tipo === "tutor" && u.enCurso; });
  // Con una pregunta abierta el tutor espera al alumno: no está «trabajando».
  const esperandote = usarTienda(e => e.pedidos.some(p => !p.cerrado && (p.clase === "quiz" || p.clase === "ask")));
  const texto = reintento ?? compactando ?? (trabajando && !escribiendo && !esperandote ? (pensando ? "El tutor está pensando…" : etiqueta && etiqueta !== "Trabajando…" ? etiqueta : "El tutor está trabajando…") : undefined);
  if (!texto) return null;
  return <p className="trabajando" aria-live="polite"><span className="puntitos" aria-hidden><i /><i /><i /></span>{texto}</p>;
}

function Vacia() {
  const curso = usarTienda(e => e.sesion.curso);
  const trabajando = usarTienda(e => e.trabajando);
  if (curso || trabajando) return null;
  return (
    <div className="vacio clase-vacia">
      <p className="serif fuerte" style={{ fontSize: 22, marginBottom: 10 }}>Una conversación nueva</p>
      <p>Preguntale al tutor lo que quieras. Para estudiar un tema de un curso, elegilo en la barra de la izquierda; para un tema suelto, usá <b>Tema libre</b>.</p>
    </div>
  );
}

export function Clase() {
  const items = usarTienda(e => e.items);
  const pedidos = usarTienda(e => e.pedidos);
  const cursos = usarTienda(e => e.cursos);
  const slug = usarTienda(e => e.sesion.curso?.curso);
  const curso = cursos.find(c => c.slug === slug);
  const lectura = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  const [abajo, setAbajo] = useState(true);
  const enLinea = pedidos.filter(p => p.clase === "quiz" || p.clase === "ask");
  const abierta = enLinea.find(p => !p.cerrado && !(p.clase === "quiz" && p.correccion));

  // Se queda abajo mientras llega texto, salvo que el alumno haya subido a releer.
  const alDesplazar = () => {
    const el = lectura.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    pegado.current = cerca;
    setAbajo(cerca);
  };
  useLayoutEffect(() => {
    const el = lectura.current;
    if (el && pegado.current) el.scrollTop = el.scrollHeight;
  }, [items, pedidos]);
  useEffect(() => { const el = lectura.current; if (el) el.scrollTop = el.scrollHeight; }, []);

  return (
    <main className="pantalla clase">
      <Barra curso={curso} />
      <div className="lectura" ref={lectura} onScroll={alDesplazar}>
        <div className="columna">
          <Plan curso={curso} />
          {items.length === 0 && !enLinea.length && <Vacia />}
          {items.map((it, i) => <div className="bloque" key={`${it.tipo}-${it.id}`}><ItemTranscripcion item={it} ultimo={i === items.length - 1} /></div>)}
          {enLinea.map(p => <div className="bloque" key={`pedido-${p.id}`}>{p.clase === "quiz" ? <TarjetaQuiz p={p} /> : p.clase === "ask" ? <TarjetaPregunta p={p} /> : null}</div>)}
          <Trabajando />
        </div>
      </div>
      {!abajo && <button className="ir-al-final fantasma" onClick={() => { const el = lectura.current; if (el) { pegado.current = true; el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); } }}>Ir al final</button>}
      <AvisoFoco />
      <Compositor bloqueado={abierta ? (abierta.clase === "quiz" ? "Respondé la pregunta de arriba, o tocá «Prefiero responder con mis palabras»." : "Respondé arriba, o tocá «Prefiero responder con mis palabras».") : undefined} />
    </main>
  );
}
