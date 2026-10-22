"""Regresiones de la auditoría en curación y visión, con PDFs sintéticos y sin red ni LLM."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/ingesta"))
from almacen import Conflicto, sha256
import test_cursos
from test_ingesta import crear_pdf
from cursos import revisar


def cortar(entrada, salida):
    salida.write(entrada.read(100))
    raise OSError("Disco lleno simulado")


class CursosAuditoriaTest(unittest.TestCase):
    setUp, tearDown = test_cursos.CursosTest.setUp, test_cursos.CursosTest.tearDown
    escribir, crear, guardar_indice = test_cursos.CursosTest.escribir, test_cursos.CursosTest.crear, test_cursos.CursosTest.guardar_indice

    def test_h40_propuesta_dentro_del_curso_pide_la_raiz_del_vault(self):
        dentro = self.raiz / "_procesado/propuesta.json"
        dentro.parent.mkdir(parents=True)
        dentro.write_text(self.propuesta.read_text())
        with self.assertRaisesRegex(ValueError, "raíz del vault"):
            revisar(self.vault, "ejemplo", dentro)

    def ampliar(self):
        nuevo = self.vault / "_entrada/otro.pdf"
        crear_pdf(nuevo)
        i = copy.deepcopy(self.indice)
        i["documentos"].append({**i["documentos"][0], "id": "otro", "archivo": "fuentes/bibliografia/otro.pdf"})
        self.escribir(i)
        paquete = json.loads(self.propuesta.read_text())
        paquete["origenes"] = {"otro": {"archivo": "_entrada/otro.pdf", "sha256": sha256(nuevo)}}
        self.propuesta.write_text(json.dumps(paquete))
        return nuevo, self.raiz / "fuentes/bibliografia/otro.pdf"

    def test_h38_curso_nuevo_cortado_no_aparece_y_se_puede_repetir(self):
        with patch("cursos.shutil.copyfileobj", side_effect=cortar):
            with self.assertRaises(OSError):
                self.crear()
        self.assertFalse(self.raiz.exists())
        self.assertTrue(self.crear()["validacion"]["ok"])
        self.assertEqual([p.name for p in (self.vault / "cursos").iterdir()], ["ejemplo"])

    def test_h38_ampliacion_cortada_o_matada_no_deja_pdf_parcial_con_el_nombre_final(self):
        self.crear()
        nuevo, destino = self.ampliar()
        with patch("cursos.shutil.copyfileobj", side_effect=cortar):
            with self.assertRaises(OSError):
                self.crear()
        self.assertEqual(list(destino.parent.iterdir()), [self.raiz / "fuentes/bibliografia/libro.pdf"])
        muerto = subprocess.Popen(["true"]); muerto.wait()
        huerfano = destino.with_name(f".otro.pdf.parcial-{muerto.pid}")
        huerfano.write_bytes(b"copia de un aplicar matado")
        self.assertEqual(self.crear()["copiados"], 1)
        self.assertFalse(huerfano.exists())
        self.assertEqual(sha256(destino), sha256(nuevo))

    def test_h38_copia_completa_y_curso_editado_se_puede_reintentar(self):
        self.crear()
        _, destino = self.ampliar()
        def interferir(entrada, salida):
            salida.write(entrada.read())
            (self.raiz / "curso.md").write_text(self.contrato + "\nEdición durante la copia\n")
        with patch("cursos.shutil.copyfileobj", side_effect=interferir):
            with self.assertRaises(Conflicto):
                self.crear()
        self.assertTrue(destino.exists())
        self.assertTrue(self.crear()["validacion"]["ok"])

    def test_h38_carpeta_incompleta_no_es_un_curso_existente(self):
        pdf = self.raiz / "fuentes/bibliografia/libro.pdf"
        pdf.parent.mkdir(parents=True)
        pdf.write_bytes(b"%PDF cortado")
        with self.assertRaisesRegex(OSError, "sin indice.yaml"):
            revisar(self.vault, "ejemplo", self.propuesta)


if __name__ == "__main__":
    unittest.main()
