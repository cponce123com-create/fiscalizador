/** Mensajes controlados: nunca devolver cuerpos del proveedor, SQL ni credenciales. */
export function errorIA(error: unknown): { code: string; mensaje: string; status: number } {
  const code = error instanceof Error ? error.message : '';
  const mensajes: Record<string, [string, number]> = {
    IA_CONFIG: ['Revisa AI_BASE_URL (URL HTTPS), AI_API_KEY y AI_MODEL en Render y vuelve a desplegar.', 503],
    IA_AUTH: ['El proveedor rechazó la clave de IA. Revisa AI_API_KEY en Render.', 503],
    IA_MODELO: ['El proveedor no encontró el modelo o la ruta. Revisa AI_MODEL y AI_BASE_URL.', 503],
    IA_PARAMETROS: ['El proveedor rechazó los parámetros. Verifica que AI_MODEL admita Chat Completions y salida JSON.', 503],
    IA_CUOTA: ['El proveedor de IA alcanzó su cuota o límite de peticiones. Revisa el saldo y los límites de tu cuenta.', 429],
    IA_TIEMPO: ['El proveedor de IA tardó demasiado. Intenta nuevamente o utiliza el buscador global.', 504],
    IA_RED: ['No se pudo conectar con el proveedor de IA desde el servidor.', 503],
    IA_PROVEEDOR: ['El proveedor de IA no está disponible temporalmente.', 503],
    IA_TRUNCADA: ['El modelo agotó la salida antes de completar el JSON. Usa un modelo sin razonamiento extendido en AI_MODEL.', 502],
    IA_RESPUESTA: ['El modelo no devolvió filtros válidos. Prueba una pregunta más concreta o un modelo compatible con JSON.', 502],
    IA_CONTEXTO: ['El catálogo excede el tamaño admitido por el asistente. El administrador debe revisar su configuración.', 503],
    IA_LIMITE: ['Se alcanzó el presupuesto del asistente. El buscador global sigue disponible.', 429],
    IA_DESACTIVADA: ['Activa el asistente en Admin → IA y guarda la configuración antes de probarlo.', 503],
    IA_NO_ADMITIDA: ['Puedo consultar proveedores, categorías, municipalidades y años. Reformula la pregunta con esos datos.', 400],
  };
  const conocido = mensajes[code];
  return conocido ? { code, mensaje: conocido[0], status: conocido[1] } : { code: 'IA_CONSULTA', mensaje: 'No se pudo consultar los datos. Intenta nuevamente o utiliza el buscador global.', status: 503 };
}
