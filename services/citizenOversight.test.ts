import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { filtrosPorDefecto } from '@/lib/filtros';
// Fixtures independientes: no dependen del libro de referencia ni de datos reales.
describe.skipIf(process.env.INTEGRATION_TESTS_ENABLED !== '1')('instantáneas y estadísticas ciudadanas', () => {
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
          'Descripción',
        ],
        ['CIUD-1', 'O/C', ruc, 'PRUEBA CIUDADANA', monto, estado, '1993-02-05', 'ALMUERZOS Y REFRIGERIOS; ALQUILER DE CAMIONETA; TALONARIOS'],
        [],
        ['CIUD-2', 'O/C', ruc, 'PRUEBA CIUDADANA', '50', 'Devengada', '1993-02-06', 'ALIMENTACIÓN Y CATERING; CONSULTORÍA DE EXPEDIENTE TÉCNICO; CHOCOLATADA NAVIDEÑA; APOYO COYUNTURAL'],
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
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: primero } })).isCurrent).toBe(
      false,
    );
    const vigentes = await prisma.order.findMany({
      where: { ruc, importBatch: { isCurrent: true } },
      orderBy: { sourceRow: 'asc' },
    });
    expect(vigentes.map((o) => o.sourceRow)).toEqual([2, 4]);
    expect(vigentes.map((o) => o.amount?.toFixed(2))).toEqual(['120.00', '50.00']);
    const ranking = await stats.rankingCompleto({
      ...filtrosPorDefecto(),
      gestionId,
    });
    expect(ranking.total).toBe(1);
    expect(ranking.filas[0]?.considerado).toBe('170.00');
    const tercero = await cargar('120', 'Anulada', true);
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: segundo } })).isCurrent).toBe(
      false,
    );
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
  it('excluye las versiones antiguas en perfiles, listados, series y ranking paginado', async () => {
    const f = { ...filtrosPorDefecto(), texto: ruc };
    const proveedor = await prisma.supplier.findUniqueOrThrow({ where: { ruc } });
    const perfil = await stats.perfilProveedor(proveedor.slug);
    expect(perfil?.totalConsiderado).toBe('50.00');
    expect(perfil?.ordenes).toBe(2);
    const { contratacionesPrensa } = await import('@/services/pressService');
    const prensa = await contratacionesPrensa([{ ruc, nombre: 'Nombre aportado para consulta' }]);
    expect(prensa.ordenes).toBe(2);
    expect(prensa.considerado).toBe('50.00');
    expect(prensa.filas[0]).toMatchObject({ registrado: '170.00', anulado: '120.00', considerado: '50.00', anuladas: 1, perfilUrl: `/proveedores/${proveedor.slug}` });
    const perfilFoto = await prisma.supplierProfile.create({ data: { supplierId: proveedor.id, isPublic: true, photoKey: 'fixture-no-se-descarga', publication: { foto: { enabled: true, sourceUrl: 'https://ejemplo.test/foto', verifiedAt: new Date().toISOString() } } } });
    const vigentesFoto = await prisma.importBatch.findMany({ where: { id: { in: ids }, isCurrent: true }, select: { id: true } });
    try {
      await prisma.importBatch.updateMany({ where: { id: { in: vigentesFoto.map(b => b.id) } }, data: { isCurrent: false } });
      const sinOrdenes = await contratacionesPrensa([{ ruc, nombre: 'Seguimiento sin órdenes vigentes' }]);
      expect(sinOrdenes.filas[0]).toMatchObject({ ordenes: 0, considerado: '0.00', perfilUrl: `/proveedores/${proveedor.slug}`, fotoUrl: `/api/public/proveedores/${proveedor.id}/foto?v=${perfilFoto.updatedAt.getTime()}` });
    } finally {
      await prisma.importBatch.updateMany({ where: { id: { in: vigentesFoto.map(b => b.id) } }, data: { isCurrent: true } });
      await prisma.supplierProfile.delete({ where: { id: perfilFoto.id } });
    }
    const comida = await import('@/services/foodService');
    const alimentacion = await comida.listarOrdenesAlimentacion({ ...filtrosPorDefecto(), gestionId });
    expect(alimentacion.total).toBe(2); // Varias palabras de comida no duplican una orden.
    expect(alimentacion.filas.filter(o => !o.isCancelled).map(o => o.amount)).toEqual(['50.00']);
    expect((await comida.gastoAlimentacionPorGestion()).map(g => g.gestion)).toEqual(['2015-2018', '2019-2022', '2023-2026']);
    const categorias = await import('@/lib/categorias-gasto');
    const gastos = await import('@/services/categorySpendingService');
    const consulta = { ...filtrosPorDefecto(), gestionId };
    const alquileres = await gastos.listarOrdenesCategoria(categorias.categoriaGastoPorId('alquiler-camionetas')!, consulta);
    expect(alquileres.total).toBe(1);
    expect(alquileres.filas[0]?.isCancelled).toBe(true);
    const expedientes = await gastos.listarOrdenesCategoria(categorias.categoriaGastoPorId('expedientes-tecnicos')!, consulta);
    expect(expedientes.total).toBe(1);
    expect(expedientes.filas[0]?.amount).toBe('50.00');
    // Temporalmente coloca la gestión aislada entre las últimas tres para auditar los totales.
    await prisma.managementPeriod.update({ where: { id: gestionId }, data: { startDate: new Date('2024-01-01') } });
    try {
      const resumenGastos = (await gastos.gastosPorCategoriaGestion()).filter(g => g.id === gestionId);
      expect(resumenGastos).toHaveLength(10);
      expect(resumenGastos.find(g => g.categoria === 'alquiler-camionetas')).toMatchObject({ ordenes: 1, anuladas: 1, considerado: '0.00', meses: 1 });
      expect(resumenGastos.find(g => g.categoria === 'consultorias')).toMatchObject({ ordenes: 1, considerado: '50.00' });
      expect(resumenGastos.find(g => g.categoria === 'expedientes-tecnicos')).toMatchObject({ ordenes: 1, considerado: '50.00' });
      expect(resumenGastos.find(g => g.categoria === 'vaso-de-leche')).toMatchObject({ ordenes: 0, considerado: '0.00', meses: 1 });
      expect(resumenGastos.find(g => g.categoria === 'utiles-oficina')).toMatchObject({ ordenes: 1, anuladas: 1, considerado: '0.00', meses: 1 });
      for (const id of ['vacaciones-navidad', 'apoyo-social']) {
        expect(resumenGastos.find(g => g.categoria === id)).toMatchObject({ ordenes: 1, considerado: '50.00', meses: 1 });
        const detalle = await gastos.listarOrdenesCategoria(categorias.categoriaGastoPorId(id)!, consulta);
        expect(detalle.total).toBe(1);
        expect(detalle.filas[0]?.amount).toBe('50.00');
      }
    } finally {
      await prisma.managementPeriod.update({ where: { id: gestionId }, data: { startDate: new Date('1993-01-01') } });
    }
    expect((await stats.listarOrdenes({ ...f, anio: 1993, mes: 2, orden: 'monto' })).total).toBe(2);
    expect(
      (
        await stats.listarOrdenes({
          ...f,
          desde: '1993-02-01',
          hasta: '1993-02-28',
          orden: 'proveedor',
        })
      ).filas,
    ).toHaveLength(2);
    expect((await stats.listarProveedores(f)).filas[0]?.considerado).toBe('50.00');
    const vacio = await stats.rankingCompleto({ ...f, gestionId: 'gestion-inexistente' });
    expect(vacio.total).toBe(0);
    expect(vacio.filas).toEqual([]);
    const segunda = await stats.rankingCompleto({ ...f, gestionId, porPagina: 1, pagina: 2 });
    expect(segunda.total).toBe(1);
    expect(segunda.totalPaginas).toBe(1);
    expect(segunda.filas).toEqual([]);
    const portada = await stats.datosPortada();
    const inicial = await stats.datosPortadaInicial();
    expect(inicial.resumen).toEqual(portada.resumen);
    expect(inicial.mensual).toEqual(portada.mensual);
    expect(inicial.ranking).toEqual(portada.ranking.slice(0, 5));
    expect(inicial.ultimos).toEqual(portada.ultimos);
    expect(portada.mensual.find((m) => m.periodo === '1993-02')?.considerado).toBe('50.00');
    expect(portada.anual.find((m) => m.periodo === '1993')?.considerado).toBe('50.00');
    expect(portada.gestiones.find((g) => g.gestion === 'CIUDADANIA-1993')?.considerado).toBe(
      '50.00',
    );
    expect((await stats.opcionesDeFiltros()).anios).toContain(1993);
    const { GET: exportar } = await import('@/app/api/public/orders/export/route');
    const csv = await exportar();
    expect(csv.status).toBe(410);
    expect((await csv.json()).fuentes).toBe('/fuentes');

    expect(
      (await stats.proveedoresMultiGestion(1)).filas.find((p) => p.ruc === ruc)?.totalConsiderado,
    ).toBe('50.00');
    expect(Number((await stats.concentracionGasto()).totalConsiderado)).toBeGreaterThanOrEqual(50);
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
    const tag = await persons.crearEtiqueta(
      {
        code: 'CIUDADANIA_PRUEBA',
        label: 'Ciudadanía prueba',
        position: 99,
        isActive: true,
        isPublic: true,
      },
      { userId: null },
    );
    auditados.push(tag.id);
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
    expect((await persons.detalleDeEtiqueta(tagId)).proveedores).toHaveLength(0);
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
    expect((await persons.detalleDeEtiqueta(tagId)).proveedores).toHaveLength(1);
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
      (await prisma.person.findUniqueOrThrow({ where: { id: personId } })).verifiedAt!.getTime(),
    ).toBeGreaterThan(new Date('2000-01-01').getTime());
  });
  it('permite revisar, ocultar y rectificar vínculos sin atribuir sus montos a la persona', async () => {
    const persons = await import('@/services/personsService');
    const ficha = await persons.personaPorId(personId);
    expect(ficha.vinculosManuales).toHaveLength(1);
    expect((await persons.listarPersonas({ texto: 'PERSONA CIUDADANIA PRUEBA' }))[0]?.id).toBe(
      personId,
    );
    expect((await persons.listarEtiquetas()).find((t) => t.id === tagId)?.personas).toBe(1);
    expect((await persons.proveedoresVinculados(personId))[0]?.considerado).toBe('50.00');
    expect((await persons.vinculosPorEtiqueta()).find((t) => t.tagId === tagId)?.considerado).toBe(
      '50.00',
    );
    expect((await persons.resumenVinculos()).proveedores).toBeGreaterThanOrEqual(1);
    expect((await persons.opcionesDeProveedor()).some((p) => p.ruc === ruc)).toBe(true);
    const entrada = {
      dni: ficha.dni,
      fullName: ficha.fullName,
      description: ficha.description,
      source: ficha.source ?? '',
      sourceUrl: ficha.sourceUrl ?? '',
      isPublic: false,
      tagIds: [tagId],
    };
    await persons.actualizarPersona(personId, entrada, { userId: null });
    expect((await persons.detalleDeEtiqueta(tagId)).proveedores).toHaveLength(0);
    expect(
      (await persons.detalleDeEtiqueta(tagId, { soloPublicas: false })).proveedores,
    ).toHaveLength(1);
    await persons.actualizarPersona(personId, { ...entrada, isPublic: true }, { userId: null });
    await persons.desvincularProveedor(ficha.vinculosManuales[0]!.id, { userId: null });
    expect((await persons.detalleDeEtiqueta(tagId)).personas).toHaveLength(0);
    await persons.actualizarEtiqueta(
      tagId,
      {
        code: 'CIUDADANIA_PRUEBA',
        label: 'Etiqueta revisada',
        position: 99,
        isActive: false,
        isPublic: false,
      },
      { userId: null },
    );
    expect((await persons.listarEtiquetas()).some((t) => t.id === tagId)).toBe(false);
    expect(
      (await persons.listarEtiquetas({ incluirInactivas: true })).find((t) => t.id === tagId)
        ?.label,
    ).toBe('Etiqueta revisada');
    await persons.eliminarEtiqueta(tagId, { userId: null });
    expect((await persons.personaPorId(personId)).etiquetas).toEqual([]);
    await persons.eliminarPersona(personId, { userId: null });
    await expect(persons.personaPorId(personId)).rejects.toThrow(/No existe/);
  });
});
