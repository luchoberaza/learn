// La caja de texto de la clase: texto, fotos (pegar, arrastrar o elegir) y «/» para cualquier comando de learn, de una
// skill o de pi. Con el tutor escribiendo, Enter lo corrige sobre la marcha (steer) y Alt+Enter lo deja para después
// (follow-up), como en pi.
import { useEffect, useMemo, useRef, useState } from "react";
import { esGrabacion } from "../../../lib/texto.ts";
import type { Imagen } from "../tipos";
import { avisar, cortar, enviar, leer, pedir, usarTienda } from "../tienda";
import { Clip, Cerrar, Detener, Enviar } from "./Iconos";

type Adjunto = { nombre: string; imagen?: Imagen; ruta?: string };
const leerArchivo = (f: File) => new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => mal(r.error); r.readAsDataURL(f); });
const MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const historial: string[] = [];

export function Compositor({ bloqueado }: { bloqueado?: string }) {
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [sugerencias, setSugerencias] = useState<{ valor: string; etiqueta: string; descripcion?: string }[]>([]);
  const [marcada, setMarcada] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const posHistorial = useRef(-1);
  const trabajando = usarTienda(e => e.trabajando);
  const cola = usarTienda(e => e.cola);
  const comandos = usarTienda(e => e.comandos);
  const textoEditor = usarTienda(e => e.textoEditor);
  const imagenesPermitidas = usarTienda(e => e.sesion.modelo);

  // El texto que pone una extensión o pi (setEditorText, /tree, /fork) llega a la caja.
  useEffect(() => { if (textoEditor) { setTexto(textoEditor.texto); area.current?.focus(); } }, [textoEditor]);
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${Math.min(a.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [texto]);
  useEffect(() => { area.current?.focus(); }, []);

  // Autocompletado de «/»: primero el comando; con espacio, los argumentos que ofrece la extensión.
  useEffect(() => {
    let vivo = true;
    const m = /^\/([\w:-]*)(\s+(.*))?$/s.exec(texto);
    if (!m || texto.includes("\n")) { setSugerencias([]); return; }
    if (m[2] === undefined) {
      const q = m[1].toLowerCase();
      setSugerencias(comandos.filter(c => c.nombre.toLowerCase().includes(q)).sort((a, b) => Number(!a.nombre.startsWith(q)) - Number(!b.nombre.startsWith(q))).slice(0, 8)
        .map(c => ({ valor: `/${c.nombre} `, etiqueta: `/${c.nombre}`, descripcion: c.descripcion })));
      setMarcada(0);
      return;
    }
    void pedir<{ value: string; label: string; description?: string }[] | null>("completar", { comando: m[1], prefijo: m[3] ?? "" }, true).then(r => {
      if (!vivo) return;
      setSugerencias((r ?? []).slice(0, 8).map(s => ({ valor: `/${m[1]} ${s.value}`, etiqueta: s.label, descripcion: s.description })));
      setMarcada(0);
    });
    return () => { vivo = false; };
  }, [texto, comandos]);

  async function agregarArchivos(archivos: File[]) {
    for (const f of archivos) {
      if (MIMES.has(f.type)) { const data = await leerArchivo(f); setAdjuntos(a => [...a, { nombre: f.name || "foto pegada", imagen: { mimeType: f.type, data } }]); continue; }
      if (/\.(heic|heif|bmp)$/i.test(f.name) || /image\/(heic|heif|bmp)/.test(f.type)) {
        // Como en la terminal: va la ruta y md-log la convierte si hay ImageMagick.
        let ruta = "";
        try { ruta = window.learn.rutaDeArchivo(f); } catch { /* pegado sin archivo */ }
        if (!ruta) ruta = await window.learn.temporal(f.name || "foto.heic", await leerArchivo(f));
        setAdjuntos(a => [...a, { nombre: f.name, ruta }]);
        avisar("Las fotos HEIC o BMP van como archivo: el modelo no las ve, pero la nota las guarda convertidas si tenés ImageMagick. Si podés, mandala como JPG o PNG.", "advertencia");
        continue;
      }
      if (/\.pdf$/i.test(f.name) || esGrabacion(f.name)) {
        const ruta = window.learn.rutaDeArchivo(f);
        const copiados = ruta ? await window.learn.aEntrada([ruta]).catch(() => []) : [];
        if (copiados.length) avisar(`Copiaste ${copiados.join(", ")} a _entrada/. Sumalo a un curso desde Crear curso o Agregar material.`);
        continue;
      }
      avisar(`No se puede adjuntar ${f.name}: sólo fotos (PNG, JPG, WEBP, GIF, HEIC), o PDFs y grabaciones de clase para un curso.`, "advertencia");
    }
  }
  async function elegirFotos() {
    const rutas = await window.learn.elegirArchivos("imagen");
    for (const ruta of rutas) {
      const r = await window.learn.leerImagen(ruta);
      setAdjuntos(a => [...a, r.data && r.mimeType ? { nombre: r.nombre, imagen: { mimeType: r.mimeType, data: r.data } } : { nombre: r.nombre, ruta }]);
    }
  }

  async function mandar(modo?: "steer" | "followUp") {
    const listos = adjuntos.filter(a => !a.imagen || a.imagen.data);
    const limpio = [texto.trim(), ...listos.filter(a => a.ruta).map(a => a.ruta!)].filter(Boolean).join("\n");
    const imagenes = listos.flatMap(a => a.imagen ? [a.imagen] : []);
    if (!limpio && !imagenes.length) return;
    if (imagenes.length && leer().sesion.modelo && !(await modeloVe())) avisar("El modelo elegido puede no aceptar imágenes; si no responde sobre la foto, elegí otro en Ajustes.", "advertencia");
    historial.push(texto); posHistorial.current = -1;
    setTexto(""); setAdjuntos([]); setSugerencias([]);
    await enviar(limpio, imagenes, modo);
  }

  const desactivado = !!bloqueado;
  const vacio = !texto.trim() && !adjuntos.length;
  const pista = useMemo(() => {
    if (bloqueado) return bloqueado;
    if (trabajando) return cola ? `${cola === 1 ? "Un mensaje espera" : `${cola} mensajes esperan`} a que el tutor termine.` : "Enter le manda tu mensaje ahora; Alt+Enter, cuando termine. Esc lo detiene.";
    return "Enter para enviar, Shift+Enter para otro renglón. Escribí / para ver los comandos.";
  }, [bloqueado, trabajando, cola]);

  return (
    <div className={`compositor ${arrastrando ? "arrastrando" : ""}`}
      onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastrando(true); } }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={e => { e.preventDefault(); setArrastrando(false); void agregarArchivos([...e.dataTransfer.files]); }}>
      {sugerencias.length > 0 && (
        <ul className="sugerencias" role="listbox">
          {sugerencias.map((s, i) => (
            <li key={s.valor} role="option" aria-selected={i === marcada} className={i === marcada ? "marcada" : ""} onMouseDown={e => { e.preventDefault(); setTexto(s.valor); area.current?.focus(); }}>
              <b>{s.etiqueta}</b>{s.descripcion && <span>{s.descripcion}</span>}
            </li>
          ))}
        </ul>
      )}
      {adjuntos.length > 0 && (
        <div className="adjuntos">
          {adjuntos.map((a, i) => (
            <span key={i} className="adjunto">
              {a.imagen?.data ? <img src={`data:${a.imagen.mimeType};base64,${a.imagen.data}`} alt="" /> : a.imagen ? <span className="giro" /> : null}
              <span>{a.nombre}</span>
              <button className="icono" onClick={() => setAdjuntos(xs => xs.filter((_, j) => j !== i))} aria-label={`Quitar ${a.nombre}`}><Cerrar /></button>
            </span>
          ))}
        </div>
      )}
      <div className="caja">
        <button className="icono" onClick={() => void elegirFotos()} aria-label="Adjuntar una foto" title="Adjuntar una foto de tu hoja" disabled={desactivado}><Clip /></button>
        <textarea ref={area} rows={1} value={texto} disabled={desactivado} aria-label="Mensaje para el tutor"
          placeholder={desactivado ? "Respondé la pregunta de arriba" : imagenesPermitidas ? "Respondé, preguntá o pegá una foto de tu hoja" : "Elegí un modelo en Ajustes para empezar"}
          onChange={e => setTexto(e.target.value)}
          onPaste={e => { const fotos = [...e.clipboardData.files]; if (fotos.length) { e.preventDefault(); void agregarArchivos(fotos); } }}
          onKeyDown={e => {
            if (sugerencias.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMarcada(m => (m + 1) % sugerencias.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMarcada(m => (m - 1 + sugerencias.length) % sugerencias.length); return; }
              if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && sugerencias[marcada] && sugerencias[marcada].valor.trim() !== texto.trim())) { e.preventDefault(); setTexto(sugerencias[marcada].valor); return; }
              if (e.key === "Escape") { e.preventDefault(); setSugerencias([]); return; }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void mandar(e.altKey ? "followUp" : "steer"); return; }
            if (e.key === "Escape" && trabajando) { e.preventDefault(); void cortar(); return; }
            if (e.key === "ArrowUp" && !texto && historial.length) { e.preventDefault(); posHistorial.current = posHistorial.current < 0 ? historial.length - 1 : Math.max(0, posHistorial.current - 1); setTexto(historial[posHistorial.current]); }
          }} />
        {trabajando && vacio && !desactivado
          ? <button className="enviar detener" onClick={() => void cortar()} aria-label="Detener al tutor" title="Detener (Esc)"><Detener /></button>
          : <button className="enviar" onClick={() => void mandar("steer")} disabled={vacio || desactivado} aria-label="Enviar" title="Enviar (Enter)"><Enviar /></button>}
      </div>
      <p className="pista">{pista}</p>
    </div>
  );
}

let veCache: { clave: string; ve: boolean } | undefined;
async function modeloVe() {
  const m = leer().sesion.modelo;
  if (!m) return true;
  const clave = `${m.proveedor}/${m.id}`;
  if (veCache?.clave === clave) return veCache.ve;
  const r = await pedir<{ modelos: { proveedor: string; id: string; imagenes: boolean }[] }>("modelos", {}, true);
  const ve = r?.modelos.find(x => x.proveedor === m.proveedor && x.id === m.id)?.imagenes ?? true;
  veCache = { clave, ve };
  return ve;
}
