import { describe, expect, it } from 'vitest';

import { fechaMaximaPadron, parsearPadronOece } from './oeceCatalogParser';

const CABECERA = 'RUC|NOMBRE_DE_ENTIDAD|DEPARTAMENTO|PROVINCIA|DISTRITO|CODIGO_SIAF|CODCONSUCODE|ESTADO|ULTIMAACTUALIZACION';

describe('parsearPadronOece', () => {
  it('lee filas pipeadas, conserva ceros y convierte fechas del padrón', () => {
    const ejemplo = [CABECERA, ...Array.from({ length: 100 }, (_, i) => `201${String(i).padStart(8, '0')}|Entidad ${i}|Junín|Chanchamayo|San Ramón|000${i}|${1000 + i}|Activo|26/02/25`)].join('\r\n');
    const filas = parsearPadronOece(ejemplo);
    expect(filas).toHaveLength(100);
    expect(filas[0].ruc).toBe('20100000000');
    expect(filas[0].sourceUpdatedAt?.toISOString()).toBe('2025-02-26T00:00:00.000Z');
    expect(fechaMaximaPadron(filas)?.toISOString()).toBe('2025-02-26T00:00:00.000Z');
  });

  it('rechaza encabezados inesperados y descargas parciales', () => {
    expect(() => parsearPadronOece(`${CABECERA}\n20100000000|Entidad`)).toThrow('Fila 2');
    expect(() => parsearPadronOece('RUC|NOMBRE\n20100000000|Entidad')).toThrow('formato esperado');
  });

  it('rechaza RUC duplicados para evitar una sincronización ambigua', () => {
    const fila = '20100000000|Entidad|Junín|Chanchamayo|San Ramón|001|1001|Activo|26/02/25';
    expect(() => parsearPadronOece([CABECERA, ...Array(100).fill(fila)].join('\n'))).toThrow('RUC duplicados');
  });
});
