// Consumo y cupo por cuenta y por modelo (DA48). Junta el registro local de learn (scripts/lib/consumo.mjs), lo que
// informan los proveedores (cabeceras y, en OpenRouter y DeepSeek, su endpoint de saldo) y el plan que se configuró en
// la app, y estima cuántas consultas quedan con cada modelo. Una consulta es un mensaje del alumno con todo lo que el
// tutor hace para contestarlo.

// Lo medido en una clase real con Claude Sonnet 5.5 (26-oct): se usa hasta tener consultas propias.
export const PERFIL_MEDIDO = { entrada: 3, salida: 712, cacheLeida: 33811, cacheEscrita: 3343, llamadas: 1.5, muestras: 0 };
// Cuentas que se pagan con una suscripción: el cupo es un porcentaje que informa el proveedor, no dólares.
export const SUSCRIPCIONES = new Set(["openai-codex", "github-copilot", "kimi-coding", "zai-coding-cn", "qwen-token-plan", "qwen-token-plan-cn",
  "qwen-token-plan-individual", "xiaomi-token-plan-ams", "xiaomi-token-plan-cn", "xiaomi-token-plan-sgp"]);
const ORIGENES = ["clase", "preparación", "verificador", "subagente"];
const DIA = 86400000;
// Un modelo local corre en esta computadora y no cobra (Ollama, LM Studio…); un proxy local con precios no lo es.
const esLocal = m => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(m?.baseUrl ?? "") && !(m.cost?.input || m.cost?.output);
// Las versiones fechadas repiten a su alias («claude-opus-4-5-20251101»): no suman en una lista para elegir.
export const fechado = id => /-\d{8}$/.test(id);

// La medianoche de hoy en una zona horaria (Google renueva los pedidos gratis a medianoche del Pacífico).
export function medianocheEn(zona, ahora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(ahora).map(x => [x.type, x.value]));
  return ahora.getTime() - ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 - ahora.getMilliseconds();
}

// El período que cuenta para el plan: del día de renovación de este mes (o del anterior) al siguiente.
export function ciclo(plan, ahora = new Date()) {
  if (plan?.tipo === "mensual") {
    const dia = Math.min(28, Math.max(1, Math.round(plan.dia || 1)));
    let desde = new Date(ahora.getFullYear(), ahora.getMonth(), dia);
    if (desde > ahora) desde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, dia);
    return { desde: desde.getTime(), hasta: new Date(desde.getFullYear(), desde.getMonth() + 1, dia).getTime() };
  }
  if (plan?.tipo === "saldo" && plan.desde && !Number.isNaN(Date.parse(plan.desde))) return { desde: Date.parse(plan.desde) };
  return { desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime(), hasta: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).getTime() };
}

// Tokens promedio de una consulta (una acción del alumno, con su marca aunque el tutor la conteste junto con otras):
// las últimas del mismo modelo si hay suficientes, si no las de cualquiera (el contexto de una clase pesa parecido con
// todos) y, sin historia, lo medido.
export function perfil(filas, clave) {
  const consultas = new Map();
  for (const f of filas) {
    if (f.origen !== "clase" || !f.consulta) continue;
    const c = consultas.get(f.consulta) ?? { clave: `${f.proveedor}/${f.modelo}`, entrada: 0, salida: 0, cacheLeida: 0, cacheEscrita: 0, llamadas: 0 };
    if (!f.marca) { c.entrada += f.entrada; c.salida += f.salida; c.cacheLeida += f.cacheLeida; c.cacheEscrita += f.cacheEscrita; c.llamadas++; }
    consultas.set(f.consulta, c);
  }
  const todas = [...consultas.values()];
  const propias = todas.filter(c => c.clave === clave);
  const muestra = (propias.length >= 5 ? propias : todas).slice(-40);
  if (muestra.length < 3) return { ...PERFIL_MEDIDO };
  const prom = k => muestra.reduce((s, c) => s + c[k], 0) / muestra.length;
  return { entrada: prom("entrada"), salida: prom("salida"), cacheLeida: prom("cacheLeida"), cacheEscrita: prom("cacheEscrita"), llamadas: prom("llamadas"), muestras: muestra.length };
}

