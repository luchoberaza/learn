// Barra lateral siempre visible (usuario): Inicio arriba, cursos y temas en el orden del índice, y abajo lo que corre
// en segundo plano (preparación, verificación, ingesta) y el medidor de consumo del modelo de la clase.
import { fraccion, sinEmoji } from "../../../lib/texto.ts";
import { cambiar, navegar, usarTienda } from "../tienda";
import type { ResumenTema } from "../tipos";
import { usarFoco } from "./foco";
import { abrirSubagentes, usarSubagentes } from "./Subagentes";
import { mmss } from "../../../lib/foco.ts";
import { MedidorLateral } from "./Consumo";

export function EstadoTema({ t }: { t: ResumenTema }) {
  if (t.estado === "dominado") return <span className="st ok" aria-label="dominado">✓</span>;
  if (t.estado === "en_curso") return <span className="st cur" aria-label="en curso">●</span>;
  if (t.estado === "repasar") return <span className="st rep" aria-label="para repasar">↻</span>;
  if (t.prerequisitosFaltan.length) return <span className="st" aria-label="conviene antes otro tema"><span className="candado" /></span>;
  return <span className="st new" aria-label="sin empezar">○</span>;
}

function TareasDeFondo() {
  const estados = usarTienda(e => e.estados);
  const widgets = usarTienda(e => e.widgets);
  const arranque = usarTienda(e => e.arranque);
  const offline = usarTienda(e => e.info?.offline);
  const subagentes = usarSubagentes();
  const lineas: { clave: string; texto: string; avance?: number; activo: boolean }[] = [];
  if (arranque === "arrancando") lineas.push({ clave: "arranque", texto: "Abriendo pi…", activo: true });
  if (estados.preparacion) lineas.push({ clave: "preparacion", texto: sinEmoji(estados.preparacion), avance: fraccion(estados.preparacion), activo: true });
  for (const [clave, l] of Object.entries(widgets)) if (clave.startsWith("curso-ingesta")) for (const texto of l) lineas.push({ clave: `${clave}-${texto}`, texto: sinEmoji(texto), avance: fraccion(texto), activo: true });
  if (estados["curso-ingesta"]) lineas.push({ clave: "curso-ingesta", texto: sinEmoji(estados["curso-ingesta"]), avance: fraccion(estados["curso-ingesta"]), activo: false });
  for (const [clave, texto] of Object.entries(estados)) if (!["curso", "preparacion", "curso-ingesta", "md-log", "compactando", "reintento"].includes(clave)) lineas.push({ clave, texto: sinEmoji(texto), activo: false });
  if (offline) lineas.push({ clave: "offline", texto: "Faltan los paquetes de pi del proyecto: pi abrió sin red. Instalalos en Preparar la computadora.", activo: false });
  const vivos = subagentes.lista.filter(s => s.vivo);
  if (!lineas.length && !subagentes.lista.length) return null;
  return (
    <div className="tareas" aria-live="polite">
      {lineas.map(l => (
        <div key={l.clave} className="tarea">{l.texto}{l.activo && <div className={`medidor ${l.avance === undefined ? "indeterminado" : ""}`}><i style={{ width: `${(l.avance ?? 0.3) * 100}%` }} /></div>}</div>
      ))}
      {subagentes.lista.length > 0 && !subagentes.abierto && (
        <button className="tarea tarea-boton" onClick={abrirSubagentes}>
          {vivos.length ? `${vivos.length === 1 ? `El subagente ${vivos[0].nombre} está trabajando` : `${vivos.length} subagentes trabajando`}. Ver` : "Ver los subagentes que terminaron"}
        </button>
      )}
    </div>
  );
}

function FocoMini() {
  const { reloj, restante } = usarFoco();
  const ruta = usarTienda(e => e.ruta.pantalla);
  if (reloj.estado === "detenido" || ruta === "clase") return null;
  return <div className="foco-mini">{reloj.fase === "foco" ? "Foco" : "Descanso"} {mmss(restante)}{reloj.estado === "pausado" ? ", en pausa" : ""}</div>;
}

export function Lateral() {
  const ruta = usarTienda(e => e.ruta);
  const cursos = usarTienda(e => e.cursos);
  const sesion = usarTienda(e => e.sesion);
  const hayConversacion = usarTienda(e => e.items.length > 0 || e.pedidos.length > 0);
  const trabajando = usarTienda(e => e.trabajando);
  const activo = sesion.curso;
  const conversacionSuelta = hayConversacion && !activo;
  return (
    <aside className="lateral" aria-label="Navegación">
      <div className="marca"><div className="cinta" aria-hidden /><span>learn</span></div>
      <button className="buscar" onClick={() => cambiar({ paleta: true })}><span>Buscar o hacer algo</span><kbd>Ctrl K</kbd></button>
      <nav className="lateral-desplazable">
        <button className={`nav ${ruta.pantalla === "inicio" ? "on" : ""}`} onClick={() => navegar({ pantalla: "inicio" })}>Inicio</button>
        {conversacionSuelta && (
          <button className={`nav ${ruta.pantalla === "clase" ? "on" : ""}`} onClick={() => navegar({ pantalla: "clase" })}>
            {trabajando && <span className="latido" aria-label="el tutor está trabajando" />}{sesion.nombre ?? "Conversación abierta"}
          </button>
        )}
        <button className={`nav ${ruta.pantalla === "tema-libre" ? "on" : ""}`} onClick={() => navegar({ pantalla: "tema-libre" })}>Tema libre</button>
        {cursos.map(c => (
          <section key={c.slug} className="curso-lateral">
            <button className={`curso-nombre ${ruta.pantalla === "curso" && ruta.slug === c.slug ? "on" : ""}`} onClick={() => navegar({ pantalla: "curso", slug: c.slug })}>{c.nombre}</button>
            {c.error && <p className="tarea">{c.error}</p>}
            <ul className="temas">
              {c.temas.map(t => {
                const enClase = activo?.curso === c.slug && activo.tema === t.id;
                const on = (ruta.pantalla === "tema" && ruta.slug === c.slug && ruta.id === t.id) || (ruta.pantalla === "clase" && enClase);
                return (
                  <li key={t.id}>
                    <button className={`${on ? "on" : ""} ${t.prerequisitosFaltan.length && t.estado === "sin_empezar" ? "bloqueado" : ""}`}
                      onClick={() => navegar(enClase ? { pantalla: "clase" } : { pantalla: "tema", slug: c.slug, id: t.id })} title={enClase ? "Volver a la clase" : t.nombre}>
                      <EstadoTema t={t} /><span className="tema-nombre">{t.nombre}</span>{enClase && trabajando && <span className="latido" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {activo?.curso === c.slug && activo.adHoc && (
                <li><button className={ruta.pantalla === "clase" ? "on" : ""} onClick={() => navegar({ pantalla: "clase" })}><span className="st cur">●</span><span className="tema-nombre">{activo.nombreTema ?? "Fuera del índice"}</span></button></li>
              )}
            </ul>
          </section>
        ))}
      </nav>
      <TareasDeFondo />
      <FocoMini />
      <MedidorLateral />
      <div className="pie-lateral">
        <button onClick={() => navegar({ pantalla: "crear-curso" })} className={ruta.pantalla === "crear-curso" ? "on" : ""}>Crear curso</button>
        <button onClick={() => navegar({ pantalla: "ajustes" })} className={ruta.pantalla === "ajustes" ? "on" : ""}>Ajustes</button>
      </div>
    </aside>
  );
}
