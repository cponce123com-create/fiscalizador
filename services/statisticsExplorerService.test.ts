import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe.skipIf(process.env.INTEGRATION_TESTS_ENABLED !== '1')('comparaciones por etapa con PostgreSQL aislado', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let gestionId = ''; let loteId = ''; let antiguoId = ''; let estadoId = ''; let ignoradoId = '';
  const proveedores: string[] = [];
  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    const marca = String(Date.now());
    gestionId = (await prisma.managementPeriod.create({ data: { name: 'ETAPAS-' + marca, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31') } })).id;
    estadoId = (await prisma.orderStatus.create({ data: { code: 'ETAPA-' + marca, label: 'Económico prueba', countsEconomically: true } })).id;
    ignoradoId = (await prisma.orderStatus.create({ data: { code: 'IGNORADO-' + marca, label: 'No económico prueba', countsEconomically: false } })).id;
    for (const [i, ruc] of ['10997766441', '20997766551', '00997766551'].entries()) {
      proveedores.push((await prisma.supplier.create({ data: { ruc, name: 'PROVEEDOR ETAPA ' + i, normalizedName: 'PROVEEDOR ETAPA ' + i, slug: 'etapas-' + marca + '-' + i } })).id);
    }
    const base = { filename: 'etapas.xlsx', originalFilename: 'etapas.xlsx', year: 2024, month: 1, period: '2024-01', managementPeriodId: gestionId, importType: 'CONSOLIDADO' as const, status: 'COMPLETED' as const };
    loteId = (await prisma.importBatch.create({ data: { ...base, version: 2, isCurrent: true, checksum: marca } })).id;
    antiguoId = (await prisma.importBatch.create({ data: { ...base, version: 1, isCurrent: false, checksum: marca + '-antiguo' } })).id;
    const filas = [
      { supplierId: proveedores[0], issueDate: new Date('2024-01-01'), amount: '100' },
      { supplierId: proveedores[1], issueDate: new Date('2024-04-09'), amount: '200' }, // día 100, año bisiesto
      { supplierId: proveedores[0], issueDate: new Date('2024-04-10'), amount: '300' }, // día 101
      { supplierId: proveedores[2], issueDate: new Date('2025-01-01'), amount: '400' },
      { supplierId: proveedores[1], issueDate: new Date('2025-12-31'), amount: '500' },
      { supplierId: proveedores[0], issueDate: new Date('2026-01-01'), amount: '600' }, // fuera del último año
      { supplierId: proveedores[0], issueDate: new Date('2024-01-02'), amount: '900', isCancelled: true },
      { supplierId: proveedores[0], issueDate: new Date('2024-01-03'), amount: '800', statusId: ignoradoId },
      { supplierId: proveedores[0], issueDate: null, amount: '50' },
    ];
    await prisma.order.createMany({ data: filas.map((f, i) => ({ statusId: estadoId, ...f, ruc: ['10997766441', '20997766551', '00997766551'][proveedores.indexOf(f.supplierId)], managementPeriodId: gestionId, importBatchId: loteId, orderNumber: 'ETAPA-' + i, rawData: {}, dedupeKey: marca + '-' + i })) });
    await prisma.order.create({ data: { supplierId: proveedores[0], ruc: '10997766441', managementPeriodId: gestionId, importBatchId: antiguoId, statusId: estadoId, issueDate: new Date('2024-01-01'), amount: '99999', orderNumber: 'ANTIGUA', rawData: {}, dedupeKey: marca + '-vieja' } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.importBatch.deleteMany({ where: { id: { in: [loteId, antiguoId].filter(Boolean) } } });
    await prisma.supplier.deleteMany({ where: { id: { in: proveedores } } });
    await prisma.orderStatus.deleteMany({ where: { id: { in: [estadoId, ignoradoId].filter(Boolean) } } });
    if (gestionId) await prisma.managementPeriod.deleteMany({ where: { id: gestionId } });
  });
  it('respeta el día 100 inclusive, los límites del año final, la cobertura y los montos económicos vigentes', async () => {
    const { estadisticasPorEtapa } = await import('./statisticsExplorerService');
    const filas = (await estadisticasPorEtapa()).filter(f => f.id === gestionId);
    expect(filas).toHaveLength(9);
    const inicio10 = filas.find(f => f.ventana === 'primeros-100' && f.grupo === '10')!;
    expect(inicio10.considerado).toBe('100.00');
    expect(inicio10.anulado).toBe('900.00');
    expect(inicio10.ordenes).toBe(3);
    expect(inicio10.hasta).toBe('2024-04-09');
    expect(inicio10.meses).toBe(1);
    expect(inicio10.esperados).toBe(4);
    expect(filas.find(f => f.ventana === 'primeros-100' && f.grupo === '20')?.considerado).toBe('200.00');
    expect(filas.find(f => f.ventana === 'ultimo-anio' && f.grupo === '10')?.considerado).toBe('0.00');
    expect(filas.find(f => f.ventana === 'ultimo-anio' && f.grupo === '20')?.considerado).toBe('500.00');
    expect(filas.find(f => f.ventana === 'ultimo-anio' && f.grupo === 'otros')?.considerado).toBe('400.00');
    expect(filas.find(f => f.ventana === 'gestion' && f.grupo === '10')?.considerado).toBe('1050.00');
    expect(filas.find(f => f.ventana === 'ultimo-anio')?.meses).toBe(0);
  });
  it('filtra ambos rankings por RUC y gestión y calcula el peso dentro del subconjunto', async () => {
    const { rankingProveedores, rankingCompleto, datosPortadaInicial } = await import('./statisticsService');
    const { leerFiltros } = await import('@/lib/filtros');
    for (const [tipoRuc, proveedor, monto] of [['10', proveedores[0], '1050.00'], ['20', proveedores[1], '700.00']] as const) {
      const portada = await rankingProveedores(5, gestionId, tipoRuc);
      expect(portada).toHaveLength(1);
      expect(portada[0]).toMatchObject({ supplierId: proveedor, considerado: monto, peso: 100 });
      const completo = await rankingCompleto(leerFiltros({ gestion: gestionId, tipoRuc }));
      expect(completo.total).toBe(1);
      expect(completo.filas[0]).toMatchObject({ supplierId: proveedor, considerado: monto, peso: 100, posicion: 1 });
      expect((await datosPortadaInicial(gestionId, tipoRuc)).ranking).toEqual(portada);
      expect(await rankingProveedores(5, 'gestion-sin-datos', tipoRuc)).toEqual([]);
    }
    expect(await rankingProveedores(5, gestionId)).toHaveLength(3);
  });
  it('señala un último año que aún no comienza', async () => {
    await prisma.managementPeriod.update({ where: { id: gestionId }, data: { endDate: new Date('2099-12-31') } });
    try {
      const { estadisticasPorEtapa } = await import('./statisticsExplorerService');
      const final = (await estadisticasPorEtapa()).find(f => f.id === gestionId && f.ventana === 'ultimo-anio')!;
      expect(final.iniciada).toBe(false);
      expect(final.esperados).toBe(0);
      expect(final.desde).toBe('2099-01-01');
    } finally { await prisma.managementPeriod.update({ where: { id: gestionId }, data: { endDate: new Date('2025-12-31') } }); }
  });
});
