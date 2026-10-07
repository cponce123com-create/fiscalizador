import { describe, expect, it } from 'vitest';
import { leerFormularioLimitado } from './formulario-limitado';
describe('formulario con bytes limitados', () => {
  it('rechaza cuerpos sin Content-Length al exceder el límite real', async () => {
    const request = new Request('https://ejemplo.test', { method: 'POST', body: 'x'.repeat(100), headers: { 'content-type': 'multipart/form-data; boundary=test' } });
    await expect(leerFormularioLimitado(request, 50)).rejects.toThrow('tamaño permitido');
  });
  it('conserva un formulario dentro del límite', async () => {
    const form = new FormData(); form.set('campo', 'valor');
    const result = await leerFormularioLimitado(new Request('https://ejemplo.test', { method: 'POST', body: form }), 1024);
    expect(result.get('campo')).toBe('valor');
  });
});
