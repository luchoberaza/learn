// El panel de página de la app con las mismas reglas que ver_pagina (sesion.ts y material.ts):
// - nunca una página con un ítem reservado para /simulacro, su solución o una casi copia, ni siquiera navegando;
// - en evaluaciones, soluciones o documentos con soluciones integradas, sólo la página exacta que el tutor enlazó
//   (las tools dan esos enlaces recién después del intento) o la que mostró con ver_pagina; nada de avanzar página a página;
// - en el resto (bibliografía, programa), se puede avanzar salteando las páginas vedadas.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const conSolucion = (d, doc) => doc.tipo === "evaluaciones" || doc.tipo === "soluciones" || (d.items?.[doc.id] ?? []).some(i => i.solucion_de !== undefined);

export function crearPaginas({ vault, piDir, pythonDelVenv, material, cursos }) {
  // Del enlace [[cursos/<curso>/fuentes/<tipo>/<archivo>.pdf#page=N]] al curso, documento y página.
  async function desdeCita(cita) {
    const m = /^\[?\[?cursos\/([a-z0-9-]+)\/(fuentes\/[^#\]]+\.pdf)#page=(\d+)/i.exec(String(cita ?? "").trim());
    if (!m) throw new Error("La cita no apunta a un PDF del curso.");
    const d = await cursos.cargar(m[1]);
    const doc = (d.documentos ?? []).find(x => x.archivo === m[2]);
    if (!doc) throw new Error("El documento de la cita no está en el índice del curso.");
    return { curso: m[1], doc: doc.id, pagina: Number(m[3]) };
  }

  function vedada(raiz, d, doc, p, ocultos) {
    return material.paginasReservadas(d, doc, ocultos).has(p) || material.copiaEnPagina(raiz, d, doc, p, ocultos);
  }

  async function pedir({ cita, curso, doc, pagina, origen }) {
    if (cita) ({ curso, doc, pagina } = await desdeCita(cita));
    const d = await cursos.cargar(curso), raiz = join(vault, "cursos", curso), fuente = material.documento(d, doc);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > fuente.paginas) throw new Error("Página PDF fuera de rango.");
    const ocultos = material.reservados(raiz, d);
    if (vedada(raiz, d, doc, pagina, ocultos)) throw new Error("Esa página trae un ítem reservado para el simulacro; no se muestra.");
    const restringido = conSolucion(d, fuente);
    if (restringido && origen !== "cita" && origen !== "ver_pagina") throw new Error("Las páginas de parciales y soluciones se abren sólo desde una cita del tutor, después de tu intento.");
    const imagen = await renderizar(curso, doc, pagina);
    // Vecinas para avanzar, sólo donde se permite y salteando las vedadas.
    const vecina = paso => {
      if (restringido) return undefined;
      for (let p = pagina + paso; p >= 1 && p <= fuente.paginas; p += paso) if (!vedada(raiz, d, doc, p, ocultos)) return p;
      return undefined;
    };
    return { curso, doc, pagina, titulo: fuente.titulo, total: fuente.paginas, anterior: vecina(-1), siguiente: vecina(1), restringido, imagen };
  }

  function renderizar(curso, doc, pagina) {
    return new Promise((resolver, rechazar) => {
      execFile(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta/sesion.py"), "renderizar", "--vault", vault, "--curso", curso, "--doc", doc, "--pagina", String(pagina)],
        { encoding: "utf8", timeout: 20000, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } }, error => {
          if (error) return rechazar(new Error("No se pudo dibujar la página: el entorno de ingesta (Python) falló."));
          try { resolver(readFileSync(join(vault, "cursos", curso, "_procesado", doc, "render", `${String(pagina).padStart(4, "0")}.png`)).toString("base64")); }
          catch { rechazar(new Error("No se encontró el dibujo de la página.")); }
        });
    });
  }

  return { pedir, desdeCita };
}
