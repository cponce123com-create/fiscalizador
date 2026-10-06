"""Pruebas de la extracción de datos del HTML.

El HTML de prueba reproduce lo que se encontró en el portal real (comprobado con las
entidades 1, 100, 1234, 11129 y 20000): un formulario con el RUC en un campo oculto y
un `window.open` hacia SEACE, sin ningún enlace a archivo.
"""

from __future__ import annotations

import unittest

from ocos.parseo_html import (
    extraer_campos_del_formulario,
    extraer_enlaces,
    extraer_enlaces_de_descarga,
    extraer_puente_seace,
    extraer_titulo,
    resolver_plantilla_seace,
    texto_visible,
)

PAGINA_REAL = """<!doctype html>
<html><head>
<title>Portal del Estado Peruano - Portal de Transparencia Estandar - PTE Municipalidad Distrital de San Ramon (MDSR)</title>
</head><body>
<form action="pte_transparencia_ordenes_compra.aspx" method="post" name="frm_buscar">
  <input name="id_entidad" type="hidden" value="11129" />
  <input name="id_tema" type="hidden" value="34" />
  <input name="id_ruc" type="hidden" value="20146657142" />
  <select name="cbo_anno" id="cbo_anno">
    <option value="">Seleccione anio</option>
    <option value=2023>2023</option>
    <option value=2024>2024</option>
  </select>
  <select name="cbo_mes" id="cbo_mes">
    <option value="">Seleccione Mes</option>
    <option value="01">Enero</option>
    <option value="06">Junio</option>
  </select>
</form>
<a href="../imagenes/b_bienes.gif">Ordenes de Servicios</a>
<a href="documentos/ordenes-2023-06.xls">Libro de ordenes de junio de 2023</a>
<a href="javascript:pte_js_abrir_sub_ventanas()">Ver administradores</a>
<a href="mailto:transparencia@example.gob.pe">Escribanos</a>
<script>
  function enviarOsce() {
    var year = document.getElementById("cbo_anno").value;
    var month = document.getElementById("cbo_mes").value;
    window.open('https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml?ruc_entidad=20146657142&anio=' + year + '&mes=' + month + '&theme=ongei', '_blank');
  }
</script>
</body></html>"""

PAGINA_SIN_PUENTE = "<html><body><p>Sin nada</p></body></html>"


class PruebasDeEnlaces(unittest.TestCase):
    def test_encuentra_solo_los_enlaces_de_descarga(self) -> None:
        enlaces = extraer_enlaces_de_descarga(PAGINA_REAL, "https://www.transparencia.gob.pe/contrataciones/")

        self.assertEqual(len(enlaces), 1)
        self.assertTrue(enlaces[0].absoluto.endswith("ordenes-2023-06.xls"))
        self.assertEqual(enlaces[0].extension, ".xls")

    def test_resuelve_los_enlaces_relativos(self) -> None:
        enlaces = extraer_enlaces_de_descarga(
            PAGINA_REAL, "https://www.transparencia.gob.pe/contrataciones/pte.aspx"
        )
        self.assertTrue(
            enlaces[0].absoluto.startswith("https://www.transparencia.gob.pe/contrataciones/")
        )

    def test_ignora_javascript_y_mailto(self) -> None:
        enlaces = extraer_enlaces(PAGINA_REAL, "https://www.transparencia.gob.pe/")
        destinos = [enlace.href for enlace in enlaces]

        self.assertFalse(any(destino.startswith("javascript:") for destino in destinos))
        self.assertFalse(any(destino.startswith("mailto:") for destino in destinos))

    def test_extrae_el_titulo(self) -> None:
        titulo = extraer_titulo(PAGINA_REAL)
        self.assertIn("PTE", titulo)
        self.assertIn("San Ramon", titulo)


class PruebasDelFormulario(unittest.TestCase):
    def test_lee_los_campos_ocultos(self) -> None:
        ocultos, _ = extraer_campos_del_formulario(PAGINA_REAL)

        self.assertEqual(ocultos["id_ruc"], "20146657142")
        self.assertEqual(ocultos["id_entidad"], "11129")
        self.assertEqual(ocultos["id_tema"], "34")

    def test_lee_las_opciones_de_los_selectores(self) -> None:
        _, selects = extraer_campos_del_formulario(PAGINA_REAL)

        self.assertIn("2023", selects["cbo_anno"])
        self.assertIn("2024", selects["cbo_anno"])
        self.assertIn("06", selects["cbo_mes"])
        # Las opciones vacías ("Seleccione anio") no se recogen: no son periodos.
        self.assertNotIn("", selects["cbo_anno"])


class PruebasDelPuenteSeace(unittest.TestCase):
    def test_encuentra_la_expresion_completa_del_window_open(self) -> None:
        plantilla = extraer_puente_seace(PAGINA_REAL)

        self.assertIsNotNone(plantilla)
        assert plantilla is not None
        # Debe incluir la concatenación, no solo el primer trozo: si no, se perdería el
        # año y el mes.
        self.assertIn("seace.gob.pe", plantilla)
        self.assertIn("year", plantilla)
        self.assertIn("month", plantilla)
        # Y no debe arrastrar el segundo argumento de window.open.
        self.assertNotIn("_blank", plantilla)

    def test_resuelve_la_plantilla_con_el_periodo(self) -> None:
        plantilla = extraer_puente_seace(PAGINA_REAL)
        assert plantilla is not None

        url = resolver_plantilla_seace(plantilla, anio=2023, mes=6)

        self.assertIn("anio=2023", url)
        self.assertIn("mes=06", url)
        self.assertIn("ruc_entidad=20146657142", url)
        self.assertTrue(url.startswith("https://prod2.seace.gob.pe/"))
        self.assertNotIn("+", url)

    def test_el_mes_va_con_dos_digitos(self) -> None:
        url = resolver_plantilla_seace("...&mes=' + month + '&x", anio=2024, mes=1)
        self.assertIn("mes=01", url)

    def test_devuelve_none_si_no_hay_puente(self) -> None:
        self.assertIsNone(extraer_puente_seace(PAGINA_SIN_PUENTE))


class PruebasDeTextoVisible(unittest.TestCase):
    def test_quita_etiquetas_y_scripts(self) -> None:
        texto = texto_visible(PAGINA_REAL)

        self.assertIn("ORDENES", texto.upper())
        self.assertNotIn("<", texto)
        self.assertNotIn("window.open", texto)


if __name__ == "__main__":
    unittest.main()
