// Lo que se abre encima de la pantalla: los diálogos que piden las extensiones (select, confirm, input, editor), los
// de la app, la confianza en la carpeta, el inicio de sesión con un proveedor y las pantallas de comandos de pi.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Item, Pedido } from "../tipos";
import { abrirSesion, avisar, cambiar, cerrarLogin, enviar, enviarYEsperar, importarSesion, leer, navegar, pedir, responder, responderConfianza, responderLogin, usarConfirmacion, usarTienda } from "../tienda";
import { Diferencias } from "./Transcripcion";
import { Prosa } from "./Prosa";
import { cuando } from "../../../lib/texto.ts";

export function Dialogo({ titulo, children, alCerrar, ancho = 560, etiqueta }: { titulo: ReactNode; children: ReactNode; alCerrar?: () => void; ancho?: number; etiqueta?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = caja.current?.querySelector<HTMLElement>("[autofocus], input, textarea, button:not(.cerrar-dialogo)");
    primero?.focus();
    const teclas = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && alCerrar) { ev.preventDefault(); ev.stopPropagation(); alCerrar(); }
      // El foco no se escapa del diálogo con Tab.
      if (ev.key === "Tab" && caja.current) {
        const f = [...caja.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, select, [tabindex='0']")];
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener("keydown", teclas, true);
    return () => { window.removeEventListener("keydown", teclas, true); previo?.focus?.(); };
  }, [alCerrar]);
  return (
    <div className="velo" onMouseDown={e => { if (e.target === e.currentTarget) alCerrar?.(); }}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={etiqueta ?? (typeof titulo === "string" ? titulo : undefined)} ref={caja} style={{ maxWidth: ancho }}>
        <h2 className="serif">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

export function MenuFlotante({ etiqueta, icono, opciones }: { etiqueta: string; icono: ReactNode; opciones: { texto: string; accion: () => void; peligro?: boolean }[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!caja.current?.contains(ev.target as Node)) setAbierto(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); setAbierto(false); } };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", esc);
    caja.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div className="menu" ref={caja}>
      <button className="icono" onClick={() => setAbierto(!abierto)} aria-label={etiqueta} aria-expanded={abierto} title={etiqueta}>{icono}</button>
      {abierto && (
        <div className="menu-flotante" role="menu"
          onKeyDown={e => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...(caja.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])], i = items.indexOf(document.activeElement as HTMLElement);
            items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}>
          {opciones.map(o => <button key={o.texto} role="menuitem" className={o.peligro ? "peligro" : ""} onClick={() => { setAbierto(false); o.accion(); }}>{o.texto}</button>)}
        </div>
      )}
    </div>
  );
}

// El título de un select de las extensiones trae a veces el detalle en las líneas siguientes.
const partir = (t: string) => { const [a, ...b] = t.split("\n"); return { titulo: a, cuerpo: b.join("\n").trim() }; };

function ultimoDiff(items: Item[]) {
  for (let i = items.length - 1; i >= 0; i--) { const x = items[i]; if (x.tipo === "sistema" && x.clase === "diff") return x.texto; }
  return undefined;
}

