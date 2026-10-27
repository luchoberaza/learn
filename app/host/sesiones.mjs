// Sesiones de pi del vault: la lista para «Retomar» y lo que necesita «Seguir donde quedaste».
// Una clase abierta es una sesión cuya última entrada `curso` no es null (no se cerró con /fin), como la restaura sesion.ts.
import { existsSync } from "node:fs";
import { join } from "node:path";

const RECIENTES = 25;

export function crearSesiones({ sdk, vault }) {
  async function listar() {
    const lista = await sdk.SessionManager.list(vault);
    return lista.sort((a, b) => b.modified - a.modified).map(s => ({
      ruta: s.path, id: s.id, nombre: s.name, modificada: s.modified?.toISOString?.() ?? String(s.modified),
      mensajes: s.messageCount, primerMensaje: (s.firstMessage ?? "").slice(0, 160),
    }));
  }

  // Lo que hay que saber de una sesión guardada sin activarla: curso y tema, si la clase quedó abierta y la última frase del tutor.
  function detalle(ruta) {
    const sm = sdk.SessionManager.open(ruta);
    const rama = sm.getBranch();
    // La última entrada `curso` dice si la clase sigue abierta (null = cerrada con /fin); la última con datos, de qué tema era.
    const entradas = rama.filter(e => e.type === "custom" && e.customType === "curso");
    const ultima = entradas.at(-1), curso = entradas.findLast(e => e.data);
    const ultimo = [...rama].reverse().find(e => e.type === "message" && e.message?.role === "assistant" && (e.message.content ?? []).some(b => b?.type === "text" && b.text.trim()));
    const texto = ultimo ? ultimo.message.content.filter(b => b?.type === "text").map(b => b.text).join("\n").trim() : "";
    return {
      ruta, nombre: sm.getSessionName(),
      curso: curso?.data ? { curso: curso.data.curso, tema: curso.data.tema, adHoc: !!curso.data.adHoc, nombreTema: curso.data.adHoc?.nombre } : undefined,
      abierta: !!ultima?.data,
      nota: curso?.data && !curso.data.sinLog ? String(curso.data.nota ?? curso.data.log ?? "") || undefined : undefined,
      ultimaFrase: ultimaFrase(texto),
    };
  }

  // La última oración con contenido del tutor, para Inicio: sin bloques de código, fórmulas en bloque, citas ni marcas de
  // Markdown. Las fórmulas en línea ($d_{prop}$) quedan enteras: la interfaz las dibuja con KaTeX.
  function ultimaFrase(texto) {
    const sinBloques = texto.replace(/```[\s\S]*?```/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\[\[[^\]]*\]\]/g, "");
    const limpio = sinBloques.split(/(\$[^$\n]+\$)/).map((parte, i) => i % 2 ? parte : parte.replace(/[*_`#>]/g, "")).join("").replace(/\s+/g, " ").trim();
    if (!limpio) return undefined;
    const frases = limpio.match(/[^.!?¿¡]+[.!?]+|[^.!?]+$/g) ?? [limpio];
    let salida = "";
    for (const f of frases.reverse()) { if ((salida + f).length > 260) break; salida = f.trim() + (salida ? ` ${salida}` : ""); if (salida.length > 80) break; }
    return salida || limpio.slice(-240);
  }

  // La clase más reciente con curso: si quedó abierta se retoma esa sesión; si se cerró con /fin, se estudia de nuevo el tema.
  async function seguirDondeQuedaste() {
    for (const s of (await listar()).slice(0, RECIENTES)) {
      let d;
      try { d = detalle(s.ruta); } catch { continue; }
      // Una clase de un curso eliminado (DA53) ya no tiene dónde seguir.
      if (!d.curso || d.curso.adHoc || !existsSync(join(vault, "cursos", d.curso.curso, "indice.yaml"))) continue;
      return { ...d, modificada: s.modificada, accion: d.abierta ? "retomar" : "estudiar" };
    }
    return undefined;
  }

  return { listar, detalle, seguirDondeQuedaste };
}
