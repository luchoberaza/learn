// Medidor de consumo (DA48): en la barra lateral, lo que queda en la cuenta del modelo de la clase y cuántas consultas
// alcanza, con un menú para cambiar de modelo; en Ajustes, el plan de cada cuenta, lo gastado y cuánto rinde cada modelo.
import { useEffect, useRef, useState } from "react";
import { aproximado, dinero, pedidosTexto, textoCuenta, textoRinde, tokensCorto, tokensTexto } from "../../../lib/consumo.ts";
import { elegirModelo, guardarAjustes, navegar, refrescarConsumo, usarTienda } from "../tienda";
import type { Consumo, CuentaConsumo, ModeloConsumo, Plan } from "../tipos";

// Los más capaces arriba y los más baratos abajo; sin precio, al final.
const porPrecio = (a: ModeloConsumo, b: ModeloConsumo) => (b.usdConsulta ?? -1) - (a.usdConsulta ?? -1);

function MenuModelos({ c, cerrar }: { c: Consumo; cerrar: () => void }) {
  const [filtro, setFiltro] = useState("");
  const nombres = Object.fromEntries(c.cuentas.map(x => [x.proveedor, x.nombre]));
  const proveedores = [...new Set([c.actual?.proveedor, ...c.modelos.map(m => m.proveedor)].filter(Boolean) as string[])];
  const f = filtro.trim().toLowerCase();
  const visibles = c.modelos.filter(m => !f || `${m.nombre} ${m.id} ${nombres[m.proveedor] ?? m.proveedor}`.toLowerCase().includes(f));
  return (
    <div className="menu-flotante menu-modelos" role="menu" aria-label="Elegir el modelo de la clase">
      {c.modelos.length > 12 && <input className="campo" autoFocus placeholder="Buscar un modelo" value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Buscar un modelo" />}
      <div className="menu-modelos-lista">
        {proveedores.map(p => {
          const lista = visibles.filter(m => m.proveedor === p).sort(porPrecio);
          if (!lista.length) return null;
          return (
            <div key={p} role="group" aria-label={nombres[p] ?? p}>
              <p className="menu-grupo">{nombres[p] ?? p}</p>
              {lista.map(m => (
                <button key={m.clave} role="menuitem" aria-current={m.clave === c.actual?.clave} className={m.clave === c.actual?.clave ? "actual" : ""}
                  onClick={() => { cerrar(); if (m.clave !== c.actual?.clave) void elegirModelo(m.proveedor, m.id, m.nombre); }}>
                  <span>{m.nombre}{m.imagenes ? "" : <small> sin imágenes</small>}</span><small>{textoRinde(m)}</small>
                </button>
              ))}
            </div>
          );
        })}
        {!visibles.length && <p className="ayuda" style={{ margin: "6px 10px" }}>Ningún modelo coincide.</p>}
      </div>
      <button role="menuitem" className="menu-pie" onClick={() => { cerrar(); navegar({ pantalla: "ajustes", seccion: "consumo" }); }}>Ver el consumo y los planes</button>
    </div>
  );
}

export function MedidorLateral() {
  const c = usarTienda(e => e.consumo);
  const listo = usarTienda(e => e.arranque === "listo");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!caja.current?.contains(ev.target as Node)) setAbierto(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); setAbierto(false); } };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", esc); };
  }, [abierto]);
  if (!listo || !c?.actual) return null;
  const actual = c.actual;
  const cuenta = c.cuentas.find(x => x.proveedor === actual.proveedor);
  const t = cuenta ? textoCuenta(cuenta) : undefined;
  const detalle = [textoRinde(actual), t?.secundario].filter(Boolean).join(" · ");
  return (
    <div className="consumo-lateral" ref={caja}>
      <button className={`consumo-boton nivel-${t?.nivel ?? "ok"}`} onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-haspopup="menu"
        aria-label={`${actual.nombre}. ${t?.principal ? `${t.principal}. ` : ""}${detalle}. Abrir la lista de modelos`}>
        <span className="consumo-modelo">{actual.nombre}</span>
        {t && <span className="consumo-texto">{t.principal}</span>}
        {t?.libre !== undefined && <span className="medidor consumo-barra" aria-hidden><i style={{ width: `${Math.max(2, t.libre * 100)}%` }} /></span>}
        <span className="consumo-detalle">{detalle}</span>
      </button>
      {abierto && <MenuModelos c={c} cerrar={() => setAbierto(false)} />}
    </div>
  );
}

