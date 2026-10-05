/**
 * Errores de dominio.
 *
 * Viven aquí, y no en la capa HTTP, para que los servicios puedan señalar
 * "esto no se puede hacer, y el administrador puede entender por qué" sin
 * depender de `Response` ni de códigos de estado.
 *
 * La traducción a HTTP la hace `lib/api/responses.ts`.
 */

/**
 * Un problema que el administrador puede entender y corregir.
 *
 * Su mensaje SÍ se muestra al cliente. Por eso quien lo lance debe cuidar el
 * texto: nada de detalles internos, rutas de archivos ni mensajes de Prisma.
 */
export class ErrorDeNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
  }
}

/** El recurso solicitado no existe. */
export class NoEncontrado extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'NoEncontrado';
  }
}
