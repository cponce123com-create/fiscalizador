/** La descarga pública se limita a libros individuales por mes. */
export async function GET(): Promise<Response> {
  return Response.json({ error: 'La descarga masiva está deshabilitada. Descarga los libros mensuales desde Fuentes y cobertura.', fuentes: '/fuentes' }, { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
