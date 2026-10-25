// Preparar la computadora (§12): elegir el vault, el diagnóstico del doctor de learn y una acción para cada faltante.
// Corre en el proceso principal de la app, así que funciona antes de que exista el Node que necesita pi.
import { useEffect, useRef, useState } from "react";
import type { Chequeo } from "../tipos";
import { arrancar, confirmarApp, guardarAjustes, navegar, usarTienda } from "../tienda";

type Accion = { id: string; texto: string; explicacion: string };
const ACCIONES: Record<string, Accion> = {
  node: { id: "node", texto: "Instalar Node.js", explicacion: "Se instala Node.js con winget (el instalador de Windows)." },
  git: { id: "git", texto: "Instalar Git", explicacion: "Se instala Git para Windows con winget; trae Git Bash, que pi usa para los comandos." },
  uv: { id: "uv", texto: "Instalar uv", explicacion: "Se instala uv, que prepara el Python de la ingesta." },
  pi: { id: "pi", texto: "Instalar pi 1.4.0", explicacion: "Se instala pi 1.4.0, la versión fijada por learn, con npm." },
  learn: { id: "learn", texto: "Traer learn a esta carpeta", explicacion: "Se clona learn (rama cursos) en .pi/ dentro de la carpeta del vault, y se crean _entrada/ y cursos/." },
  venv: { id: "venv", texto: "Preparar el Python de la ingesta", explicacion: "Se crea .pi/.venv con Python 3.13.13 y las versiones fijadas (uv sync --locked)." },
  paquetes: { id: "paquetes", texto: "Instalar los paquetes de pi", explicacion: "Se instalan los subagentes y la extensión web en las versiones fijadas por learn." },
  config: { id: "config", texto: "Instalar la configuración web", explicacion: "Se copia la configuración de búsqueda web a tu carpeta personal de pi." },
  magick: { id: "magick", texto: "Instalar ImageMagick", explicacion: "Se instala ImageMagick con winget, para que las fotos HEIC o BMP del celular se guarden en la nota de la clase." },
  visual: { id: "visual", texto: "Instalar lo de los diagramas", explicacion: "Se instala mermaid-cli en .pi/extensions/visual-tools, para que visualize dibuje con el Chrome, Chromium o Edge que ya tenés." },
  ocr: { id: "ocr", texto: "Instalar Tesseract", explicacion: "Se instala Tesseract 5.5.2 con español e inglés y Ghostscript en tu carpeta de usuario, sin permisos de administrador, y queda anotado en curso.config.local.json." },
};
function accionDe(c: Chequeo, hayPi: boolean): Accion | undefined {
  const n = c.nombre;
  if (n === "Node.js" && c.estado === "falla") return ACCIONES.node;
  if (n === "pi") return ACCIONES.pi;
  if (/^Git( Bash)?$/.test(n)) return ACCIONES.git;
  if (n === "Carpeta del vault" && !hayPi) return ACCIONES.learn;
  if (/Subagentes fijados|Extensión web fijada|Web del researcher/.test(n)) return ACCIONES.paquetes;
  if (/Configuración web|web_fetch del researcher/.test(n)) return ACCIONES.config;
  if (/Python de ingesta|pymupdf|ocrmypdf|wordfreq|pyyaml|Entorno de ingesta/i.test(n)) return ACCIONES.venv;
  if (/Tesseract|Idiomas OCR/.test(n)) return ACCIONES.ocr;
  if (/Diagramas/.test(n) && /dependencias/.test(c.detalle)) return ACCIONES.visual;
  if (/^ImageMagick/.test(n) && c.estado === "info") return ACCIONES.magick;
  return undefined;
}
const MARCA = { ok: "✓", falla: "✗", aviso: "!", info: "·" };

function Linea({ c, hayPi, instalar, ocupado }: { c: Chequeo; hayPi: boolean; instalar: (a: Accion) => void; ocupado: boolean }) {
  const a = c.estado === "falla" || c.estado === "aviso" || (c.estado === "info" && /^ImageMagick/.test(c.nombre)) ? accionDe(c, hayPi) : undefined;
  const credenciales = c.estado === "falla" && /^Credenciales|^Modelo /.test(c.nombre) && !/--sin-red/.test(c.detalle);
  return (
    <li className={`chequeo estado-${c.estado}`}>
      <span className="marca-chequeo" aria-label={c.estado}>{MARCA[c.estado]}</span>
      <div><b>{c.nombre}</b>{c.detalle && <span>{c.detalle}</span>}</div>
      {a && <button className="fantasma" disabled={ocupado} onClick={() => instalar(a)}>{a.texto}</button>}
      {a?.id === "venv" && <button className="enlace" disabled={ocupado} onClick={() => instalar(ACCIONES.uv)}>Instalar uv antes</button>}
      {credenciales && <button className="fantasma" onClick={() => navegar({ pantalla: "ajustes", seccion: "cuentas" })}>Iniciar sesión</button>}
    </li>
  );
}

