// Cómo encarar un tema y qué preguntas hacer (DA52). Una sola tabla para /estudiar y /preguntas en la terminal, la
// sección «Esta clase» del prompt, el conteo que sigue a cada pregunta y la app (Ajustes → Cómo estudio y el menú de
// cada tema). Sin dependencias de pi: el host de la app la importa tal cual.

export type IdModo = "seguir" | "desde-cero" | "fortalecer";
export type IdMezcla = "automatico" | "solo-opcion" | "mas-opcion" | "mitad" | "mas-desarrollo" | "solo-desarrollo";
export type TipoPregunta = "opcion" | "desarrollo";

export interface Modo { id: IdModo; nombre: string; descripcion: string; regla?: string }
// desarrollo: la parte de las preguntas que va de desarrollo; sin ella (automático) decide el tutor según el nodo.
export interface Mezcla { id: IdMezcla; nombre: string; descripcion: string; desarrollo?: number }

export const MODOS: Modo[] = [
  { id: "seguir", nombre: "Seguir donde quedé", descripcion: "Retoma desde lo que ya sabés y el próximo paso guardado." },
  { id: "desde-cero", nombre: "Desde cero", descripcion: "Repasa todo el tema desde las bases, aunque figure como sabido.",
    regla: "No des por sabido nada del dossier (borde, «domina», objetivo ni plan). Probe desde la base de cada hebra, sin la lista de lo que ya vio; objetivo y plan nuevos, que reemplazan a los guardados. Enseñá todos los nodos del tema desde sus raíces, también lo que figure como dominado, cada uno con su pregunta. Lo registrado antes no se borra: registrá sólo lo que observes." },
  { id: "fortalecer", nombre: "Fortalecer lo flojo", descripcion: "Trabaja lo que te costó: los errores guardados y sus bases.",
    regla: "El probe va a lo que el dossier registra como falla, errores abiertos y ejercicios fallados, y a sus bases: confirmá cuáles siguen. El plan son sólo esos nodos, con las bases que falten, cada uno con práctica; lo que ya resuelve, cerralo con `falla_resuelta`. Si el dossier no registra fallas, decilo en una línea y seguí como en «Desde cero»." },
];

export const MEZCLAS: Mezcla[] = [
  { id: "automatico", nombre: "Automático", descripcion: "Múltiple opción al principio y más desarrollo a medida que dominás, como pide el examen." },
  { id: "solo-opcion", nombre: "Sólo múltiple opción", descripcion: "Todas las preguntas con opciones para elegir.", desarrollo: 0 },
  { id: "mas-opcion", nombre: "Más múltiple opción", descripcion: "De cada 4 preguntas, 3 de múltiple opción y 1 de desarrollo.", desarrollo: 0.25 },
  { id: "mitad", nombre: "Mitad y mitad", descripcion: "Una de múltiple opción y una de desarrollo.", desarrollo: 0.5 },
  { id: "mas-desarrollo", nombre: "Más desarrollo", descripcion: "De cada 4 preguntas, 1 de múltiple opción y 3 de desarrollo.", desarrollo: 0.75 },
  { id: "solo-desarrollo", nombre: "Sólo desarrollo", descripcion: "Todas las preguntas se responden escribiendo.", desarrollo: 1 },
];

export const modo = (id: unknown): Modo => MODOS.find(m => m.id === id) ?? MODOS[0];
export const mezcla = (id: unknown): Mezcla => MEZCLAS.find(m => m.id === id) ?? MEZCLAS[0];

// /estudiar <curso> <tema> [desde-cero|fortalecer]: el modo va al final («desde cero» también en dos palabras).
export function modoDeArgs(palabras: string[]): { modo: IdModo; resto: string[] } {
  const ultima = (palabras.at(-1) ?? "").toLowerCase();
  if (ultima === "desde-cero" || ultima === "fortalecer") return { modo: ultima, resto: palabras.slice(0, -1) };
  if (ultima === "cero" && palabras.at(-2)?.toLowerCase() === "desde") return { modo: "desde-cero", resto: palabras.slice(0, -2) };
  return { modo: "seguir", resto: palabras };
}

// Con una parte fija, la próxima pregunta es de desarrollo mientras las de desarrollo queden por debajo de esa parte
// contando la que viene: 1/4 da opción, opción, opción, desarrollo; 1/2 alterna empezando por opción.
export function proxima(m: Mezcla, opcion: number, desarrollo: number): TipoPregunta | undefined {
  if (m.desarrollo === undefined) return undefined;
  return desarrollo < Math.floor(m.desarrollo * (opcion + desarrollo + 1) + 1e-9) ? "desarrollo" : "opcion";
}

const COMO = { opcion: "de múltiple opción (`quiz`)", desarrollo: "de desarrollo (`pregunta_desarrollo`)" };

// La sección del prompt: cambia sólo si cambian el modo o la mezcla, así no rompe la caché en cada turno.
export function seccionClase(idModo: IdModo | undefined, idMezcla: unknown): string {
  const m = modo(idModo), x = mezcla(idMezcla), lineas = ["# Esta clase"];
  if (m.regla) lineas.push(`Modo: ${m.nombre}. ${m.regla}`);
  const primera = proxima(x, 0, 0);
  lineas.push(x.desarrollo === undefined
    ? `Preguntas: ${x.nombre}. Múltiple opción (\`quiz\`) en el probe y al verificar algo nuevo; desarrollo (\`pregunta_desarrollo\`) cuando ya acertó ese concepto, y el repaso en el formato del examen.`
    : `Preguntas: ${x.nombre} (${x.descripcion.replace(/\.$/, "")}). La primera va ${COMO[primera!]}.`);
  lineas.push("Respetá esta mezcla en toda pregunta con respuesta correcta (probe, verificación y repaso). Decide de qué tipo es cada pregunta, no cuándo preguntar: la clase sigue igual. Cada respuesta trae el conteo de la clase y, con una mezcla fija, de qué tipo va la próxima. La práctica con ítems de evaluación sigue en el chat, con texto o foto.");
  return lineas.join("\n");
}

// Lo que se suma al resultado de cada pregunta, sólo para el modelo.
export function lineaConteo(idMezcla: unknown, opcion: number, desarrollo: number): string {
  const x = mezcla(idMezcla), sigue = proxima(x, opcion, desarrollo);
  const van = `en esta clase van ${opcion} de múltiple opción y ${desarrollo} de desarrollo`;
  return sigue ? `Mezcla «${x.nombre}»: ${van}; cuando vuelvas a preguntar, que sea ${COMO[sigue]}.` : `Mezcla «${x.nombre}»: ${van}; cuando vuelvas a preguntar, elegí el tipo según el nodo.`;
}
