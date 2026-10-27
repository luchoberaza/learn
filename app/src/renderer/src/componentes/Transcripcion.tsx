// Cada cosa que pasa en la clase, dibujada según lo que es. Las tools del curso son una línea en español (nunca sus
// argumentos ni resultados); las generales, una línea plegable con el comando y su salida, como en pi.
import { memo, useEffect, useState } from "react";
import type { Item, ItemDesarrollo, ItemPregunta, ItemQuiz } from "../tipos";
import { abrirPagina, enviar } from "../tienda";
import { imagenRender, Prosa } from "./Prosa";
import { analizarEnlace } from "../../../lib/texto.ts";

export const LETRAS = "abcdefghijklm";

const SKILLS: Record<string, string> = { teach: "la clase de tema libre", visualize: "los diagramas", "curso-nuevo": "el armado del curso", "curso-agregar": "la ampliación del curso" };

function Alumno({ item }: { item: Extract<Item, { tipo: "alumno" }> }) {
  return (
    <div className="alumno">
      <span className="quien">Vos</span>
      {item.skills?.map(s => <span key={s} className="skill-cargada">Empezó {SKILLS[s] ?? `la skill ${s}`}</span>)}
      {item.texto.trim() && <p>{item.texto}</p>}
      {item.imagenes.length > 0 && <div className="fotos">{item.imagenes.map((im, i) => <img key={i} src={`data:${im.mimeType};base64,${im.data}`} alt={`Foto ${i + 1} que mandaste`} />)}</div>}
    </div>
  );
}

function Herramienta({ item }: { item: Extract<Item, { tipo: "herramienta" }> }) {
  const marca = item.estado === "corriendo" ? <span className="giro" aria-label="en curso" /> : item.estado === "error" ? <span className="marca mal" aria-label="falló">✗</span> : <span className="marca" aria-hidden>·</span>;
  if (item.curso) {
    return (
      <div className={`herramienta ${item.estado}`}>
        {marca}<span>{item.linea || "Trabajando con el material…"}</span>
        {item.parcial && <pre className="parcial">{item.parcial}</pre>}
      </div>
    );
  }
  return (
    <details className={`herramienta general ${item.estado}`}>
      <summary>{marca}<span>{item.linea}</span>{item.detalle.entrada && <code>{item.detalle.entrada.split("\n")[0].slice(0, 90)}</code>}</summary>
      {item.detalle.entrada && <pre className="salida">{item.detalle.entrada}</pre>}
      {item.detalle.salida && <pre className="salida">{item.detalle.salida}</pre>}
    </details>
  );
}

// La explicación que trajo la pregunta (DA52): el alumno la lee como texto del tutor, justo antes de la pregunta.
export function ExplicacionPrevia({ texto }: { texto?: string }) {
  return texto ? <div className="tutor explicacion-previa"><Prosa texto={texto} terminado /></div> : null;
}

export function QuizResuelto({ item }: { item: ItemQuiz }) {
  if (item.estado !== "respondido" || !item.resultado) {
    return (
      <div className="quiz cerrado">
        <p className="qmeta">{item.estado === "descartado" ? "Pregunta descartada" : "Pregunta cerrada sin respuesta"}</p>
        <p className="qtexto">{item.pregunta}</p>
        {item.mensaje && <p className="ayuda">{item.mensaje}</p>}
      </div>
    );
  }
  const r = item.resultado;
  return (
    <>
    <ExplicacionPrevia texto={item.explicacionPrevia} />
    <div className="quiz">
      <p className="qmeta">{item.modo === "multi-select" ? "Para comprobar, varias respuestas" : "Para comprobar"}</p>
      <p className="qtexto">{item.pregunta}</p>
      {item.contexto && <p className="qcontexto">{item.contexto}</p>}
      <ul className="opciones">
        {(item.opciones ?? []).map((o, i) => {
          const correcta = r.correctas.includes(o.indice), elegida = r.elegidas.includes(o.indice);
          return <li key={o.indice} className={correcta ? "bien" : elegida ? "mal" : ""}><span className="letra">{LETRAS[i]}</span>{o.label}{elegida && <span className="elegiste">{correcta ? "tu respuesta" : "elegiste esta"}</span>}</li>;
        })}
        {r.noSe && <li className="nose mal"><span className="letra" />No sé <span className="elegiste">elegiste esta</span></li>}
      </ul>
      {r.nota && <p className="tu-nota">Tu nota: {r.nota}</p>}
      <div className="veredicto"><b className={r.correcto ? "bien" : "mal"}>{r.correcto ? "Bien." : r.noSe ? "Está bien no saber." : "No era esa."}</b>{r.explicacion && <Prosa texto={r.explicacion} margen={false} clase="veredicto-texto" />}</div>
    </div>
    </>
  );
}

