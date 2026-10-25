import assert from "node:assert/strict";
import test from "node:test";
import { analizarEnlace, cuando, estadoEnIndice, fechaLarga, fraccion, marcarPlan, nodosDelPlan, nombreCorto, sinEmoji, slugDe } from "./texto.ts";

test("los enlaces de Obsidian se reconocen como cita, imagen, PDF o nota", () => {
  assert.deepEqual(analizarEnlace("cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=54"),
    { tipo: "cita", destino: "cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=54", curso: "redes-demo", archivo: "fuentes/bibliografia/kurose.pdf", pagina: 54, alias: undefined });
  assert.equal(analizarEnlace("cursos/redes/fuentes/bibliografia/k.pdf#page=3|Kurose").alias, "Kurose");
  assert.deepEqual(analizarEnlace("viz-dag-retardos.png"), { tipo: "imagen", destino: "viz-dag-retardos.png", alias: undefined });
  assert.equal(analizarEnlace("_entrada/muestras/practico1.pdf#page=1|Práctico 1").tipo, "pdf");
  assert.equal(analizarEnlace("Otra nota").tipo, "nota");
});

test("el plan guardado se parte en nodos y se marca con lo que el alumno domina", () => {
  assert.deepEqual(nodosDelPlan("1. Transmisión (p. 54)\n2. Propagación (p. 55)\n3. Encolamiento"), ["Transmisión (p. 54)", "Propagación (p. 55)", "Encolamiento"]);
  assert.deepEqual(nodosDelPlan("Transmisión → Propagación → Encolamiento"), ["Transmisión", "Propagación", "Encolamiento"]);
  assert.deepEqual(nodosDelPlan("1. Transmisión 2. Propagación 3. Encolamiento"), ["Transmisión", "Propagación", "Encolamiento"]);
  assert.deepEqual(nodosDelPlan(undefined), []);
  assert.deepEqual(marcarPlan(["Transmisión (p. 54)", "Propagación", "Encolamiento"], ["retardo de transmisión L/R"]),
    [{ nombre: "Transmisión", estado: "hecho" }, { nombre: "Propagación", estado: "actual" }, { nombre: "Encolamiento", estado: "pendiente" }]);
});

test("fechas en palabras", () => {
  const ahora = new Date(2026, 9, 24, 18, 0);
  assert.equal(fechaLarga(ahora), "Sábado 24 de octubre");
  assert.equal(cuando(new Date(2026, 9, 24, 17, 55), ahora), "hace 5 minutos");
  assert.equal(cuando(new Date(2026, 9, 24, 9, 0), ahora), "hoy a la mañana");
  assert.equal(cuando(new Date(2026, 9, 23, 22, 0), ahora), "ayer a la noche");
  assert.equal(cuando(new Date(2026, 9, 20, 22, 0), ahora), "el martes");
  assert.equal(cuando(new Date(2026, 8, 3, 22, 0), ahora), "el 3 de septiembre");
});

test("estado de cada tema en el índice, como en la maqueta", () => {
  const nombres = { transporte: "Capa de transporte" };
  assert.deepEqual(estadoEnIndice({ id: "a", estado: "dominado", prerequisitosFaltan: [] }, "b", nombres), { texto: "dominado", clase: "ok" });
  assert.deepEqual(estadoEnIndice({ id: "b", estado: "sin_empezar", prerequisitosFaltan: [] }, "b", nombres), { texto: "te conviene seguir acá", clase: "go" });
  assert.deepEqual(estadoEnIndice({ id: "c", estado: "sin_empezar", prerequisitosFaltan: ["transporte"] }, "b", nombres), { texto: "después de Transporte", clase: "" });
  assert.deepEqual(estadoEnIndice({ id: "d", estado: "repasar", prerequisitosFaltan: [] }, "b", nombres), { texto: "para repasar", clase: "rep" });
  assert.equal(nombreCorto("Capa de red"), "Red");
});

test("slug, fracción de un estado y emojis de la terminal", () => {
  assert.equal(slugDe("Redes de Computadoras 2026"), "redes-de-computadoras-2026");
  assert.equal(slugDe("Álgebra Lineal"), "algebra-lineal");
  assert.equal(fraccion("Preparando el material: 12 de 40 páginas"), 0.3);
  assert.equal(fraccion("redes: en_curso · 10/40 · pendientes: 2"), 0.25);
  assert.equal(fraccion("sin números"), undefined);
  assert.equal(sinEmoji("📚 redes › Retardos"), "redes › Retardos");
  assert.equal(sinEmoji("📝 Simulacro · Retardos"), "Simulacro · Retardos");
});
