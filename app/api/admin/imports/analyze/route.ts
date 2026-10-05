import { z } from 'zod';

import { ErrorDeNegocio, okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { analizar } from '@/services/importService';

/**
 * FASE 1 del importador: analizar el archivo subido.
 *
 * No inserta ninguna orden. Guarda el archivo original y devuelve la propuesta
 * de mapeo, la vista previa y los hallazgos para que el administrador decida.
 */

// SheetJS y el acceso a disco requieren el runtime Node, no Edge.
export const runtime = 'nodejs';

/** Límite de tamaño. Un libro mensual del portal no llega ni de lejos. */
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

const camposSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  importType: z.enum(['ORDENES_COMPRA', 'ORDENES_SERVICIO', 'CONSOLIDADO']),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const usuario = await requierePermiso('imports:write');

    let formulario: FormData;
    try {
      formulario = await request.formData();
    } catch {
      throw new ErrorDeNegocio('Se esperaba un formulario multipart con el archivo.');
    }

    const archivo = formulario.get('archivo');
    if (!(archivo instanceof File)) {
      throw new ErrorDeNegocio('Falta el archivo a importar.');
    }
    if (archivo.size === 0) {
      throw new ErrorDeNegocio('El archivo está vacío.');
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      const mb = Math.round(TAMANO_MAXIMO_BYTES / 1024 / 1024);
      throw new ErrorDeNegocio(`El archivo supera el límite de ${mb} MB.`);
    }

    const campos = camposSchema.safeParse({
      year: formulario.get('year'),
      month: formulario.get('month'),
      importType: formulario.get('importType'),
    });

    if (!campos.success) {
      throw new ErrorDeNegocio('Año, mes o tipo de información inválidos.');
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    const resultado = await analizar({
      buffer,
      // El nombre solo se usa para mostrarlo y para derivar la extensión, que
      // se valida contra la lista permitida en storageService.
      originalFilename: archivo.name,
      year: campos.data.year,
      month: campos.data.month,
      importType: campos.data.importType,
      userId: usuario.id,
    });

    return okJson(resultado, 201);
  } catch (error) {
    return respuestaDeError(error);
  }
}
