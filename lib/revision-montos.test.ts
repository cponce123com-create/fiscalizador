import { describe, expect, it } from 'vitest';
import { resumenConExclusiones, requiereRevisionMonto } from '@/lib/revision-montos';

describe('resumen de la importación después de revisar los montos', () => {
  it('descuenta importes económicos y anulados sin descontar dos veces un número de fila', () => {
    const summary = { registeredCents: 10_100_000, cancelledCents: 50_000, consideredCents: 10_050_000 };
    const filas = [{ sourceRow: 2, registeredCents: 10_000_000, cancelledCents: 0 },
      { sourceRow: 3, registeredCents: 50_000, cancelledCents: 50_000 }];
    expect(resumenConExclusiones(summary, filas, new Set([2, 2, 3, 999]))).toEqual({
      registeredCents: 50_000, cancelledCents: 0, consideredCents: 50_000,
    });
    expect(summary.consideredCents).toBe(10_050_000);
  });

  it('incluye las filas que no caben en los primeros 500 hallazgos', () => {
    const filas = Array.from({ length: 601 }, (_, i) => ({ sourceRow: i + 2, registeredCents: 100, cancelledCents: 0 }));
    expect(resumenConExclusiones({ registeredCents: 60_100, cancelledCents: 0, consideredCents: 60_100 }, filas, new Set([602])).consideredCents).toBe(60_000);
  });

  it('distingue alertas de monto de otras advertencias', () => {
    expect(requiereRevisionMonto([{ code: 'MONTO_ALTO' }])).toBe(true);
    expect(requiereRevisionMonto([{ code: 'MONTO_ATIPICO' }])).toBe(true);
    expect(requiereRevisionMonto([{ code: 'MONTO_COINCIDE_RUC' }])).toBe(true);
    expect(requiereRevisionMonto([{ code: 'RUC_DIGITO_VERIFICADOR' }])).toBe(false);
  });
});
