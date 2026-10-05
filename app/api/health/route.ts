// =============================================================================
// Endpoint de salud
// =============================================================================
// Lo usa el health check de Render. Comprueba de verdad la base de datos: un
// endpoint que solo devolviera 200 sin consultar nada reportaría "sano" aunque
// Neon estuviera caído, y Render no reiniciaría el servicio cuando hace falta.
//
// Devuelve 503 si la base no responde, que es lo que Render interpreta como
// servicio no sano.

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Nunca se cachea: un health check cacheado no sirve para nada.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ ok: true, base: 'accesible' }, { status: 200 });
  } catch {
    // Sin detalles internos: solo se informa de que la base no responde.
    return Response.json({ ok: false, base: 'inaccesible' }, { status: 503 });
  }
}