function DialogoPedido({ p }: { p: Exclude<Pedido, { clase: "quiz" | "desarrollo" | "ask" }> }) {
  const [valor, setValor] = useState(p.clase === "editor" ? p.prefill ?? "" : "");
  const items = usarTienda(e => e.items);
  const cancelar = () => void responder(p.id, p.clase === "confirm" ? false : undefined);
  if (p.clase === "select") {
    const { titulo, cuerpo } = partir(p.titulo);
    const diff = /^Guardar cambios del curso/.test(titulo) ? ultimoDiff(items) : undefined;
    return (
      <Dialogo titulo={titulo} alCerrar={cancelar} ancho={diff ? 860 : 560}>
        {cuerpo && <p className="dialogo-texto">{cuerpo}</p>}
        {diff && <Diferencias texto={diff} />}
        <div className="lista-opciones" onKeyDown={e => { const n = Number(e.key); if (n >= 1 && n <= p.opciones.length && n <= 9) { e.preventDefault(); void responder(p.id, p.opciones[n - 1]); } }}>
          {p.opciones.map((o, i) => <button key={o} onClick={() => void responder(p.id, o)} autoFocus={i === 0}><span className="num-opcion">{i + 1}</span>{o}</button>)}
        </div>
        <p className="ayuda">Elegí con el mouse, con las flechas o con el número. Esc cancela.</p>
      </Dialogo>
    );
  }
  if (p.clase === "confirm") {
    return (
      <Dialogo titulo={p.titulo} alCerrar={cancelar}>
        <p className="dialogo-texto">{p.mensaje}</p>
        <div className="acciones fin"><button className="fantasma" onClick={cancelar}>No</button><button className="boton" autoFocus onClick={() => void responder(p.id, true)}>Sí</button></div>
      </Dialogo>
    );
  }
  if (p.clase === "input") {
    return (
      <Dialogo titulo={p.titulo} alCerrar={cancelar}>
        <form onSubmit={e => { e.preventDefault(); void responder(p.id, valor); }}>
          <input className="campo" value={valor} onChange={e => setValor(e.target.value)} placeholder={p.placeholder} autoFocus />
          <div className="acciones fin"><button type="button" className="fantasma" onClick={cancelar}>Cancelar</button><button className="boton">Aceptar</button></div>
        </form>
      </Dialogo>
    );
  }
  const { titulo, cuerpo } = partir(p.titulo);
  return (
    <Dialogo titulo={titulo} alCerrar={cancelar} ancho={720}>
      {cuerpo && <Prosa texto={cuerpo} margen={false} clase="dialogo-texto prosa-chica" />}
      <textarea className="campo editor" value={valor} onChange={e => setValor(e.target.value)} autoFocus rows={8}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void responder(p.id, valor); } }} />
      <div className="acciones fin"><span className="ayuda">Ctrl+Enter para aceptar.</span><button className="fantasma" onClick={cancelar}>Cancelar</button><button className="boton" onClick={() => void responder(p.id, valor)}>Aceptar</button></div>
    </Dialogo>
  );
}

function Confirmacion() {
  const c = usarConfirmacion();
  if (!c) return null;
  return (
    <Dialogo titulo={c.titulo} alCerrar={() => c.resolver(false)}>
      <p className="dialogo-texto">{c.mensaje}</p>
      <div className="acciones fin"><button className="fantasma" onClick={() => c.resolver(false)}>{c.no}</button><button className="boton" autoFocus onClick={() => c.resolver(true)}>{c.si}</button></div>
    </Dialogo>
  );
}

function Confianza() {
  const carpeta = usarTienda(e => e.confianza);
  if (!carpeta) return null;
  return (
    <Dialogo titulo="¿Confiás en esta carpeta?" etiqueta="Confianza en la carpeta">
      <p className="dialogo-texto">learn vive en <b>.pi/</b> dentro de <b>{carpeta}</b>: sus extensiones y skills corren código en tu computadora. pi las carga sólo si confiás en la carpeta, igual que la primera vez que la abrís en la terminal. La decisión queda guardada.</p>
      <div className="acciones fin">
        <button className="fantasma" onClick={() => responderConfianza(false)}>No confiar</button>
        <button className="boton" autoFocus onClick={() => responderConfianza(true)}>Confiar y abrir</button>
      </div>
    </Dialogo>
  );
}

