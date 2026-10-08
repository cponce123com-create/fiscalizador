# Compartir el portal, las estadísticas y los proveedores

## Auditoría y cambios

| Elemento | Problema encontrado | Comportamiento nuevo |
| --- | --- | --- |
| Enlace de portada | Solo usaba la imagen social; ignoraba la fotografía de portada | Prioridad: foto de portada, imagen social de respaldo, logo. Configuración tomada del admin y Cloudinary |
| Perfil de proveedor | Título de página específico, pero Open Graph heredaba el genérico del portal | Título, resumen, canónico e imagen PNG propios, con monto considerado y órdenes de todos los libros vigentes disponibles |
| Tarjetas de gastos | Sin exportación ni botones de redes | Todas las tarjetas del componente de comparación: alimentación y categorías, PNG 1200 × 630, comparación de tres gestiones y cobertura por gestión |
| Fotografías de perfiles | Imagen privada almacenada en Cloudinary | Se lee únicamente si la ficha y el campo foto están publicados y verificados. La imagen final nunca revela claves ni URL autenticada |
| Recursos del servidor | Generación de imágenes consume CPU y conexiones | Hasta 2 generaciones simultáneas y 40 solicitudes por minuto por proceso; PNG materializado antes de liberar el cupo, sin caché persistente |

Las imágenes se generan a partir de los mismos servicios de datos que las tarjetas. No hay captura del navegador, dependencia nueva, cuenta de pago ni extracción masiva CSV. El PNG se prepara solo cuando el vecino lo solicita o cuando una red consulta la vista previa. La foto del proveedor conserva proporción vertical 3:4.

El diseño social destaca las cifras y mantiene los meses disponibles, sin avisos de advertencia en el PNG. Las aclaraciones metodológicas permanecen en las páginas de detalle. El mensaje de WhatsApp usa título y montos en negrita, emojis y una sección por gestión; los metadatos eliminan las marcas de negrita y saltos de línea. La URL de imagen lleva versión para distinguir el nuevo diseño, aunque las redes pueden conservar vistas previas anteriores.

## Uso

1. Abre **Compartir en redes** debajo de una comparación o en el perfil público del proveedor. Los perfiles se alcanzan también desde el ranking y «¿Y la prensa cuánto cobra?».
2. **WhatsApp** abre un texto con título, resumen y enlace. **Facebook** abre su diálogo para compartir ese enlace; su vista previa procede de Open Graph.
3. **Preparar imagen** genera el PNG. Un segundo clic en **Compartir imagen** abre el selector del dispositivo si admite archivos. Se evita perder la activación del usuario mientras se descarga/genera la imagen.
4. Si el navegador no admite compartir archivos, **Descargar imagen** y **Copiar texto** permiten adjuntarla y pegar el resumen manualmente. Si se deniega el portapapeles, el texto queda visible para seleccionarlo.

El destino decide cómo presenta imagen, título y texto. El botón web de Facebook comparte enlaces, no adjunta automáticamente un PNG ni publica en nombre del usuario. No se puede garantizar que todas las aplicaciones conserven el texto junto a un archivo: por eso existe el botón independiente de copiar. Cancelar el selector no muestra un error.

## Datos y precisión

- El monto considerado excluye anuladas y estados no económicos, conforme a los servicios existentes. Una orden no acredita un pago efectivo ni un conflicto de intereses.
- Las tarjetas informan de meses disponibles: ausencia de libros no significa gasto cero.
- La clasificación de gastos es por descripción y una orden puede coincidir con varias categorías. Los totales de categorías no son aditivos.
- Compartir un proveedor resume **todos los libros vigentes disponibles**, aunque la tabla visible tenga filtros o paginación. El texto lo indica; el enlace apunta al perfil sin filtros.
- Solo se exportan nombre, cifras públicas, municipio y fotografía autorizada. Notas privadas, domicilio, fecha de nacimiento, claves de Cloudinary y relaciones privadas no forman parte del PNG.
- La imagen descargada es una instantánea. Revocar una foto impide nuevas generaciones con ella; no retira copias ya compartidas por terceros.

## Configuración y comprobación al desplegar

Mantener `NEXT_PUBLIC_SITE_URL=https://fiscalizador.onrender.com` (o el dominio definitivo). Next usa esta base para los enlaces absolutos de Open Graph. La portada se configura en **Admin → Apariencia y titulares**. Si falta, se usa la imagen social y luego el logo.

Verificar un enlace nuevo de portada, un proveedor con foto publicada y otro sin foto, alimentación y una categoría. Probar la descarga y el selector nativo en Android/iOS, y descarga + texto en escritorio. Las redes mantienen sus propias vistas previas: un despliegue no garantiza actualizar inmediatamente enlaces que ya consultaron. Facebook permite solicitar una nueva consulta en su Sharing Debugger.

Pruebas automatizadas: metadatos propios, textos y cobertura, rechazo de tipos/rutas desconocidos sin consultas, foto privada no leída, fallo de foto publicada tolerado, incorporación de foto autorizada vertical y PNG real de 1200 × 630.

## Alcance restante

Las tarjetas temporales y de composición RUC de Estadísticas usan otro componente y todavía no tienen exportación individual. El enlace a Estadísticas se puede compartir normalmente. El flujo nuevo cubre perfiles y todas las comparaciones de categorías de gastos.

## Referencias técnicas

- Next.js ImageResponse: https://nextjs.org/docs/app/api-reference/functions/image-response
- Web Share API y archivos/activación: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- Open Graph / Facebook: https://developers.facebook.com/docs/sharing/webmasters/
- Sharing Debugger: https://developers.facebook.com/tools/debug/
