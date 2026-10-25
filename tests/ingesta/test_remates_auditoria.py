"""Remates de la preparación por tema: fallos en espera por huella de entradas, sin red ni LLM."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
import preparacion
import test_preparacion_auditoria as base


class FallosEnEsperaTest(base.CursoPreparacion):
    def trabajo(self):
        return preparacion.trabajo(self.vault, "ejemplo", "derivacion", 150)

    def test_un_fallo_espera_hasta_que_cambien_sus_entradas_o_pase_un_dia(self):
        self.segmentar("parcial", [{"id": "1", "paginas": [1], "enunciado": "Derive."}])
        self.segmentar("practico", [{"id": "1", "paginas": [1], "enunciado": "Integre."}, {"id": "2", "paginas": [2], "enunciado": "Grafique."}])
        t = self.trabajo()
        parcial = next(s for s in t["segmentar"] if s["doc"] == "parcial")
        self.assertEqual((parcial["listo"], t["en_espera"], len(t["clasificar"])), (True, 0, 2))
        practico = {c["id"]: c["entrada"] for c in t["clasificar"]}
        preparacion.registrar(self.vault, "ejemplo", {"fallos": {"segmentar/parcial": parcial["entrada"], "clasificar/practico/2": practico["2"]}})
        t = self.trabajo()
        self.assertEqual(([s["listo"] for s in t["segmentar"]], [c["id"] for c in t["clasificar"]], t["en_espera"]), ([False], ["1"], 2))
        # Cambia una página del parcial: su segmentación vuelve a la cola; la clasificación sigue en espera.
        pagina = self.raiz / "_procesado/parcial/paginas/0002.md"
        pagina.write_text(pagina.read_text(encoding="utf-8") + "\nPregunta 2. Integre.\n", encoding="utf-8", newline="\n")
        t = self.trabajo()
        self.assertEqual(([s["listo"] for s in t["segmentar"]], t["en_espera"]), ([True], 1))
        # Pasa un día: la clasificación también vuelve.
        archivo = self.raiz / "_procesado/preparacion.json"
        estado = json.loads(archivo.read_text(encoding="utf-8"))
        estado["fallos"]["clasificar/practico/2"]["fecha"] = "2000-01-01T00:00:00+00:00"
        archivo.write_text(json.dumps(estado), encoding="utf-8", newline="\n")
        self.assertEqual(([c["id"] for c in self.trabajo()["clasificar"]], self.trabajo()["en_espera"]), (["1", "2"], 0))


class EstadoTest(base.CursoPreparacion):
    def test_curso_check_dice_por_tema_el_estado_y_los_items_asignados(self):
        self.assertEqual(preparacion.estado(self.vault, "ejemplo"), ["Preparación de derivacion: sin preparar; 0 ítems asignados automáticamente.",
                                                                     "Preparación de integracion: sin preparar; 0 ítems asignados automáticamente."])
        self.segmentar("practico", [{"id": "1", "paginas": [1], "enunciado": "Integre."}, {"id": "2", "paginas": [2], "enunciado": "Grafique."}])
        preparacion.asignar(self.vault, "ejemplo", [{"doc": "practico", "id": "1", "tema": "integracion"}, {"doc": "practico", "id": "2", "tema": "integracion"}])
        indice = preparacion.trabajo(self.vault, "ejemplo", "derivacion", 150)["indice"]
        preparacion.registrar(self.vault, "ejemplo", {"tema": {"id": "derivacion", "estado": "incompleta", "indice": indice, "pendientes": 1}})
        preparacion.registrar(self.vault, "ejemplo", {"tema": {"id": "integracion", "estado": "completa", "indice": indice, "pendientes": 0}})
        self.assertEqual(preparacion.estado(self.vault, "ejemplo"), ["Preparación de derivacion: incompleta (1 página pendiente); 0 ítems asignados automáticamente.",
                                                                     "Preparación de integracion: completa; 2 ítems asignados automáticamente."])
        # Sin páginas pendientes, lo que falta son ítems (en espera tras un fallo, por ejemplo).
        preparacion.registrar(self.vault, "ejemplo", {"tema": {"id": "derivacion", "estado": "incompleta", "indice": indice, "pendientes": 0}})
        self.assertEqual(preparacion.estado(self.vault, "ejemplo")[0], "Preparación de derivacion: incompleta (quedan ítems por separar o clasificar); 0 ítems asignados automáticamente.")
        self.indice["temas"][0]["alias"] = ["derivada"]
        self.guardar_indice(self.indice)
        self.assertIn("cambió el índice", preparacion.estado(self.vault, "ejemplo")[1])


if __name__ == "__main__":
    unittest.main()