function Login() {
  const l = usarTienda(e => e.login);
  const [valor, setValor] = useState("");
  useEffect(() => setValor(""), [l?.pedido?.id]);
  if (!l) return null;
  return (
    <Dialogo titulo={`Iniciar sesión con ${l.nombre}`} alCerrar={cerrarLogin} ancho={600}>
      {!l.eventos.length && !l.pedido && !l.fin && <p className="dialogo-texto apagado"><span className="giro" /> Preparando el inicio de sesión…</p>}
      {l.eventos.map((e, i) => (
        <div key={i} className="paso-login">
          {e.type === "auth_url" && <>
            <p>{e.instructions ?? "Se abrió el navegador para que autorices a pi. Si no se abrió, usá este enlace:"}</p>
            <button className="enlace cita" onClick={() => void window.learn.abrirExterno(e.url!)}>{e.url!.length > 80 ? `${e.url!.slice(0, 80)}…` : e.url}</button>
          </>}
          {e.type === "device_code" && <>
            <p>Entrá a <button className="enlace cita" onClick={() => void window.learn.abrirExterno(e.verificationUri!)}>{e.verificationUri}</button> y escribí este código:</p>
            <p className="codigo-dispositivo">{e.userCode}</p>
          </>}
          {(e.type === "info" || e.type === "progress") && <p className={e.type === "progress" ? "apagado" : ""}>{e.message}{e.links?.map(k => <button key={k.url} className="enlace cita" style={{ marginLeft: 8 }} onClick={() => void window.learn.abrirExterno(k.url)}>{k.label ?? k.url}</button>)}</p>}
        </div>
      ))}
      {l.pedido && (
        <form className="paso-login" onSubmit={e => { e.preventDefault(); responderLogin(valor); }}>
          <p>{l.pedido.mensaje}</p>
          {l.pedido.tipo === "select"
            ? <div className="lista-opciones">{l.pedido.opciones?.map(o => <button type="button" key={o.id} onClick={() => responderLogin(o.id)}>{o.label}{o.description && <small>{o.description}</small>}</button>)}</div>
            : <input className="campo" type={l.pedido.tipo === "secret" ? "password" : "text"} value={valor} onChange={e => setValor(e.target.value)} placeholder={l.pedido.placeholder} autoFocus autoComplete="off" />}
          {l.pedido.tipo !== "select" && <div className="acciones fin"><button type="button" className="fantasma" onClick={() => responderLogin(undefined)}>Cancelar</button><button className="boton" disabled={!valor.trim()}>Continuar</button></div>}
        </form>
      )}
      {l.fin && <p className={`aviso-bloque ${l.fin.ok ? "info" : "error"}`}>{l.fin.ok ? `Listo: ya podés usar los modelos de ${l.nombre}.` : l.fin.error}</p>}
      <div className="acciones fin"><button className={l.fin ? "boton" : "fantasma"} onClick={cerrarLogin}>{l.fin ? "Cerrar" : "Cancelar"}</button></div>
    </Dialogo>
  );
}

// ---------- Pantallas de comandos de pi ----------

const cerrarPantalla = () => cambiar({ pantallaPi: undefined });

function InfoSesion() {
  const [d, setD] = useState<any>();
  useEffect(() => { void pedir("estadisticas-sesion").then(setD); }, []);
  const n = (x?: number) => (x ?? 0).toLocaleString("es-AR");
  return (
    <Dialogo titulo="Información de la sesión" alCerrar={cerrarPantalla}>
      {!d ? <p className="apagado"><span className="giro" /> Leyendo…</p> : (
        <dl className="datos">
          <dt>Nombre</dt><dd>{d.nombre ?? "sin nombre"}</dd>
          <dt>Archivo</dt><dd className="ruta">{d.archivo ?? "sin guardar todavía"}</dd>
          <dt>Modelo</dt><dd>{d.modelo ? `${d.modelo.nombre} (${d.modelo.proveedor})` : "ninguno"}{d.pensamiento ? `, razonamiento ${d.pensamiento}` : ""}</dd>
          <dt>Mensajes</dt><dd>{n(d.estadisticas?.userMessages)} tuyos, {n(d.estadisticas?.assistantMessages)} del tutor, {n(d.estadisticas?.toolCalls)} herramientas</dd>
          <dt>Tokens</dt><dd>{n(d.estadisticas?.tokens?.input)} de entrada, {n(d.estadisticas?.tokens?.output)} de salida, {n(d.estadisticas?.tokens?.cacheRead)} de caché</dd>
          {d.estadisticas?.cost > 0 && <><dt>Costo estimado</dt><dd>US$ {d.estadisticas.cost.toFixed(4)}</dd></>}
          <dt>Contexto</dt><dd>{d.contexto?.tokens != null ? `${n(d.contexto.tokens)} de ${n(d.contexto.contextWindow)} (${Math.round(d.contexto.percent ?? 0)} %)` : "se sabe después de la próxima respuesta"}</dd>
        </dl>
      )}
      <div className="acciones fin"><button className="boton" onClick={cerrarPantalla}>Cerrar</button></div>
    </Dialogo>
  );
}

