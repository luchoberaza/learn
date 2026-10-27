#!/usr/bin/env node
// Host de la app: corre pi 1.4.0 con el .pi/ del vault, como pi-learn (-ns --skill .pi/skills), y habla con la app por
// el canal IPC de Node (process.send / message). La salida estándar queda para diagnósticos: lo que imprima una
// extensión no puede romper el protocolo. Uso: node inicio.mjs --vault <carpeta del vault>
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { crearFiltro } from "./filtro.mjs";
import { crearInterfaz } from "./interfaz.mjs";
import { crearCursos } from "./curso.mjs";
import { crearPaginas } from "./paginas.mjs";
import { crearSesiones } from "./sesiones.mjs";
import { clasesAbiertasPorOtros } from "./instancia.mjs";
import { crearSuperficie } from "./superficie.mjs";
import { crearConsumo } from "./consumo.mjs";

const argumento = nombre => { const i = process.argv.indexOf(nombre); return i > 0 ? process.argv[i + 1] : undefined; };
const vault = resolve(argumento("--vault") ?? process.cwd());
const piDir = join(vault, ".pi");
// Como pi-learn, que corre desde la carpeta del vault: hay extensiones (los agentes de los subagentes, por ejemplo)
// que buscan su configuración desde el directorio de trabajo del proceso.
try { process.chdir(vault); } catch { /* la carpeta no existe: lo informa el chequeo de abajo */ }
const enviar = mensaje => { try { process.send?.(mensaje); } catch { /* la app se cerró */ } };
const fatal = mensaje => { enviar({ tipo: "error-fatal", mensaje }); setTimeout(() => process.exit(1), 200); };
// La respuesta de la app al aviso de confianza llega por el mismo canal, antes de que existan las demás acciones.
let esperandoConfianza;
process.on("message", mensaje => { if (mensaje?.tipo === "confianza") esperandoConfianza?.(!!mensaje.aceptar); });
const importar = ruta => import(pathToFileURL(ruta).href);
// Ningún console.log de pi o de una extensión debe confundirse con el protocolo (que va por IPC); igual se manda a stderr.
for (const nivel of ["log", "info"]) console[nivel] = (...partes) => process.stderr.write(`${partes.join(" ")}\n`);

if (!existsSync(join(piDir, "scripts/lib/pi-sdk.mjs"))) fatal(`En ${vault} no está learn (.pi/). Elegí la carpeta del vault o preparala en «Preparar la computadora».`);
else if (!existsSync(join(piDir, "extensions/comun/preguntar.ts"))) fatal("Este .pi/ es anterior a la app: le falta el puente de interfaz (extensions/comun/preguntar.ts). Actualizá learn.");
else arrancar().catch(e => fatal(`No se pudo abrir pi: ${e?.message ?? e}`));

