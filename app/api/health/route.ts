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
import { existeDirectorioStorage } from '@/services/storageService';

export const runtime = 'nodejs';

// Nunca se cachea: un health check cacheado no sirve para nada.
export const dynamic = 'force-dynamic';

type EstadoComponente = {
  estado: 'ok' | 'degradado' | 'caido';
  latenciaMs: number;
};

async function verificarBase(): Promise<EstadoComponente> {
  const inicio = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    return { estado: 'ok', latenciaMs: Date.now() - inicio };
  } catch {
    return { estado: 'caido', latenciaMs: Date.now() - inicio };
  }
}

async function verificarStorage(): Promise<EstadoComponente> {
  const inicio = Date.now();
  try {
    const ok = await existeDirectorioStorage();
    return { estado: ok ? 'ok' : 'degradado', latenciaMs: Date.now() - inicio };
  } catch {
    return { estado: 'degradado', latenciaMs: Date.now() - inicio };
  }
}

export async function GET(): Promise<Response> {
  const [base, almacenamiento] = await Promise.all([verificarBase(), verificarStorage()]);
  const ok = base.estado === 'ok';

  return Response.json(
    {
      ok,
      base: base.estado === 'ok' ? 'accesible' : 'inaccesible',
      estado: ok && almacenamiento.estado === 'ok' ? 'ok' : ok ? 'degradado' : 'caido',
      componentes: { base, almacenamiento },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
