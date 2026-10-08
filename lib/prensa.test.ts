import { describe, expect, it } from 'vitest';
import { catalogoPrensa } from './prensa';

describe('listado de prensa aportado', () => {
  it('conserva las 42 identidades contractuales sin RUC duplicados', () => {
    expect(catalogoPrensa).toHaveLength(42);
    expect(new Set(catalogoPrensa.map(p => p.ruc)).size).toBe(42);
    expect(catalogoPrensa.filter(p => p.dni)).toHaveLength(35);
    for (const p of catalogoPrensa) {
      expect(p.ruc).toMatch(/^(10|20)\d{9}$/);
      expect(Object.keys(p).sort()).toEqual(['dni', 'nombre', 'ruc']);
    }
  });
  it('extrae el DNI de RUC 10 conservando ceros y deja las empresas sin DNI', () => {
    expect(catalogoPrensa.find(p => p.ruc === '10027726459')?.dni).toBe('02772645');
    expect(catalogoPrensa.find(p => p.ruc === '10454761923')?.dni).toBe('45476192');
    expect(catalogoPrensa.find(p => p.ruc === '20486447240')?.dni).toBeNull();
  });
});
