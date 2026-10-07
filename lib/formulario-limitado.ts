import { ErrorDeNegocio } from '@/lib/errors';
/** Limita los bytes reales, incluso sin Content-Length o con un valor falsificado. */
export async function leerFormularioLimitado(request: Request, maxBytes: number): Promise<FormData> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ErrorDeNegocio('El archivo supera el tamaño permitido.');
  if (!request.body) throw new ErrorDeNegocio('Falta el formulario.');
  const reader = request.body.getReader();
  const partes: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new ErrorDeNegocio('El archivo supera el tamaño permitido.'); }
      partes.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  return new Response(new Blob(partes), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
}
