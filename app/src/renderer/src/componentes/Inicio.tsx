// Inicio (§9.1): lo primero es dónde quedaste, con la última frase del tutor; después el índice de cada curso como el de
// un libro y tu semana de foco.
import { cuando, estadoEnIndice, fechaLarga } from "../../../lib/texto.ts";
import { fraseSemana, semana } from "../../../lib/foco.ts";
import { abrirSesion, estudiar, navegar, seguirClase, usarTienda } from "../tienda";
import type { ResumenCurso } from "../tipos";
import { md } from "../lib/markdown";

export function IndiceCurso({ c, limite }: { c: ResumenCurso; limite?: number }) {
  const nombres = Object.fromEntries(c.temas.map(t => [t.id, t.nombre]));
  const temas = limite ? c.temas.slice(0, limite) : c.temas;
  let unidad: number | undefined;
  return (
    <ol className="indice">
      {temas.map(t => {
        const e = estadoEnIndice(t, c.sugerido, nombres);
        const cabecera = !limite && t.unidad !== undefined && t.unidad !== unidad && c.temas.some(x => x.unidad !== t.unidad);
        unidad = t.unidad;
        return [
          cabecera ? <li key={`u${t.unidad}`} className="unidad">Unidad {t.unidad}</li> : null,
          <li key={t.id}>
            <button onClick={() => navegar({ pantalla: "tema", slug: c.slug, id: t.id })}>
              <span className="nombre">{t.nombre}</span><span className="puntos" aria-hidden /><span className={`estado ${e.clase}`}>{e.texto}</span>
            </button>
          </li>,
        ];
      })}
      {limite && c.temas.length > limite && <li><button className="enlace" onClick={() => navegar({ pantalla: "curso", slug: c.slug })}>Ver los {c.temas.length} temas</button></li>}
    </ol>
  );
}

function Seguir() {
  const seguir = usarTienda(e => e.seguir);
  const cursos = usarTienda(e => e.cursos);
  const listos = usarTienda(e => e.cursosListos);
  const hoy = new Date();
  if (seguir === undefined || !listos) return <section className="retomar"><p className="cuando">{fechaLarga(hoy)}.</p><h2 className="serif titular apagado">Buscando dónde quedaste…</h2></section>;
  const curso = seguir?.curso ? cursos.find(c => c.slug === seguir.curso!.curso) : undefined;
  const tema = curso?.temas.find(t => t.id === seguir?.curso?.tema);
  if (seguir && curso && tema) {
    const fecha = new Date(seguir.modificada);
    return (
      <section className="retomar">
        <p className="cuando">{fechaLarga(hoy)}. Tu última clase fue {cuando(fecha, hoy)}.</p>
        <h2 className="serif titular">{seguir.accion === "retomar" ? `Seguí con ${minuscula(tema.nombre)}` : `Volvé a ${minuscula(tema.nombre)}`}</h2>
        {seguir.ultimaFrase && <blockquote className="ultima-frase"><span dangerouslySetInnerHTML={{ __html: `“${md.renderInline(seguir.ultimaFrase, { citas: [] })}”` }} /><small>{curso.nombre}, {tema.nombre}</small></blockquote>}
        {!seguir.ultimaFrase && <p className="vacio" style={{ marginBottom: 24 }}>{seguir.accion === "retomar" ? "La clase quedó abierta: se retoma donde estaba." : "La última clase de este tema se cerró: la próxima arranca por el próximo paso que quedó guardado."}</p>}
        <div className="acciones">
          <button className="boton" onClick={() => void seguirClase(seguir)}>{seguir.accion === "retomar" ? "Seguir la clase" : "Estudiar de nuevo"}</button>
          {seguir.nota ? <button className="enlace" onClick={() => navegar({ pantalla: "nota", ruta: seguir.nota! })}>Leer la nota de esa clase</button>
            : <button className="enlace" onClick={() => navegar({ pantalla: "tema", slug: curso.slug, id: tema.id })}>Ver el tema</button>}
        </div>
      </section>
    );
  }
  // Sin clases todavía: el tema sugerido del primer curso, o crear el primero.
  const primero = cursos.find(c => !c.error && c.temas.length);
  const sugerido = primero?.temas.find(t => t.id === primero.sugerido) ?? primero?.temas[0];
  if (primero && sugerido) {
    return (
      <section className="retomar">
        <p className="cuando">{fechaLarga(hoy)}.</p>
        <h2 className="serif titular">Empezá por {minuscula(sugerido.nombre)}</h2>
        <p className="vacio" style={{ marginBottom: 24 }}>El tutor arranca con unas preguntas cortas para ver qué sabés, acuerda con vos un objetivo y arma el plan del tema con la bibliografía de {primero.nombre}.</p>
        <div className="acciones">
          <button className="boton" onClick={() => void estudiar(primero.slug, sugerido.id)}>Empezar la clase</button>
          <button className="enlace" onClick={() => navegar({ pantalla: "curso", slug: primero.slug })}>Ver el curso</button>
        </div>
      </section>
    );
  }
  return (
    <section className="retomar">
      <p className="cuando">{fechaLarga(hoy)}.</p>
      <h2 className="serif titular">Armá tu primer curso</h2>
      <p className="vacio" style={{ marginBottom: 24 }}>Juntá los PDFs de la materia (programa, bibliografía, prácticos y parciales) y learn los ordena por tema. También podés estudiar cualquier tema suelto, sin curso.</p>
      <div className="acciones">
        <button className="boton" onClick={() => navegar({ pantalla: "crear-curso" })}>Crear un curso</button>
        <button className="enlace" onClick={() => navegar({ pantalla: "tema-libre" })}>Estudiar un tema libre</button>
      </div>
    </section>
  );
}
const minuscula = (s: string) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

