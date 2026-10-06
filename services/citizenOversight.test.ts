import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { filtrosPorDefecto } from '@/lib/filtros';
// Fixtures independientes: no dependen del libro de referencia ni de datos reales.
describe.skipIf(!process.env.DATABASE_URL)(
  'instantáneas y estadísticas ciudadanas',
  () => {
    let prisma: typeof import('@/lib/prisma').prisma;
    let imports: typeof import('@/services/importService');
    let stats: typeof import('@/services/statisticsService');
    const ids: string[] = [];
    const keys: string[] = [];
    let gestionId = '';
    let personId = '';
    let tagId = '';
    const auditados: string[] = [];
    const ruc = '20933333333';
    function libro(monto: string, estado: string) {
      const w = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        w,
        XLSX.utils.aoa_to_sheet([
          [
            'Número de orden',
            'Tipo de Orden',
            'RUC',
            'Denominación o razón Social',
            'Monto',
            'Estado',
            'Fecha de Emisión',
          ],
          [
            'CIUD-1',
            'O/C',
            ruc,
            'PRUEBA CIUDADANA',
            monto,
            estado,
            '1993-02-05',
          ],
          [],
          [
            'CIUD-2',
            'O/C',
            ruc,
            'PRUEBA CIUDADANA',
            '50',
            'Devengada',
            '1993-02-06',
          ],
        ]),
        'Evidencia',
      );
      return Buffer.from(XLSX.write(w, { type: 'array', bookType: 'xlsx' }));
    }
    async function cargar(monto: string, estado: string, reemplazar = false) {
      const b = await imports.analizar({
        buffer: libro(monto, estado),
        originalFilename: 'ciudadania-1993-02.xlsx',
        year: 1993,
        month: 2,
        importType: 'CONSOLIDADO',
        userId: null,
      });
      ids.push(b.importBatchId);
      const lote = await prisma.importBatch.findUniqueOrThrow({
        where: { id: b.importBatchId },
      });
      if (lote.storageKey) keys.push(lote.storageKey);
      await imports.confirmar({
        importBatchId: b.importBatchId,
        userId: null,
        reemplazarPeriodo: reemplazar,
        sourceUrl: 'https://ejemplo.test/libro',
        coverageComplete: true,
      });
      return b.importBatchId;
    }
    beforeAll(async () => {
      ({ prisma } = await import('@/lib/prisma'));
      imports = await import('@/services/importService');
      stats = await import('@/services/statisticsService');
      const g = await prisma.managementPeriod.create({
        data: {
          name: 'CIUDADANIA-1993',
          startDate: new Date('1993-01-01'),
          endDate: new Date('1993-12-31'),
        },
      });
      gestionId = g.id;
    });
    afterAll(async () => {
      if (!prisma) return;
      await prisma.importBatch.deleteMany({ where: { id: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.supplierManagementSummary.deleteMany({
        where: { managementPeriodId: gestionId },
      });
      await prisma.managementPeriod.deleteMany({ where: { id: gestionId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.personTag.deleteMany({ where: { id: tagId } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: auditados } },
      });
      await prisma.supplier.deleteMany({ where: { ruc } });
      const { getStorage } = await import('@/services/storageService');
      await Promise.all(keys.map((k) => getStorage().remove(k)));
    });
    it('sustituye monto y estado; conserva historia, fila física y promedio coherente', async () => {
      const primero = await cargar('100', 'Devengada');
      const segundo = await cargar('120', 'Devengada', true);
      expect(await prisma.order.count({ where: { ruc } })).toBe(4);
      expect(
        (await prisma.importBatch.findUniqueOrThrow({ where: { id: primero } }))
          .isCurrent,
      ).toBe(false);
      const vigentes = await prisma.order.findMany({
        where: { ruc, importBatch: { isCurrent: true } },
        orderBy: { sourceRow: 'asc' },
      });
      expect(vigentes.map((o) => o.sourceRow)).toEqual([2, 4]);
      expect(vigentes.map((o) => o.amount?.toFixed(2))).toEqual([
        '120.00',
        '50.00',
      ]);
      const ranking = await stats.rankingCompleto({
        ...filtrosPorDefecto(),
        gestionId,
      });
      expect(ranking.total).toBe(1);
      expect(ranking.filas[0]?.considerado).toBe('170.00');
      const tercero = await cargar('120', 'Anulada', true);
      expect(
        (await prisma.importBatch.findUniqueOrThrow({ where: { id: segundo } }))
          .isCurrent,
      ).toBe(false);
      const comparativa = (await stats.comparativaPorGestion()).find(
        (g) => g.gestion === 'CIUDADANIA-1993',
      );
      expect(comparativa?.considerado).toBe('50.00');
      expect(comparativa?.ticketMedio).toBe('50.00');
      const { GET } = await import('@/app/api/public/libros/[id]/route');
      const respuesta = await GET(new Request('https://ejemplo.test'), {
        params: Promise.resolve({ id: tercero }),
      });
      expect(respuesta.status).toBe(200);
      expect(await respuesta.text()).toContain('Anulada');
      expect(
        (
          await prisma.supplierManagementSummary.findFirstOrThrow({
            where: { managementPeriodId: gestionId },
          })
        ).consideredAmount.toFixed(2),
      ).toBe('50.00');
    });
    it('rechaza sustituciones sin confirmación y conserva el vigente', async () => {
      const b = await imports.analizar({
        buffer: libro('999', 'Devengada'),
        originalFilename: 'ciudadania-1993-02.xlsx',
        year: 1993,
        month: 2,
        importType: 'CONSOLIDADO',
        userId: null,
      });
      ids.push(b.importBatchId);
      const lote = await prisma.importBatch.findUniqueOrThrow({
        where: { id: b.importBatchId },
      });
      if (lote.storageKey) keys.push(lote.storageKey);
      await expect(
        imports.confirmar({ importBatchId: b.importBatchId, userId: null }),
      ).rejects.toThrow(/Confirma/);
      expect(
        await prisma.importBatch.count({
          where: { year: 1993, month: 2, isCurrent: true },
        }),
      ).toBe(1);
    });
    it('no publica relaciones sin evidencia y renueva la revisión si cambia la fuente', async () => {
      const persons = await import('@/services/personsService');
      const tag = await prisma.personTag.create({
        data: { code: 'CIUDADANIA-PRUEBA', label: 'Ciudadanía prueba' },
      });
      tagId = tag.id;
      const entrada = {
        dni: '93333333',
        fullName: 'PERSONA CIUDADANIA PRUEBA',
        description: 'Afirmación editorial de prueba documentada',
        source: 'Documento de prueba ciudadano',
        sourceUrl: 'https://ejemplo.test/persona',
        isPublic: true,
        tagIds: [tagId],
      };
      const p = await persons.crearPersona(entrada, { userId: null });
      personId = p.id;
      auditados.push(p.id);
      await expect(
        persons.vincularProveedor(
          { personId, ruc, note: 'Relación sin evidencia' },
          { userId: null },
        ),
      ).rejects.toThrow(/Documenta/);
      const proveedor = await prisma.supplier.findUniqueOrThrow({
        where: { ruc },
      });
      const legacy = await prisma.personSupplierLink.create({
        data: {
          personId,
          supplierId: proveedor.id,
          note: 'Nota antigua sin documento',
        },
      });
      expect((await persons.detalleDeEtiqueta(tagId)).proveedores).toHaveLength(
        0,
      );
      await prisma.personSupplierLink.delete({ where: { id: legacy.id } });
      const link = await persons.vincularProveedor(
        {
          personId,
          ruc,
          note: 'Relación documentada solo como fixture',
          sourceUrl: 'https://ejemplo.test/relacion',
          validFrom: '1993-01-01',
          validUntil: '1993-12-31',
        },
        { userId: null },
      );
      auditados.push(link.id);
      expect((await persons.detalleDeEtiqueta(tagId)).proveedores).toHaveLength(
        1,
      );
      expect(
        (
          await prisma.personSupplierLink.findUniqueOrThrow({
            where: { id: link.id },
          })
        ).validFrom
          ?.toISOString()
          .slice(0, 10),
      ).toBe('1993-01-01');
      await prisma.person.update({
        where: { id: personId },
        data: { verifiedAt: new Date('2000-01-01') },
      });
      await persons.actualizarPersona(
        personId,
        { ...entrada, source: 'Documento corregido de prueba' },
        { userId: null },
      );
      expect(
        (
          await prisma.person.findUniqueOrThrow({ where: { id: personId } })
        ).verifiedAt!.getTime(),
      ).toBeGreaterThan(new Date('2000-01-01').getTime());
    });
  },
);
