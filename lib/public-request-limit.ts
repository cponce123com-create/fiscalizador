type Clase = 'export' | 'search' | 'image';
const proceso = globalThis as typeof globalThis & { fiscalizadorPublicLimits?: Record<Clase, { inicio: number; peticiones: number; activas: number }> };
const estado = proceso.fiscalizadorPublicLimits ??= { image: { inicio: 0, peticiones: 0, activas: 0 }, export: { inicio: 0, peticiones: 0, activas: 0 }, search: { inicio: 0, peticiones: 0, activas: 0 } };
/** Protección del proceso antes de abrir conexiones. Compartida entre ambos exportadores. */
export async function peticionPublicaLimitada(clase: Clase, ejecutar: () => Promise<Response>): Promise<Response> {
  const e = estado[clase];
  const ahora = Date.now();
  if (ahora - e.inicio >= 60_000) { e.inicio = ahora; e.peticiones = 0; }
  const maxPeticiones = clase === 'image' ? 40 : clase === 'export' ? 20 : 180;
  const maxActivas = clase === 'search' ? 3 : 2;
  if (e.peticiones >= maxPeticiones || e.activas >= maxActivas) return Response.json({ error: 'Demasiadas consultas. Intenta nuevamente en un momento.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((60_000 - (ahora - e.inicio)) / 1000))), 'Cache-Control': 'no-store' } });
  e.peticiones++; e.activas++;
  try { return await ejecutar(); } finally { e.activas--; }
}