function Arbol() {
  const [nodos, setNodos] = useState<{ id: string; nivel: number; rol: string; texto: string; enRama: boolean; hoja: boolean }[]>();
  const [elegido, setElegido] = useState<string>();
  const [instrucciones, setInstrucciones] = useState("");
  useEffect(() => { void pedir("arbol").then(r => setNodos(r ?? [])); }, []);
  const ir = async (resumir: boolean) => {
    const r = await pedir<{ cancelado: boolean; motivo?: string }>("navegar", { id: elegido, resumir, instrucciones: resumir ? instrucciones : undefined });
    if (r?.motivo) avisar(r.motivo);
    if (r && !r.cancelado) { avisar("Volviste a ese punto de la clase."); cerrarPantalla(); navegar({ pantalla: "clase" }); }
  };
  return (
    <Dialogo titulo="Volver a un punto anterior" alCerrar={cerrarPantalla} ancho={760}>
      <p className="dialogo-texto">Elegí un mensaje: la clase sigue desde ahí y lo posterior queda guardado como otra rama. Si elegís un mensaje tuyo, vuelve a la caja de texto para que lo cambies.</p>
      {!nodos ? <p className="apagado"><span className="giro" /> Leyendo la sesión…</p> : !nodos.length ? <p className="vacio">La sesión todavía está vacía.</p> : (
        <ul className="arbol">
          {nodos.map(n => (
            <li key={n.id} style={{ paddingLeft: n.nivel * 18 }}>
              <button className={`${elegido === n.id ? "elegido" : ""} ${n.enRama ? "" : "otra-rama"}`} onClick={() => setElegido(n.id)} disabled={n.hoja}>
                <span className="rol">{n.rol === "alumno" ? "Vos" : n.rol === "tutor" ? "Tutor" : "Resumen"}</span><span>{n.texto}</span>{n.hoja && <span className="apagado"> (estás acá)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {elegido && (
        <>
          <input className="campo" value={instrucciones} onChange={e => setInstrucciones(e.target.value)} placeholder="Instrucciones para el resumen (opcional)" style={{ marginTop: 14 }} />
          <div className="acciones fin">
            <button className="fantasma" onClick={() => void ir(true)}>Volver y resumir lo que dejo atrás</button>
            <button className="boton" onClick={() => void ir(false)}>Volver sin resumir</button>
          </div>
        </>
      )}
    </Dialogo>
  );
}

function Bifurcar() {
  const [mensajes, setMensajes] = useState<{ id: string; texto: string }[]>();
  useEffect(() => { void pedir("mensajes-fork").then(r => setMensajes(r ?? [])); }, []);
  const ir = async (id: string) => {
    const r = await pedir<{ cancelado: boolean }>("bifurcar", { id });
    if (r && !r.cancelado) { avisar("Empezaste una sesión nueva desde ese mensaje; la anterior queda guardada."); cerrarPantalla(); navegar({ pantalla: "clase" }); }
  };
  return (
    <Dialogo titulo="Empezar otra sesión desde un mensaje" alCerrar={cerrarPantalla} ancho={720}>
      <p className="dialogo-texto">La sesión nueva copia la conversación hasta antes de ese mensaje, que vuelve a la caja de texto para que lo reescribas.</p>
      {!mensajes ? <p className="apagado"><span className="giro" /> Leyendo…</p> : !mensajes.length ? <p className="vacio">Todavía no escribiste ningún mensaje en esta sesión.</p> : (
        <ul className="arbol">{mensajes.map(m => <li key={m.id}><button onClick={() => void ir(m.id)}><span className="rol">Vos</span><span>{m.texto.slice(0, 200)}</span></button></li>)}</ul>
      )}
    </Dialogo>
  );
}

function Novedades() {
  const [d, setD] = useState<{ texto: string; version: string }>();
  useEffect(() => { void pedir("novedades").then(setD); }, []);
  return (
    <Dialogo titulo={`Novedades de pi${d ? ` ${d.version}` : ""}`} alCerrar={cerrarPantalla} ancho={780}>
      <div className="desplazable">{!d ? <span className="giro" /> : d.texto ? <Prosa texto={d.texto.slice(0, 60000)} margen={false} clase="prosa prosa-chica" /> : <p className="vacio">Esta instalación de pi no trae la lista de cambios.</p>}</div>
      <div className="acciones fin"><button className="boton" onClick={cerrarPantalla}>Cerrar</button></div>
    </Dialogo>
  );
}

const ATAJOS: [string, string][] = [
  ["Ctrl K", "Buscar un tema, una sesión o cualquier comando"], ["Enter", "Enviar el mensaje"], ["Shift Enter", "Otro renglón en el mensaje"],
  ["Alt Enter", "Mientras el tutor escribe: dejar el mensaje para cuando termine"], ["Esc", "Detener al tutor, o cerrar el panel o un diálogo"],
  ["a b c", "Elegir una opción del quiz"], ["n", "«No sé» en el quiz"], ["1 2 3", "Elegir una opción en las preguntas y diálogos"],
  ["↑", "Con la caja vacía, recuperar tu mensaje anterior"], ["/", "Comandos de learn, de las skills y de pi en la caja de texto"], ["Ctrl ,", "Ajustes"],
];
function Atajos() {
  return (
    <Dialogo titulo="Atajos de teclado" alCerrar={cerrarPantalla}>
      <dl className="atajos">{ATAJOS.map(([k, d]) => [<dt key={k}>{k.split(" ").map(x => <kbd key={x}>{x}</kbd>)}</dt>, <dd key={`${k}d`}>{d}</dd>])}</dl>
      <div className="acciones fin"><button className="boton" onClick={cerrarPantalla}>Cerrar</button></div>
    </Dialogo>
  );
}

function ConfianzaCarpeta() {
  const [d, setD] = useState<{ confiada: boolean; carpeta: string }>();
  useEffect(() => { void pedir("confianza-carpeta", {}).then(setD); }, []);
  const cambiarConfianza = async (confiar: boolean) => {
    const r = await pedir<{ confiada: boolean; carpeta: string }>("confianza-carpeta", { confiar });
    if (r) { setD(r); avisar(confiar ? "La carpeta queda como confiable." : "La carpeta deja de ser confiable: la próxima vez pi va a preguntar antes de cargar learn."); }
  };
  return (
    <Dialogo titulo="Confianza en la carpeta" alCerrar={cerrarPantalla}>
      {d && <p className="dialogo-texto">{d.confiada ? `Confiás en ${d.carpeta}: pi carga las extensiones y skills de learn.` : `No confiás en ${d.carpeta}.`}</p>}
      <div className="acciones fin">
        {d?.confiada ? <button className="fantasma peligro" onClick={() => void cambiarConfianza(false)}>Dejar de confiar</button> : <button className="fantasma" onClick={() => void cambiarConfianza(true)}>Confiar</button>}
        <button className="boton" onClick={cerrarPantalla}>Cerrar</button>
      </div>
    </Dialogo>
  );
}

function Nombrar() {
  const [nombre, setNombre] = useState(leer().sesion.nombre ?? "");
  return (
    <Dialogo titulo="Nombrar la sesión" alCerrar={cerrarPantalla}>
      <form onSubmit={e => { e.preventDefault(); if (nombre.trim()) void pedir("nombrar", { nombre: nombre.trim() }).then(r => { if (r) { cambiar({ sesion: r }); cerrarPantalla(); } }); }}>
        <input className="campo" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus placeholder="Por ejemplo: Redes · Retardos" />
        <div className="acciones fin"><button type="button" className="fantasma" onClick={cerrarPantalla}>Cancelar</button><button className="boton" disabled={!nombre.trim()}>Guardar</button></div>
      </form>
    </Dialogo>
  );
}

function VincularNota() {
  const [nombre, setNombre] = useState("");
  const vincular = async (ruta: string) => { cerrarPantalla(); await enviarYEsperar(`/md-log ${ruta}`); };
  return (
    <Dialogo titulo="Registrar la clase en una nota" alCerrar={cerrarPantalla}>
      <p className="dialogo-texto">La nota de Obsidian se llena con toda la conversación de esta sesión y sigue sumando lo que venga. Si elegís una nota con contenido, pi pregunta antes de reemplazarlo.</p>
      <div className="acciones">
        <button className="fantasma" onClick={async () => { const [r] = await window.learn.elegirArchivos("nota"); if (r) void vincular(r); }}>Elegir una nota del vault…</button>
      </div>
      <form className="fila-campo" onSubmit={async e => { e.preventDefault(); if (!nombre.trim()) return; const r = await window.learn.notaLibre(nombre.trim()).catch(() => undefined); if (r) void vincular(r); }}>
        <input className="campo" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="O el nombre de una nota nueva en notas-libres/" />
        <button className="boton" disabled={!nombre.trim()}>Crear y registrar</button>
      </form>
    </Dialogo>
  );
}

function Importar() {
  return (
    <Dialogo titulo="Importar una sesión" alCerrar={cerrarPantalla}>
      <p className="dialogo-texto">Abre una sesión de pi guardada como archivo .jsonl (por ejemplo, exportada en otra computadora). La sesión actual queda guardada.</p>
      <div className="acciones fin">
        <button className="fantasma" onClick={cerrarPantalla}>Cancelar</button>
        <button className="boton" onClick={async () => { const [r] = await window.learn.elegirArchivos("sesion"); cerrarPantalla(); if (r) void importarSesion(r); }}>Elegir el archivo…</button>
      </div>
    </Dialogo>
  );
}

function PantallaPi() {
  const p = usarTienda(e => e.pantallaPi);
  if (!p) return null;
  switch (p.nombre) {
    case "session": return <InfoSesion />;
    case "tree": return <Arbol />;
    case "fork": return <Bifurcar />;
    case "changelog": return <Novedades />;
    case "hotkeys": return <Atajos />;
    case "trust": return <ConfianzaCarpeta />;
    case "name": return <Nombrar />;
    case "md-log": return <VincularNota />;
    case "import": return <Importar />;
    default: return null;
  }
}

export function Capas() {
  const pedidos = usarTienda(e => e.pedidos);
  const dialogo = pedidos.find(p => p.clase !== "quiz" && p.clase !== "desarrollo" && p.clase !== "ask") as Exclude<Pedido, { clase: "quiz" | "desarrollo" | "ask" }> | undefined;
  return (
    <>
      {dialogo && <DialogoPedido key={dialogo.id} p={dialogo} />}
      <Confirmacion />
      <Confianza />
      <Login />
      <PantallaPi />
    </>
  );
}

// Lista de sesiones para retomar (también /resume).
export function ListaSesiones({ limite }: { limite?: number }) {
  const sesiones = usarTienda(e => e.sesiones);
  const actual = usarTienda(e => e.sesion.archivo);
  const hoy = new Date();
  const lista = limite ? sesiones.slice(0, limite) : sesiones;
  if (!lista.length) return <p className="vacio">Todavía no hay sesiones guardadas en este vault.</p>;
  return (
    <ul className="sesiones">
      {lista.map(s => (
        <li key={s.ruta}>
          <button onClick={() => void abrirSesion(s.ruta)}>
            <span className="fuerte">{s.nombre ?? (s.primerMensaje.slice(0, 80) || "Sin nombre")}</span>
            <span className="apagado">{s.ruta === actual ? "abierta ahora" : cuando(new Date(s.modificada), hoy)}, {s.mensajes === 1 ? "un mensaje" : `${s.mensajes} mensajes`}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
