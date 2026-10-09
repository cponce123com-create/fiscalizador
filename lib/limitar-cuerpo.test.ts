import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { limitarCuerpo } from './limitar-cuerpo';

function request(method: string, contentLength?: number): NextRequest {
  return new NextRequest('https://fiscalizador.local/api/admin/importaciones', {
    method,
    headers:
      contentLength === undefined ? undefined : { 'content-length': String(contentLength) },
  });
}

describe('limitarCuerpo', () => {
  it('ignora metodos sin cuerpo', () => {
    expect(limitarCuerpo(request('GET', 100 * 1024 * 1024))).toBeNull();
  });

  it('acepta solicitudes dentro del limite', () => {
    expect(limitarCuerpo(request('POST', 25 * 1024 * 1024))).toBeNull();
  });

  it('rechaza solicitudes demasiado grandes antes del parser multipart', () => {
    const respuesta = limitarCuerpo(request('POST', 26 * 1024 * 1024));

    expect(respuesta?.status).toBe(413);
  });
});
