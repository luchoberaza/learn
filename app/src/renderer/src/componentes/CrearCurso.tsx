// Crear curso y agregar material (§9.5): los PDFs y las grabaciones de clase (DA51) se copian a _entrada/ sin tocar los originales y el armado sigue como
// conversación con las skills curso-nuevo y curso-agregar (preguntas en tarjetas, diff para aprobar, barra de ingesta).
import { useEffect, useState } from "react";
import { ES_SLUG, esGrabacion, slugDe } from "../../../lib/texto.ts";
import { avisar, enviar, navegar, pedir, usarTienda } from "../tienda";

const tam = (b: number) => b > 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
const comillas = (n: string) => /\s/.test(n) ? `"${n}"` : n;

export function CrearCurso({ slug: inicial }: { slug?: string }) {
  const agregar = inicial !== undefined;
  const cursos = usarTienda(e => e.cursos);
  const [archivos, setArchivos] = useState<{ nombre: string; bytes: number }[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState(inicial ?? "");
  const [slugTocado, setSlugTocado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [empezando, setEmpezando] = useState(false);

  const listar = async (nuevos: string[] = []) => {
    const l = await window.learn.listarEntrada().catch(() => []);
    setArchivos(l);
    if (nuevos.length) setElegidos(s => new Set([...s, ...nuevos]));
  };
  useEffect(() => { void listar(); }, []);
  useEffect(() => { if (!slugTocado && !agregar) setSlug(slugDe(nombre)); }, [nombre, slugTocado, agregar]);

  const sumar = async (rutas: string[]) => {
    const material = rutas.filter(r => /\.pdf$/i.test(r) || esGrabacion(r));
    if (rutas.length && !material.length) return avisar("Sólo se pueden sumar PDFs y grabaciones de clase (video o audio).", "advertencia");
    const copiados = await window.learn.aEntrada(material).catch(e => { avisar(String(e), "error"); return [] as string[]; });
    if (copiados.length) avisar(copiados.length === 1 ? `Copiaste ${copiados[0]} a _entrada/.` : `Copiaste ${copiados.length} archivos a _entrada/.`);
    await listar(copiados);
  };

  const existe = !agregar && cursos.some(c => c.slug === slug);
  const slugValido = ES_SLUG.test(slug) && !existe;
  const lista = [...elegidos].filter(n => archivos.some(a => a.nombre === n));
  const puede = agregar ? !!slug && cursos.some(c => c.slug === slug) && (lista.length > 0 || archivos.length > 0) : slugValido && archivos.length > 0;

  const empezar = async () => {
    if (!puede || empezando) return;
    setEmpezando(true);
    try {
      await pedir("nueva-sesion");
      navegar({ pantalla: "clase" });
      const extra = lista.length ? ` ${lista.map(comillas).join(" ")}` : "";
      await enviar(`/${agregar ? "curso-agregar" : "curso-nuevo"} ${slug}${extra}`);
    } finally { setEmpezando(false); }
  };

  return (
    <main className="pantalla pagina-lectura">
      <h1 className="titulo-pantalla">{agregar ? "Agregar material a un curso" : "Crear un curso"}</h1>
      <p className="vacio" style={{ marginBottom: 30 }}>
        {agregar ? "Sumá otro práctico, un parcial, un libro o la grabación de una clase. El tutor propone los cambios al índice y no se guarda nada sin que veas el diff y lo apruebes; tu progreso no se toca."
          : "Juntá los PDFs de la materia: el programa, la bibliografía, los prácticos y los parciales viejos, si tenés. También las grabaciones de las clases, en video o audio: se transcriben en tu computadora, sin costo. El tutor arma el índice por tema, te pregunta lo que no queda claro y te muestra la propuesta para que la apruebes."}
      </p>

      <section className="paso">
        <h2 className="serif subtitulo">El material</h2>
        <div className={`zona-soltar ${arrastrando ? "activa" : ""}`}
          onDragOver={e => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
          onDrop={e => { e.preventDefault(); setArrastrando(false); void sumar([...e.dataTransfer.files].map(f => window.learn.rutaDeArchivo(f)).filter(Boolean)); }}>
          <p>Arrastrá acá los PDFs y las grabaciones</p>
          <button className="fantasma" onClick={async () => void sumar(await window.learn.elegirArchivos("pdf"))}>Elegir archivos…</button>
          <p className="ayuda">Se copian a la carpeta _entrada/ del vault; los originales no se tocan.</p>
        </div>
        {archivos.length > 0 && (
          <>
            <p className="ayuda" style={{ margin: "18px 0 8px" }}>{agregar ? "Marcá los que van a este curso. Sin marcar ninguno, el tutor revisa todo _entrada/ y elige lo que corresponde." : "Marcá los que son de esta materia. Sin marcar ninguno, el tutor revisa todo _entrada/ y deja afuera lo que no corresponde."}</p>
            <ul className="lista-archivos">
              {archivos.map(a => (
                <li key={a.nombre}>
                  <label className="casilla">
                    <input type="checkbox" checked={elegidos.has(a.nombre)} onChange={e => setElegidos(s => { const n = new Set(s); if (e.target.checked) n.add(a.nombre); else n.delete(a.nombre); return n; })} />
                    <span>{a.nombre}<small>{tam(a.bytes)}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="paso">
        <h2 className="serif subtitulo">{agregar ? "El curso" : "El nombre"}</h2>
        {agregar ? (
          <select className="campo" value={slug} onChange={e => setSlug(e.target.value)} aria-label="Curso">
            <option value="">Elegí el curso</option>
            {cursos.map(c => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
          </select>
        ) : (
          <>
            <label className="etiqueta" htmlFor="nombre-curso">Nombre de la materia</label>
            <input id="nombre-curso" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Por ejemplo: Redes de Computadoras" />
            <label className="etiqueta" htmlFor="slug-curso" style={{ marginTop: 16 }}>Nombre corto, para la carpeta</label>
            <input id="slug-curso" className="campo" value={slug} onChange={e => { setSlugTocado(true); setSlug(e.target.value.toLowerCase()); }} placeholder="redes" />
            <p className={`ayuda ${slug && !slugValido ? "mal" : ""}`}>
              {!slug ? "Minúsculas, números y guiones: queda en cursos/<nombre>/." : existe ? "Ya hay un curso con ese nombre: usá Agregar material." : !ES_SLUG.test(slug) ? "Sólo minúsculas, números y guiones, sin espacios." : `El curso queda en cursos/${slug}/.`}
            </p>
          </>
        )}
      </section>

      <p className="vacio" style={{ margin: "8px 0 22px" }}>El armado sigue en una conversación: el tutor lee el material, te hace las preguntas en tarjetas y lee todas las páginas y transcribe las grabaciones en segundo plano (la barra de la izquierda muestra el avance). Puede tardar un rato con libros largos o grabaciones.</p>
      <div className="acciones">
        <button className="boton" disabled={!puede || empezando} onClick={() => void empezar()}>{empezando ? "Empezando…" : agregar ? "Agregar al curso" : "Armar el curso"}</button>
        {!archivos.length && <span className="apagado">Sumá al menos un PDF o una grabación.</span>}
      </div>
    </main>
  );
}