// Lo que escribió el alumno (o «No sé») y la respuesta esperada, en la tarjeta viva y en la transcripción.
export function RespuestaEscrita({ r }: { r: { noSe: boolean; texto?: string; esperada?: string } }) {
  return (
    <>
      {r.noSe ? <p className="tu-respuesta nose">Respondiste: No sé</p> : <p className="tu-respuesta">{r.texto}</p>}
      {r.esperada && <div className="veredicto esperada"><b>Respuesta esperada.</b><Prosa texto={r.esperada} margen={false} clase="veredicto-texto" /></div>}
    </>
  );
}

export function DesarrolloResuelto({ item }: { item: ItemDesarrollo }) {
  if (item.estado !== "respondido" || !item.resultado) {
    return (
      <div className="quiz cerrado">
        <p className="qmeta">{item.estado === "descartado" ? "Pregunta descartada" : "Pregunta cerrada sin respuesta"}</p>
        <p className="qtexto">{item.pregunta}</p>
        {item.mensaje && <p className="ayuda">{item.mensaje}</p>}
      </div>
    );
  }
  return (
    <>
    <ExplicacionPrevia texto={item.explicacionPrevia} />
    <div className="quiz desarrollo">
      <p className="qmeta">Para comprobar, con tus palabras</p>
      <p className="qtexto">{item.pregunta}</p>
      {item.contexto && <p className="qcontexto">{item.contexto}</p>}
      <RespuestaEscrita r={item.resultado} />
    </div>
    </>
  );
}

export function PreguntaResuelta({ item }: { item: ItemPregunta }) {
  const respuestas = item.respuestas ?? [];
  return (
    <div className="pregunta-resuelta">
      <p className="qtexto">{item.pregunta}</p>
      {item.estado === "respondido"
        ? <p>{respuestas.map((r, i) => <span key={i} className="respuesta">{r.tipo === "option" ? r.label : r.texto}</span>)}</p>
        : <p className="apagado">{item.estado === "descartado" ? "Pregunta descartada." : "Cerrada sin elegir: respondiste con tus palabras."}</p>}
    </div>
  );
}

// Diff de guardar_curso: lo que se agrega en verde y lo que se quita en rojo.
export function Diferencias({ texto }: { texto: string }) {
  return (
    <pre className="diff">
      {texto.split("\n").map((l, i) => <span key={i} className={l.startsWith("+") && !l.startsWith("+++") ? "mas" : l.startsWith("-") && !l.startsWith("---") ? "menos" : l.startsWith("@@") ? "zona" : undefined}>{l}{"\n"}</span>)}
    </pre>
  );
}

function PaginaMostrada({ item }: { item: Extract<Item, { tipo: "pagina" }> }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => { void imagenRender(item.render).then(setSrc); }, [item.render]);
  const m = /\[\[([^\]]+)\]\]/.exec(item.cita);
  const enlace = m ? analizarEnlace(m[1]) : undefined;
  const abrir = () => { if (enlace?.tipo === "cita") void abrirPagina({ cita: `[[${enlace.destino}]]`, origen: "ver_pagina" }); };
  return (
    <figure className="pagina-mostrada">
      <button onClick={abrir} disabled={enlace?.tipo !== "cita"} aria-label="Ver la página grande">{src ? <img src={src} alt="Página que mostró el tutor" /> : <span className="giro" />}</button>
      <figcaption>{enlace?.tipo === "cita" ? `Página ${enlace.pagina} que mostró el tutor` : item.cita.replace(/\[\[|\]\]/g, "")}</figcaption>
    </figure>
  );
}

export const ItemTranscripcion = memo(function ItemTranscripcion({ item, ultimo }: { item: Item; ultimo: boolean }) {
  switch (item.tipo) {
    case "alumno": return <Alumno item={item} />;
    case "tutor": return <div className="tutor"><Prosa texto={item.texto} terminado={!item.enCurso} /></div>;
    case "herramienta": return <Herramienta item={item} />;
    case "quiz": return <QuizResuelto item={item} />;
    case "desarrollo": return <DesarrolloResuelto item={item} />;
    case "pregunta": return <PreguntaResuelta item={item} />;
    case "sistema": return item.clase === "diff" ? <div className="sistema"><p className="apagado">Cambios propuestos al curso</p><Diferencias texto={item.texto} /></div> : <div className="sistema"><pre>{item.texto}</pre></div>;
    case "pagina": return <PaginaMostrada item={item} />;
    case "separador": return <div className="separador"><span>{item.texto}</span></div>;
    case "error": return <div className="error-linea"><span>{item.texto}</span>{ultimo && <button className="enlace" onClick={() => void enviar("seguí")}>Reintentar</button>}</div>;
    case "aviso-linea": return <p className="aviso-linea">{item.texto}</p>;
  }
});