function Semana() {
  const h = usarTienda(e => e.semanaFoco);
  const hoy = new Date();
  const dias = semana(h, hoy), max = Math.max(30, ...dias.map(d => d.minutos));
  return (
    <section className="semana">
      <h3 className="serif">Tu semana</h3>
      <p>{fraseSemana(h, hoy)}</p>
      <div className="barras" role="img" aria-label={dias.map(d => `${d.etiqueta}: ${Math.round(d.minutos)} minutos`).join(", ")}>
        {dias.map(d => <div key={d.dia} className={d.hoy ? "hoy" : ""} style={{ height: `${Math.max(4, (d.minutos / max) * 100)}%` }} title={`${Math.round(d.minutos)} min`} />)}
      </div>
      <div className="dias">{dias.map(d => <span key={d.dia}>{d.etiqueta}</span>)}</div>
    </section>
  );
}

function Recientes() {
  const sesiones = usarTienda(e => e.sesiones);
  const actual = usarTienda(e => e.sesion.archivo);
  const lista = sesiones.filter(s => s.mensajes > 0).slice(0, 5);
  if (!lista.length) return null;
  const hoy = new Date();
  return (
    <section className="recientes">
      <h3 className="serif">Otras clases</h3>
      <ul>
        {lista.map(s => (
          <li key={s.ruta}>
            <button onClick={() => void abrirSesion(s.ruta)}>
              <span className="fuerte">{s.nombre ?? (s.primerMensaje.slice(0, 60) || "Sin nombre")}</span>
              <span className="apagado">{s.ruta === actual ? "abierta ahora" : cuando(new Date(s.modificada), hoy)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="enlace" onClick={() => navegar({ pantalla: "sesiones" })}>Todas las sesiones</button>
    </section>
  );
}

export function Inicio() {
  const cursos = usarTienda(e => e.cursos);
  return (
    <main className="pantalla inicio">
      <Seguir />
      <div className="inicio-indices">
        {cursos.map(c => (
          <section key={c.slug} className="indice-curso">
            <h3 className="serif"><button onClick={() => navegar({ pantalla: "curso", slug: c.slug })}>{c.nombre}</button></h3>
            {c.error ? <p className="aviso-bloque error">{c.error}</p> : c.temas.length ? <IndiceCurso c={c} limite={12} /> : <p className="vacio">Este curso todavía no tiene temas en el índice.</p>}
          </section>
        ))}
      </div>
      <div className="inicio-columna">
        <Semana />
        <Recientes />
      </div>
    </main>
  );
}