const hoyDia = () => Math.min(28, new Date().getDate());
const PRESETS: Record<string, { nombre: string; monto: number }> = { max20: { nombre: "Créditos del plan Max 20x (200 USD por mes)", monto: 200 }, max5: { nombre: "Créditos del plan Max 5x (100 USD por mes)", monto: 100 } };

function EditorPlan({ proveedor, plan, planes }: { proveedor: string; plan?: Plan; planes: Record<string, Plan> }) {
  const guardar = (nuevo?: Plan) => { const p = { ...planes }; if (nuevo) p[proveedor] = nuevo; else delete p[proveedor]; void guardarAjustes({ planes: p }); };
  const valor = plan?.preset ?? plan?.tipo ?? "";
  const elegir = (v: string) => {
    if (PRESETS[v]) return guardar({ tipo: "mensual", monto: PRESETS[v].monto, dia: plan?.dia ?? hoyDia(), preset: v });
    if (v === "mensual") return guardar({ tipo: "mensual", monto: plan?.preset ? 20 : plan?.monto ?? 20, dia: plan?.dia ?? 1 });
    if (v === "saldo") return guardar({ tipo: "saldo", monto: plan?.monto ?? 10, desde: new Date().toLocaleDateString("sv-SE") });
    if (v === "gratis") return guardar({ tipo: "gratis", pedidosDia: plan?.pedidosDia });
    if (v === "sin-tope") return guardar({ tipo: "sin-tope" });
    guardar(undefined);
  };
  const numero = (clave: "monto" | "dia" | "pedidosDia", etiqueta: string, min: number, max: number) => (
    <label className="numero"><span>{etiqueta}</span>
      <input className="campo" type="number" min={min} max={max} defaultValue={plan?.[clave] ?? ""} key={`${valor}-${clave}`}
        onBlur={e => { const n = Number(e.target.value); if (e.target.value !== "" && n >= min && n <= max) guardar({ ...plan!, [clave]: clave === "monto" ? Math.round(n * 100) / 100 : Math.round(n) }); }} />
    </label>
  );
  return (
    <div className="editor-plan">
      <label className="etiqueta" htmlFor={`plan-${proveedor}`}>Cómo pagás esta cuenta</label>
      <select id={`plan-${proveedor}`} className="campo" value={valor} onChange={e => elegir(e.target.value)}>
        <option value="">Sin configurar</option>
        {proveedor === "anthropic" && Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
        <option value="mensual">Un presupuesto por mes</option>
        <option value="saldo">Un saldo que cargué</option>
        <option value="gratis">Un plan gratis, con pedidos por día</option>
        <option value="sin-tope">Sin tope</option>
      </select>
      {plan?.tipo === "mensual" && (
        <div className="numeros" style={{ marginTop: 12 }}>
          {!plan.preset && numero("monto", "USD por mes", 0.01, 100000)}
          {numero("dia", "Día del mes en que se renueva", 1, 28)}
        </div>
      )}
      {plan?.tipo === "saldo" && (
        <div className="numeros" style={{ marginTop: 12 }}>
          {numero("monto", "USD que cargaste", 0.01, 100000)}
          <label className="numero"><span>Desde el día</span>
            <input className="campo" type="date" defaultValue={plan.desde} onBlur={e => e.target.value && guardar({ ...plan, desde: e.target.value })} /></label>
        </div>
      )}
      {plan?.tipo === "gratis" && <div className="numeros" style={{ marginTop: 12 }}>{numero("pedidosDia", "Pedidos por día del plan", 1, 1000000)}</div>}
      {plan?.preset && <p className="ayuda">Los créditos se renuevan con tu plan de Claude y no se acumulan. Los ves en claude.ai → Configuración → Facturación.</p>}
      {plan?.tipo === "gratis" && proveedor === "google" && <p className="ayuda">Google renueva los pedidos gratis a la medianoche del Pacífico. El límite de cada modelo está en AI Studio.</p>}
    </div>
  );
}

function DiasConsumo({ dias }: { dias: CuentaConsumo["porDia"] }) {
  const max = Math.max(...dias.map(d => d.costo));
  if (!(max > 0)) return null;
  return (
    <div className="dias-consumo" role="img" aria-label={`Gasto de los últimos 14 días: hasta ${dinero(max)} USD por día`}>
      {dias.map(d => <span key={d.dia} className={d.costo > 0 ? undefined : "cero"} title={`${d.dia}: ${dinero(d.costo)} USD`} style={{ height: `${Math.max(d.costo > 0 ? 6 : 3, (d.costo / max) * 100)}%` }} />)}
    </div>
  );
}

const ORIGEN: Record<string, string> = { clase: "clases", "preparación": "preparación de temas", verificador: "verificador", subagente: "subagentes" };

// Lo usado con cada modelo de la cuenta en el período: consultas, pedidos, tokens y costo (o «sin costo»).
function PorModelo({ cuenta, nombres }: { cuenta: CuentaConsumo; nombres: Record<string, string> }) {
  if (!cuenta.porModelo.length) return null;
  return (
    <div className="tabla-envoltura">
      <table className="tabla-consumo tabla-por-modelo" aria-label={`Uso por modelo en ${cuenta.nombre}`}>
        <thead><tr><th>Modelo</th><th>Consultas</th><th>Pedidos</th><th>Tokens</th><th>Costo</th></tr></thead>
        <tbody>
          {cuenta.porModelo.map(m => (
            <tr key={m.modelo}>
              <td>{nombres[`${cuenta.proveedor}/${m.modelo}`] ?? m.modelo}</td>
              <td>{m.consultas ? m.consultas.toLocaleString("es-AR") : "—"}</td>
              <td>{m.pedidos.toLocaleString("es-AR")}</td>
              <td>{tokensCorto(m.tokens)}</td>
              <td>{m.costo > 0 ? `${dinero(m.costo)} USD` : "sin costo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TarjetaCuenta({ cuenta, planes, nombres }: { cuenta: CuentaConsumo; planes: Record<string, Plan>; nombres: Record<string, string> }) {
  const t = textoCuenta(cuenta);
  const origenes = Object.entries(cuenta.porOrigen).filter(([, v]) => v > 0).map(([k, v]) => `${ORIGEN[k] ?? k} ${dinero(v)}`);
  const configurable = !["ventanas", "sin-dato", "local", "suscripcion"].includes(cuenta.tipo) && cuenta.fuente !== "el proveedor";
  const { pedidos, tokens } = cuenta.uso.periodo;
  return (
    <section className={`tarjeta-cuenta nivel-${t.nivel}`} aria-label={`Cuenta de ${cuenta.nombre}`}>
      <h3>{cuenta.nombre}</h3>
      <p className="consumo-texto">{t.principal}</p>
      {t.libre !== undefined && <span className="medidor consumo-barra" aria-hidden><i style={{ width: `${Math.max(2, t.libre * 100)}%` }} /></span>}
      {t.secundario && <p className="ayuda">{t.secundario}</p>}
      {cuenta.gastado > 0 ? (
        <p className="ayuda">{cuenta.equivalente ? `Lo usado equivale a ${dinero(cuenta.gastado)} USD a precio de API (lo cubre la suscripción).` : `Gastado en este período: ${dinero(cuenta.gastado)} USD`}{origenes.length > 1 ? ` (${origenes.join(", ")})` : ""}.</p>
      ) : pedidos > 0 && <p className="ayuda">En este período: {pedidosTexto(pedidos)} y {tokensTexto(tokens)}, sin costo.</p>}
      <DiasConsumo dias={cuenta.porDia} />
      <PorModelo cuenta={cuenta} nombres={nombres} />
      {configurable && <EditorPlan proveedor={cuenta.proveedor} plan={cuenta.plan} planes={planes} />}
    </section>
  );
}

export function ConsumoAjuste() {
  const c = usarTienda(e => e.consumo);
  const planes = usarTienda(e => e.ajustes?.planes) ?? {};
  const listo = usarTienda(e => e.arranque === "listo");
  const [filtro, setFiltro] = useState("");
  useEffect(() => { if (listo) void refrescarConsumo(); }, [listo]);
  const p = c?.perfil;
  const llamadas = p ? p.llamadas.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "";
  const f = filtro.trim().toLowerCase();
  const nombres = Object.fromEntries((c?.cuentas ?? []).map(x => [x.proveedor, x.nombre]));
  const nombresModelo = Object.fromEntries((c?.modelos ?? []).map(m => [m.clave, m.nombre]));
  const filas = (c?.modelos ?? []).filter(m => !f || `${m.nombre} ${m.id} ${nombres[m.proveedor] ?? m.proveedor}`.toLowerCase().includes(f))
    .sort((a, b) => a.proveedor === b.proveedor ? porPrecio(a, b) : a.proveedor.localeCompare(b.proveedor));
  return (
    <section className="ajuste ajuste-ancho">
      <h2 className="serif">Consumo</h2>
      <p className="ayuda" style={{ marginBottom: 18 }}>Cuánto gastaste con cada cuenta, cuánto te queda y cuánto rinde cada modelo. Learn anota cada respuesta del modelo en esta computadora: tokens y costo, nunca el texto de la clase.</p>
      {!listo ? <p className="vacio">Abrí learn para ver el consumo.</p> : !c ? <span className="giro" /> : (
        <>
          {c.cuentas.length ? c.cuentas.map(x => <TarjetaCuenta key={x.proveedor} cuenta={x} planes={planes} nombres={nombresModelo} />)
            : <p className="aviso-bloque">Todavía no hay cuentas conectadas: iniciá sesión con un proveedor en Cuentas.</p>}
          <h3 className="subtitulo-ajuste">Cuánto rinde cada modelo</h3>
          {p && (
            <p className="ayuda" style={{ marginBottom: 12 }}>
              Una consulta es un mensaje o una respuesta tuya con todo lo que el tutor hace para contestarlo: en promedio {llamadas} {llamadas === "1" ? "llamada" : "llamadas"} al modelo
              y unos {aproximado((p.entrada + p.cacheLeida + p.cacheEscrita) / 1000)} mil tokens de contexto, {p.muestras ? `según tus últimas ${p.muestras} consultas` : "según una clase de prueba (se ajusta solo cuando estudies)"}.
              Es una estimación: cada modelo escribe y piensa distinto.
            </p>
          )}
          {c.modelos.length > 12 && <input className="campo" placeholder="Buscar un modelo" value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Buscar un modelo" style={{ marginBottom: 10 }} />}
          {c.modelos.length ? (
            <div className="tabla-envoltura"><table className="tabla-consumo">
              <thead><tr><th>Modelo</th><th>Por consulta</th><th>Con 1 USD</th><th>Con lo que queda</th><th><span className="oculto-accesible">Usar</span></th></tr></thead>
              <tbody>
                {filas.map(m => (
                  <tr key={m.clave} className={m.clave === c.actual?.clave ? "actual" : ""}>
                    <td>{m.nombre}<small>{nombres[m.proveedor] ?? m.proveedor}{m.imagenes ? "" : " · sin imágenes"}</small></td>
                    <td>{m.gratis ? "sin costo" : m.usdConsulta !== undefined ? `${m.usdConsulta < 0.01 ? m.usdConsulta.toLocaleString("es-AR", { maximumSignificantDigits: 2 }) : dinero(m.usdConsulta)} USD` : "—"}</td>
                    <td>{m.gratis ? "—" : m.porDolar !== undefined ? `≈ ${aproximado(m.porDolar)}` : "—"}</td>
                    <td>{m.agotado ? "sin cupo por ahora" : m.quedan !== undefined ? `≈ ${aproximado(m.quedan)}` : "—"}</td>
                    <td>{m.clave === c.actual?.clave ? <span className="apagado">En uso</span> : <button className="fantasma chico" onClick={() => void elegirModelo(m.proveedor, m.id, m.nombre)}>Usar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <p className="vacio">No hay modelos disponibles.</p>}
          <p className="ayuda" style={{ marginTop: 12 }}>Los precios salen del catálogo de pi. Lo que queda sale de tu plan, o del proveedor cuando lo informa (la suscripción de ChatGPT, OpenRouter, DeepSeek, Groq). Los modelos gratis (los de DeepSeek, Qwen o GLM por OpenRouter, los de NVIDIA, los gratis de OpenCode) se cuentan en pedidos y tokens; si su plan tiene un límite por día, cargalo arriba y se ve cuántas consultas quedan. Algunos planes gratis limitan los tokens por minuto, y una clase manda entre 20 y 40 mil por llamada.</p>
        </>
      )}
    </section>
  );
}
