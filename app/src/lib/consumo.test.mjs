import assert from "node:assert/strict";
import test from "node:test";
import { aproximado, cuando, dinero, nombreVentana, pedidosTexto, textoCuenta, textoRinde, tokensCorto, tokensTexto } from "./consumo.ts";

const AHORA = new Date(2026, 9, 26, 12, 0).getTime();
const base = { proveedor: "anthropic", nombre: "Anthropic", gastado: 42.5, porOrigen: {}, porModelo: [], porDia: [], uso: { periodo: { pedidos: 0, tokens: 0 }, hoy: { pedidos: 0, tokens: 0 } } };

test("los modelos gratis y los planes de tokens: lo usado hoy, en pedidos y tokens", () => {
  const uso = { periodo: { pedidos: 40, tokens: 1500000 }, hoy: { pedidos: 12, tokens: 340400 } };
  const g = textoCuenta({ ...base, proveedor: "nvidia", nombre: "NVIDIA", gastado: 0, tipo: "gratis", uso }, AHORA);
  assert.equal(g.principal, "Hoy: 12 pedidos · 340 mil tokens");
  assert.equal(g.secundario, "el límite diario lo pone el proveedor");
  assert.equal(textoCuenta({ ...base, gastado: 0, tipo: "suscripcion", uso }, AHORA).secundario, "el cupo de tu plan está en la página del proveedor");
  assert.equal(pedidosTexto(1), "1 pedido");
  assert.equal(tokensTexto(950), "950 tokens");
  assert.equal(tokensTexto(1040000), "1 millón de tokens");
  assert.equal(tokensTexto(1500000), "1,5 millones de tokens");
  assert.equal(tokensTexto(23400000), "23,4 millones de tokens");
  assert.equal(tokensCorto(1120000), "1,1 millones");
  assert.equal(tokensCorto(2000000), "2 millones");
  assert.equal(tokensCorto(126400), "126 mil");
});

test("los números del medidor: dinero con centavos, estimaciones redondeadas y ventanas con nombre", () => {
  assert.equal(dinero(157.5), "157,50");
  assert.equal(dinero(1234.5), "1.235");
  assert.equal(aproximado(26.9), "26");
  assert.equal(aproximado(449), "440");
  assert.equal(aproximado(10602), "10.600");
  assert.equal(nombreVentana(300), "5 horas");
  assert.equal(nombreVentana(10080), "la semana");
  assert.equal(nombreVentana(), "la ventana");
  assert.match(cuando(new Date(2026, 9, 26, 18, 40).getTime(), AHORA), /^a las 18:40$/);
  assert.match(cuando(new Date(2026, 9, 27, 9, 5).getTime(), AHORA), /^mañana a las 09:05$/);
  assert.match(cuando(new Date(2026, 10, 3).getTime(), AHORA), /^el 3 (de )?nov/);
});

test("cada cuenta en su unidad: dólares del plan, ventanas de la suscripción, pedidos del día", () => {
  const plan = textoCuenta({ ...base, tipo: "dinero", queda: 157.5, limite: 200, fuente: "tu plan", plan: { tipo: "mensual", monto: 200, dia: 3 }, renueva: new Date(2026, 10, 3).getTime() }, AHORA);
  assert.equal(plan.principal, "157,50 de 200,00 USD");
  assert.match(plan.secundario, /^se renueva el 3/);
  assert.equal(plan.nivel, "ok");
  assert.equal(textoCuenta({ ...base, tipo: "dinero", queda: 15, limite: 200, fuente: "tu plan" }, AHORA).nivel, "mal");
  assert.equal(textoCuenta({ ...base, tipo: "dinero", queda: 7.25, fuente: "el proveedor" }, AHORA).principal, "Te quedan 7,25 USD");

  const v = textoCuenta({ ...base, tipo: "ventanas", ventanas: [{ minutos: 300, usado: 36, renueva: new Date(2026, 9, 26, 18, 40).getTime() }, { minutos: 10080, usado: 82 }] }, AHORA);
  assert.equal(v.principal, "64 % libre de 5 horas");
  assert.equal(v.secundario, "se renueva a las 18:40 · la semana: 18 % libre");
  assert.equal(v.nivel, "aviso", "manda la ventana con menos libre");

  assert.equal(textoCuenta({ ...base, tipo: "pedidos", pedidos: { quedan: 38, limite: 50, gratis: true } }, AHORA).principal, "Quedan 38 de 50 pedidos gratis hoy");
  assert.equal(textoCuenta({ ...base, tipo: "pedidos", pedidos: { usados: 4 } }, AHORA).principal, "Hoy: 4 pedidos");
  assert.equal(textoCuenta({ ...base, tipo: "local" }, AHORA).principal, "Modelo local, sin límite");
  assert.equal(textoCuenta({ ...base, tipo: "sin-tope" }, AHORA).principal, "Este período: 42,50 USD");
  const agotado = textoCuenta({ ...base, tipo: "dinero", queda: 50, limite: 200, agotado: { desde: AHORA, hasta: new Date(2026, 9, 26, 13, 0).getTime() } }, AHORA);
  assert.deepEqual([agotado.principal, agotado.secundario, agotado.nivel], ["Sin cupo por ahora", "vuelve a las 13:00", "mal"]);
});

test("lo que rinde un modelo: las consultas que quedan, sin costo, o cuántas entran en un dólar", () => {
  const m = { clave: "a/b", proveedor: "a", id: "b", nombre: "B", imagenes: true, razona: true, agotado: false, gratis: false };
  assert.equal(textoRinde({ ...m, quedan: 10602 }), "≈ 10.600 consultas");
  assert.equal(textoRinde({ ...m, quedan: 1 }), "≈ 1 consulta");
  assert.equal(textoRinde({ ...m, gratis: true }), "sin costo");
  assert.equal(textoRinde({ ...m, porDolar: 53.02 }), "≈ 53 por USD");
  assert.equal(textoRinde({ ...m, agotado: true, quedan: 0 }), "sin cupo por ahora");
});
