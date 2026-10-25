// Tema (§9.2): objetivo acordado, plan, borde (lo que domina y lo que falla), próximo paso, ejercicios y si hay
// simulacro reservado (sin decir cuál). Desde acá se empieza o se retoma la clase.
import { marcarPlan, nodosDelPlan, ESTADOS, type EstadoTema } from "../../../lib/texto.ts";

// «2026-10-25» es una fecha local, no medianoche UTC (que en Uruguay o Argentina cae el día anterior).
const fechaLocal = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(s); };
function diaRelativo(d: Date) {
  const hoy = new Date(), dias = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  return dias === 0 ? "hoy" : dias === 1 ? "ayer" : `el ${d.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`;
}
import { abrirPagina, estudiar, navegar, seguirClase, usarTienda } from "../tienda";

export function Tema({ slug, id }: { slug: string; id: string }) {
  const c = usarTienda(e => e.cursos.find(x => x.slug === slug));
  const activo = usarTienda(e => e.sesion.curso);
  const seguir = usarTienda(e => e.seguir);
  const t = c?.temas.find(x => x.id === id);
  if (!c || !t) return <main className="pantalla"><p className="vacio">No se encontró el tema.</p></main>;
  const p = t.progreso;
  const enClase = activo?.curso === slug && activo.tema === id;
  const abierta = !enClase && seguir?.curso?.curso === slug && seguir.curso.tema === id && seguir.accion === "retomar" ? seguir : undefined;
  const nombres = Object.fromEntries(c.temas.map(x => [x.id, x.nombre]));
  const nodos = marcarPlan(nodosDelPlan(p.plan), [...p.domina, ...p.conceptosFirmes]);
  const empezado = t.estado !== "sin_empezar";
  return (
    <main className="pantalla pagina-lectura">
      <p className="miga-pantalla"><button className="enlace" onClick={() => navegar({ pantalla: "curso", slug })}>{c.nombre}</button></p>
      <h1 className="titulo-pantalla">{t.nombre}</h1>
      <p className={`estado-tema ${t.estado}`}>{ESTADOS[t.estado as EstadoTema] ?? t.estado}{p.actualizado ? `, actualizado ${diaRelativo(fechaLocal(p.actualizado))}` : ""}</p>

      {t.prerequisitosFaltan.length > 0 && (
        <p className="aviso-bloque">Conviene tener firme antes {t.prerequisitosFaltan.map(x => nombres[x] ?? x).join(" y ")}. Podés estudiarlo igual: el tutor arranca viendo qué sabés.</p>
      )}

      <div className="acciones" style={{ margin: "6px 0 34px" }}>
        {enClase ? <button className="boton" onClick={() => navegar({ pantalla: "clase" })}>Volver a la clase</button>
          : abierta ? <button className="boton" onClick={() => void seguirClase(abierta)}>Seguir la clase</button>
          : <button className="boton" onClick={() => void estudiar(slug, id)}>{empezado ? "Estudiar este tema" : "Empezar la clase"}</button>}
        {t.simulacroDisponible
          ? <span className="apagado">{enClase ? "Hay un simulacro reservado: rendilo desde la barra de la clase." : "Hay un simulacro reservado para cuando lo termines."}</span>
          : <span className="apagado">Sin simulacro reservado: no quedan parciales sin usar de este tema.</span>}
      </div>

      {p.proximoPaso && <section className="seccion-tema"><h2 className="serif">Próximo paso</h2><p className="proximo">{p.proximoPaso}</p></section>}
      {p.objetivo && <section className="seccion-tema"><h2 className="serif">Objetivo acordado</h2><p>{p.objetivo}</p></section>}
      {nodos.length > 0 && (
        <section className="seccion-tema"><h2 className="serif">Plan</h2>
          <ol className="plan-lista">{nodos.map((n, i) => <li key={i} className={n.estado}>{n.nombre}{n.estado === "actual" && <span className="apagado">, por acá</span>}</li>)}</ol>
        </section>
      )}
      {(p.domina.length > 0 || p.falla.length > 0) && (
        <section className="seccion-tema borde"><h2 className="serif">Dónde estás</h2>
          {p.domina.length > 0 && <div><h3>Ya dominás</h3><ul>{p.domina.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {p.falla.length > 0 && <div><h3>Todavía falla</h3><ul className="falla">{p.falla.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </section>
      )}
      {p.errores.length > 0 && <section className="seccion-tema"><h2 className="serif">Errores de concepto a revisar</h2><ul className="lista">{p.errores.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
      {p.ejercicios.length > 0 && (
        <section className="seccion-tema"><h2 className="serif">Ejercicios hechos</h2>
          <table className="tabla"><thead><tr><th>Ejercicio</th><th>Resultado</th><th>Puntaje</th><th>Fecha</th></tr></thead>
            <tbody>{p.ejercicios.map((x, i) => <tr key={i}><td>{[x.doc, x.item].filter(Boolean).join(" / ")}</td><td>{x.resultado ?? ""}</td><td>{x.puntaje ?? ""}</td><td>{x.fecha ?? ""}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {t.objetivos.length > 0 && <section className="seccion-tema"><h2 className="serif">Objetivos del programa</h2><ul className="lista">{t.objetivos.map((x, i) => <li key={i}>{x.replace(/^[A-Za-z]{0,3}\d+(?:\.\d+)*:\s*/, "")}</li>)}</ul></section>}
      {t.bibliografia.length > 0 && (
        <section className="seccion-tema"><h2 className="serif">Bibliografía</h2>
          <ul className="lista">
            {t.bibliografia.map((b, i) => {
              const doc = c.documentos.find(d => d.id === b.doc);
              return (
                <li key={i}>{doc?.titulo ?? b.doc}{b.seccion ? `, ${b.seccion}` : ""}{b.paginas?.length ? `, páginas ${b.paginas[0]}${b.paginas[1] && b.paginas[1] !== b.paginas[0] ? `–${b.paginas[1]}` : ""}` : ""}
                  {b.paginas?.length && doc && !doc.restringido ? <> <button className="enlace cita" onClick={() => void abrirPagina({ curso: slug, doc: b.doc, pagina: b.paginas![0], origen: "tema" })}>Abrir</button></> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {!empezado && !p.objetivo && <p className="vacio" style={{ marginTop: 10 }}>Todavía no estudiaste este tema. En la primera clase el tutor te hace unas preguntas cortas, acuerda un objetivo con vos y arma el plan.</p>}
    </main>
  );
}