// USD de una consulta con los precios del catálogo de pi (por millón de tokens). Sin precio de caché, cuenta como entrada.
export function costoConsulta(p, cost) {
  if (!cost) return undefined;
  const leer = cost.cacheRead > 0 ? cost.cacheRead : cost.input, escribir = cost.cacheWrite > 0 ? cost.cacheWrite : cost.input;
  return (p.entrada * (cost.input || 0) + p.salida * (cost.output || 0) + p.cacheLeida * (leer || 0) + p.cacheEscrita * (escribir || 0)) / 1e6;
}

const ultimoCupo = (cupos, proveedor) => Object.entries(cupos).filter(([k]) => k.startsWith(`${proveedor}/`)).map(([, v]) => v).sort((a, b) => String(b.t).localeCompare(String(a.t)))[0];

const tokensDe = f => (f.entrada || 0) + (f.salida || 0) + (f.cacheLeida || 0) + (f.cacheEscrita || 0);
// Pedidos al modelo (las marcas de consulta no lo son) y tokens de unas filas.
const usoDe = filas => { const llamadas = filas.filter(f => !f.marca); return { pedidos: llamadas.length, tokens: llamadas.reduce((s, f) => s + tokensDe(f), 0) }; };

// Lo que se sabe de una cuenta: cuánto se gastó en el período (en dólares y, para los modelos gratis, en pedidos y
// tokens), por origen y por modelo, de dónde sale el límite y cuánto queda. gratis: todos sus modelos cuestan 0.
export function resumenCuenta({ proveedor, nombre, filas, plan, cupos = {}, remoto, local = false, gratis = false, ahora = Date.now() }) {
  const periodo = ciclo(plan, new Date(ahora));
  const propias = filas.filter(f => f.proveedor === proveedor);
  const enPeriodo = propias.filter(f => Date.parse(f.t) >= periodo.desde);
  const gastado = enPeriodo.reduce((s, f) => s + (f.costo || 0), 0);
  const porOrigen = Object.fromEntries(ORIGENES.map(o => [o, enPeriodo.filter(f => (f.origen ?? "clase") === o).reduce((s, f) => s + (f.costo || 0), 0)]));
  const modelos = new Map();
  for (const f of enPeriodo) {
    const m = modelos.get(f.modelo) ?? { modelo: f.modelo, costo: 0, consultas: new Set(), pedidos: 0, tokens: 0 };
    m.costo += f.costo || 0;
    if (f.origen === "clase" && f.consulta) m.consultas.add(f.consulta);
    if (!f.marca) { m.pedidos++; m.tokens += tokensDe(f); }
    modelos.set(f.modelo, m);
  }
  const porModelo = [...modelos.values()].filter(m => m.pedidos > 0)
    .map(m => ({ modelo: m.modelo, costo: m.costo, consultas: m.consultas.size, pedidos: m.pedidos, tokens: m.tokens }))
    .sort((a, b) => b.costo - a.costo || b.tokens - a.tokens);
  const hoy = new Date(ahora); hoy.setHours(0, 0, 0, 0);
  const uso = { periodo: usoDe(enPeriodo), hoy: usoDe(propias.filter(f => Date.parse(f.t) >= hoy.getTime())) };
  const porDia = [];
  for (let i = 13; i >= 0; i--) {
    const dia = new Date(ahora - i * DIA).toLocaleDateString("sv-SE");
    porDia.push({ dia, costo: propias.filter(f => new Date(f.t).toLocaleDateString("sv-SE") === dia).reduce((s, f) => s + (f.costo || 0), 0) });
  }
  const base = { proveedor, nombre: nombre ?? proveedor, gastado, porOrigen, porModelo, porDia, uso, plan, renueva: periodo.hasta, ...(gratis ? { gratis } : {}) };
  const cupo = ultimoCupo(cupos, proveedor);
  const agotado = Object.entries(cupos).filter(([k, v]) => k.startsWith(`${proveedor}/`) && v.agotado && (v.agotado.hasta ?? v.agotado.desde + 3600000) > ahora).map(([, v]) => v.agotado)[0];
  const conAgotado = r => agotado ? { ...r, agotado } : r;

  if (local) return { ...base, tipo: "local" };
  if (SUSCRIPCIONES.has(proveedor)) {
    if (cupo?.tipo === "ventanas") return conAgotado({ ...base, tipo: "ventanas", equivalente: true, ventanas: cupo.ventanas, planProveedor: cupo.plan, fuente: "el proveedor", visto: cupo.t });
    // ChatGPT informa su cupo en cada respuesta; los planes de tokens (Kimi, GLM, Qwen, Xiaomi) no: se muestra lo usado.
    return conAgotado({ ...base, tipo: proveedor === "openai-codex" ? "sin-dato" : "suscripcion", equivalente: true });
  }
  if (remoto?.queda !== undefined) return conAgotado({ ...base, tipo: "dinero", queda: remoto.queda, limite: remoto.limite, moneda: remoto.moneda ?? "USD", fuente: "el proveedor", pedidos: remoto.pedidos });
  if (remoto?.pedidos) return conAgotado({ ...base, tipo: "pedidos", pedidos: remoto.pedidos, fuente: "el proveedor" });
  if (cupo?.tipo === "pedidos" && (!cupo.renueva || cupo.renueva > ahora)) return conAgotado({ ...base, tipo: "pedidos", pedidos: { quedan: cupo.quedan, limite: cupo.limite, renueva: cupo.renueva }, fuente: "el proveedor" });
  if (plan?.tipo === "mensual" || plan?.tipo === "saldo") {
    const limite = Math.max(0, Number(plan.monto) || 0);
    return conAgotado({ ...base, tipo: "dinero", limite, queda: Math.max(0, limite - gastado), moneda: "USD", fuente: "tu plan" });
  }
  if (plan?.tipo === "gratis") {
    const desde = proveedor === "google" ? medianocheEn("America/Los_Angeles", new Date(ahora)) : ahora - (ahora % DIA);
    const usados = propias.filter(f => !f.marca && Date.parse(f.t) >= desde).length;
    const limite = Number(plan.pedidosDia) || undefined;
    return conAgotado({ ...base, tipo: "pedidos", pedidos: { usados, limite, quedan: limite ? Math.max(0, limite - usados) : undefined, renueva: desde + DIA }, fuente: "tu plan" });
  }
  // Modelos gratis sin un límite conocido (NVIDIA, los gratis de OpenCode o de GLM…): no hay dólares que contar, sí pedidos y tokens.
  return conAgotado({ ...base, tipo: gratis ? "gratis" : "sin-tope" });
}

