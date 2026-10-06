# Interfaz ciudadana

## Diseño público y cinta de titulares

El portal usa el escudo de San Ramón proporcionado por el propietario, convertido a WebP en `public/identidad/escudo-san-ramon.webp`, y una paleta verde con acentos dorados. Se presenta como vigilancia ciudadana independiente; el escudo identifica la municipalidad consultada.

En **Administración → Apariencia y titulares** (`/admin/apariencia`), una cuenta SUPERADMIN puede configurar el nombre de la municipalidad, activar o desactivar la cinta, escribir un titular de hasta 280 caracteres, añadir un enlace opcional y elegir velocidad lenta, normal o rápida. Guardar publica los cambios en todo el portal. La cinta está desactivada inicialmente; no se publica ningún anuncio de ejemplo. El enlace debe ser una ruta interna o una URL http/https sin credenciales. Los cambios requieren `settings:manage` y quedan registrados en auditoría junto con la configuración, en una misma transacción.

Los lectores pueden pausar la cinta con su botón; también se pausa al pasar el puntero o enfocar su enlace. Con movimiento reducido, el texto se muestra estático y permite varias líneas. La configuración utiliza la tabla `AppSetting` existente y no requiere una migración nueva.
