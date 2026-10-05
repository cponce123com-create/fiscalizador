import { ErrorDeNegocio, okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { detectarPeriodo } from '@/services/importService';

/**
 * Deduce el periodo de un libro a partir de su contenido.
 *
 * Es la pieza que hace usable la carga por lotes: al arrastrar doce libros, la
 * interfaz necesita saber a qué mes corresponde cada uno antes de analizarlo, para
 * que el administrador no tenga que elegir doce meses a mano.
 *
 * **No escribe nada**: ni base de datos, ni archivo original. Solo lee y responde.
 * Por eso es seguro llamarlo para cada archivo soltado.
 */

export const runtime = 'nodejs';

/** Mismo límite que el análisis: un libro mensual no llega ni de lejos. */
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    await requierePermiso('imports:write');

    let formulario: FormData;
    try {
      formulario = await request.formData();
    } catch {
      throw new ErrorDeNegocio('Se esperaba un formulario multipart con el archivo.');
    }

    const archivo = formulario.get('archivo');
    if (!(archivo instanceof File)) {
      throw new ErrorDeNegocio('Falta el archivo del que deducir el periodo.');
    }
    if (archivo.size === 0) {
      throw new ErrorDeNegocio('El archivo está vacío.');
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      const mb = Math.round(TAMANO_MAXIMO_BYTES / 1024 / 1024);
      throw new ErrorDeNegocio(`El archivo supera el límite de ${mb} MB.`);
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const resultado = await detectarPeriodo(buffer, archivo.name);

    return okJson(resultado, 200);
  } catch (error) {
    return respuestaDeError(error);
  }
}
