import { test } from "node:test";
import assert from "node:assert/strict";
import { registrarCuracion } from "../extensions/curso/curacion.ts";

function cursoCheck(validacion) {
  const comandos = new Map(), mensajes = [];
  registrarCuracion({ registerCommand: (n, d) => comandos.set(n, d), sendMessage: m => mensajes.push(m),
    exec: async () => ({ code: 0, stdout: JSON.stringify({ ok: true, errores: [], avisos: [], pendientes: [], ...validacion }), stderr: "" }) });
  return comandos.get("curso-check").handler("redes", { ui: { notify: assert.fail } }).then(() => mensajes[0].content);
}

test("H05: /curso-check da los comandos para transcribir sin modelo las páginas que faltan", async () => {
  const faltan = [{ doc: "kurose-7", pagina: 179 }, { doc: "kurose-7", pagina: 180 }];
  const texto = await cursoCheck({ pendientes: faltan, sin_transcripcion: faltan });
  assert.match(texto, /2 sin transcripción/);
  assert.match(texto, /cursos\.py manifiesto --curso redes --pendientes\n.*ingestar\.py iniciar --manifiesto _procesado\/manifiesto-redes\.json --salida cursos\/redes\/_procesado/);
  assert.doesNotMatch(await cursoCheck({ pendientes: faltan, sin_transcripcion: [] }), /manifiesto/);
});
