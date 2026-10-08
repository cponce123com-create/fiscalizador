import { expect, it } from 'vitest';
import { GET } from './route';
it('deshabilita la descarga masiva en el servidor y dirige a los libros mensuales', async () => {
  const r = await GET();
  expect(r.status).toBe(410);
  expect(r.headers.get('Content-Disposition')).toBeNull();
  expect(await r.json()).toMatchObject({ fuentes: '/fuentes' });
});
