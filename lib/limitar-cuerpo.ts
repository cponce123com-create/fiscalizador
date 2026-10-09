import { NextResponse, type NextRequest } from 'next/server';

const LIMITE_BYTES = 25 * 1024 * 1024;
const HOLGURA_MULTIPART_BYTES = 64 * 1024;
const METODOS_SIN_CUERPO = new Set(['GET', 'HEAD', 'OPTIONS']);

export function limitarCuerpo(request: NextRequest): NextResponse | null {
  if (METODOS_SIN_CUERPO.has(request.method)) return null;

  const contentLength = request.headers.get('content-length');
  if (!contentLength) return null;

  const tamano = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(tamano)) return null;

  if (tamano > LIMITE_BYTES + HOLGURA_MULTIPART_BYTES) {
    return NextResponse.json(
      {
        error: 'Solicitud demasiado grande.',
        limite: LIMITE_BYTES,
      },
      { status: 413 },
    );
  }

  return null;
}
