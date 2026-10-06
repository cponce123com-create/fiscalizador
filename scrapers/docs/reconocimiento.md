# Reconocimiento de las fuentes

Registro de lo que se comprobó contra los sitios reales antes de escribir código. Está
aquí porque **contradice parte del encargo** y porque, cuando algo deje de funcionar, esto
es lo que dice qué se daba por supuesto.

Fecha del reconocimiento: 2026-10-06. Las URLs cambian: si algo no cuadra, vuelve a
ejecutar estas comprobaciones antes de tocar el código.

## 1. Portal de Transparencia

### La URL del encargo no es la página de órdenes

```
https://www.transparencia.gob.pe/contrataciones/pte_transparencia_ordenes_compra.aspx
    ?id_entidad=11129&id_tema=34&Ver=D
```

Devuelve 200 y 12.864 bytes, pero es una **página de navegación**. Su enlace real a
contrataciones es relativo:

```
../contrataciones/pte_transparencia_contrataciones.aspx?id_entidad=11129&id_tema=34&ver=D
```

Y esa, a su vez, es un menú con cuatro botones de imagen:

| Botón | Destino |
|---|---|
| Procesos de selección | `pte_transparencia_procesos.aspx` |
| Contrataciones directas | `pte_transparencia_contrataciones_directas.aspx` |
| Órdenes de bienes y servicios | `pte_transparencia_ordenes_compra.aspx` |
| Viáticos | `pte_transparencia_viaticos.aspx` |

### La página de órdenes es un formulario, no una lista de ficheros

Comprobado con **cinco entidades** (ids 1, 100, 1234, 11129 y 20000):

| Entidad | Bytes | Enlaces a archivo | Formulario | RUC en el formulario |
|---|---|---|---|---|
| 1 | 11.444 | 0 | sí | (no) |
| 100 | 11.448 | 0 | sí | (no) |
| 1234 | 11.450 | 0 | sí | (no) |
| 11129 | 12.847 | 0 | sí | 20146657142 |
| 20000 | 11.452 | 0 | sí | (no) |

El formulario es:

```html
<form action="pte_transparencia_ordenes_compra.aspx" method="post" name="frm_buscar">
  <input name="id_entidad" type="hidden" value="11129" />
  <input name="id_tema"    type="hidden" value="34" />
  <input name="id_ruc"     type="hidden" value="20146657142" />
  <select name="cbo_anno" id="cbo_anno">…</select>
  <select name="cbo_mes"  id="cbo_mes">…</select>
</form>
```

**Enviarlo por POST devuelve exactamente la misma página, sin resultados.** Se probó con
`cbo_anno=2023&cbo_mes=06`: 13.208 bytes y cero enlaces a archivos.

### Lo que sí hace: delegar en SEACE

El JavaScript de la página construye la URL del buscador público:

```javascript
function enviarOsce() {
  var year  = document.getElementById("cbo_anno").value;
  var month = document.getElementById("cbo_mes").value;
  window.open('https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml?ruc_entidad=20146657142&anio=' + year + '&mes=' + month + '&theme=ongei', '_blank');
}
```

Detalle a tener en cuenta: el RUC está **incrustado en el JavaScript**, no en el campo
oculto de todas las entidades. Solo la 11129 lo tenía en `id_ruc`. Por eso el scraper lee
el RUC del formulario **cuando está** y, si no, exige que venga en la configuración: es
preferible pedirlo a inventarlo.

### Consecuencia para el diseño

`transparencia.py` hace tres cosas:

1. Lee el RUC y el nombre de la entidad de la página.
2. Si hay enlaces a archivos (pasa en otras secciones y en entidades que suben
   documentos), los descarga.
3. Si no los hay, devuelve el **puente a SEACE** y el orquestador anota una advertencia.

Devolver una lista vacía sería lo peor: parecería que la entidad no publica nada.

## 2. SEACE

```
https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml
    ?ruc_entidad=20146657142&anio=2026&mes=02&theme=ongei
```

Un cliente HTTP simple recibe **403** (69 bytes, sin `Content-Type`). No se pudo
inspeccionar el DOM.

Lo que sí se sabe:

* Es una aplicación **JavaServer Faces**: el estado viaja en campos ocultos
  (`javax.faces.ViewState`) y la paginación son postbacks de JavaScript, no URLs. Por eso
  `requests` no sirve y hace falta un navegador (Playwright).
* Pide un captcha tipo *gimpy* antes de mostrar resultados.
* El año y el mes van en la URL, así que la consulta se puede dirigir sin rellenar el
  formulario.

### Qué queda sin verificar

* **Los selectores** del campo de captcha, la imagen, el botón y el enlace de paginación.
  Están escritos como listas de candidatos en `ocos/seace.py` (`SELECTORES`). Si ninguno
  casa, el error dice cuáles se probaron.
* **Los encabezados de la tabla de resultados.** `COLUMNAS_SEACE` incluye varias formas
  por si el rótulo cambia.
* **El acierto real del captcha.** No se puede medir sin ejecutar contra el sitio.

### Cómo cerrarlo (dos minutos)

```yaml
red:
  navegador_visible: true
```

Una consulta, mirar el inspector, y añadir los selectores que falten a `SELECTORES`.

## 3. `gimpysolver`, comprobado en PyPI

No se dio por supuesto que existiera: se consultó `https://pypi.org/pypi/gimpysolver/json`.

* Versión `0.0.18`, autor CesarCort, licencia **GPL**.
* Resumen del propio paquete: «solver to gimpy captcha types like SEACE PORTAL. The model
  has been trained with 4000 images and 92 porcent of accuracy».
* API, según su README:
  ```python
  from gimpysolver import captchaSolverRPA
  solucionador = captchaSolverRPA.captcha_solver(ruta_del_png)
  solucionador.resize()      # opcional
  texto = solucionador.predict()
  ```
* Solo lee **PNG de 380×85**. `ocos/captcha.py` reescala y convierte a PNG antes de
  llamarlo, y guarda la imagen cada vez que falla.

## 4. Alternativa recomendada

Existe una vía oficial de **datos abiertos de OSCE**
(`contratacionesabiertas.osce.gob.pe/descargas`) que no necesita captcha ni navegador y es
mucho más estable. Debería ser la vía principal y SEACE el respaldo. No se ha
implementado en esta entrega.
