import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { levantarHost, VAULT } from "./ayuda.mjs";

// Requiere el curso de demostración (app/e2e/curso_demo.py) en el vault de trabajo.
const CURSO = "redes-demo";
const hayCurso = existsSync(join(VAULT, "cursos", CURSO, "indice.yaml"));
const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";

const QUIZ = `export default ai => [
  ai.fauxAssistantMessage([ai.fauxText("Arranquemos con lo que ya sabés."), ai.fauxToolCall("quiz", {
    question: "Si duplicás el largo del enlace, ¿qué pasa con el retardo de propagación?",
    details: "Todo lo demás queda igual.",
    options: [{ label: "Se duplica", value: "dup" }, { label: "No cambia", value: "igual" }, { label: "Se reduce a la mitad", value: "mitad" }],
    correctAnswer: "dup", explanation: "Como $d_{prop} = d/s$, si la distancia se duplica el retardo también.",
  }, { id: "quiz-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Bien: el retardo de propagación crece con la distancia."),
]`;

// Lo que nunca puede viajar a la interfaz: la respuesta correcta del quiz antes de responder, la explicación ni el valor.
const filtrado = m => JSON.stringify(m);

test("host: arranca con confianza, carga el curso y da a la interfaz sólo el resumen", { skip: sinCurso }, async t => {
  const h = levantarHost(t);
  const listo = await h.esperar(m => m.tipo === "listo" || m.tipo === "error-fatal", 60000, "listo");
  assert.equal(listo.tipo, "listo", listo.mensaje);
  assert.ok(h.mensajes.some(m => m.tipo === "confianza"), "pidió confianza en un agente nuevo");
  const cursos = await h.pedir("cursos");
  const demo = cursos.find(c => c.slug === CURSO);
  assert.ok(demo, JSON.stringify(cursos).slice(0, 300));
  assert.deepEqual(demo.orden, ["retardos", "aplicacion", "transporte"]);
  assert.equal(demo.sugerido, "retardos");
  const retardos = demo.temas.find(x => x.id === "retardos");
  assert.equal(retardos.simulacroDisponible, true);
  // Ni enunciados, ni soluciones, ni cuál es el reservado.
  const texto = JSON.stringify(demo);
  assert.doesNotMatch(texto, /Solución|8 x 10\^6 bits|51 ms|reservado"\s*:/);
  assert.equal(demo.temas.find(x => x.id === "aplicacion").prerequisitosFaltan[0], "retardos");
  const comandos = await h.pedir("comandos");
  for (const n of ["estudiar", "fin", "simulacro", "progreso", "curso-nuevo", "compact", "model"]) assert.ok(comandos.some(c => c.nombre === n), n);
});

test("host: /estudiar abre la clase y el quiz llega sin la correcta; la corrección viene recién al responder", { skip: sinCurso }, async t => {
  const h = levantarHost(t, { guion: QUIZ });
  await h.esperar(m => m.tipo === "listo", 60000, "listo");
  const antesNotas = existsSync(join(VAULT, "cursos", CURSO, "sesiones")) ? readdirSync(join(VAULT, "cursos", CURSO, "sesiones")) : [];
  await h.pedir("enviar", { texto: `/estudiar ${CURSO} retardos` });
  const sesion = await h.esperar(m => m.tipo === "sesion" && m.curso?.tema === "retardos", 30000, "la sesión con el tema activo");
  assert.equal(sesion.curso.curso, CURSO);
  const pedido = await h.esperar(m => m.tipo === "pedido" && m.clase === "quiz", 30000, "el quiz");
  assert.equal(pedido.id, "quiz-1");
  assert.match(pedido.pregunta, /duplicás el largo/);
  assert.deepEqual(pedido.opciones.map(o => o.indice), [1, 2, 3]);
  // Hasta acá, nada de la respuesta: ni el valor ni la explicación ni el índice correcto.
  for (const m of h.mensajes) assert.doesNotMatch(filtrado(m), /correctAnswer|"correctas"|d_\{prop\} = d\/s|"dup"/, `filtró: ${filtrado(m).slice(0, 200)}`);
  const correcta = pedido.opciones.find(o => o.label === "Se duplica").indice;
  await h.pedir("responder", { pedido: pedido.id, respuesta: { noSe: false, elegidas: [correcta], nota: "creo que es lineal" } });
  const correccion = await h.esperar(m => m.tipo === "correccion" && m.id === pedido.id, 10000, "la corrección");
  assert.equal(correccion.correcto, true); assert.deepEqual(correccion.correctas, [correcta]);
  assert.match(correccion.explicacion, /d_\{prop\}/);
  await h.pedir("responder", { pedido: pedido.id, respuesta: { seguir: true } });
  const item = await h.esperar(m => m.tipo === "item" && m.item.tipo === "quiz" && m.item.id === "quiz-1", 10000, "el quiz resuelto");
  assert.equal(item.item.estado, "respondido"); assert.equal(item.item.resultado.correcto, true); assert.equal(item.item.resultado.nota, "creo que es lineal");
  await h.esperar(m => m.tipo === "tutor-texto" && !m.enCurso && /crece con la distancia/.test(m.texto), 20000, "el texto final del tutor");
  // Las líneas de tools del curso viajan en español y sin el texto del material.
  for (const m of h.mensajes.filter(m => m.tipo === "item" && m.item.tipo === "herramienta" && m.item.curso)) assert.doesNotMatch(filtrado(m), /d_trans = L\/R|1\.4\.1/);
  // La nota de la clase quedó en Obsidian con el quiz y la respuesta.
  const nuevas = readdirSync(join(VAULT, "cursos", CURSO, "sesiones")).filter(n => n.endsWith(".md") && !antesNotas.includes(n));
  assert.equal(nuevas.length, 1, JSON.stringify(nuevas));
  const nota = readFileSync(join(VAULT, "cursos", CURSO, "sesiones", nuevas[0]), "utf8");
  assert.match(nota, /\[!question\] Quiz/); assert.match(nota, /Quiz — correcto ✓/); assert.match(nota, /creo que es lineal/);
  t.after(() => { for (const n of nuevas) rmSync(join(VAULT, "cursos", CURSO, "sesiones", n), { force: true }); rmSync(join(VAULT, "cursos", CURSO, ".sesion-activa.json"), { force: true }); });
});

test("host: una página del parcial no se abre navegando, y una con el ítem reservado nunca", { skip: sinCurso }, async t => {
  const h = levantarHost(t);
  await h.esperar(m => m.tipo === "listo", 60000, "listo");
  const libro = await h.pedir("pagina", { curso: CURSO, doc: "kurose", pagina: 2, origen: "navegar" });
  assert.equal(libro.pagina, 2); assert.equal(libro.anterior, 1); assert.equal(libro.siguiente, 3); assert.ok(libro.imagen.length > 1000);
  await assert.rejects(() => h.pedir("pagina", { curso: CURSO, doc: "parcial-2025", pagina: 2, origen: "navegar" }), /reservado|sólo desde una cita/);
  await assert.rejects(() => h.pedir("pagina", { curso: CURSO, doc: "kurose", pagina: 99, origen: "navegar" }), /fuera de rango/);
});
