// Curso (§9.2): el índice, el material, las notas de clase y el estado (validación, ingesta e informe).
import { useEffect, useState } from "react";
import { cuando, esGrabacion } from "../../../lib/texto.ts";
import { abrirGrabacion, abrirPagina, eliminarCurso, enviar, estudiar, navegar, pedir, refrescarCursos, usarTienda } from "../tienda";
import type { NotaResumen } from "../tipos";
import { IndiceCurso } from "./Inicio";
import { Prosa } from "./Prosa";
import { MenuAbrirPdf } from "./PanelPagina";

const TIPOS: Record<string, string> = { programa: "Programa", bibliografia: "Bibliografía", ejercicios: "Ejercicios y prácticos", evaluaciones: "Evaluaciones", soluciones: "Soluciones", practicos: "Prácticos", apuntes: "Apuntes", otros: "Otros" };
type Pestana = "indice" | "material" | "notas" | "estado";

function Material({ slug }: { slug: string }) {
  const c = usarTienda(e => e.cursos.find(x => x.slug === slug));
  if (!c) return null;
  const grupos = new Map<string, typeof c.documentos>();
  for (const d of c.documentos) grupos.set(d.tipo, [...(grupos.get(d.tipo) ?? []), d]);
  return (
    <div>
      {[...grupos].map(([tipo, docs]) => (
        <section key={tipo} className="grupo-material">
          <h3 className="serif">{TIPOS[tipo] ?? tipo}</h3>
          <ul className="documentos">
            {docs.map(d => {
              const evaluacion = d.restringido ?? (tipo === "evaluaciones" || tipo === "soluciones");
              // Una grabación de clase (DA51) se cuenta en tramos de 5 minutos y se escucha en su propia ventana.
              if (esGrabacion(d.archivo)) return (
                <li key={d.id}>
                  <span className="fuerte">{d.titulo}</span>
                  <span className="apagado">grabación · {d.paginas === 1 ? "un tramo" : `${d.paginas} tramos`} de 5 minutos</span>
                  <button className="enlace cita" onClick={() => void abrirGrabacion(`[[cursos/${slug}/${d.archivo}#t=0]]`, d.titulo)} title="La grabación, en su propia ventana">Escuchar</button>
                </li>
              );
              return (
                <li key={d.id}>
                  <span className="fuerte">{d.titulo}</span>
                  <span className="apagado">{d.paginas === 1 ? "una página" : `${d.paginas} páginas`}</span>
                  {evaluacion
                    ? <span className="apagado" title="Para no ver la solución antes de intentarlo, el tutor abre estas páginas recién después de tu intento.">se abre en la práctica</span>
                    : <>
                      <MenuAbrirPdf curso={slug} doc={d.id} pagina={1} texto="Abrir" clase="enlace cita" />
                      <button className="enlace cita" onClick={() => void abrirPagina({ curso: slug, doc: d.id, pagina: 1, origen: "material" })} title="Página por página, en el panel">Hojear</button>
                    </>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!c.documentos.length && <p className="vacio">El curso todavía no tiene documentos en el índice.</p>}
    </div>
  );
}

function Notas({ slug }: { slug: string }) {
  const [notas, setNotas] = useState<NotaResumen[]>();
  const [verificaciones, setVerificaciones] = useState<NotaResumen[]>([]);
  useEffect(() => {
    void pedir<NotaResumen[]>("notas", { slug }).then(n => setNotas(n ?? []));
    void pedir<NotaResumen[]>("verificaciones", { slug }, true).then(n => setVerificaciones(n ?? []));
  }, [slug]);
  const hoy = new Date();
  if (!notas) return <p className="apagado"><span className="giro" /> Buscando las notas…</p>;
  return (
    <div>
      {notas.length ? (
        <ul className="sesiones">
          {notas.map(n => <li key={n.ruta}><button onClick={() => navegar({ pantalla: "nota", ruta: n.ruta })}><span className="fuerte">{n.nombre}</span><span className="apagado">{cuando(new Date(n.modificada), hoy)}</span></button></li>)}
        </ul>
      ) : <p className="vacio">Cada clase deja su nota acá (en <b>sesiones/</b> del curso). Todavía no hay ninguna.</p>}
      {verificaciones.length > 0 && (
        <>
          <h3 className="serif" style={{ margin: "28px 0 10px" }}>Verificaciones del material</h3>
          <ul className="sesiones">{verificaciones.map(n => <li key={n.ruta}><button onClick={() => navegar({ pantalla: "nota", ruta: n.ruta })}><span className="fuerte">{n.nombre}</span><span className="apagado">{cuando(new Date(n.modificada), hoy)}</span></button></li>)}</ul>
        </>
      )}
    </div>
  );
}

function Estado({ slug }: { slug: string }) {
  const c = usarTienda(e => e.cursos.find(x => x.slug === slug));
  const ingesta = usarTienda(e => e.estados["curso-ingesta"]);
  const resultado = usarTienda(e => [...e.items].reverse().find(x => x.tipo === "sistema" && x.clase === "info" && x.texto.startsWith(`${slug}:`)));
  const [informe, setInforme] = useState<string | null>();
  const [validando, setValidando] = useState(false);
  useEffect(() => { void pedir<{ texto: string } | undefined>("informe", { slug }, true).then(r => setInforme(r?.texto ?? null)); }, [slug]);
  useEffect(() => { if (resultado) setValidando(false); }, [resultado]);
  if (!c) return null;
  const i = c.ingesta;
  return (
    <div className="estado-curso">
      <section>
        <h3 className="serif">Lectura de los PDFs</h3>
        {i ? (
          <>
            <p>{i.estado === "completada" ? "Terminada." : i.estado === "completada_con_pendientes" ? "Terminada, con páginas pendientes." : i.estado === "en_curso" ? "En curso." : `Estado: ${i.estado.replace(/_/g, " ")}.`} {i.procesadas} de {i.solicitadas} páginas{i.pendientes ? `, ${i.pendientes} pendientes` : ""}.</p>
            {i.estado === "en_curso" && <div className="medidor"><i style={{ width: `${(i.procesadas / Math.max(1, i.solicitadas)) * 100}%` }} /></div>}
          </>
        ) : <p className="apagado">Sin registro de ingesta.</p>}
        {ingesta && <p className="ayuda">{ingesta}</p>}
        <div className="acciones"><button className="fantasma" onClick={() => void enviar(`/curso-estado ${slug}`).then(() => refrescarCursos())}>Consultar la ingesta</button></div>
      </section>
      <section>
        <h3 className="serif">Validación del curso</h3>
        <p className="vacio">Revisa la estructura, las referencias del índice, el progreso, las páginas pendientes y la preparación de cada tema.</p>
        <div className="acciones"><button className="fantasma" disabled={validando} onClick={() => { setValidando(true); void enviar(`/curso-check ${slug}`); }}>{validando ? <><span className="giro" /> Validando…</> : "Validar el curso"}</button></div>
        {resultado?.tipo === "sistema" && <pre className="salida" style={{ marginTop: 14 }}>{resultado.texto}</pre>}
      </section>
      <section>
        <h3 className="serif">Informe de ingesta</h3>
        {informe === undefined ? <span className="giro" /> : informe ? <div className="informe"><Prosa texto={informe} margen={false} clase="prosa prosa-chica" /></div> : <p className="apagado">Este curso todavía no tiene informe-ingesta.md.</p>}
      </section>
      {c.avisos.length > 0 && (
        <section>
          <h3 className="serif">Avisos de la carga</h3>
          {c.avisos.map((a, k) => <p key={k} className="aviso-bloque">{a}</p>)}
        </section>
      )}
    </div>
  );
}

export function Curso({ slug, pestana: inicial }: { slug: string; pestana?: Pestana }) {
  const c = usarTienda(e => e.cursos.find(x => x.slug === slug));
  const [pestana, setPestana] = useState<Pestana>(inicial ?? "indice");
  const [buscar, setBuscar] = useState("");
  if (!c) return <main className="pantalla"><p className="vacio">No se encontró el curso {slug}.</p></main>;
  const dominados = c.temas.filter(t => t.estado === "dominado").length;
  return (
    <main className="pantalla pagina-ancha">
      <header className="cabecera">
        <h1 className="titulo-pantalla">{c.nombre}</h1>
        <p className="apagado">{c.temas.length === 1 ? "Un tema" : `${c.temas.length} temas`}, {dominados === 0 ? "ninguno dominado todavía" : dominados === 1 ? "uno dominado" : `${dominados} dominados`}{c.examen ? `. Examen: ${c.examen.descripcion}` : ""}.</p>
        <div className="acciones">
          {c.sugerido && <button className="boton" onClick={() => navegar({ pantalla: "tema", slug, id: c.sugerido! })}>Seguir por {c.temas.find(t => t.id === c.sugerido)?.nombre}</button>}
          <button className="fantasma" onClick={() => navegar({ pantalla: "crear-curso", slug })}>Agregar material</button>
          <button className="fantasma peligro" onClick={() => void eliminarCurso(slug)}>Eliminar el curso</button>
        </div>
      </header>
      {c.error && <p className="aviso-bloque error">{c.error}</p>}
      {c.avisos.length > 0 && pestana !== "estado" && <p className="aviso-bloque">{c.avisos.length === 1 ? c.avisos[0] : `${c.avisos.length} avisos de la carga del curso: miralos en Estado.`}</p>}
      <div className="pestanas" role="tablist">
        {([["indice", "Índice"], ["material", "Material"], ["notas", "Notas de clase"], ["estado", "Estado"]] as const).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)}>{t}</button>
        ))}
      </div>
      {pestana === "indice" && (
        <>
          <form className="buscador-curso" onSubmit={e => { e.preventDefault(); const q = buscar.trim(); if (q) void estudiar(slug, q); }}>
            <input className="campo" value={buscar} onChange={e => setBuscar(e.target.value)} aria-label="Estudiar algo de este curso"
              placeholder="Estudiar algo puntual: un tema, un alias o cualquier concepto del material" />
            <button className="fantasma" disabled={!buscar.trim()}>Estudiar</button>
          </form>
          <p className="ayuda" style={{ margin: "-14px 0 22px" }}>Si coincide con un tema, se abre esa clase; si hay varios parecidos, elegís; si no está en el índice, el tutor lo busca en el material y lo estudian fuera del índice.</p>
          {c.temas.length ? <IndiceCurso c={c} /> : <p className="vacio">El índice todavía no tiene temas.</p>}
        </>
      )}
      {pestana === "material" && <Material slug={slug} />}
      {pestana === "notas" && <Notas slug={slug} />}
      {pestana === "estado" && <Estado slug={slug} />}
    </main>
  );
}