// Cuánto rinde un modelo con lo que queda en su cuenta.
export function estimar({ modelo, perfilConsulta, cuenta, cupos = {} }) {
  const usd = esLocal(modelo) ? 0 : costoConsulta(perfilConsulta, modelo.cost);
  const r = { usdConsulta: usd, porDolar: usd ? 1 / usd : undefined, gratis: usd === 0 };
  if (!cuenta || cuenta.agotado) return { ...r, quedan: cuenta?.agotado ? 0 : undefined };
  if (cuenta.tipo === "dinero" && cuenta.queda !== undefined && usd && (cuenta.moneda ?? "USD") === "USD") return { ...r, quedan: Math.floor(cuenta.queda / usd) };
  if (cuenta.tipo === "ventanas") {
    const deltas = cupos[`${modelo.provider}/${modelo.id}`]?.porConsulta ?? [];
    const prom = deltas.length >= 3 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : undefined;
    const corta = cuenta.ventanas?.[0];
    return { ...r, quedan: prom && corta ? Math.floor((100 - corta.usado) / prom) : undefined, renueva: corta?.renueva };
  }
  if (cuenta.tipo === "pedidos" && cuenta.pedidos?.quedan !== undefined) return { ...r, quedan: Math.floor(cuenta.pedidos.quedan / Math.max(0.1, perfilConsulta.llamadas)) };
  return r;
}

// Cuando la cuenta del modelo actual se está por acabar: otro modelo que alcance para bastante más.
export function sugerir(actual, filas) {
  if (!actual || actual.quedan === undefined || actual.quedan >= 30) return undefined;
  const candidatos = filas.filter(f => f.clave !== actual.clave && f.imagenes && f.razona && !f.agotado && (f.gratis || (f.quedan ?? 0) >= Math.max(30, actual.quedan * 3)));
  const mismo = candidatos.filter(f => f.proveedor === actual.proveedor).sort((a, b) => (b.quedan ?? 0) - (a.quedan ?? 0));
  const otros = candidatos.filter(f => f.proveedor !== actual.proveedor).sort((a, b) => (b.gratis ? 1e12 : b.quedan ?? 0) - (a.gratis ? 1e12 : a.quedan ?? 0));
  return mismo[0] ?? otros[0];
}

