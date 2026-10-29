import assert from "node:assert/strict";
import test from "node:test";
import { avance, detener, duracionEnPalabras, fraseSemana, iniciar, mmss, nuevo, pausar, racha, restante, saltar, semana, tic } from "./foco.ts";

const A = { activo: true, foco: 25, descanso: 5, descansoLargo: 15, ciclos: 4, sonido: false };
const MIN = 60000;
const libre = { preguntaAbierta: false, simulacro: false };

test("un bloque completo suma sus minutos como bloque y avisa el descanso", () => {
  let r = iniciar(nuevo(A), 0);
  assert.equal(restante(r, 10 * MIN), 15 * MIN);
  assert.equal(Math.round(avance(r, A, 10 * MIN) * 100), 40);
  const { reloj, eventos } = tic(r, A, 25 * MIN, libre);
  assert.deepEqual(eventos, [{ tipo: "sumar", minutos: 25, bloque: true }, { tipo: "aviso", clase: "fin-foco", siguiente: "descanso" }]);
  assert.equal(reloj.estado, "esperando");
  assert.equal(reloj.fase, "descanso");
  assert.equal(reloj.restanteMs, 5 * MIN);
  r = reloj;
  // El descanso no arranca solo: el aviso nunca le quita la caja de texto al alumno.
  assert.deepEqual(tic(r, A, 40 * MIN, libre).eventos, []);
});

test("con una pregunta abierta, el aviso de descanso espera a que se responda", () => {
  const r = iniciar(nuevo(A), 0);
  const fin = tic(r, A, 25 * MIN, { preguntaAbierta: true, simulacro: false });
  assert.deepEqual(fin.eventos, [{ tipo: "sumar", minutos: 25, bloque: true }]);
  assert.equal(fin.reloj.avisoDiferido, true);
  assert.deepEqual(tic(fin.reloj, A, 26 * MIN, { preguntaAbierta: true, simulacro: false }).eventos, []);
  const respondida = tic(fin.reloj, A, 27 * MIN, libre);
  assert.deepEqual(respondida.eventos, [{ tipo: "aviso", clase: "fin-foco", siguiente: "descanso" }]);
  assert.equal(respondida.reloj.avisoDiferido, false);
});

test("el simulacro pausa el foco, cuenta lo estudiado y al terminar vuelve a correr", () => {
  const r = iniciar(nuevo(A), 0);
  const pausa = tic(r, A, 10 * MIN, { preguntaAbierta: false, simulacro: true });
  assert.equal(pausa.reloj.estado, "pausado");
  assert.equal(pausa.reloj.pausaSimulacro, true);
  assert.deepEqual(pausa.eventos, [{ tipo: "sumar", minutos: 10, bloque: false }]);
  // Durante el simulacro el tiempo no corre.
  assert.equal(restante(tic(pausa.reloj, A, 50 * MIN, { preguntaAbierta: false, simulacro: true }).reloj, 50 * MIN), 15 * MIN);
  const sigue = tic(pausa.reloj, A, 60 * MIN, libre);
  assert.equal(sigue.reloj.estado, "corriendo");
  assert.equal(restante(sigue.reloj, 61 * MIN), 14 * MIN);
});

test("una pausa del alumno no la levanta el fin del simulacro", () => {
  const p = pausar(iniciar(nuevo(A), 0), 5 * MIN).reloj;
  assert.equal(tic(p, A, 9 * MIN, libre).reloj.estado, "pausado");
});

test("cada cuatro bloques el descanso es largo", () => {
  let r = nuevo(A), t = 0;
  for (let i = 1; i <= 4; i++) {
    r = iniciar({ ...r, fase: "foco", restanteMs: 25 * MIN }, t);
    t += 25 * MIN;
    r = tic(r, A, t, libre).reloj;
    assert.equal(r.fase, i === 4 ? "descansoLargo" : "descanso");
  }
  assert.equal(r.restanteMs, 15 * MIN);
});

test("saltar y detener cuentan lo estudiado sin marcar un bloque", () => {
  const r = iniciar(nuevo(A), 0);
  const s = saltar(r, A, 12 * MIN);
  assert.deepEqual(s.eventos, [{ tipo: "sumar", minutos: 12, bloque: false }]);
  assert.equal(s.reloj.fase, "descanso");
  assert.equal(s.reloj.bloques, 0);
  const d = detener(iniciar(nuevo(A), 0), A, 3 * MIN);
  assert.deepEqual(d.eventos, [{ tipo: "sumar", minutos: 3, bloque: false }]);
  assert.equal(d.reloj.estado, "detenido");
});

test("racha, semana y la frase de Inicio", () => {
  const hoy = new Date(2026, 9, 24, 18);
  const h = { "2026-10-24": { minutos: 75, bloques: 3 }, "2026-10-23": { minutos: 50, bloques: 2 }, "2026-10-22": { minutos: 20, bloques: 1 }, "2026-10-20": { minutos: 30, bloques: 1 } };
  assert.equal(racha(h, hoy), 3);
  assert.equal(fraseSemana(h, hoy), "Hoy estudiaste una hora y cuarto en tres bloques de foco. Llevás tres días seguidos.");
  const s = semana(h, hoy);
  assert.equal(s.length, 7);
  assert.deepEqual(s.at(-1), { dia: "2026-10-24", etiqueta: "sá", minutos: 75, hoy: true });
  assert.equal(s[0].etiqueta, "do");
  // Si hoy todavía no hubo foco, la racha de ayer sigue viva.
  const sinHoy = { "2026-10-23": { minutos: 50, bloques: 2 }, "2026-10-22": { minutos: 20, bloques: 1 } };
  assert.equal(racha(sinHoy, hoy), 2);
  assert.equal(fraseSemana(sinHoy, hoy), "Hoy todavía no empezaste un bloque de foco. Venís de dos días seguidos.");
  assert.equal(fraseSemana({}, hoy), "Hoy todavía no empezaste un bloque de foco.");
});

test("duraciones y reloj en palabras", () => {
  assert.equal(duracionEnPalabras(30), "media hora");
  assert.equal(duracionEnPalabras(92), "una hora y media");
  assert.equal(duracionEnPalabras(20), "veinte minutos");
  assert.equal(duracionEnPalabras(120), "dos horas");
  assert.equal(duracionEnPalabras(2), "menos de cinco minutos");
  assert.equal(mmss(15 * MIN + 32000), "15:32");
  assert.equal(mmss(999), "0:01");
});
