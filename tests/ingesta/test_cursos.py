"""Curación con PDFs sintéticos, sin red ni LLM; nunca sustituye la revisión del curso real."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
from almacen import Conflicto, sha256
from test_ingesta import crear_pdf
from cursos import aplicar, cargar_yaml, publicar_informe, revisar, validar


class CursosTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.vault = Path(self.tmp.name)
        (self.vault / "_entrada").mkdir()
        self.fuente = self.vault / "_entrada/libro.pdf"
        crear_pdf(self.fuente)
        self.raiz = self.vault / "cursos/ejemplo"
        self.contrato = "---\nnombre: Curso de ejemplo\nslug: ejemplo\n---\n# Objetivos\n- O1.1: Comprender la derivación.\n"
        self.indice = {"version": 1, "documentos": [{"id": "libro", "titulo": "Libro", "tipo": "bibliografia", "archivo": "fuentes/bibliografia/libro.pdf", "paginas": 3, "prioridad": "principal"}],
                       "temas": [{"id": "derivacion", "nombre": "Derivación", "unidad": 1, "alias": ["derivadas"], "prerequisitos": [], "objetivos": ["O1.1"], "bibliografia": [{"doc": "libro", "seccion": "Derivación", "paginas": [1, 2]}]}]}
        self.propuesta = self.vault / "_procesado/propuesta.json"
        self.propuesta.parent.mkdir()
        self.escribir()

    def tearDown(self):
        self.tmp.cleanup()

    def escribir(self, indice=None, contrato=None):
        paquete = {"indice_yaml": yaml.safe_dump(indice or self.indice, allow_unicode=True, sort_keys=False), "curso_md": contrato or self.contrato,
                   "origenes": {"libro": {"archivo": "_entrada/libro.pdf", "sha256": sha256(self.fuente)}}}
        self.propuesta.write_text(json.dumps(paquete, ensure_ascii=False))

    def crear(self):
        r, _ = revisar(self.vault, "ejemplo", self.propuesta)
        return aplicar(self.vault, "ejemplo", self.propuesta, r["base"], r["huella"])

    def guardar_indice(self, i):
        (self.raiz / "indice.yaml").write_text(yaml.safe_dump(i, allow_unicode=True))
        return validar(self.raiz, "ejemplo")

    def test_crea_copia_identica_y_progreso_vacio_sin_mover_fuente(self):
        antes = sha256(self.fuente)
        r = self.crear()
        self.assertTrue(r["nuevo"])
        self.assertTrue(r["validacion"]["ok"])
        self.assertFalse(r["validacion"]["listo_estudio"])
        self.assertEqual(sha256(self.raiz / "fuentes/bibliografia/libro.pdf"), antes)
        self.assertEqual(sha256(self.fuente), antes)
        self.assertEqual(cargar_yaml((self.raiz / "progreso.yaml").read_text()), {"version": 1, "temas": {}, "historial": []})
        self.assertTrue((self.raiz / "sesiones/adjuntos").is_dir())

    def test_repeticion_no_recopia_fuente_ni_cambia_progreso(self):
        self.crear()
        progreso = self.raiz / "progreso.yaml"
        antes = progreso.stat().st_mtime_ns
        self.assertEqual(self.crear()["copiados"], 0)
        self.assertEqual(progreso.stat().st_mtime_ns, antes)

    def test_ampliacion_conserva_texto_y_comentarios_y_rechaza_edicion_concurrente(self):
        self.crear()
        paquete = json.loads(self.propuesta.read_text())
        paquete["indice_yaml"] += "# Nota manual que se conserva.\n"
        self.propuesta.write_text(json.dumps(paquete))
        self.crear()
        self.assertIn("# Nota manual", (self.raiz / "indice.yaml").read_text())
        r, _ = revisar(self.vault, "ejemplo", self.propuesta)
        (self.raiz / "curso.md").write_text(self.contrato + "\nNota del usuario\n")
        with self.assertRaises(Conflicto):
            aplicar(self.vault, "ejemplo", self.propuesta, r["base"], r["huella"])
        self.assertIn("Nota del usuario", (self.raiz / "curso.md").read_text())

    def test_propuesta_cambiada_o_fuente_alterada_no_se_publican(self):
        r, _ = revisar(self.vault, "ejemplo", self.propuesta)
        self.escribir(contrato=self.contrato + "\nCambio posterior\n")
        with self.assertRaises(Conflicto):
            aplicar(self.vault, "ejemplo", self.propuesta, r["base"], r["huella"])
        self.assertFalse(self.raiz.exists())
        self.fuente.write_bytes(b"Otro archivo")
        with self.assertRaises(Conflicto):
            revisar(self.vault, "ejemplo", self.propuesta)

    def test_no_sobrescribe_destino_existente_ni_acepta_carpeta_incompleta(self):
        self.raiz.mkdir(parents=True)
        nota = self.raiz / "nota.md"
        nota.write_text("Material del usuario")
        with self.assertRaises(OSError):
            self.crear()
        self.assertEqual(nota.read_text(), "Material del usuario")

    def test_rutas_y_symlinks_rechazados(self):
        for ruta in ["../libro.pdf", "fuentes/bibliografia/../../fuera.pdf", "/tmp/libro.pdf", "fuentes/bibliografia/a#b.pdf"]:
            i = copy.deepcopy(self.indice)
            i["documentos"][0]["archivo"] = ruta
            self.escribir(i)
            with self.assertRaises((ValueError, Conflicto)):
                revisar(self.vault, "ejemplo", self.propuesta)
        self.escribir()
        (self.vault / "cursos").symlink_to(self.vault / "_entrada", target_is_directory=True)
        with self.assertRaises(Conflicto):
            self.crear()
        with self.assertRaises(ValueError):
            revisar(self.vault, "../ejemplo", self.propuesta)

    def test_yaml_con_claves_duplicadas_alias_o_version_invalida(self):
        for s in ["version: 1\nversion: 2\n", "dato: &a [*a]\n", "1: dato\n"]:
            with self.assertRaises(ValueError):
                cargar_yaml(s)
        self.crear()
        for v in [True, 2, "1"]:
            i = copy.deepcopy(self.indice)
            i["version"] = v
            self.assertFalse(self.guardar_indice(i)["ok"])

    def test_validador_ids_rangos_tipos_y_objetivos(self):
        self.crear()
        casos = []
        i = copy.deepcopy(self.indice); i["documentos"].append(i["documentos"][0]); casos.append(i)
        i = copy.deepcopy(self.indice); i["temas"].append(i["temas"][0]); casos.append(i)
        i = copy.deepcopy(self.indice); i["temas"][0]["objetivos"] = ["O9.9"]; casos.append(i)
        i = copy.deepcopy(self.indice); i["temas"][0]["bibliografia"][0]["doc"] = "ausente"; casos.append(i)
        for rango in [[0, 2], [2, 1], [1, 4], [True, 2], [1]]:
            i = copy.deepcopy(self.indice); i["temas"][0]["bibliografia"][0]["paginas"] = rango; casos.append(i)
        i = copy.deepcopy(self.indice); i["documentos"][0]["paginas"] = 4; casos.append(i)
        i = copy.deepcopy(self.indice); i["documentos"][0]["soluciones"] = "libro"; casos.append(i)
        for i in casos:
            with self.subTest(indice=i):
                self.assertFalse(self.guardar_indice(i)["ok"])

    def test_prerequisitos_inexistentes_y_ciclos(self):
        self.crear()
        i = copy.deepcopy(self.indice)
        i["temas"][0]["prerequisitos"] = ["ausente"]
        self.assertFalse(self.guardar_indice(i)["ok"])
        i["temas"][0]["prerequisitos"] = ["derivacion"]
        self.assertIn("circulares", " ".join(self.guardar_indice(i)["errores"]))
        i = copy.deepcopy(self.indice)
        t = copy.deepcopy(i["temas"][0]); t["id"] = "integracion"; t["prerequisitos"] = ["derivacion"]
        i["temas"].append(t); i["temas"][0]["prerequisitos"] = ["integracion"]
        self.assertFalse(self.guardar_indice(i)["ok"])

    def test_pendientes_y_contrato_largo_son_avisos_no_falsa_aprobacion(self):
        self.crear()
        r = validar(self.raiz, "ejemplo", max_tokens=1)
        self.assertTrue(r["ok"])
        self.assertFalse(r["listo_estudio"])
        self.assertEqual(len(r["pendientes"]), 2)
        self.assertTrue(any("presupuesto" in a for a in r["avisos"]))
        banco = self.raiz / "_procesado/libro"
        (banco / "paginas").mkdir(parents=True)
        q = {"paginas": {str(n): {"ruta": "digital", "pendiente": n == 2} for n in [1, 2]}}
        for n in [1, 2]: (banco / f"paginas/{n:04}.md").write_text("Texto")
        (banco / "calidad.json").write_text(json.dumps(q))
        self.assertEqual(validar(self.raiz, "ejemplo")["pendientes"], [{"doc": "libro", "pagina": 2}])
        q["paginas"]["2"]["pendiente"] = False
        (banco / "calidad.json").write_text(json.dumps(q))
        self.assertTrue(validar(self.raiz, "ejemplo")["listo_estudio"])

    def test_progreso_invalido_no_se_restaura_ni_modifica(self):
        self.crear()
        archivo = self.raiz / "progreso.yaml"
        casos = [{"version": 1, "temas": [], "historial": []},
                 {"version": 1, "temas": {"ausente": {"estado": "dominado"}}, "historial": []},
                 {"version": 1, "temas": {"derivacion": {"estado": "inventado"}}, "historial": []},
                 {"version": 1, "temas": {"derivacion": {"estado": "en_curso", "borde": {"falla": "texto"}}}, "historial": []},
                 {"version": 1, "temas": {}, "historial": [{"tema": "derivacion", "resumen": "hola", "fecha": "2026-10-20", "log": "../secreto.md"}]}]
        for p in casos:
            archivo.write_text(yaml.safe_dump(p))
            antes = sha256(archivo)
            self.assertFalse(validar(self.raiz, "ejemplo")["ok"])
            self.assertEqual(sha256(archivo), antes)

    def test_items_inexistentes_duplicados_y_soluciones_incorrectas(self):
        self.crear()
        i = copy.deepcopy(self.indice)
        i["temas"][0]["ejercicios"] = [{"doc": "libro", "items": ["1"]}]
        self.assertFalse(self.guardar_indice(i)["ok"])
        i["documentos"][0]["tipo"] = "ejercicios"
        i["documentos"][0]["archivo"] = "fuentes/ejercicios/libro.pdf"
        destino = self.raiz / i["documentos"][0]["archivo"]
        destino.parent.mkdir(); destino.write_bytes(self.fuente.read_bytes())
        i["temas"][0]["bibliografia"] = []
        self.assertFalse(self.guardar_indice(i)["ok"])
        carpeta = self.raiz / "_procesado/libro"; carpeta.mkdir(parents=True)
        item = {"id": "1", "paginas": [1], "enunciado": "Calcule la derivada."}
        (carpeta / "items.yaml").write_text(yaml.safe_dump({"doc": "libro", "items": [item]}))
        self.assertTrue(self.guardar_indice(i)["ok"])
        item["solucion"] = {"doc": "libro", "id": "1"}
        (carpeta / "items.yaml").write_text(yaml.safe_dump({"doc": "libro", "items": [item]}))
        self.assertFalse(self.guardar_indice(i)["ok"])
        del item["solucion"]
        (carpeta / "items.yaml").write_text(yaml.safe_dump({"doc": "libro", "items": [item, item]}))
        self.assertFalse(self.guardar_indice(i)["ok"])

    def test_ampliacion_no_elimina_ni_renombra_material(self):
        self.crear()
        for cambio in ["temas", "archivo"]:
            i = copy.deepcopy(self.indice)
            if cambio == "temas": i["temas"] = []
            else: i["documentos"][0]["archivo"] = "fuentes/bibliografia/otro.pdf"
            self.escribir(i)
            with self.assertRaises(Conflicto): self.crear()

    def test_ampliacion_copia_solo_lo_nuevo_y_conserva_progreso_y_fuente_previa(self):
        self.crear()
        nuevo = self.vault / "_entrada/otro.pdf"
        crear_pdf(nuevo)
        i = copy.deepcopy(self.indice)
        i["documentos"].append({**i["documentos"][0], "id": "otro", "archivo": "fuentes/bibliografia/otro.pdf"})
        self.escribir(i, contrato=self.contrato + "\nNota manual preservada\n")
        paquete = json.loads(self.propuesta.read_text())
        paquete["origenes"] = {"otro": {"archivo": "_entrada/otro.pdf", "sha256": sha256(nuevo)}}
        self.propuesta.write_text(json.dumps(paquete))
        progreso = self.raiz / "progreso.yaml"
        antes = progreso.stat().st_mtime_ns
        fuente_previa = sha256(self.raiz / self.indice["documentos"][0]["archivo"])
        r, _ = revisar(self.vault, "ejemplo", self.propuesta)
        self.assertEqual(aplicar(self.vault, "ejemplo", self.propuesta, r["base"], r["huella"])["copiados"], 1)
        self.assertEqual(progreso.stat().st_mtime_ns, antes)
        self.assertEqual(sha256(self.raiz / self.indice["documentos"][0]["archivo"]), fuente_previa)
        self.assertEqual(sha256(self.raiz / "fuentes/bibliografia/otro.pdf"), sha256(nuevo))
        self.assertIn("Nota manual preservada", (self.raiz / "curso.md").read_text())

    def test_amplia_con_pdf_nuevo_y_rechaza_edicion_durante_la_copia(self):
        self.crear()
        nuevo = self.vault / "_entrada/otro.pdf"
        crear_pdf(nuevo)
        i = copy.deepcopy(self.indice)
        i["documentos"].append({**i["documentos"][0], "id": "otro", "archivo": "fuentes/bibliografia/otro.pdf"})
        self.escribir(i)
        paquete = json.loads(self.propuesta.read_text())
        paquete["origenes"] = {"otro": {"archivo": "_entrada/otro.pdf", "sha256": sha256(nuevo)}}
        self.propuesta.write_text(json.dumps(paquete))
        progreso = sha256(self.raiz / "progreso.yaml")
        r, _ = revisar(self.vault, "ejemplo", self.propuesta)
        import shutil
        copiar = shutil.copyfileobj
        def interferir(entrada, salida):
            copiar(entrada, salida)
            (self.raiz / "curso.md").write_text(self.contrato + "\nEdición durante copia\n")
        with patch("cursos.shutil.copyfileobj", side_effect=interferir):
            with self.assertRaises(Conflicto):
                aplicar(self.vault, "ejemplo", self.propuesta, r["base"], r["huella"])
        self.assertIn("Edición durante copia", (self.raiz / "curso.md").read_text())
        self.assertEqual(sha256(self.raiz / "progreso.yaml"), progreso)
        self.assertEqual(len(cargar_yaml((self.raiz / "indice.yaml").read_text())["documentos"]), 1)

    def test_registro_corrupto_o_fuente_cambiada_se_detecta(self):
        self.crear()
        carpeta = self.raiz / "_procesado/libro"
        carpeta.mkdir(parents=True)
        (carpeta / "calidad.json").write_text("[]")
        self.assertFalse(validar(self.raiz, "ejemplo")["ok"])
        (carpeta / "calidad.json").write_text('{"paginas": {}}')
        (carpeta / "meta.json").write_text(json.dumps({"id": "libro", "sha256": "huella incorrecta"}))
        self.assertFalse(validar(self.raiz, "ejemplo")["ok"])

    def test_informe_recupera_corte_entre_registro_y_markdown(self):
        self.crear()
        publicar_informe(self.vault, "ejemplo")
        i = copy.deepcopy(self.indice)
        i["temas"][0]["nombre"] = "Derivación: nombre revisado"
        self.guardar_indice(i)
        from cursos import atomico
        def cortar(raiz, nombre, contenido):
            if nombre == "informe-ingesta.md":
                raise OSError("Corte simulado")
            return atomico(raiz, nombre, contenido)
        with patch("cursos.atomico", side_effect=cortar):
            with self.assertRaises(OSError):
                publicar_informe(self.vault, "ejemplo")
        publicar_informe(self.vault, "ejemplo")
        self.assertIn("nombre revisado", (self.raiz / "informe-ingesta.md").read_text())

    def test_informe_visible_cita_y_preserva_edicion_manual(self):
        self.crear()
        publicar_informe(self.vault, "ejemplo")
        archivo = self.raiz / "informe-ingesta.md"
        self.assertIn("Tema → material", archivo.read_text())
        self.assertIn("[[cursos/ejemplo/fuentes/bibliografia/libro.pdf#page=1]]", archivo.read_text())
        self.assertIn("sin preparar", archivo.read_text())
        archivo.write_text("Mis observaciones")
        with self.assertRaises(Conflicto): publicar_informe(self.vault, "ejemplo")
        self.assertEqual(archivo.read_text(), "Mis observaciones")
