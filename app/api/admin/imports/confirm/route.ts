import { z } from 'zod';

import { ErrorDeNegocio, okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { CAMPOS_INTERNOS, type InternalField } from '@/services/mappingService';
import { confirmar } from '@/services/importService';

/**
 * FASE 2 del importador: confirmar e insertar.
 *
 * El cuerpo NO trae filas: solo el identificador del lote y, opcionalmente, las
 * correcciones de mapeo. Las filas se releen del archivo guardado en el
 * servidor, porque la sección 25 del pliego prohíbe confiar en datos enviados
 * desde el navegador (docs/prompt.md).
 */

export const runtime = 'nodejs';

/** Valida que el campo sea uno de los conocidos, sin recurrir a un cast. */
const campoInternoSchema = z
  .string()
  .refine(
    (valor): valor is InternalField => CAMPOS_INTERNOS.some((c) => c.field === valor),
    'Campo interno desconocido.',
  );

const cuerpoSchema = z.object({
  importBatchId: z.string().min(1, 'Falta el identificador del lote.'),
  /** Confirmación explícita para importar una versión nueva de un periodo ya cargado. */
  reemplazarPeriodo: z.boolean().optional().default(false),
  sourceUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .url()
        .max(500)
        .refine((v) => /^https?:\/\//i.test(v)),
    ])
    .optional(),
  coverageComplete: z.boolean().optional(),
  /**
   * Compatibilidad con clientes anteriores. El versionado sustituye el libro
   * completo y no descarta filas contra versiones anteriores.
   */
  omitirDuplicados: z.boolean().optional().default(true),
  /**
   * Números de fila del libro que el administrador dejó fuera al revisar los
   * hallazgos. Es una DECISIÓN, no un dato: el servidor vuelve a leer el archivo y
   * descarta esas filas, así que el navegador no puede colar registros que no existen.
   */
  filasExcluidas: z.array(z.number().int().min(1).max(1_000_000)).max(20_000).optional(),
  mapping: z
    .array(
      z.object({
        position: z.number().int().min(0),
        field: campoInternoSchema.nullable(),
        isPublic: z.boolean(),
      }),
    )
    .max(200)
    .optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const usuario = await requierePermiso('imports:write');

    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      throw new ErrorDeNegocio('El cuerpo de la petición debe ser JSON.');
    }

    const parsed = cuerpoSchema.safeParse(cuerpo);
    if (!parsed.success) {
      const detalle = parsed.error.issues.map((i) => i.message).join(' ');
      throw new ErrorDeNegocio(`Petición inválida: ${detalle}`);
    }

    const resultado = await confirmar({
      importBatchId: parsed.data.importBatchId,
      userId: usuario.id,
      request,
      mappingOverride: parsed.data.mapping,
      reemplazarPeriodo: parsed.data.reemplazarPeriodo,
      sourceUrl: parsed.data.sourceUrl,
      coverageComplete: parsed.data.coverageComplete,
      omitirDuplicados: parsed.data.omitirDuplicados,
      filasExcluidas: parsed.data.filasExcluidas,
    });

    return okJson(resultado, 200);
  } catch (error) {
    return respuestaDeError(error);
  }
}
