import { NoAutenticado, SinPermiso } from '@/lib/auth/session';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';

export { ErrorDeNegocio };

/**
 * Respuestas HTTP uniformes para la API.
 *
 * Regla: los mensajes de error hacia fuera NUNCA incluyen detalles internos
 * (mensajes de Prisma, rutas de archivos, cadenas de conexión). Un error 500
 * devuelve un texto genérico y el detalle queda en el registro del servidor.
 */

export function errorJson(mensaje: string, status: number, extra?: Record<string, unknown>): Response {
  return Response.json({ error: mensaje, ...extra }, { status });
}

export function okJson<T>(datos: T, status = 200): Response {
  return Response.json(datos, { status });
}

/**
 * Convierte una excepción en una respuesta HTTP.
 *
 * Se usa en el `catch` de todos los manejadores de ruta para no repetir la
 * traducción de errores de dominio a códigos de estado.
 */
export function respuestaDeError(error: unknown): Response {
  if (error instanceof NoAutenticado) {
    return errorJson(error.message, 401);
  }

  if (error instanceof SinPermiso) {
    return errorJson(error.message, 403);
  }

  if (error instanceof NoEncontrado) {
    return errorJson(error.message, 404);
  }

  // Los errores de negocio sí se muestran: están escritos para el administrador
  // y no revelan nada interno.
  if (error instanceof ErrorDeNegocio) {
    return errorJson(error.message, 409);
  }

  console.error('Error inesperado en la API:', error);
  return errorJson('Error interno del servidor.', 500);
}
