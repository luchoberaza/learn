// Ajustes (§9.8): apariencia, foco, modelos (el de la clase y los de visión y researcher de esta máquina), cuentas,
// ajustes de pi que aplican fuera de la terminal, la carpeta del vault y lo avanzado.
import { useEffect, useState } from "react";
import { arrancar, avisar, cambiar, confirmarApp, guardarAjustes, iniciarLogin, navegar, pedir, usarTienda } from "../tienda";

type Seccion = "apariencia" | "foco" | "modelos" | "cuentas" | "pi" | "vault" | "avanzado";
const SECCIONES: [Seccion, string][] = [["apariencia", "Apariencia"], ["foco", "Foco"], ["modelos", "Modelos"], ["cuentas", "Cuentas"], ["pi", "Conversación"], ["vault", "Carpeta del vault"], ["avanzado", "Avanzado"]];

function Apariencia() {
  const tema = usarTienda(e => e.ajustes?.tema ?? "sistema");
  return (
    <section className="ajuste">
      <h2 className="serif">Apariencia</h2>
      <div className="opciones-radio">
        {([["noche", "Noche", "Morado sobre azul noche, para leer de noche o con poca luz."], ["dia", "Día", "Papel claro y tinta azul, para leer con luz."], ["sistema", "Como el sistema", "Sigue el modo claro u oscuro de tu computadora."]] as const).map(([v, t, d]) => (
          <label key={v} className="casilla"><input type="radio" name="tema" checked={tema === v} onChange={() => void guardarAjustes({ tema: v })} /><span>{t}<small>{d}</small></span></label>
        ))}
      </div>
    </section>
  );
}

function Foco() {
  const f = usarTienda(e => e.ajustes?.foco);
  if (!f) return null;
  const poner = (c: Partial<typeof f>) => void guardarAjustes({ foco: { ...f, ...c } });
  const numero = (clave: "foco" | "descanso" | "descansoLargo" | "ciclos", etiqueta: string, min: number, max: number) => (
    <label className="numero"><span>{etiqueta}</span><input className="campo" type="number" min={min} max={max} value={f[clave]} onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= min && n <= max) poner({ [clave]: n }); }} /></label>
  );
  return (
    <section className="ajuste">
      <h2 className="serif">Foco</h2>
      <label className="casilla"><input type="checkbox" checked={f.activo} onChange={e => poner({ activo: e.target.checked })} /><span>Mostrar el temporizador en la clase<small>Bloques de foco con descansos. Nunca corta la clase: el aviso espera a que respondas la pregunta abierta, y en el simulacro se pausa.</small></span></label>
      <div className="acciones" style={{ margin: "16px 0" }}>
        <button className="fantasma" onClick={() => poner({ foco: 25, descanso: 5, descansoLargo: 15, ciclos: 4 })}>25 y 5</button>
        <button className="fantasma" onClick={() => poner({ foco: 50, descanso: 10, descansoLargo: 20, ciclos: 3 })}>50 y 10</button>
      </div>
      <div className="numeros">
        {numero("foco", "Minutos de foco", 5, 180)}
        {numero("descanso", "Descanso corto", 1, 60)}
        {numero("descansoLargo", "Descanso largo", 1, 90)}
        {numero("ciclos", "Bloques hasta el descanso largo", 1, 12)}
      </div>
      <label className="casilla" style={{ marginTop: 16 }}><input type="checkbox" checked={f.sonido} onChange={e => poner({ sonido: e.target.checked })} /><span>Sonar una campana suave al terminar cada bloque</span></label>
      <p className="ayuda">Los minutos de foco por día quedan en los datos de la app, no en el vault ni en tu progreso.</p>
    </section>
  );
}

type Modelos = { actual?: { proveedor: string; id: string }; pensamiento?: string; niveles: string[]; modelos: { proveedor: string; id: string; nombre: string; imagenes: boolean; razona: boolean }[] };
const NIVELES: Record<string, string> = { off: "Sin razonamiento", minimal: "Mínimo", low: "Bajo", medium: "Medio", high: "Alto", xhigh: "Muy alto", max: "Máximo" };

