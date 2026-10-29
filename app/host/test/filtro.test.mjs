import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { crearFiltro } from "../filtro.mjs";
import { PI_DIR } from "./ayuda.mjs";

const etiquetas = await import(pathToFileURL(join(PI_DIR, "extensions/curso/etiquetas.ts")).href);
const texto = m => JSON.stringify(m);

test("filtro: de las tools del curso sólo sale la línea en español, nunca args ni resultados", () => {
  const f = crearFiltro({ etiquetas });
  const secreto = "TEXTO DEL LIBRO: d_trans = L/R (página 54)";
  for (const nombre of etiquetas.TOOLS_DEL_CURSO) {
    const args = { doc: "kurose", desde: 1, hasta: 2, consulta: secreto, ids: ["7"] };
    const resultado = { content: [{ type: "text", text: secreto }], details: { texto: secreto } };
    const salidas = [
      ...f.evento({ type: "tool_execution_start", toolCallId: `t-${nombre}`, toolName: nombre, args }),
      ...f.evento({ type: "tool_execution_update", toolCallId: `t-${nombre}`, toolName: nombre, args, partialResult: resultado }),
      ...f.evento({ type: "tool_execution_end", toolCallId: `t-${nombre}`, toolName: nombre, result: resultado, isError: false }),
    ];
    for (const m of salidas) {
      // El texto parcial es el mismo que dibuja la terminal (render.ts): el diff de guardar_curso y el avance de transcribir.
      const { parcial, ...resto } = m.item ?? {};
      if (parcial !== undefined) assert.equal(parcial, etiquetas.textoParcial(nombre, resultado), nombre);
      assert.doesNotMatch(texto({ ...m, item: resto }), /TEXTO DEL LIBRO|"args"|"details"|"consulta"/, `${nombre}: ${texto(m).slice(0, 200)}`);
      if (m.item?.tipo === "herramienta") assert.equal(m.item.curso, true);
    }
  }
});

test("filtro: el quiz no muestra la correcta ni la explicación hasta que termina la tool", () => {
  const f = crearFiltro({ etiquetas });
  const args = { question: "¿Qué pasa?", options: [{ label: "A" }, { label: "B" }, { label: "C" }], correctAnswer: "A", explanation: "Porque sí, $x$" };
  const inicio = f.evento({ type: "tool_execution_start", toolCallId: "q1", toolName: "quiz", args });
  assert.deepEqual(inicio, [{ tipo: "qa-inicio", id: "q1", nombre: "quiz" }]);
  assert.deepEqual(f.evento({ type: "tool_execution_update", toolCallId: "q1", toolName: "quiz", args, partialResult: { details: { correctIndices: [1] } } }), []);
  // Y en la transcripción guardada, el mensaje del tutor con la llamada no deja ver los args del quiz.
  const t = f.transcripcion([
    { type: "message", id: "e1", message: { role: "assistant", content: [{ type: "text", text: "Probemos." }, { type: "toolCall", id: "q1", name: "quiz", arguments: args }] } },
    { type: "message", id: "e2", message: { role: "toolResult", toolCallId: "q1", toolName: "quiz", details: { status: "cancelled", question: "¿Qué pasa?" } } },
  ]);
  assert.doesNotMatch(texto(t), /correctAnswer|Porque sí/);
  assert.equal(t[1].estado, "cancelado");
});

test("filtro: no salen mensajes ocultos, razonamiento ni el SKILL.md entero", () => {
  const f = crearFiltro({ etiquetas });
  assert.deepEqual(f.evento({ type: "message_end", message: { role: "custom", display: false, customType: "curso-orden", content: "ORDEN INTERNA" } }), []);
  const pensando = f.evento({ type: "message_update", message: { role: "assistant", content: [{ type: "thinking", thinking: "RAZONAMIENTO PRIVADO" }] } });
  assert.doesNotMatch(texto(pensando), /RAZONAMIENTO/);
  assert.deepEqual(pensando, [{ tipo: "pensando" }]);
  const skill = f.evento({ type: "message_end", message: { role: "user", timestamp: 5, content: [{ type: "text", text: '<skill name="teach" location="/x/SKILL.md">\n# Enseñar\nINSTRUCCIONES LARGAS\n</skill>\n\nseries de Fourier' }] } });
  assert.equal(skill[0].item.texto, "series de Fourier");
  assert.deepEqual(skill[0].item.skills, ["teach"]);
  assert.doesNotMatch(texto(skill), /INSTRUCCIONES LARGAS/);
});

test("filtro: cada mensaje del tutor tiene su id aunque el proveedor no dé responseId", () => {
  const f = crearFiltro({ etiquetas });
  const mensaje = t => ({ role: "assistant", timestamp: 1000, content: [{ type: "text", text: t }] });
  const a = [...f.evento({ type: "message_start", message: mensaje("") }), ...f.evento({ type: "message_end", message: mensaje("Primero") })];
  const b = [...f.evento({ type: "message_start", message: mensaje("") }), ...f.evento({ type: "message_end", message: mensaje("Segundo") })];
  const idA = a.find(m => m.tipo === "tutor-texto").id, idB = b.find(m => m.tipo === "tutor-texto").id;
  assert.notEqual(idA, idB);
});

test("filtro: una tool general conserva su entrada al terminar (el evento final no trae args)", () => {
  const f = crearFiltro({ etiquetas });
  f.evento({ type: "tool_execution_start", toolCallId: "s1", toolName: "subagent", args: { agent: "scout", task: "Mirá cursos/" } });
  const [fin] = f.evento({ type: "tool_execution_end", toolCallId: "s1", toolName: "subagent", result: { content: [{ type: "text", text: "listo" }] }, isError: false });
  assert.equal(fin.item.detalle.entrada, "scout: Mirá cursos/");
  assert.equal(fin.item.detalle.salida, "listo");
  assert.equal(fin.item.linea, "Subagente");
});
