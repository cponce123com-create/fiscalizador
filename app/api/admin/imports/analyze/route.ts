import { leerFormularioLimitado } from '@/lib/formulario-limitado';
import { z } from 'zod';

import { ErrorDeNegocio, okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { analizar } from '@/services/importService';
import { asegurarMunicipalidadActiva } from '@/services/municipalityService';

/**
 * FASE 1 del importador: analizar el archivo subido.
 *
 * No inserta ninguna orden. Guarda el archivo original y devuelve la propuesta
 * de mapeo, la vista previa y los hallazgos para que el administrador decida.
 */

// SheetJS y el acceso a disco requieren el runtime Node, no Edge.
export const runtime = 'nodejs';

/**
 * Límite de tamaño.
 *
 * Un libro mensual del portal ronda 1 MB y 4.400 filas, así que 25 MB es holgado. Pero este
 * límite es la ÚNICA protección real que hay, porque `XLSX.read` es **síncrono** y bloquea
 * el hilo de Node mientras dura. Medido en esta máquina: 4.000 filas tardan 0,8 s, 20.000
 * tardan 2,8 s, y 50.000 (33 MB, ya por encima del límite) tardan 6,7 s.
 *
 * Durante esos segundos el proceso no atiende nada más, así que se congelan también las
 * páginas públicas. Y no se puede poner un timeout que lo corte: en la medición, un
 * temporizador de 10 ms no llegó a dispararse hasta que terminó la lectura.
 *
 * Si algún día hacen falta libros más grandes, la salida no es subir este número, sino leer
 * el archivo en un hilo aparte (`node:worker_threads`) para que el portal siga respondiendo.
 */
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

const camposSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  importType: z.enum(['ORDENES_COMPRA', 'ORDENES_SERVICIO', 'CONSOLIDADO']),
  municipalityId: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const usuario = await requierePermiso('imports:write');

    let formulario: FormData;
    try {
      formulario = await leerFormularioLimitado(request, TAMANO_MAXIMO_BYTES + 64 * 1024);
    } catch (error) {
      if (error instanceof ErrorDeNegocio) throw error;
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
      municipalityId: formulario.get('municipalityId') || undefined,
    });

    if (!campos.success) {
      throw new ErrorDeNegocio('Año, mes o tipo de información inválidos.');
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const municipalityId = await asegurarMunicipalidadActiva(campos.data.municipalityId);

    const resultado = await analizar({
      buffer,
      // El nombre solo se usa para mostrarlo y para derivar la extensión, que
      // se valida contra la lista permitida en storageService.
      originalFilename: archivo.name,
      year: campos.data.year,
      month: campos.data.month,
      importType: campos.data.importType,
      municipalityId,
      userId: usuario.id,
    });

    return okJson(resultado, 201);
  } catch (error) {
    return respuestaDeError(error);
  }
}