function ModelosAjuste() {
  const [m, setM] = useState<Modelos>();
  const [config, setConfig] = useState<{ base: Record<string, unknown>; local: Record<string, string> }>();
  const [vision, setVision] = useState("");
  const [researcher, setResearcher] = useState("");
  const listo = usarTienda(e => e.arranque === "listo");
  useEffect(() => {
    if (listo) void pedir<Modelos>("modelos").then(setM);
    void window.learn.configLocal().then(c => { setConfig(c); setVision(c.local.modelo_vision ?? ""); setResearcher(c.local.modelo_researcher ?? ""); }).catch(() => undefined);
  }, [listo]);
  const proveedores = [...new Set(m?.modelos.map(x => x.proveedor))];
  const valor = m?.actual ? `${m.actual.proveedor}/${m.actual.id}` : "";
  return (
    <section className="ajuste">
      <h2 className="serif">Modelos</h2>
      {!listo ? <p className="vacio">Abrí learn para elegir el modelo de la clase.</p> : !m ? <span className="giro" /> : (
        <>
          <label className="etiqueta" htmlFor="modelo">Modelo de la clase</label>
          {m.modelos.length ? (
            <select id="modelo" className="campo" value={valor} onChange={async e => {
              const [proveedor, ...id] = e.target.value.split("/");
              const r = await pedir("elegir-modelo", { proveedor, id: id.join("/") });
              if (r) { cambiar({ sesion: r }); setM(await pedir<Modelos>("modelos")); avisar("Modelo cambiado."); }
            }}>
              {!valor && <option value="">Elegí un modelo</option>}
              {proveedores.map(p => <optgroup key={p} label={p}>{m.modelos.filter(x => x.proveedor === p).map(x => <option key={x.id} value={`${x.proveedor}/${x.id}`}>{x.nombre}{x.imagenes ? "" : " (sin imágenes)"}</option>)}</optgroup>)}
            </select>
          ) : <p className="aviso-bloque">No hay modelos disponibles: iniciá sesión con un proveedor en Cuentas.</p>}
          {m.niveles.length > 1 && (
            <>
              <label className="etiqueta" htmlFor="pensamiento" style={{ marginTop: 16 }}>Razonamiento</label>
              <select id="pensamiento" className="campo" value={m.pensamiento} onChange={async e => { const r = await pedir("pensamiento", { nivel: e.target.value }); if (r) { cambiar({ sesion: r }); setM({ ...m, pensamiento: e.target.value }); } }}>
                {m.niveles.map(n => <option key={n} value={n}>{NIVELES[n] ?? n}</option>)}
              </select>
              <p className="ayuda">Más razonamiento piensa mejor las correcciones, pero tarda más y gasta más cuota.</p>
            </>
          )}
        </>
      )}
      <h3 className="subtitulo-ajuste">En esta computadora</h3>
      <p className="ayuda" style={{ marginBottom: 12 }}>La preparación de cada tema (leer páginas con visión) y la verificación con fuentes externas usan sus propios modelos. Quedan en curso.config.local.json, sin tocar el curso.config.json del repo. Vacío usa el del repo.</p>
      <datalist id="lista-modelos">{m?.modelos.map(x => <option key={`${x.proveedor}/${x.id}`} value={`${x.proveedor}/${x.id}`} />)}</datalist>
      <label className="etiqueta" htmlFor="vision">Modelo de visión</label>
      <input id="vision" className="campo" list="lista-modelos" value={vision} onChange={e => setVision(e.target.value)} placeholder={config?.base.modelo_vision ? `Del repo: ${config.base.modelo_vision}` : "proveedor/modelo"} />
      <label className="etiqueta" htmlFor="researcher" style={{ marginTop: 14 }}>Modelo del verificador (researcher)</label>
      <input id="researcher" className="campo" list="lista-modelos" value={researcher} onChange={e => setResearcher(e.target.value)} placeholder={config?.base.modelo_researcher ? `Del repo: ${config.base.modelo_researcher}` : "proveedor/modelo"} />
      <div className="acciones" style={{ marginTop: 14 }}>
        <button className="fantasma" onClick={async () => {
          if ([vision, researcher].some(v => v && !/^[^/\s]+\/\S+$/.test(v))) return avisar("Escribí cada modelo como proveedor/modelo, por ejemplo openai-codex/gpt-6-luna.", "advertencia");
          const c = await window.learn.configLocal({ modelo_vision: vision.trim() || undefined, modelo_researcher: researcher.trim() || undefined }).catch(e => { avisar(String(e), "error"); return undefined; });
          if (c) { setConfig(c); avisar("Guardaste los modelos de esta computadora."); }
        }}>Guardar</button>
      </div>
    </section>
  );
}

