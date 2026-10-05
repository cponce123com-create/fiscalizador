import { z } from 'zod';

/**
 * Cliente de la API del importador para el navegador.
 *
 * Las respuestas se validan con Zod en lugar de confiarlas mediante un cast.
 * Motivo: un cast solo afirma una forma, no la comprueba. Si el servidor cambia
 * o devuelve algo inesperado, aquí se detecta con un mensaje claro en lugar de
 * fallar más tarde en mitad del renderizado con un error incomprensible.
 */

const severidadSchema = z.enum(['ERROR', 'WARNING', 'INFO']);

export const issueSchema = z.object({
  severity: severidadSchema,
  code: z.string(),
  message: z.string(),
  sourceRow: z.number(),
  columnName: z.string().nullish(),
  rawValue: z.string().nullish(),
});

const columnaSchema = z.object({
  position: z.number(),
  originalName: z.string(),
  field: z.string().nullable(),
  confidence: z.number(),
  matchedBy: z.enum(['EXACTO', 'ALIAS', 'SIMILITUD']).nullable(),
  dataType: z.string(),
  isRequired: z.boolean(),
  isPublic: z.boolean(),
  sampleValues: z.array(z.string()),
});

const resumenSchema = z.object({
  totalRows: z.number(),
  successfulRows: z.number(),
  warningRows: z.number(),
  errorRows: z.number(),
  cancelledRows: z.number(),
  registeredCents: z.number(),
  cancelledCents: z.number(),
  consideredCents: z.number(),
});

const previewSchema = z.object({
  sourceRow: z.number(),
  orderNumber: z.string(),
  ruc: z.string().nullable(),
  supplierName: z.string().nullable(),
  amount: z.string().nullable(),
  issueDate: z.string().nullable(),
  statusRaw: z.string().nullable(),
  isCancelled: z.boolean(),
  issues: z.array(issueSchema),
});

const lotePrevioSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  period: z.string(),
  version: z.number(),
  status: z.string(),
  totalRows: z.number(),
});

export const analizarRespuestaSchema = z.object({
  importBatchId: z.string(),
  checksum: z.string(),
  sheetName: z.string(),
  sheetNames: z.array(z.string()),
  headerRowIndex: z.number(),
  version: z.number(),
  columns: z.array(columnaSchema),
  camposFaltantes: z.array(z.string()),
  preview: z.array(previewSchema),
  summary: resumenSchema,
  issues: z.array(issueSchema),
  lotesMismoPeriodo: z.array(lotePrevioSchema),
  loteMismoChecksum: lotePrevioSchema.nullable(),
});

export const confirmarRespuestaSchema = z.object({
  importBatchId: z.string(),
  status: z.enum(['COMPLETED', 'COMPLETED_WITH_WARNINGS']),
  ordenesInsertadas: z.number(),
  proveedoresCreados: z.number(),
  proveedoresExistentes: z.number(),
  variantesDetectadas: z.number(),
  summary: resumenSchema,
});

export type AnalizarRespuesta = z.infer<typeof analizarRespuestaSchema>;
export type ConfirmarRespuesta = z.infer<typeof confirmarRespuestaSchema>;
export type IssueRespuesta = z.infer<typeof issueSchema>;
export type ResumenRespuesta = z.infer<typeof resumenSchema>;
export type ColumnaRespuesta = z.infer<typeof columnaSchema>;
export type PreviewRespuesta = z.infer<typeof previewSchema>;

/**
 * Forma mínima de un esquema Zod, expresada estructuralmente.
 *
 * Se evita depender del tipo genérico exacto de Zod: así el cliente no se rompe
 * si cambia su firma entre versiones.
 */
type Esquema<T> = {
  safeParse: (valor: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

/** Extrae el mensaje de error de una respuesta fallida, sin usar casts. */
function mensajeDeError(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;
  if (!('error' in cuerpo)) return null;

  const posible = cuerpo.error;
  return typeof posible === 'string' ? posible : null;
}

/**
 * Hace una petición y devuelve el cuerpo validado.
 *
 * Los errores de la API (401, 403, 404, 409, 500) se propagan como excepciones
 * con el mensaje que escribió el servidor: nunca se tragan.
 */
export async function pedirJson<T>(
  url: string,
  opciones: RequestInit,
  esquema: Esquema<T>,
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw new Error('No se pudo contactar con el servidor. Revisa tu conexión.');
  }

  const cuerpo: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(mensajeDeError(cuerpo) ?? `La petición falló con el código ${respuesta.status}.`);
  }

  const parsed = esquema.safeParse(cuerpo);
  if (!parsed.success) {
    throw new Error('La respuesta del servidor no tiene el formato esperado.');
  }

  return parsed.data;
}
