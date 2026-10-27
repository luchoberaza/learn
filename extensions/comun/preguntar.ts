// Puente para una interfaz gráfica (la app de escritorio). En la terminal, quiz y ask_user_question dibujan su popup con
// ctx.ui.custom; fuera de ella (RPC, SDK) custom no existe y devolvía undefined: el quiz quedaba cancelado y la aprobación
// del plan no aparecía. Si la interfaz trae ctx.ui.preguntar, la pregunta le llega armada y ella la dibuja; si no, cada
// tool sigue por su camino de siempre. La interfaz es la que hace cumplir lo mismo que el popup: la correcta y la
// explicación sólo se muestran después de responder, y un corte (signal) cierra la pregunta como cancelada, salvo un
// quiz ya corregido, cuya respuesta se conserva.

export interface PedidoQuiz {
	tipo: "quiz";
	pregunta: string;
	contexto?: string;
	modo: "single-select" | "multi-select";
	// En el orden ya barajado que ve el alumno; indice es 1-based, como el número que se muestra.
	opciones: { indice: number; label: string; description?: string }[];
	correctas: number[];
	explicacion?: string;
	// La explicación que la pregunta verifica (DA52): se muestra antes de la pregunta, como texto del tutor.
	clase?: string;
}

export interface PedidoAsk {
	tipo: "ask";
	pregunta: string;
	contexto?: string;
	modo: "text" | "single-select" | "multi-select";
	opciones: { indice: number; label: string; value: string; description?: string }[];
	etiquetaOtra: string;
}

// pregunta_desarrollo (DA52): se responde escribiendo. La respuesta esperada se muestra recién después de responder.
export interface PedidoDesarrollo {
	tipo: "desarrollo";
	pregunta: string;
	contexto?: string;
	esperada: string;
	clase?: string;
}

// noSe: eligió «No sé»; elegidas: índices de opciones (vacío con noSe); nota: el campo opcional, si escribió algo.
export interface RespuestaQuiz { noSe: boolean; elegidas: number[]; nota?: string }
export type RespuestaAsk = { tipo: "option"; indice: number } | { tipo: "other"; texto: string } | { tipo: "text"; texto: string };
// texto: lo que escribió (vacío con noSe).
export interface RespuestaDesarrollo { noSe: boolean; texto?: string }

type Preguntar = {
	(pedido: PedidoQuiz, signal?: AbortSignal): Promise<RespuestaQuiz | null>;
	(pedido: PedidoAsk, signal?: AbortSignal): Promise<RespuestaAsk[] | null>;
	(pedido: PedidoDesarrollo, signal?: AbortSignal): Promise<RespuestaDesarrollo | null>;
};

// La función de la interfaz gráfica, o undefined si no la hay (terminal, RPC, pruebas sin app).
export function preguntarConApp(ctx: any): Preguntar | undefined {
	const preguntar = ctx?.ui?.preguntar;
	return ctx?.mode !== "tui" && typeof preguntar === "function" ? preguntar.bind(ctx.ui) : undefined;
}