// Saldo que informa el propio proveedor. Nunca corta: sin red o con un cambio de formato, vale lo local.
export async function saldoRemoto(proveedor, clave, buscar = fetch) {
  const pedir = async url => { const r = await buscar(url, { headers: { Authorization: `Bearer ${clave}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
  try {
    if (proveedor === "openrouter") {
      const k = (await pedir("https://openrouter.ai/api/v1/key")).data ?? {};
      const gratis = k.free_model_daily_requests;
      const pedidos = gratis && Number.isFinite(gratis.remaining) ? { quedan: gratis.remaining, limite: gratis.limit, usados: gratis.used, gratis: true } : undefined;
      let queda = Number.isFinite(k.limit_remaining) ? k.limit_remaining : undefined, limite = Number.isFinite(k.limit) ? k.limit : undefined;
      if (queda === undefined) {
        try { const c = (await pedir("https://openrouter.ai/api/v1/credits")).data ?? {}; if (Number.isFinite(c.total_credits) && Number.isFinite(c.total_usage)) { queda = Math.max(0, c.total_credits - c.total_usage); limite = c.total_credits; } }
        catch { /* sin saldo de cuenta: quedan los pedidos gratis */ }
      }
      return { queda, limite, pedidos };
    }
    if (proveedor === "deepseek") {
      const b = await pedir("https://api.deepseek.com/user/balance");
      const info = (b.balance_infos ?? []).find(i => i.currency === "USD") ?? b.balance_infos?.[0];
      return info ? { queda: Number(info.total_balance), moneda: info.currency } : undefined;
    }
  } catch { return undefined; }
  return undefined;
}

// lib: { leerConsumo, leerCupos } de learn. modelos(): los disponibles (con credenciales) del registro de pi.
export function crearConsumo({ lib, modelos, actual, claveApi, nombres = () => ({}), ahora = () => Date.now(), buscar = fetch }) {
  const cache = new Map();
  async function remoto(proveedor) {
    if (!["openrouter", "deepseek"].includes(proveedor)) return undefined;
    const previo = cache.get(proveedor);
    if (previo && ahora() - previo.t < 60000) return previo.valor;
    const k = await claveApi(proveedor).catch(() => undefined);
    const valor = k ? await saldoRemoto(proveedor, k, buscar) : undefined;
    cache.set(proveedor, { t: ahora(), valor });
    return valor;
  }
  async function resumen(planes = {}) {
    const t = ahora();
    const filas = lib.leerConsumo({ desde: new Date(t - 62 * DIA).toISOString() });
    const cupos = lib.leerCupos();
    const disponibles = (await modelos()).filter(m => !fechado(m.id));
    const conectados = new Set(disponibles.map(m => m.provider));
    const proveedores = [...new Set([...conectados, ...filas.map(f => f.proveedor)])];
    const nombre = nombres();
    const sinCosto = p => { const propios = disponibles.filter(m => m.provider === p); return propios.length > 0 && propios.every(m => !m.cost?.input && !m.cost?.output); };
    const cuentas = await Promise.all(proveedores.map(async p => resumenCuenta({ proveedor: p, nombre: nombre[p], filas, plan: planes[p], cupos, remoto: conectados.has(p) ? await remoto(p) : undefined,
      local: disponibles.some(m => m.provider === p && esLocal(m)), gratis: sinCosto(p), ahora: t })));
    const porProveedor = Object.fromEntries(cuentas.map(c => [c.proveedor, c]));
    const m0 = actual();
    const tabla = disponibles.map(m => {
      const clave = `${m.provider}/${m.id}`;
      const e = estimar({ modelo: m, perfilConsulta: perfil(filas, clave), cuenta: porProveedor[m.provider], cupos });
      return { clave, proveedor: m.provider, id: m.id, nombre: m.name ?? m.id, imagenes: (m.input ?? []).includes("image"), razona: !!m.reasoning,
        agotado: !!porProveedor[m.provider]?.agotado, ...e };
    });
    const claveActual = m0 ? `${m0.provider}/${m0.id}` : undefined;
    const filaActual = tabla.find(f => f.clave === claveActual);
    return { actual: filaActual, perfil: perfil(filas, claveActual), cuentas: cuentas.filter(c => conectados.has(c.proveedor) || c.uso.periodo.pedidos > 0),
      modelos: tabla, sugerido: sugerir(filaActual, tabla), hayRegistro: filas.length > 0 };
  }
  return { resumen };
}
