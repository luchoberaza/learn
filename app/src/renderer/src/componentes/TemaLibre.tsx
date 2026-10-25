// Tema libre (§9.6): la skill teach fuera de un curso, con su nota de Obsidian si querés. Los diagramas de visualize
// aparecen en la clase como imágenes.
import { useEffect, useState } from "react";
import { cuando } from "../../../lib/texto.ts";
import { enviar, enviarYEsperar, navegar, pedir, usarTienda } from "../tienda";
import type { NotaResumen } from "../tipos";

export function TemaLibre() {
  const [tema, setTema] = useState("");
  const [conNota, setConNota] = useState(true);
  const [empezando, setEmpezando] = useState(false);
  const [notas, setNotas] = useState<NotaResumen[]>([]);
  const comandos = usarTienda(e => e.comandos);
  const hayTeach = comandos.some(c => c.nombre === "skill:teach");
  useEffect(() => { void pedir<NotaResumen[]>("notas-libres", {}, true).then(n => setNotas(n ?? [])); }, []);

  const empezar = async () => {
    if (!tema.trim() || empezando) return;
    setEmpezando(true);
    try {
      await pedir("nueva-sesion");
      if (conNota) {
        const ruta = await window.learn.notaLibre(tema.trim()).catch(() => undefined);
        if (ruta) await enviarYEsperar(`/md-log ${ruta}`);
      }
      navegar({ pantalla: "clase" });
      await enviar(`/skill:teach ${tema.trim()}`);
    } finally { setEmpezando(false); }
  };
  const hoy = new Date();
  return (
    <main className="pantalla pagina-lectura">
      <h1 className="titulo-pantalla">Estudiar un tema libre</h1>
      <p className="vacio" style={{ marginBottom: 28 }}>Fuera de un curso: el tutor arranca viendo qué sabés, arma un plan y enseña paso a paso, con preguntas para comprobar. Si hace falta, busca fuentes y dibuja diagramas.</p>
      {!hayTeach && <p className="aviso-bloque">No se encontró la skill teach en .pi/skills. Revisá la instalación en Preparar la computadora.</p>}
      <form onSubmit={e => { e.preventDefault(); void empezar(); }} className="formulario">
        <label className="etiqueta" htmlFor="tema-libre">¿Qué querés aprender?</label>
        <input id="tema-libre" className="campo grande" value={tema} onChange={e => setTema(e.target.value)} placeholder="Por ejemplo: transformada de Fourier, o cómo funciona TCP" autoFocus />
        <label className="casilla" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={conNota} onChange={e => setConNota(e.target.checked)} />
          <span>Guardar la clase en una nota de Obsidian<small>Se crea en notas-libres/ del vault y se llena mientras estudiás.</small></span>
        </label>
        <div className="acciones" style={{ marginTop: 24 }}><button className="boton" disabled={!tema.trim() || empezando || !hayTeach}>{empezando ? "Empezando…" : "Empezar la clase"}</button></div>
      </form>
      {notas.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 className="serif subtitulo">Notas de temas libres</h2>
          <ul className="sesiones">{notas.map(n => <li key={n.ruta}><button onClick={() => navegar({ pantalla: "nota", ruta: n.ruta })}><span className="fuerte">{n.nombre}</span><span className="apagado">{cuando(new Date(n.modificada), hoy)}</span></button></li>)}</ul>
        </section>
      )}
    </main>
  );
}
