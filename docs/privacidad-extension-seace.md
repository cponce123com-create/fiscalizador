# Política de privacidad — Fiscalizador · Descarga anual SEACE

Última actualización: 8 de octubre de 2026. Aplicable a la extensión 1.0.1.

## Propósito y responsable

Esta extensión independiente del proyecto Fiscalizador descarga los archivos Excel mensuales de órdenes de compra y servicios publicados en SEACE para el año y la municipalidad que el usuario selecciona. No está afiliada a SEACE ni a entidades del Estado peruano.

El proyecto y su canal de contacto están disponibles en [el repositorio de Fiscalizador](https://github.com/cponce123com-create/fiscalizador). Para consultas sobre esta política, utiliza [el canal de incidencias](https://github.com/cponce123com-create/fiscalizador/issues). No adjuntes contraseñas, cookies ni información personal innecesaria a una incidencia pública.

## Información que procesa

La extensión procesa en la computadora del usuario:

- El año, RUC de la municipalidad y nombre de la municipalidad introducidos en su formulario o recibidos del panel autorizado de Fiscalizador.
- El contenido de las páginas y formularios de exportación de SEACE, incluidos el periodo y los campos técnicos necesarios para solicitar cada Excel.
- Los Excel públicos descargados, que pueden contener nombres y RUC de proveedores, fechas y montos de contratación.
- La dirección y el estado de carga de la pestaña de SEACE utilizada para descargar, así como el nombre, identificador y estado de las descargas que inicia.

Estos datos se utilizan exclusivamente para solicitar los libros, verificar su periodo, detectar archivos repetidos, mostrar el progreso y guardarlos con nombres identificables. La extensión no incorpora analítica, publicidad ni seguimiento del historial general de navegación. No solicita una cuenta propia, correo, contraseñas, datos de salud, ubicación del dispositivo ni información de pago del usuario.

## Conexiones y destinatarios

Las solicitudes de consulta y exportación se realizan directamente a `https://prod2.seace.gob.pe/` mediante HTTPS. SEACE recibe los parámetros de consulta y los datos técnicos habituales de una conexión, como la dirección IP y las cookies de sesión que el navegador gestione para ese sitio.

La extensión no utiliza la API de cookies para extraerlas ni las envía a Fiscalizador. El navegador puede enviar las cookies de SEACE al propio SEACE para completar la exportación.

El panel autorizado de Fiscalizador puede enviar a la extensión el año, RUC y municipalidad para abrir el descargador. La extensión responde con el resultado de apertura o un error; no devuelve los Excel ni su contenido al panel. No importa los libros automáticamente.

La extensión no envía los Excel, su contenido ni la configuración a servidores del desarrollador. No vende datos, no los comparte con anunciantes y no los utiliza para evaluar solvencia crediticia.

## Almacenamiento, conservación y eliminación

La configuración de la descarga, el progreso y las huellas usadas para detectar duplicados permanecen en la memoria de la pestaña del descargador y se pierden al cerrarla. La extensión no sincroniza esta información mediante Chrome Storage.

Los Excel se guardan en la computadora del usuario a través del gestor de descargas de Chrome. Permanecen allí hasta que el usuario los elimine. Chrome puede conservar su propio registro de descargas, que se administra desde el navegador.

El usuario puede detener el proceso, cerrar la pestaña del descargador, eliminar los archivos guardados y desinstalar la extensión. Desinstalarla no borra los Excel previamente descargados. El desarrollador no conserva una copia de esos archivos.

## Permisos

- **scripting:** ejecutar la función incluida en el paquete para comprobar el mes y utilizar el formulario de exportación de SEACE.
- **downloads:** guardar los Excel y comprobar que una descarga finalice antes de iniciar la siguiente.
- **Acceso a prod2.seace.gob.pe:** consultar y exportar los libros solicitados; no concede acceso a todos los sitios web.

Los scripts y la biblioteca de lectura de Excel están incluidos en el paquete de la extensión. La extensión no descarga código remoto para ejecutarlo ni evade CAPTCHA o protecciones de SEACE.

## Uso limitado y cambios

El uso de la información obtenida mediante las APIs de Chrome se limita al propósito de descarga descrito en esta política y cumple los requisitos de uso limitado de la Política de Datos de Usuario de Chrome Web Store. No se utiliza para publicidad ni se proporciona acceso al desarrollador al contenido de los libros descargados.

Las prácticas propias de SEACE, Chrome y GitHub están sujetas a sus respectivas políticas. Esta política describe la extensión, no todos los tratamientos del portal web Fiscalizador.

Si una nueva versión cambia el manejo de datos, se actualizarán esta política y las declaraciones correspondientes en Chrome Web Store.