async function arrancar() {
  const piSdk = await importar(join(piDir, "scripts/lib/pi-sdk.mjs"));
  // Igual que pi-learn: los subagentes esperan 300 ms al shell y, sin los paquetes fijados, pi abre sin red de inicio.
  process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS ??= "300";
  const faltanPaquetes = !existsSync(join(piDir, "git/github.com/amosblomqvist/pi-interactive-subagents")) || !existsSync(join(piDir, "npm/node_modules/pi-web-access"));
  if (faltanPaquetes) process.env.PI_OFFLINE = "1";
  let sdk;
  try { sdk = await piSdk.importPi(); }
  catch { return fatal("No se encontró pi 1.4.0. Instalalo desde «Preparar la computadora»."); }
  const version = (() => { try { return JSON.parse(readFileSync(join(piSdk.carpetaPaquetePi(), "package.json"), "utf8")).version; } catch { return "?"; } })();
  const etiquetas = await importar(join(piDir, "extensions/curso/etiquetas.ts"));
  const material = await importar(join(piDir, "extensions/curso/material.ts"));
  const opcional = async ruta => { try { return await importar(join(piDir, ruta)); } catch { return undefined; } };
  const [simulacro, progreso] = [await opcional("extensions/curso/simulacro.ts"), await opcional("extensions/curso/progreso.ts")];
  const libConsumo = await opcional("scripts/lib/consumo.mjs");
  // Modos de estudio y mezcla de preguntas (DA52): un .pi anterior no los tiene y la app no los ofrece.
  const estudio = await opcional("extensions/comun/estudio.ts");

  // Confianza del proyecto, como el aviso de pi la primera vez; queda guardada con su mecanismo (trust.json).
  const confianza = new sdk.ProjectTrustStore(piSdk.agentDir);
  if (sdk.hasTrustRequiringProjectResources(vault) && confianza.get(vault) !== true) {
    const acepta = await new Promise(resolver => { esperandoConfianza = resolver; enviar({ tipo: "confianza", carpeta: vault }); });
    if (!acepta) return fatal("Sin confiar en la carpeta, pi no carga learn (.pi/). Podés aceptarla al volver a abrir la app.");
    confianza.set(vault, true);
  }

  // Subagentes en paneles de la app en lugar de tmux (app/subagentes): la superficie del paquete se agrega antes de
  // que pi cargue las extensiones; sin la app, el paquete sigue con tmux. PI_LEARN_SIN_PARCHE=1 lo deja como está.
  let parche;
  if (!process.env.PI_LEARN_SIN_PARCHE) {
    try { parche = (await import("../subagentes/aplicar.mjs")).aplicar(vault); }
    catch (e) { parche = `sin aplicar: ${e?.message ?? e}`; }
  }
  const subagentes = await crearSuperficie({ enviar, cwd: vault });
  if (subagentes.disponible) globalThis.__piLearnSuperficie = subagentes.superficie;

  const interfaz = crearInterfaz({ enviar });
  const filtro = crearFiltro({ etiquetas });
  const cursos = crearCursos({ vault, piDir, pythonDelVenv: piSdk.pythonDelVenv, material, simulacro, progreso });
  const paginas = crearPaginas({ vault, piDir, pythonDelVenv: piSdk.pythonDelVenv, material, cursos });
  const sesiones = crearSesiones({ sdk, vault });

  // Pruebas de punta a punta: un proveedor falso con guion (app/e2e), sin red ni modelo.
  const extras = [];
  const e2e = process.env.PI_LEARN_E2E ? await importar(resolve(process.env.PI_LEARN_E2E)) : undefined;
  if (e2e) extras.push(e2e.default);

  const crearRuntime = async ({ cwd, agentDir, sessionManager, sessionStartEvent }) => {
    const settingsManager = sdk.SettingsManager.create(cwd, agentDir, { projectTrusted: true });
    const services = await sdk.createAgentSessionServices({ cwd, agentDir, settingsManager,
      resourceLoaderOptions: { noSkills: true, additionalSkillPaths: [join(piDir, "skills")], extensionFactories: extras } });
    return { ...(await sdk.createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })), services, diagnostics: services.diagnostics };
  };
  const runtime = await sdk.createAgentSessionRuntime(crearRuntime, { cwd: vault, agentDir: piSdk.agentDir, sessionManager: sdk.SessionManager.create(vault) });

  // Texto del tutor: se manda a lo sumo cada 40 ms por mensaje (el modelo emite un evento por token).
  const textos = new Map();
  const mandarTexto = m => {
    const previo = textos.get(m.id);
    if (!m.enCurso) { if (previo) clearTimeout(previo.reloj); textos.delete(m.id); return enviar(m); }
    if (previo) { previo.mensaje = m; return; }
    const entrada = { mensaje: m, reloj: setTimeout(() => { textos.delete(m.id); enviar(entrada.mensaje); }, 40) };
    textos.set(m.id, entrada);
  };

  function estadoSesion() {
    const s = runtime.session, rama = s.sessionManager.getBranch();
    const c = rama.findLast(e => e.type === "custom" && e.customType === "curso");
    const sim = rama.findLast(e => e.type === "custom" && e.customType === "curso-simulacro");
    const enSimulacro = !!(sim?.data && c?.data && sim.data.log === c.data.log);
    return {
      archivo: s.sessionFile, nombre: s.sessionName,
      curso: c?.data ? { curso: c.data.curso, tema: c.data.tema, adHoc: !!c.data.adHoc, nombreTema: c.data.adHoc?.nombre, nota: c.data.nota ?? c.data.log, sinNota: !!c.data.sinLog } : undefined,
      // Sólo que hay un simulacro y desde cuándo: nunca cuál es el ítem reservado.
      simulacro: enSimulacro ? { tema: sim.data.tema, desde: sim.timestamp } : undefined,
      modelo: s.model ? { proveedor: s.model.provider, id: s.model.id, nombre: s.model.name ?? s.model.id } : undefined,
      pensamiento: s.thinkingLevel, trabajando: s.isStreaming,
    };
  }
  const mandarEstado = () => enviar({ tipo: "sesion", ...estadoSesion() });

  let desuscribir;
  async function vincular() {
    desuscribir?.();
    interfaz.cerrarTodo();
    const session = runtime.session;
    await session.bindExtensions({
      uiContext: interfaz.uiContext, mode: "rpc",
      commandContextActions: {
        waitForIdle: () => session.waitForIdle(),
        newSession: async options => runtime.newSession(options),
        fork: async (entryId, opciones) => ({ cancelled: (await runtime.fork(entryId, opciones)).cancelled }),
        navigateTree: async (targetId, o) => ({ cancelled: (await session.navigateTree(targetId, { summarize: o?.summarize, customInstructions: o?.customInstructions, replaceInstructions: o?.replaceInstructions, label: o?.label })).cancelled }),
        switchSession: async (ruta, opciones) => runtime.switchSession(ruta, opciones),
        reload: async () => { await session.reload(); },
      },
      shutdownHandler: () => enviar({ tipo: "pedido-salir" }),
      onError: e => enviar({ tipo: "aviso", nivel: "error", texto: `Una extensión falló (${basename(String(e.extensionPath ?? ""))}): ${e.error}` }),
    });
    desuscribir = session.subscribe(ev => {
      for (const m of filtro.evento(ev)) {
        if (m.tipo === "qa-inicio") interfaz.inicioQA(m.id, m.nombre);
        else if (m.tipo === "qa-fin") interfaz.finQA(m.id);
        else if (m.tipo === "tutor-texto") mandarTexto(m);
        else enviar(m);
      }
      if (["agent_settled", "entry_appended", "session_info_changed", "agent_start", "thinking_level_changed"].includes(ev.type)) mandarEstado();
    });
    // En las pruebas, cada sesión usa el modelo falso (las nuevas tomarían el predeterminado de los settings).
    if (e2e?.faux) { await session.setModel(e2e.faux.getModel()); session.setThinkingLevel("off"); }
    enviar({ tipo: "transcripcion", items: filtro.transcripcion(session.sessionManager.getBranch()) });
    mandarEstado();
  }
  runtime.setRebindSession(async () => { await vincular(); });
  await vincular();

  const s = () => runtime.session;
  const aviso = (texto, nivel = "info") => enviar({ tipo: "aviso", texto, nivel });
  // Un .pi/ anterior a DA48 no tiene el registro de consumo: la app sigue sin medidor.
  const consumo = libConsumo && crearConsumo({ lib: libConsumo, actual: () => s().model,
    modelos: async () => { const mr = s().modelRuntime; return mr.getAvailable().catch(() => mr.getAvailableSnapshot()); },
    claveApi: async proveedor => (await s().modelRuntime.getAuth(proveedor))?.auth?.apiKey,
    nombres: () => Object.fromEntries(s().modelRuntime.getProviders().map(p => [p.id, p.name])) });
  const enCasa = rel => material.rutaSegura(vault, String(rel).replaceAll("\\", "/"));

  // Comandos de pi (no de extensiones): los que no tienen sentido escritos se resuelven en una pantalla de la app.
  const PANTALLAS = new Set(["resume", "model", "thinking", "login", "logout", "settings", "hotkeys", "changelog", "scoped-models", "tree", "fork", "clone", "import", "copy", "trust", "quit"]);
  const SOLO_TERMINAL = { llama: "maneja modelos de un servidor llama.cpp", share: "sube la sesión a un visor web", bug: "prepara un reporte para los autores de pi" };
  async function comandoDePi(nombre, resto) {
    if (nombre === "compact") { await s().compact(resto || undefined); return true; }
    if (nombre === "new") { await runtime.newSession(); return true; }
    if (nombre === "reload") { await s().reload(); aviso("Se recargaron las extensiones, skills y configuración."); return true; }
    if (nombre === "name") { if (resto) s().setSessionName(resto); else aviso(`Nombre de la sesión: ${s().sessionName ?? "sin nombre"}`); return true; }
    if (nombre === "session") { enviar({ tipo: "pantalla", nombre: "sesion", datos: { ...estadoSesion(), estadisticas: s().getSessionStats(), contexto: s().getContextUsage() } }); return true; }
    if (nombre === "export") { const ruta = await s().exportToHtml(resto || undefined); aviso(`Sesión exportada en ${ruta}`); return true; }
    if (PANTALLAS.has(nombre)) { enviar({ tipo: "pantalla", nombre, datos: { argumentos: resto } }); return true; }
    if (SOLO_TERMINAL[nombre]) { aviso(`/${nombre} (${SOLO_TERMINAL[nombre]}) es un comando general de pi que queda en la terminal: abrí pi en el vault para usarlo.`); return true; }
    return false;
  }

  // esperar: la respuesta llega cuando prompt terminó (un comando corto como /md-log, antes de mandar el siguiente).
  async function enviarTexto({ texto = "", imagenes = [], modo, esperar = false }) {
    const limpio = String(texto);
    const m = /^\/([a-z][\w:-]*)(?:\s+([\s\S]*))?$/i.exec(limpio.trim());
    // Un comando de extensión (/estudiar, /fin…) lo resuelve prompt aunque el tutor esté escribiendo; uno de pi, el host.
    const registrados = new Set(s().extensionRunner.getRegisteredCommands().map(c => c.name));
    if (m && !registrados.has(m[1]) && !m[1].startsWith("skill:") && await comandoDePi(m[1], (m[2] ?? "").trim())) return { disposicion: "resuelto" };
    const opciones = { images: imagenes.map(i => ({ type: "image", data: i.data, mimeType: i.mimeType })), source: "interactive" };
    if (s().isStreaming && !(m && registrados.has(m[1]))) opciones.streamingBehavior = modo === "followUp" ? "followUp" : "steer";
    let disposicion = "enviado";
    const enCurso = s().prompt(limpio, { ...opciones, preflightResult: d => { disposicion = d; } }).catch(e => aviso(e?.message ?? String(e), "error"));
    if (esperar) await enCurso;
    else await new Promise(r => setTimeout(r, 0));
    return { disposicion };
  }

  // El árbol de la sesión (/tree): sólo lo que se lee (mensajes y resúmenes), con una sangría por cada bifurcación.
  function arbol() {
    const sm = s().sessionManager, rama = new Set(sm.getBranch().map(e => e.id)), hoja = sm.getLeafId(), salida = [];
    const legible = e => {
      if (e.type === "compaction") return { rol: "resumen", texto: "Resumen de la clase" };
      if (e.type === "branch_summary") return { rol: "resumen", texto: "Resumen de una rama" };
      if (e.type !== "message" || !e.message) return undefined;
      const m = e.message;
      if (m.role === "user") { const t = typeof m.content === "string" ? m.content : (m.content ?? []).filter(b => b?.type === "text").map(b => b.text).join(" "); return t.trim() ? { rol: "alumno", texto: t } : (Array.isArray(m.content) && m.content.some(b => b?.type === "image") ? { rol: "alumno", texto: "(foto)" } : undefined); }
      if (m.role === "assistant") { const t = (m.content ?? []).filter(b => b?.type === "text").map(b => b.text).join(" "); return t.trim() ? { rol: "tutor", texto: t } : undefined; }
      return undefined;
    };
    const recorrer = (nodo, nivel) => {
      const l = legible(nodo.entry);
      if (l) salida.push({ id: nodo.entry.id, nivel, rol: l.rol, texto: l.texto.replace(/\s+/g, " ").trim().slice(0, 160), enRama: rama.has(nodo.entry.id), hoja: nodo.entry.id === hoja, etiqueta: nodo.label });
      for (const hijo of nodo.children) recorrer(hijo, nodo.children.length > 1 ? nivel + 1 : nivel);
    };
    for (const raiz of sm.getTree()) recorrer(raiz, 0);
    return salida;
  }

  // Ajustes de pi que tienen sentido fuera de la terminal (los de dibujo de pi-tui no aplican a la app).
  function ajustesPi(cambios) {
    const sesion = s(), sm = sesion.settingsManager;
    if (cambios) {
      if (typeof cambios.compactacion === "boolean") sesion.setAutoCompactionEnabled(cambios.compactacion);
      if (["all", "one-at-a-time"].includes(cambios.correccion)) sesion.setSteeringMode(cambios.correccion);
      if (["all", "one-at-a-time"].includes(cambios.seguimiento)) sesion.setFollowUpMode(cambios.seguimiento);
      if (["sse", "websocket", "websocket-cached", "auto"].includes(cambios.transporte)) sm.setTransport(cambios.transporte);
      if (typeof cambios.reintentos === "boolean") sm.setRetryEnabled(cambios.reintentos);
    }
    return { compactacion: sesion.autoCompactionEnabled, correccion: sm.getSteeringMode(), seguimiento: sm.getFollowUpMode(), transporte: sm.getTransport(), reintentos: sm.getRetryEnabled() };
  }

  function listarComandos() {
    const propios = s().extensionRunner.getRegisteredCommands().map(c => ({ nombre: c.name, descripcion: c.description ?? "", origen: "learn" }));
    const skills = (s().resourceLoader.getSkills().skills ?? []).map(k => ({ nombre: `skill:${k.name}`, descripcion: k.description ?? "", origen: "skill" }));
    const pi = [["compact", "Resumir la clase para seguir con menos contexto"], ["new", "Empezar una sesión nueva"], ["resume", "Retomar otra sesión"], ["model", "Elegir el modelo"],
      ["thinking", "Nivel de razonamiento"], ["login", "Iniciar sesión con un proveedor"], ["logout", "Cerrar sesión de un proveedor"], ["name", "Nombrar la sesión"],
      ["session", "Información y estadísticas de la sesión"], ["export", "Exportar la sesión a HTML"], ["copy", "Copiar el último mensaje del tutor"], ["reload", "Recargar extensiones y skills"],
      ["tree", "Ver el árbol de la sesión"], ["fork", "Nueva sesión desde un mensaje anterior"], ["clone", "Duplicar la sesión"], ["import", "Importar una sesión JSONL"],
      ["settings", "Ajustes"], ["hotkeys", "Atajos de teclado"], ["changelog", "Novedades de pi"], ["trust", "Confianza en la carpeta"], ["scoped-models", "Modelos para alternar"],
      ["llama", "Modelos de llama.cpp (en la terminal)"], ["share", "Compartir la sesión (en la terminal)"], ["bug", "Reportar un error de pi (en la terminal)"], ["quit", "Salir"]]
      .map(([nombre, descripcion]) => ({ nombre, descripcion, origen: "pi" }));
    return [...propios, ...skills, ...pi];
  }
  async function completar(nombre, prefijo) {
    const c = s().extensionRunner.getRegisteredCommands().find(x => x.name === nombre);
    try { return (await c?.getArgumentCompletions?.(prefijo ?? "")) ?? []; } catch { return []; }
  }

  function notas(slug) {
    const dir = enCasa(`cursos/${slug}/sesiones`);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith(".md"))
      .map(d => ({ ruta: `cursos/${slug}/sesiones/${d.name}`, nombre: d.name.replace(/\.md$/, ""), modificada: statSync(join(dir, d.name)).mtime.toISOString() }))
      .sort((a, b) => b.modificada.localeCompare(a.modificada));
  }
  // Imagen de una nota o del panel: ruta del vault, relativa a la nota (adjuntos/…) o, como Obsidian, por nombre en viz/.
  function imagen({ ruta, desde }) {
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(String(ruta))) throw new Error("No es una imagen.");
    const candidatos = [ruta, desde ? `${dirname(String(desde).replaceAll("\\", "/"))}/${ruta}` : undefined, `viz/${basename(String(ruta))}`].filter(Boolean);
    for (const c of candidatos) {
      try { const f = enCasa(c); if (existsSync(f)) return { mimeType: mime(f), data: readFileSync(f).toString("base64") }; } catch { /* fuera del vault */ }
    }
    throw new Error("No se encontró la imagen en el vault.");
  }
  const mime = f => ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(f).toLowerCase()];

  async function modelos() {
    const mr = s().modelRuntime, actual = s().model;
    const disponibles = await mr.getAvailable().catch(() => mr.getAvailableSnapshot());
    return { actual: actual ? { proveedor: actual.provider, id: actual.id } : undefined, pensamiento: s().thinkingLevel, niveles: s().getAvailableThinkingLevels(),
      modelos: disponibles.map(m => ({ proveedor: m.provider, id: m.id, nombre: m.name ?? m.id, imagenes: (m.input ?? []).includes("image"), razona: !!m.reasoning })) };
  }
  function cuentas() {
    const mr = s().modelRuntime;
    return mr.getProviders().map(p => ({ id: p.id, nombre: p.name, conectado: mr.hasConfiguredAuth(p.id),
      metodos: [...(p.auth?.oauth ? [{ tipo: "oauth", nombre: p.auth.oauth.loginLabel ?? p.auth.oauth.name }] : []), ...(p.auth?.apiKey?.login ? [{ tipo: "api_key", nombre: p.auth.apiKey.name }] : [])] }))
      .filter(p => p.metodos.length || p.conectado);
  }
  // Inicio de sesión con el flujo del proveedor: los pasos (abrir el navegador, pegar un código) se dibujan en la app.
  const pasosLogin = new Map();
  let loginEnCurso;
  async function iniciarSesion({ proveedor, metodo }) {
    loginEnCurso?.abort();
    const control = new AbortController();
    loginEnCurso = control;
    const interaccion = {
      signal: control.signal,
      prompt: pedido => new Promise((resolver, rechazar) => {
        const id = `login-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        pasosLogin.set(id, { resolver, rechazar });
        pedido.signal?.addEventListener("abort", () => { pasosLogin.delete(id); enviar({ tipo: "login-cerrado", id }); rechazar(new Error("cancelado")); }, { once: true });
        enviar({ tipo: "login-pedido", id, pedido: { tipo: pedido.type, mensaje: pedido.message, placeholder: pedido.placeholder, opciones: pedido.options } });
      }),
      notify: e => enviar({ tipo: "login-evento", evento: e }),
    };
    try {
      await s().modelRuntime.login(proveedor, metodo, interaccion);
      enviar({ tipo: "login-fin", ok: true, proveedor });
    } catch (e) { enviar({ tipo: "login-fin", ok: false, proveedor, error: control.signal.aborted ? "Inicio de sesión cancelado." : String(e?.message ?? e) }); }
    finally { if (loginEnCurso === control) loginEnCurso = undefined; }
  }

  const acciones = {
    enviar: enviarTexto,
    cortar: async () => { await s().abort(); },
    responder: async ({ pedido, respuesta }) => ({ abierto: interfaz.responder(pedido, respuesta) }),
    sesiones: () => sesiones.listar(),
    seguir: () => sesiones.seguirDondeQuedaste(),
    "detalle-sesion": ({ ruta }) => sesiones.detalle(ruta),
    "abrir-sesion": async ({ ruta }) => { await runtime.switchSession(ruta); return estadoSesion(); },
    "nueva-sesion": async () => { await runtime.newSession(); return estadoSesion(); },
    estado: () => estadoSesion(),
    instancias: () => clasesAbiertasPorOtros(vault),
    cursos: () => cursos.todos(),
    curso: ({ slug }) => cursos.resumen(slug),
    pagina: args => paginas.pedir(args),
    lectura: args => paginas.lectura(args),
    "imagen-render": ({ ruta }) => {
      const rel = relative(vault, resolve(String(ruta))).split(sep).join("/");
      if (!/^cursos\/[a-z0-9-]+\/_procesado\/[a-z0-9-]+\/render\/\d{4}\.png$/.test(rel)) throw new Error("Ruta de página inválida.");
      return { mimeType: "image/png", data: readFileSync(enCasa(rel)).toString("base64") };
    },
    imagen,
    notas: ({ slug }) => notas(slug),
    nota: ({ ruta }) => {
      const rel = String(ruta).replaceAll("\\", "/");
      if (!/^(cursos\/[a-z0-9-]+\/(sesiones|notas\/verificaciones)|notas-libres)\/[^/]+\.md$/.test(rel)) throw new Error("Sólo se leen notas de clase, de temas libres y verificaciones.");
      return { ruta: rel, texto: readFileSync(enCasa(rel), "utf8") };
    },
    "notas-libres": () => {
      const dir = enCasa("notas-libres");
      if (!existsSync(dir)) return [];
      return readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith(".md"))
        .map(d => ({ ruta: `notas-libres/${d.name}`, nombre: d.name.replace(/\.md$/, ""), modificada: statSync(join(dir, d.name)).mtime.toISOString() }))
        .sort((a, b) => b.modificada.localeCompare(a.modificada));
    },
    verificaciones: ({ slug }) => {
      const dir = enCasa(`cursos/${slug}/notas/verificaciones`);
      if (!existsSync(dir)) return [];
      return readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith(".md"))
        .map(d => ({ ruta: `cursos/${slug}/notas/verificaciones/${d.name}`, nombre: d.name.replace(/\.md$/, ""), modificada: statSync(join(dir, d.name)).mtime.toISOString() }))
        .sort((a, b) => b.modificada.localeCompare(a.modificada));
    },
    // El informe de ingesta del curso (lo escribe la skill de armado para el alumno).
    informe: ({ slug }) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug))) throw new Error("Curso inválido.");
      const f = enCasa(`cursos/${slug}/informe-ingesta.md`);
      return existsSync(f) ? { ruta: `cursos/${slug}/informe-ingesta.md`, texto: readFileSync(f, "utf8") } : undefined;
    },
    arbol: () => arbol(),
    navegar: async ({ id, resumir, instrucciones }) => {
      if (id === s().sessionManager.getLeafId()) return { cancelado: true, motivo: "Ya estás en ese punto." };
      if (s().isStreaming) await s().abort();
      const r = await s().navigateTree(id, { summarize: !!resumir, customInstructions: instrucciones || undefined });
      if (!r.cancelled && !r.aborted) {
        enviar({ tipo: "transcripcion", items: filtro.transcripcion(s().sessionManager.getBranch()) });
        if (r.editorText) enviar({ tipo: "texto-editor", texto: r.editorText });
        mandarEstado();
      }
      return { cancelado: !!r.cancelled || !!r.aborted };
    },
    "mensajes-fork": () => s().getUserMessagesForForking().map(m => ({ id: m.entryId, texto: m.text })),
    bifurcar: async ({ id }) => { const r = await runtime.fork(id); if (r.selectedText) enviar({ tipo: "texto-editor", texto: r.selectedText }); return { cancelado: !!r.cancelled }; },
    clonar: async () => {
      const hoja = s().sessionManager.getLeafId();
      if (!hoja) throw new Error("Todavía no hay nada para duplicar.");
      return { cancelado: !!(await runtime.fork(hoja, { position: "at" })).cancelled };
    },
    importar: async ({ ruta }) => {
      try { return { cancelado: !!(await runtime.importFromJsonl(String(ruta))).cancelled }; }
      catch (e) { if (e?.name === "MissingSessionCwdError") return { cancelado: !!(await runtime.importFromJsonl(String(ruta), vault)).cancelled }; throw e; }
    },
    "confianza-carpeta": ({ confiar }) => {
      const store = new sdk.ProjectTrustStore(piSdk.agentDir);
      if (typeof confiar === "boolean") store.set(vault, confiar);
      return { confiada: store.get(vault) === true, carpeta: vault };
    },
    novedades: () => { try { return { texto: readFileSync(join(piSdk.carpetaPaquetePi(), "CHANGELOG.md"), "utf8").slice(0, 200000), version }; } catch { return { texto: "", version }; } },
    "ajustes-pi": ({ cambios }) => ajustesPi(cambios),
    "estadisticas-sesion": () => ({ ...estadoSesion(), estadisticas: s().getSessionStats(), contexto: s().getContextUsage() }),
    comandos: () => listarComandos(),
    estudio: () => estudio && {
      modos: estudio.MODOS.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
      mezclas: estudio.MEZCLAS.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
      preguntas: estudio.mezcla(piSdk.leerConfigLocal(piDir).preguntas).id,
    },
    completar: ({ comando, prefijo }) => completar(comando, prefijo),
    modelos,
    "elegir-modelo": async ({ proveedor, id }) => { const m = s().modelRuntime.getModel(proveedor, id); if (!m) throw new Error("Modelo no encontrado."); await s().setModel(m); return estadoSesion(); },
    pensamiento: ({ nivel }) => { s().setThinkingLevel(nivel); return estadoSesion(); },
    cuentas: () => cuentas(),
    consumo: ({ planes }) => consumo ? consumo.resumen(planes ?? {}) : { sinRegistro: true },
    "iniciar-sesion": args => { void iniciarSesion(args); return { iniciado: true }; },
    "login-respuesta": ({ id, valor, cancelar }) => { const p = pasosLogin.get(id); if (!p) return { abierto: false }; pasosLogin.delete(id); cancelar ? p.rechazar(new Error("cancelado")) : p.resolver(String(valor ?? "")); return { abierto: true }; },
    "cancelar-login": () => { loginEnCurso?.abort(); return {}; },
    "cerrar-sesion": async ({ proveedor }) => { await s().modelRuntime.logout(proveedor); return cuentas(); },
    compactar: async ({ instrucciones }) => { await s().compact(instrucciones || undefined); return {}; },
    nombrar: ({ nombre }) => { s().setSessionName(nombre); return estadoSesion(); },
    exportar: async ({ ruta }) => ({ ruta: await s().exportToHtml(ruta || undefined) }),
    recargar: async () => { await s().reload(); return {}; },
    "ultimo-texto": () => ({ texto: s().getLastAssistantText() ?? "" }),
    subagentes: () => subagentes.disponible ? subagentes.lista() : [],
    "subagente-escribir": ({ id, datos }) => { subagentes.teclear?.(id, datos); return {}; },
    "subagente-tamano": ({ id, cols, rows }) => { subagentes.tamano?.(id, cols, rows); return {}; },
    "subagente-cerrar": ({ id }) => { subagentes.cerrarPorElAlumno?.(id); return {}; },
    salir: async () => { subagentes.cerrarTodo?.(); await runtime.dispose().catch(() => {}); process.exit(0); },
  };

  process.on("message", async mensaje => {
    if (mensaje?.tipo === "confianza") return;
    const accion = acciones[mensaje?.tipo];
    if (!accion) { if (mensaje?.id) enviar({ tipo: "respuesta", id: mensaje.id, ok: false, error: `Acción desconocida: ${mensaje?.tipo}` }); return; }
    try { const datos = await accion(mensaje.datos ?? {}); if (mensaje.id) enviar({ tipo: "respuesta", id: mensaje.id, ok: true, datos }); }
    catch (e) { if (mensaje.id) enviar({ tipo: "respuesta", id: mensaje.id, ok: false, error: e?.message ?? String(e) }); }
  });
  process.on("disconnect", () => { subagentes.cerrarTodo?.(); runtime.dispose().catch(() => {}).finally(() => process.exit(0)); });

  enviar({ tipo: "listo", vault, piDir, version, offline: faltanPaquetes, aviso: version !== "1.4.0" ? `pi ${version} es distinta de la fijada 1.4.0.` : undefined,
    subagentes: subagentes.disponible ? { disponible: true, parche } : { disponible: false, motivo: subagentes.motivo, parche } });
}
