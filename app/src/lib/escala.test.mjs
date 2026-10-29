import assert from "node:assert/strict";
import test from "node:test";
import { anchoLateral, anchoPanel, escalaValida, LATERAL, pasoEscala } from "./escala.ts";

test("la escala sube y baja de a un paso, se queda en los extremos y Ctrl 0 vuelve al 100 %", () => {
  assert.equal(pasoEscala(1, 1), 1.1);
  assert.equal(pasoEscala(1.1, 1), 1.25);
  assert.equal(pasoEscala(1.5, 1), 1.5);
  assert.equal(pasoEscala(1, -1), 0.9);
  assert.equal(pasoEscala(0.8, -1), 0.8);
  assert.equal(pasoEscala(1.25, 0), 1);
});

test("una escala guardada rara se lleva a la más cercana de la lista", () => {
  assert.equal(escalaValida(undefined), 1);
  assert.equal(escalaValida("1.2"), 1);
  assert.equal(escalaValida(Number.NaN), 1);
  assert.equal(escalaValida(1.2), 1.25);
  assert.equal(escalaValida(3), 1.5);
  assert.equal(escalaValida(0.1), 0.8);
  assert.equal(pasoEscala(1.19, 1), 1.5);
});

test("la barra lateral queda entre 200 y 420 px; sin ancho guardado, el de siempre", () => {
  assert.equal(anchoLateral(undefined), LATERAL.normal);
  assert.equal(anchoLateral(120), 200);
  assert.equal(anchoLateral(999), 420);
  assert.equal(anchoLateral(301.6), 302);
});

test("el panel de página no baja de 300 px ni pasa del 60 % de la ventana, y deja 360 px a la pantalla", () => {
  assert.equal(anchoPanel(100, 1400, 256), 300);
  assert.equal(anchoPanel(500, 1400, 256), 500);
  assert.equal(anchoPanel(1200, 1400, 256), 784);
  // Ventana angosta con la barra ancha: manda lo que necesita la pantalla.
  assert.equal(anchoPanel(900, 1000, 420), 300);
  assert.equal(anchoPanel(900, 1200, 420), 420);
});
