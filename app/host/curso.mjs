// Datos de los cursos para las pantallas de la app (barra lateral, Inicio, curso, tema).
// Se leen con el mismo sesion.py cargar que usa /estudiar (sólo lectura; el progreso lo escribe únicamente la extensión),
// con la copia .sesion-cargada.json de respaldo, como DA15. A la interfaz va un resumen: nunca enunciados, ítems,
// soluciones ni cuál es el ítem reservado para el simulacro.
import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function crearCursos({ vault, piDir, pythonDelVenv, material, simulacro, progreso }) {
  const cache = new Map();

  function listarSlugs() {
    const dir = join(vault, "cursos");
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && SLUG.test(d.name) && existsSync(join(dir, d.name, "indice.yaml"))).map(d => d.name).sort();
  }

  // Huella barata para saber si hay que volver a cargar: índice, progreso, asignaciones e ítems cambian lo que se muestra.
  function huella(slug) {
    const raiz = join(vault, "cursos", slug);
    return ["indice.yaml", "progreso.yaml", "_procesado/asignaciones.json", "_procesado/preparacion.json"]
      .map(f => { try { return statSync(join(raiz, f)).mtimeMs; } catch { return 0; } }).join(":");
  }

  function cargar(slug) {
    if (!SLUG.test(slug)) return Promise.reject(new Error("Curso inválido."));
    const h = huella(slug), previo = cache.get(slug);
    if (previo && previo.huella === h) return Promise.resolve(previo.datos);
    return new Promise((resolver, rechazar) => {
      execFile(pythonDelVenv(piDir), [join(piDir, "scripts/ingesta/sesion.py"), "cargar", "--vault", vault, "--curso", slug],
        { encoding: "utf8", timeout: 30000, maxBuffer: 64 * 1024 * 1024, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } },
        (error, stdout) => {
          let datos;
          try { if (!error) datos = JSON.parse(stdout); } catch { /* salida cortada */ }
          if (!datos) {
            try { datos = JSON.parse(readFileSync(join(vault, "cursos", slug, ".sesion-cargada.json"), "utf8")); }
            catch { return rechazar(new Error("No se pudo leer el curso: el entorno de ingesta (Python) no respondió. Revisalo en Preparar la computadora.")); }
            datos = { ...datos, avisos: [...(datos.avisos ?? []), "Material desde la última carga; el entorno de ingesta no respondió."] };
          }
          cache.set(slug, { huella: h, datos });
          resolver(datos);
        });
    });
  }

  const estadoDe = (d, id) => d.progreso?.temas?.[id]?.estado ?? "sin_empezar";
  const lista = x => Array.isArray(x) ? x : [];

  function resumenTema(d, raiz, t, reservas) {
    const p = d.progreso?.temas?.[t.id] ?? {};
    const prereqFaltan = lista(t.prerequisitos).filter(id => estadoDe(d, id) !== "dominado");
    return {
      id: t.id, nombre: t.nombre, unidad: t.unidad, alias: lista(t.alias),
      estado: estadoDe(d, t.id), prerequisitos: lista(t.prerequisitos), prerequisitosFaltan: prereqFaltan,
      objetivos: lista(t.objetivos).map(id => (d.contrato ?? "").split("\n").find(l => l.startsWith(`- ${id}:`))?.slice(2).trim() || id),
      bibliografia: lista(t.bibliografia).map(b => ({ doc: b.doc, seccion: b.seccion, paginas: b.paginas })),
      progreso: {
        proximoPaso: typeof p.proximo_paso === "string" ? p.proximo_paso : undefined,
        objetivo: typeof p.objetivo === "string" ? p.objetivo : undefined,
        plan: typeof p.plan === "string" ? p.plan : undefined,
        domina: lista(p.borde?.domina).map(String), falla: lista(p.borde?.falla).map(String),
        conceptosFirmes: lista(p.conceptos_firmes).map(String),
        errores: lista(p.errores_de_concepto).filter(e => e && !e.resuelto).map(e => String(e.descripcion ?? "")),
        ejercicios: lista(p.ejercicios).map(e => ({ doc: e?.doc, item: e?.item, resultado: e?.resultado, puntaje: e?.puntaje, fecha: e?.fecha })),
        actualizado: p.actualizado,
      },
      // Sólo si hay uno disponible: cuál es, nunca (E3).
      simulacroDisponible: !!reservas[t.id],
    };
  }

  async function resumen(slug) {
    const d = await cargar(slug), raiz = join(vault, "cursos", slug);
    let reservas = {};
    try { reservas = material.reservas(raiz, d); } catch { /* sin ítems todavía */ }
    const temas = material.ordenarTemas(d).map(t => resumenTema(d, raiz, t, reservas));
    const siguiente = progreso?.proximoTema ? progreso.proximoTema(d) : undefined;
    const t = simulacro?.tiempo ? simulacro.tiempo(d.contrato ?? "") : undefined;
    return {
      slug, nombre: d.nombre || slug, contrato: d.contrato ?? "", avisos: lista(d.avisos),
      temas, orden: temas.map(x => x.id), sugerido: siguiente?.id,
      // restringido: evaluaciones, soluciones o con soluciones integradas; se abren sólo desde una cita del tutor (paginas.mjs).
      documentos: lista(d.documentos).map(x => ({ id: x.id, titulo: x.titulo, tipo: x.tipo, paginas: x.paginas, archivo: x.archivo, prioridad: x.prioridad,
        restringido: x.tipo === "evaluaciones" || x.tipo === "soluciones" || lista(d.items?.[x.id]).some(i => i?.solucion_de !== undefined) })),
      examen: t ? { minutosPorPregunta: t.minutos, descripcion: t.examen } : undefined,
      ingesta: estadoIngesta(slug),
    };
  }

  // Estado de la ingesta base (estado-ingesta.json), para la barra del curso; el cálculo de «interrumpida» lo hace ingestar.py.
  function estadoIngesta(slug) {
    try {
      const e = JSON.parse(readFileSync(join(vault, "cursos", slug, "_procesado/estado-ingesta.json"), "utf8"));
      return { estado: e.estado, procesadas: e.procesadas ?? 0, solicitadas: e.solicitadas ?? 0, pendientes: e.pendientes ?? 0, documento: e.documento, pagina: e.pagina };
    } catch { return undefined; }
  }

  async function todos() {
    const salida = [];
    for (const slug of listarSlugs()) {
      try { salida.push(await resumen(slug)); }
      catch (e) { salida.push({ slug, nombre: slug, error: e.message, temas: [], orden: [], avisos: [], documentos: [] }); }
    }
    return salida;
  }

  return { listarSlugs, cargar, resumen, todos, olvidar: slug => cache.delete(slug) };
}