type Cuenta = { id: string; nombre: string; conectado: boolean; metodos: { tipo: string; nombre: string }[] };
function Cuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>();
  const listo = usarTienda(e => e.arranque === "listo");
  const login = usarTienda(e => e.login);
  useEffect(() => { if (listo && !login) void pedir<Cuenta[]>("cuentas").then(setCuentas); }, [listo, login]);
  return (
    <section className="ajuste">
      <h2 className="serif">Cuentas</h2>
      <p className="ayuda" style={{ marginBottom: 14 }}>Las credenciales las guarda pi en tu carpeta personal, igual que con /login en la terminal. Nunca van al vault.</p>
      {!listo ? <p className="vacio">Abrí learn para iniciar sesión con un proveedor.</p> : !cuentas ? <span className="giro" /> : (
        <ul className="cuentas">
          {cuentas.map(c => (
            <li key={c.id}>
              <span className="fuerte">{c.nombre}</span>
              <span className={c.conectado ? "conectado" : "apagado"}>{c.conectado ? "conectada" : "sin conectar"}</span>
              <span className="separa" />
              {c.metodos.map(m => <button key={m.tipo} className="fantasma" onClick={() => void iniciarLogin(c.id, c.nombre, m.tipo)}>{m.tipo === "oauth" ? (c.conectado ? "Volver a iniciar sesión" : "Iniciar sesión") : "Usar una clave"}</button>)}
              {c.conectado && <button className="enlace" onClick={async () => { if (await confirmarApp(`Cerrar la sesión de ${c.nombre}`, "pi borra las credenciales guardadas de este proveedor.", "Cerrar sesión")) { const r = await pedir<Cuenta[]>("cerrar-sesion", { proveedor: c.id }); if (r) setCuentas(r); } }}>Cerrar sesión</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type AjustesPi = { compactacion: boolean; correccion: string; seguimiento: string; transporte: string; reintentos: boolean };
function Conversacion() {
  const [a, setA] = useState<AjustesPi>();
  const listo = usarTienda(e => e.arranque === "listo");
  useEffect(() => { if (listo) void pedir<AjustesPi>("ajustes-pi", {}).then(setA); }, [listo]);
  const poner = async (cambios: Partial<AjustesPi>) => { const r = await pedir<AjustesPi>("ajustes-pi", { cambios }); if (r) setA(r); };
  if (!listo) return <section className="ajuste"><h2 className="serif">Conversación</h2><p className="vacio">Abrí learn para ver estos ajustes de pi.</p></section>;
  if (!a) return <section className="ajuste"><h2 className="serif">Conversación</h2><span className="giro" /></section>;
  return (
    <section className="ajuste">
      <h2 className="serif">Conversación</h2>
      <p className="ayuda" style={{ marginBottom: 14 }}>Son ajustes de pi (los mismos de /settings en la terminal) que valen también para la app.</p>
      <label className="casilla"><input type="checkbox" checked={a.compactacion} onChange={e => void poner({ compactacion: e.target.checked })} /><span>Resumir la clase sola cuando se llena el contexto<small>Así una clase larga sigue sin cortarse. También podés resumirla a mano desde el menú de la clase.</small></span></label>
      <label className="casilla" style={{ marginTop: 12 }}><input type="checkbox" checked={a.reintentos} onChange={e => void poner({ reintentos: e.target.checked })} /><span>Reintentar solo si el proveedor falla</span></label>
      <label className="etiqueta" htmlFor="correccion" style={{ marginTop: 18 }}>Mensajes que mandás mientras el tutor escribe (Enter)</label>
      <select id="correccion" className="campo" value={a.correccion} onChange={e => void poner({ correccion: e.target.value })}><option value="one-at-a-time">De a uno, esperando cada respuesta</option><option value="all">Todos juntos</option></select>
      <label className="etiqueta" htmlFor="seguimiento" style={{ marginTop: 14 }}>Mensajes para cuando termine (Alt+Enter)</label>
      <select id="seguimiento" className="campo" value={a.seguimiento} onChange={e => void poner({ seguimiento: e.target.value })}><option value="one-at-a-time">De a uno</option><option value="all">Todos juntos</option></select>
      <label className="etiqueta" htmlFor="transporte" style={{ marginTop: 14 }}>Conexión con el proveedor</label>
      <select id="transporte" className="campo" value={a.transporte} onChange={e => void poner({ transporte: e.target.value })}><option value="auto">Automática</option><option value="sse">SSE</option><option value="websocket">WebSocket</option><option value="websocket-cached">WebSocket con caché</option></select>
    </section>
  );
}

function Vault() {
  const vault = usarTienda(e => e.ajustes?.vault);
  const cambiarVault = async () => {
    const nueva = await window.learn.elegirCarpeta("Elegí la carpeta del vault");
    if (!nueva) return;
    await guardarAjustes({ vault: nueva });
    navegar({ pantalla: "preparar" });
  };
  return (
    <section className="ajuste">
      <h2 className="serif">Carpeta del vault</h2>
      <p className="ruta-grande">{vault ?? "Todavía no elegiste una carpeta."}</p>
      {vault && /onedrive|dropbox|google drive|icloud/i.test(vault) && <p className="aviso-bloque">Esta carpeta se sincroniza con la nube. learn usa enlaces y bloqueos de archivos que la sincronización puede romper: conviene una carpeta local, como Documentos\pi-learning.</p>}
      <div className="acciones">
        <button className="fantasma" onClick={() => void cambiarVault()}>Elegir otra carpeta…</button>
        {vault && <button className="enlace" onClick={() => void window.learn.mostrarEnCarpeta(".pi")}>Mostrar en la carpeta</button>}
      </div>
    </section>
  );
}

function Avanzado() {
  const app = usarTienda(e => e.app);
  const info = usarTienda(e => e.info);
  const node = usarTienda(e => e.ajustes?.node ?? "");
  const vault = usarTienda(e => e.ajustes?.vault);
  const [ruta, setRuta] = useState(node);
  const listo = usarTienda(e => e.arranque === "listo");
  return (
    <section className="ajuste">
      <h2 className="serif">Avanzado</h2>
      <dl className="datos">
        <dt>App</dt><dd>learn {app?.version} ({app?.plataforma === "win32" ? "Windows" : app?.plataforma === "linux" ? "Linux" : app?.plataforma})</dd>
        <dt>pi</dt><dd>{info?.version ?? "sin abrir"}</dd>
        <dt>Datos de la app</dt><dd className="ruta">{app?.datos}</dd>
      </dl>
      <label className="etiqueta" htmlFor="node" style={{ marginTop: 18 }}>Node.js que usa pi</label>
      <div className="fila-campo">
        <input id="node" className="campo" value={ruta} onChange={e => setRuta(e.target.value)} placeholder="node (el del sistema)" />
        <button className="fantasma" onClick={async () => { await guardarAjustes({ node: ruta.trim() || undefined }); avisar("Guardado: se usa al volver a abrir pi."); }}>Guardar</button>
      </div>
      <div className="acciones" style={{ marginTop: 18, flexWrap: "wrap" }}>
        {listo && <button className="fantasma" onClick={() => void pedir("recargar").then(r => r && avisar("Se recargaron las extensiones, skills y configuración."))}>Recargar extensiones y skills</button>}
        {vault && <button className="fantasma" onClick={() => void arrancar(vault)}>Volver a abrir pi</button>}
        <button className="fantasma" onClick={() => void window.learn.abrirRegistros()}>Abrir el registro</button>
        {listo && <button className="enlace" onClick={() => cambiar({ pantallaPi: { nombre: "trust", datos: {} } })}>Confianza en la carpeta</button>}
        {listo && <button className="enlace" onClick={() => cambiar({ pantallaPi: { nombre: "changelog", datos: {} } })}>Novedades de pi</button>}
        <button className="enlace" onClick={() => cambiar({ pantallaPi: { nombre: "hotkeys", datos: {} } })}>Atajos de teclado</button>
        <button className="enlace" onClick={() => navegar({ pantalla: "preparar" })}>Preparar la computadora</button>
      </div>
    </section>
  );
}

export function Ajustes({ seccion }: { seccion?: string }) {
  const [activa, setActiva] = useState<Seccion>((SECCIONES.find(s => s[0] === seccion)?.[0]) ?? "apariencia");
  useEffect(() => { if (seccion && SECCIONES.some(s => s[0] === seccion)) setActiva(seccion as Seccion); }, [seccion]);
  return (
    <main className="pantalla ajustes">
      <nav className="ajustes-nav" aria-label="Secciones de ajustes">
        <h1 className="titulo-pantalla">Ajustes</h1>
        {SECCIONES.map(([k, t]) => <button key={k} className={activa === k ? "on" : ""} aria-current={activa === k} onClick={() => setActiva(k)}>{t}</button>)}
      </nav>
      <div className="ajustes-cuerpo">
        {activa === "apariencia" && <Apariencia />}
        {activa === "foco" && <Foco />}
        {activa === "modelos" && <ModelosAjuste />}
        {activa === "cuentas" && <Cuentas />}
        {activa === "pi" && <Conversacion />}
        {activa === "vault" && <Vault />}
        {activa === "avanzado" && <Avanzado />}
      </div>
    </main>
  );
}
