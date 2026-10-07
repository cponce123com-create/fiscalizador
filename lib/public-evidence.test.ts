import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({
  prisma: {
    columnVisibility: {
      findMany: vi.fn().mockResolvedValue([{ internalField: 'description' }]),
    },
    importColumn: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ internalField: 'ruc' }, { internalField: null }]),
    },
  },
}));
import { celdaCsv, celdaMontoCsv, camposOcultos } from '@/lib/public-evidence';
describe('extracto público', () => {
  it.each([
    '=HYPERLINK("https://ejemplo.test")',
    ' +SUM(A1:A2)',
    '-1+1',
    '@SUM(A1:A2)',
    '\t=CMD()',
  ])('neutraliza fórmulas: %s', (valor) =>
    expect(celdaCsv(valor)).toMatch(/^"'/),
  );
  it('escapa comillas, saltos y separadores sin perder texto', () =>
    expect(celdaCsv('Compra, "A"\nB')).toBe('"Compra, ""A""\nB"'));
  it('no inventa cero para un monto ausente', () =>
    expect(celdaCsv(null)).toBe('""'));
  it('combina restricciones globales y del libro', async () =>
    expect(await camposOcultos('libro')).toEqual(
      new Set(['description', 'ruc']),
    ));
  it('conserva montos negativos y bloquea fórmulas que simulen números', () => {
    expect(celdaMontoCsv('-123.45')).toBe('"-123.45"');
    expect(celdaMontoCsv('-1+1')).toBe('"\'-1+1"');
    expect(celdaCsv('-123.45')).toBe('"\'-123.45"');
  });

});
