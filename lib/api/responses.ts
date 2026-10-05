import { z } from 'zod';

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

/**
 * Traduce una excepción al mensaje que verá quien la provocó desde el panel.
 *
 * Es la versión para Server Actions de lo que `respuestaDeError` hace para la API:
 * los errores de dominio y de permiso se muestran tal cual —están escritos para
 * leerse— y un fallo inesperado NO, porque podría arrastrar detalles internos
 * (consultas, rutas) a la pantalla de un administrador.
 */
export function mensajeDeErrorDeAccion(error: unknown): string {
  if (
    error instanceof NoAutenticado ||
    error instanceof SinPermiso ||
    error instanceof NoEncontrado ||
    error instanceof ErrorDeNegocio
  ) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Datos inválidos.';
  }

  console.error('Fallo inesperado en una acción del panel:', error);
  return 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.';
}
