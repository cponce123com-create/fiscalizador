# Asistente ciudadano — primera entrega

Bloque bajo el buscador global y antes del selector municipal. Alcance independiente de la municipalidad seleccionada: todas las entidades activas salvo las que indique explícitamente la pregunta. Pantalla administrativa `/admin/ia`, solo `settings:manage`.

## Configuración

En Render (variables de servidor, nunca NEXT_PUBLIC):

```
AI_BASE_URL=https://radoxai.com/v1
AI_API_KEY=clave_nueva_del_proveedor
AI_MODEL=identificador_exacto_del_modelo
```

Elegir un modelo de chat sin razonamiento extendido, con salida JSON y soporte de `max_tokens`: el límite de 500 incluye razonamiento y puede dejar una respuesta vacía en modelos que lo utilizan. Verificar el catálogo real de la cuenta. No se configura una clave ni se activa públicamente de forma automática. Una clave publicada en un chat debe sustituirse. No copiarla al repo.

Documentación consultada: https://radoxai.com/docs y https://radoxai.com/ (19/10/2026). La compatibilidad declarada es con Chat Completions. La conexión real no se probó sin credenciales. El cupo del proveedor y los tokens de este panel son contadores distintos: comprobar el presupuesto disponible si la misma clave se usa en otros proyectos.

## Flujo

Pregunta (8–400 caracteres) → interpretación JSON validada → filtros parametrizados → PostgreSQL → tarjetas y enlaces. No se envían filas, perfiles privados, familiares o notas a Radox. Se envía el texto escrito por el visitante y un catálogo público de entidades/categorías, informado junto al formulario. El proveedor puede tratar ese texto según sus políticas.

Los resultados no son prosa generada: nombres, cantidades e importes proceden de la consulta. El usuario ve los filtros interpretados para detectar interpretaciones equivocadas. Se consultan CurrentOrder, entidades activas, estados con efecto económico, sin anuladas ni libros pendientes de revisión. Años por fecha de emisión; grupos por proveedor, municipalidad y gestión. Máximo 50 grupos y 10 órdenes de ejemplo. No equivale a pago confirmado, cobertura completa ni prueba de parentesco o delito.

Se reutilizan interpretaciones siete días, mediante hash de pregunta/modelo/catálogo (sin texto original almacenado). Los datos económicos siempre se consultan de nuevo: no requieren invalidación al importar. No se necesita migración: configuración, presupuesto e interpretaciones usan AppSetting.

## Límites

Reservas de 12000 tokens antes de cada llamada, transacción con bloqueo asesor y contadores persistentes por día/mes en horario de Lima. Se reserva de forma conservadora y no se devuelve por fallos. Presupuesto por defecto 120000 diarios / 1000000 mensuales. Prompt limitado a 10500 bytes + salida 500 tokens; sin herramientas ni razonamiento solicitado. Verificar compatibilidad y contabilidad del modelo antes de activación pública.

4 solicitudes/minuto por cliente y 30 globales por proceso; máximo dos simultáneas. Los límites locales no son distribuidos; el presupuesto sí es compartido por Neon. Una IP no disponible agrupa clientes por señal de cabeceras, como el límite público existente. SQL con timeout de 7 segundos por sentencia. Clave solo en servidor. Sin reintentos automáticos que dupliquen costes.

## Activación y pruebas de aceptación

1. Configurar variables y desplegar.
2. Activar para pruebas administrativas, manteniendo visitantes desactivados.
3. Probar un proveedor conocido, un año, dos municipios y una categoría. Contrastar montos y órdenes con sus fuentes.
4. Probar una pregunta sobre familiares/delitos y una municipalidad inexistente: no deben inventarse resultados.
5. Verificar fallo del proveedor, límite de presupuesto y desactivación. El buscador normal debe seguir funcionando.
6. Activar visitantes solo después de verificar modelo y calidad.

## Siguientes entregas del plan

Clasificación avanzada de prensa con revisión humana, procesamiento de órdenes confirmadas y resúmenes persistentes en perfiles aún no se incluyen. Esta entrega cubre la conexión, consulta controlada, control administrativo y primer bloque público. No se ejecutan trabajos automáticos al importar ni se cambian categorías existentes.
