// Paleta (Ctrl+K): ningún comando queda inaccesible aunque no tenga botón propio. Temas, cursos, sesiones, pantallas
// y todos los comandos de learn, de las skills y de pi.
import { useEffect, useMemo, useRef, useState } from "react";
import { abrirSesion, cambiar, enviar, estudiar, leer, navegar, nuevaSesion, usarTienda } from "../tienda";

type Entrada = { id: string; grupo: string; texto: string; detalle?: string; accion: () => void };
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Comandos que se ejecutan al elegirlos; los demás quedan escritos en la caja de texto para completar el argumento.
const DIRECTOS = new Set(["fin", "simulacro", "cursos", "md-unlog", "compact", "new", "resume", "model", "thinking", "login", "logout", "session", "copy", "reload",
  "tree", "fork", "clone", "settings", "hotkeys", "changelog", "trust", "scoped-models", "quit", "import", "export", "llama", "share", "bug"]);

function ejecutarComando(nombre: string) {
  const e = leer();
  cambiar({ paleta: false });
  if (nombre === "new") return void nuevaSesion();
  if (nombre === "name") return cambiar({ pantallaPi: { nombre: "name", datos: {} } });
  if (nombre === "md-log") return cambiar({ pantallaPi: { nombre: "md-log", datos: {} } });
  if (nombre === "curso-nuevo") return navegar({ pantalla: "crear-curso" });
  if (nombre === "curso-agregar") return navegar({ pantalla: "crear-curso", slug: e.cursos[0]?.slug ?? "" });
  const unCurso = e.cursos.length === 1 ? e.cursos[0].slug : e.sesion.curso?.curso;
  if ((nombre === "curso-check" || nombre === "curso-estado") && unCurso) { navegar({ pantalla: "clase" }); return void enviar(`/${nombre} ${unCurso}`); }
  if (nombre === "progreso" && unCurso) { navegar({ pantalla: "clase" }); return void enviar(`/progreso ${unCurso}`); }
  if (DIRECTOS.has(nombre)) {
    // Los que abren una pantalla de la app no necesitan ir a la clase.
    if (!["resume", "model", "thinking", "login", "logout", "settings", "hotkeys", "changelog", "trust", "scoped-models", "session", "tree", "fork", "import", "quit", "copy"].includes(nombre)) navegar({ pantalla: "clase" });
    return void enviar(`/${nombre}`);
  }
  navegar({ pantalla: "clase" });
  cambiar(x => ({ textoEditor: { texto: `/${nombre} `, n: (x.textoEditor?.n ?? 0) + 1 } }));
}

export function Paleta() {
  const abierta = usarTienda(e => e.paleta);
  const cursos = usarTienda(e => e.cursos);
  const sesiones = usarTienda(e => e.sesiones);
  const comandos = usarTienda(e => e.comandos);
  const [q, setQ] = useState("");
  const [marcada, setMarcada] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  useEffect(() => { if (abierta) { setQ(""); setMarcada(0); } }, [abierta]);

  const entradas = useMemo<Entrada[]>(() => [
    { id: "p-inicio", grupo: "Ir a", texto: "Inicio", accion: () => navegar({ pantalla: "inicio" }) },
    { id: "p-libre", grupo: "Ir a", texto: "Tema libre", detalle: "Estudiar cualquier tema sin curso", accion: () => navegar({ pantalla: "tema-libre" }) },
    { id: "p-crear", grupo: "Ir a", texto: "Crear curso", detalle: "Desde los PDFs de la materia", accion: () => navegar({ pantalla: "crear-curso" }) },
    { id: "p-sesiones", grupo: "Ir a", texto: "Todas las sesiones", detalle: "Retomar una clase o conversación", accion: () => navegar({ pantalla: "sesiones" }) },
    { id: "p-ajustes", grupo: "Ir a", texto: "Ajustes", detalle: "Apariencia, foco, modelos, cuentas", accion: () => navegar({ pantalla: "ajustes" }) },
    { id: "p-preparar", grupo: "Ir a", texto: "Preparar la computadora", detalle: "Diagnóstico e instalación", accion: () => navegar({ pantalla: "preparar" }) },
    { id: "p-atajos", grupo: "Ir a", texto: "Atajos de teclado", accion: () => cambiar({ pantallaPi: { nombre: "hotkeys", datos: {} } }) },
    ...cursos.flatMap(c => [
      { id: `c-${c.slug}`, grupo: "Cursos", texto: c.nombre, detalle: `${c.temas.length} temas`, accion: () => navegar({ pantalla: "curso", slug: c.slug }) },
      ...c.temas.map(t => ({ id: `t-${c.slug}-${t.id}`, grupo: "Estudiar", texto: t.nombre, detalle: c.nombre, accion: () => void estudiar(c.slug, t.id) })),
    ]),
    ...sesiones.slice(0, 40).map(s => ({ id: `s-${s.ruta}`, grupo: "Retomar", texto: s.nombre ?? (s.primerMensaje.slice(0, 70) || "Sin nombre"), accion: () => void abrirSesion(s.ruta) })),
    ...comandos.map(c => ({ id: `k-${c.nombre}`, grupo: c.origen === "learn" ? "Comandos de learn" : c.origen === "skill" ? "Skills" : "Comandos de pi", texto: `/${c.nombre}`, detalle: c.descripcion, accion: () => ejecutarComando(c.nombre) })),
  ], [cursos, sesiones, comandos]);

  const filtradas = useMemo(() => {
    const palabras = normalizar(q).split(/\s+/).filter(Boolean);
    if (!palabras.length) return entradas.filter(e => e.grupo !== "Estudiar" && e.grupo !== "Comandos de pi").slice(0, 60);
    return entradas.filter(e => { const h = normalizar(`${e.texto} ${e.detalle ?? ""} ${e.grupo}`); return palabras.every(p => h.includes(p)); }).slice(0, 80);
  }, [q, entradas]);
  useEffect(() => { lista.current?.querySelector(".marcada")?.scrollIntoView({ block: "nearest" }); }, [marcada]);

  if (!abierta) return null;
  const elegir = (e?: Entrada) => { if (!e) return; cambiar({ paleta: false }); e.accion(); };
  let grupo = "";
  return (
    <div className="velo arriba" onMouseDown={e => { if (e.target === e.currentTarget) cambiar({ paleta: false }); }}>
      <div className="paleta" role="dialog" aria-label="Buscar o hacer algo">
        <input className="campo" autoFocus value={q} placeholder="Buscá un tema, una sesión o un comando" aria-label="Buscar"
          onChange={e => { setQ(e.target.value); setMarcada(0); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setMarcada(m => Math.min(filtradas.length - 1, m + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setMarcada(m => Math.max(0, m - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); elegir(filtradas[marcada]); }
            else if (e.key === "Escape") { e.preventDefault(); cambiar({ paleta: false }); }
          }} />
        <ul ref={lista} role="listbox">
          {filtradas.map((e, i) => {
            const cabecera = e.grupo !== grupo ? (grupo = e.grupo) : undefined;
            return [
              cabecera ? <li key={`g-${cabecera}`} className="grupo" role="presentation">{cabecera}</li> : null,
              <li key={e.id} role="option" aria-selected={i === marcada} className={i === marcada ? "marcada" : ""} onMouseEnter={() => setMarcada(i)} onMouseDown={ev => { ev.preventDefault(); elegir(e); }}>
                <span>{e.texto}</span>{e.detalle && <small>{e.detalle}</small>}
              </li>,
            ];
          })}
          {!filtradas.length && <li className="grupo">Nada coincide con «{q}».</li>}
        </ul>
      </div>
    </div>
  );
}
