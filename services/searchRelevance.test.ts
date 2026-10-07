import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerFiltros } from '@/lib/filtros';
describe.skipIf(process.env.INTEGRATION_TESTS_ENABLED !== '1')('relevancia con PostgreSQL y columna calculada', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let listar: typeof import('./statisticsService').listarOrdenes;
  let supplierId = ''; let batchId = '';
  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma')); ({ listarOrdenes: listar } = await import('./statisticsService'));
    const marca = String(Date.now());
    const s = await prisma.supplier.create({ data: { ruc: '20944444444', name: 'PRUEBA IPAD', normalizedName: 'PRUEBA IPAD', slug: 'prueba-busqueda-' + marca } }); supplierId = s.id;
    const b = await prisma.importBatch.create({ data: { filename: 'prueba.xlsx', originalFilename: 'prueba.xlsx', year: 1994, month: 1, period: '1994-01', checksum: marca, importType: 'CONSOLIDADO', isCurrent: true, status: 'COMPLETED' } }); batchId = b.id;
    await prisma.order.createMany({ data: [
      { orderNumber: 'A', description: 'Adquisición de IPAD, modelo de prueba', issueDate: new Date('1994-01-01') },
      { orderNumber: 'B', description: 'Local EQUIPADO para actividad', issueDate: new Date('1994-01-03') },
      { orderNumber: 'C', description: 'Servicio distinto', issueDate: new Date('1994-01-04') },
    ].map((o, i) => ({ ...o, supplierId, importBatchId: batchId, ruc: s.ruc, rawData: {}, dedupeKey: marca + i })) });
  });
  afterAll(async () => { if (!prisma) return; if (batchId) await prisma.importBatch.deleteMany({ where: { id: batchId } }); if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } }); });
  it('IPAD aparece antes que EQUIPADO aunque sea más antiguo, incluyendo páginas y minúsculas', async () => {
    const f = leerFiltros({ texto: 'iPad', proveedor: supplierId, porPagina: '1' });
    expect((await listar(f)).filas.map(o => o.orderNumber)).toEqual(['A']);
    expect((await listar({ ...f, pagina: 2 })).filas.map(o => o.orderNumber)).toEqual(['B']);
    expect((await listar({ ...f, pagina: 3 })).filas.map(o => o.orderNumber)).toEqual(['C']);
    expect((await listar(f)).total).toBe(3);
  });
  it('respeta orden de fecha explícito e ignora tildes en descripción', async () => {
    expect((await listar(leerFiltros({ texto: 'iPad', proveedor: supplierId, orden: 'fecha' }))).filas[0].orderNumber).toBe('C');
    expect((await listar(leerFiltros({ texto: 'adquisicion', proveedor: supplierId }))).filas[0].orderNumber).toBe('A');
  });
  it('mantiene automáticamente la búsqueda al actualizar una descripción', async () => {
    const fila = await prisma.order.findFirstOrThrow({ where: { importBatchId: batchId, orderNumber: 'A' } });
    await prisma.order.update({ where: { id: fila.id }, data: { description: 'Compra de TABLET' } });
    expect((await listar(leerFiltros({ texto: 'tablet', proveedor: supplierId }))).filas[0].orderNumber).toBe('A');
  });
});
