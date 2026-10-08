# Sección «¿Y la prensa cuánto cobra?»

La portada muestra seis entradas y enlaza al listado completo en `/prensa`. El menú público incluye el mismo enlace. El listado tiene búsqueda inmediata por nombre, apellido, medio o RUC y un filtro para mostrar solo entradas con órdenes publicadas.

## Listado de seguimiento

`data/prensa.json` contiene los 42 nombres y RUC aportados para esta sección: 35 personas naturales y 7 empresas. Es un listado de consulta, no un registro de empleados municipales. No se incorporan los montos, acusaciones, afirmaciones de fallecimiento ni relaciones societarias del texto aportado.

Para añadir o corregir una entrada, modifica su nombre y RUC en ese archivo. El RUC identifica la entrada y no debe repetirse. `lib/prensa.ts` extrae internamente los ocho dígitos del DNI en un RUC 10, conservando ceros iniciales. Este dato no se añade a la respuesta pública del listado; las fichas existentes conservan sus controles de publicación por dato.

## Cruce y montos

`services/pressService.ts` cruza el listado por **RUC exacto** con `CurrentOrder`, la misma vista de órdenes vigentes publicadas que usa el ranking. Abarca todos los periodos disponibles, sin depender del filtro de gestión del ranking de la portada.

Los montos se recalculan al consultar la página. No requieren sincronizar el listado después de una importación. Se excluyen versiones sustituidas y registros que la vista no publica. El monto considerado excluye órdenes anuladas y estados que no cuentan económicamente. Las sumas usan `Prisma.Decimal` y se presentan con dos decimales.

Una coincidencia abre `/proveedores/{slug}`, la ficha contractual existente, con todas sus órdenes paginadas y documentos de origen. Así no se crea un segundo perfil del mismo proveedor. Una entrada sin coincidencias abre `/prensa/{ruc}`; cuando aparecen órdenes publicadas, esa ruta redirige a la ficha contractual.

Las empresas mantienen sus propios montos. No se atribuyen sus órdenes a supuestos propietarios o representantes por semejanza de nombre. Las fotos se sirven por el endpoint público existente únicamente cuando cumplen los controles de publicación del perfil.

Una orden no acredita un pago efectivo. «Sin coincidencias» significa ausencia de registros en la cobertura disponible; no demuestra ausencia de contratos con otras entidades o periodos sin libros importados.

## Verificación

Las pruebas cubren el catálogo, extracción del DNI, cruce exacto, decimales, RUC duplicados, fichas sin órdenes y enlaces públicos. La integración reutiliza un libro de prueba y sus versiones para comprobar que las órdenes antiguas no se duplican y que las anuladas no suman. No requiere migraciones ni escribir en la base de producción durante el desarrollo.