export function Preparar() {
  const vault = usarTienda(e => e.ajustes?.vault);
  const arranque = usarTienda(e => e.arranque);
  const plataforma = usarTienda(e => e.app?.plataforma);
  const [d, setD] = useState<{ basicos: Chequeo[]; doctor: Chequeo[]; opcionales: Chequeo[]; listoParaAbrir: boolean }>();
  const [revisando, setRevisando] = useState(false);
  const [ocupado, setOcupado] = useState<string>();
  const [salida, setSalida] = useState<string[]>([]);
  const [todo, setTodo] = useState(false);
  const consola = useRef<HTMLPreElement>(null);

  const revisar = async () => {
    setRevisando(true);
    try { setD(await window.learn.diagnostico()); } finally { setRevisando(false); }
  };
  useEffect(() => { void revisar(); }, [vault]);
  useEffect(() => window.learn.alSalidaSistema(m => setSalida(s => [...s.slice(-400), m.linea])), []);
  useEffect(() => { consola.current?.scrollTo({ top: consola.current.scrollHeight }); }, [salida]);

  const elegirVault = async () => {
    const r = await window.learn.elegirCarpeta("Elegí o creá la carpeta del vault");
    if (r) await guardarAjustes({ vault: r });
  };
  const instalar = async (a: Accion) => {
    if (!(await confirmarApp(a.texto, `${a.explicacion} Vas a ver lo que hace acá abajo.`, a.texto))) return;
    setOcupado(a.id); setSalida([`— ${a.texto} —`]);
    const codigo = await window.learn.instalar(a.id, vault);
    setSalida(s => [...s, codigo === 0 ? "Listo." : `Terminó con el código ${codigo}. Revisá los mensajes de arriba.`]);
    setOcupado(undefined);
    await revisar();
  };

  const hayPi = !!d?.basicos.find(c => c.nombre === "Carpeta del vault" && c.estado === "ok");
  const doctor = d?.doctor ?? [];
  const problemas = doctor.filter(c => c.estado === "falla" || c.estado === "aviso");
  const visibles = todo ? doctor : problemas;
  return (
    <main className="pantalla pagina-lectura preparar">
      <h1 className="titulo-pantalla">Preparar la computadora</h1>
      <p className="vacio" style={{ marginBottom: 30 }}>Acá se revisa que esté todo lo que learn necesita y se instala lo que falta, paso por paso. Es la misma revisión que el doctor de learn en la terminal.</p>

      <section className="paso">
        <h2 className="serif subtitulo">La carpeta del vault</h2>
        <p className="vacio">Es la carpeta donde viven tus cursos, notas y learn (.pi/). Si ya usás Obsidian, puede ser tu vault.</p>
        <p className="ruta-grande">{vault ?? "Todavía no elegiste una carpeta."}</p>
        {vault && /onedrive|dropbox|google drive|icloud/i.test(vault) && <p className="aviso-bloque">Esta carpeta se sincroniza con la nube. learn usa enlaces y bloqueos de archivos que la sincronización puede romper: conviene una carpeta local{plataforma === "win32" ? ", como C:\\Users\\vos\\pi-learning" : ""}.</p>}
        <div className="acciones"><button className={vault ? "fantasma" : "boton"} onClick={() => void elegirVault()}>{vault ? "Elegir otra carpeta…" : "Elegir o crear la carpeta…"}</button></div>
      </section>

      <section className="paso">
        <h2 className="serif subtitulo">Lo necesario para abrir</h2>
        {!d ? <p className="apagado"><span className="giro" /> Revisando…</p> : (
          <ul className="chequeos">{d.basicos.map(c => <Linea key={c.nombre} c={c} hayPi={hayPi} instalar={a => void instalar(a)} ocupado={!!ocupado} />)}</ul>
        )}
        {d?.listoParaAbrir && arranque !== "listo" && vault && (
          <div className="acciones" style={{ marginTop: 16 }}><button className="boton" onClick={async () => { await arrancar(vault); navegar({ pantalla: "inicio" }); }}>Abrir learn</button></div>
        )}
      </section>

      {d?.listoParaAbrir && (
        <section className="paso">
          <h2 className="serif subtitulo">Revisión completa</h2>
          {revisando && <p className="apagado"><span className="giro" /> Corriendo el doctor de learn…</p>}
          {!revisando && !doctor.length && <p className="apagado">El doctor no devolvió resultados.</p>}
          {doctor.length > 0 && (
            <>
              <p className="vacio">{problemas.length ? `${problemas.length === 1 ? "Una comprobación pide" : `${problemas.length} comprobaciones piden`} atención; ${doctor.length - problemas.length} dan bien.` : `Las ${doctor.length} comprobaciones dan bien.`} Las que dicen «sin verificar» necesitan red y credenciales.</p>
              <ul className="chequeos">{visibles.map((c, i) => <Linea key={`${c.nombre}-${i}`} c={c} hayPi={hayPi} instalar={a => void instalar(a)} ocupado={!!ocupado} />)}</ul>
              <div className="acciones" style={{ marginTop: 12 }}>
                <button className="enlace" onClick={() => setTodo(!todo)}>{todo ? "Ver sólo lo que pide atención" : "Ver todas las comprobaciones"}</button>
                <button className="enlace" disabled={revisando} onClick={() => void revisar()}>Revisar de nuevo</button>
              </div>
            </>
          )}
        </section>
      )}

      {d && d.opcionales.length > 0 && (
        <section className="paso">
          <h2 className="serif subtitulo">Opcional</h2>
          <ul className="chequeos">{d.opcionales.map(c => <Linea key={c.nombre} c={c} hayPi={hayPi} instalar={a => void instalar(a)} ocupado={!!ocupado} />)}</ul>
        </section>
      )}

      {salida.length > 0 && (
        <section className="paso">
          <h2 className="serif subtitulo">{ocupado ? <><span className="giro" /> Instalando…</> : "Lo último que se hizo"}</h2>
          <pre className="salida consola" ref={consola}>{salida.join("\n")}</pre>
        </section>
      )}
    </main>
  );
}
