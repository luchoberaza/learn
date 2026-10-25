// La uiContext que el host le da a pi: lo que en la terminal dibuja pi-tui, acá viaja a la app como pedidos y avisos.
// preguntar (extensions/comun/preguntar.ts) dibuja quiz y ask_user_question en la app. La corrección del quiz la hace
// el host: la app recibe la correcta y la explicación recién cuando el alumno respondió.
import { randomUUID } from "node:crypto";

const conjunto = xs => [...new Set(xs)].sort((a, b) => a - b).join(",");

export function crearInterfaz({ enviar }) {
  const pendientes = new Map();
  // Ids de las tools de preguntas que arrancaron y todavía no tienen tarjeta: la tarjeta toma el id de su tool.
  const qaEnEspera = { quiz: [], ask_user_question: [] };

  function pedir(tipo, datos, { signal, timeout, porDefecto, id = randomUUID(), alResponder } = {}) {
    if (signal?.aborted) return Promise.resolve(porDefecto);
    return new Promise(resolver => {
      let reloj;
      const terminar = valor => {
        if (!pendientes.has(id)) return;
        pendientes.delete(id);
        clearTimeout(reloj);
        signal?.removeEventListener("abort", alCortar);
        resolver(valor);
      };
      const alCortar = () => {
        const p = pendientes.get(id);
        const valor = p?.alCortar ? p.alCortar() : porDefecto;
        enviar({ tipo: "pedido-cerrado", id, motivo: "corte" });
        terminar(valor);
      };
      signal?.addEventListener("abort", alCortar, { once: true });
      if (timeout) reloj = setTimeout(() => { enviar({ tipo: "pedido-cerrado", id, motivo: "tiempo" }); terminar(porDefecto); }, timeout);
      pendientes.set(id, { tipo, terminar, alResponder });
      enviar({ tipo: "pedido", id, clase: tipo, ...datos });
    });
  }

  // La app contesta un pedido. Devuelve false si ya no estaba abierto.
  function responder(id, respuesta) {
    const p = pendientes.get(id);
    if (!p) return false;
    if (p.alResponder) p.alResponder(respuesta);
    else p.terminar(respuesta);
    return true;
  }

  async function preguntar(pedido, signal) {
    const clave = pedido.tipo === "quiz" ? "quiz" : "ask_user_question";
    const id = qaEnEspera[clave].shift() ?? randomUUID();
    if (pedido.tipo !== "quiz") {
      const r = await pedir("ask", { pregunta: pedido.pregunta, contexto: pedido.contexto, modo: pedido.modo, opciones: pedido.opciones, etiquetaOtra: pedido.etiquetaOtra },
        { signal, id, porDefecto: null });
      return Array.isArray(r?.respuestas) ? r.respuestas : null;
    }
    // Quiz: primero la respuesta, después la corrección en pantalla; la tool termina cuando el alumno sigue.
    let respuesta;
    return pedir("quiz", { pregunta: pedido.pregunta, contexto: pedido.contexto, modo: pedido.modo, opciones: pedido.opciones.map(o => ({ indice: o.indice, label: o.label, ...(o.description ? { description: o.description } : {}) })) }, {
      signal, id, porDefecto: null,
      alResponder: r => {
        const p = pendientes.get(id);
        if (!respuesta) {
          if (!r || typeof r !== "object" || (!r.noSe && !(Array.isArray(r.elegidas) && r.elegidas.length))) return p.terminar(null); // cancelar
          respuesta = { noSe: !!r.noSe, elegidas: r.noSe ? [] : r.elegidas.filter(Number.isInteger), ...(typeof r.nota === "string" && r.nota.trim() ? { nota: r.nota } : {}) };
          if (pedido.modo === "single-select") respuesta.elegidas = respuesta.elegidas.slice(0, 1);
          const correcto = !respuesta.noSe && conjunto(respuesta.elegidas) === conjunto(pedido.correctas);
          // Una respuesta ya corregida se conserva aunque después corten el turno (el alumno ya vio la correcta).
          p.alCortar = () => respuesta;
          enviar({ tipo: "correccion", id, correctas: pedido.correctas, correcto, noSe: respuesta.noSe, elegidas: respuesta.elegidas,
            ...(pedido.explicacion ? { explicacion: pedido.explicacion } : {}), ...(respuesta.nota ? { nota: respuesta.nota.trim() } : {}) });
          return;
        }
        p.terminar(respuesta);
      },
    });
  }

  const nada = () => {};
  const uiContext = {
    select: (titulo, opciones, opts) => pedir("select", { titulo, opciones }, { signal: opts?.signal, timeout: opts?.timeout, porDefecto: undefined }).then(r => typeof r === "string" && opciones.includes(r) ? r : undefined),
    confirm: (titulo, mensaje, opts) => pedir("confirm", { titulo, mensaje }, { signal: opts?.signal, timeout: opts?.timeout, porDefecto: false }).then(r => r === true),
    input: (titulo, placeholder, opts) => pedir("input", { titulo, placeholder }, { signal: opts?.signal, timeout: opts?.timeout, porDefecto: undefined }).then(r => typeof r === "string" ? r : undefined),
    editor: (titulo, prefill) => pedir("editor", { titulo, prefill }, { porDefecto: undefined }).then(r => typeof r === "string" ? r : undefined),
    notify: (mensaje, tipo) => enviar({ tipo: "aviso", texto: String(mensaje ?? ""), nivel: tipo === "error" ? "error" : tipo === "warning" ? "advertencia" : "info" }),
    setStatus: (clave, texto) => enviar({ tipo: "estado", clave, texto: texto ?? undefined }),
    setWidget: (clave, contenido, opts) => { if (contenido === undefined || Array.isArray(contenido)) enviar({ tipo: "widget", clave, lineas: contenido, lugar: opts?.placement ?? "aboveEditor" }); },
    setTitle: titulo => enviar({ tipo: "titulo", texto: titulo }),
    setWorkingMessage: mensaje => enviar({ tipo: "etiqueta-trabajando", texto: mensaje }),
    setHiddenThinkingLabel: etiqueta => enviar({ tipo: "etiqueta-pensando", texto: etiqueta }),
    setWorkingVisible: nada, setWorkingIndicator: nada, setFooter: nada, setHeader: nada, addAutocompleteProvider: nada,
    setEditorComponent: nada, getEditorComponent: () => undefined,
    onTerminalInput: () => nada,
    custom: async () => undefined,
    pasteToEditor: texto => enviar({ tipo: "texto-editor", texto }),
    setEditorText: texto => enviar({ tipo: "texto-editor", texto }),
    getEditorText: () => "",
    get theme() { return undefined; },
    getAllThemes: () => [], getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "La app maneja su propio tema." }),
    getToolsExpanded: () => false, setToolsExpanded: nada,
    preguntar,
  };

  return {
    uiContext,
    responder,
    // El filtro avisa cuándo arrancó una tool de preguntas, para que su tarjeta use el mismo id que la tool.
    inicioQA(id, nombre) { qaEnEspera[nombre]?.push(id); },
    finQA(id) { for (const lista of Object.values(qaEnEspera)) { const i = lista.indexOf(id); if (i >= 0) lista.splice(i, 1); } },
    cerrarTodo() { for (const [id, p] of pendientes) { enviar({ tipo: "pedido-cerrado", id, motivo: "sesion" }); p.terminar(undefined); } },
  };
}
