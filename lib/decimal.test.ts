import { describe, expect, it } from 'vitest';
import { decimalMonetario } from '@/lib/decimal';

describe('agregados monetarios exactos', () => {
  it('conserva los céntimos al sumar muchos libros', () => {
    expect(decimalMonetario('100000000000000.01')).toBe('100000000000000.01');
    expect(decimalMonetario('100000000000000.99')).toBe('100000000000000.99');
  });
  it('redondea el promedio decimal sin aproximaciones binarias', () => {
    expect(decimalMonetario('1.005')).toBe('1.01');
  });
  it.each([null, undefined, 'ilegible', Infinity])(
    'mantiene el valor neutral anterior para %s',
    (valor) => {
      expect(decimalMonetario(valor)).toBe('0.00');
    },
  );
});
