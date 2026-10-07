import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas de los catálogos configurables contra la base real.
 *
 * Comprueban las reglas que protegen las cifras publicadas —qué puede contar como gasto,
 * qué no se puede borrar— y que el código y los alias se guarden como el importador los
 * busca. Todo lo que crean lo borran después, incluidos los rastros de auditoría.
 */

const hayBaseDeDatos = process.env.INTEGRATION_TESTS_ENABLED === '1';

describe.skipIf(!hayBaseDeDatos)('catalogService contra la base real', () => {
  let svc: typeof import('@/services/catalogService');
  let prisma: typeof import('@/lib/prisma').prisma;

  const CODIGO = 'PRUEBA_CATALOGO';
  const CODIGO_BORRABLE = 'PRUEBA_BORRABLE';
  const NOMBRE_GESTION = 'PRUEBA-GESTION-1900-1901';
  const NOMBRE_GESTION_CON_ORDENES = 'PRUEBA-GESTION-CON-ORDENES';

  /** Lotes y proveedores de prueba, para borrarlos al terminar. */
  const lotesDePrueba: string[] = [];
  const proveedoresDePrueba: string[] = [];

  /** Contador: el lote de prueba comparte clave única con las importaciones reales. */
  let lotesDePruebaCreados = 0;

  const creados: string[] = [];

  function entradaEstado(cambios: Partial<import('@/services/catalogService').EntradaEstado> = {}) {
    return {
      code: CODIGO,
      label: 'Prueba de catálogo',
      aliases: [] as string[],
      countsEconomically: true,
      isCancelled: false,
      isUnknown: false,
      position: 50,
      isActive: true,
      ...cambios,
    };
  }

  /**
   * Crea una orden mínima, con su lote y su proveedor, y la apunta para borrarla.
   *
   * Existe porque las pruebas de «no se puede borrar algo que usan las órdenes» daban por
   * hecho que la base ya tenía órdenes. En local las hay (de importaciones anteriores),
   * pero el CI siembra una base limpia: sin esto, la prueba o fallaba o no comprobaba
   * nada.
   */
  async function crearOrdenDePrueba(opciones: {
    statusId?: string;
    managementPeriodId?: string;
  }): Promise<void> {
    const marca = `prueba-catalogo-${Date.now().toString(36)}`;
    // RUC de 11 dígitos y único: la base no valida el formato, pero el campo es único y
    // no queremos chocar con datos de verdad.
    const ruc = `20${Date.now().toString().slice(-9)}`;

    const lote = await prisma.importBatch.create({
      data: {
        filename: marca,
        originalFilename: `${marca}.xls`,
        // Periodo imposible en los libros reales: el lote comparte clave única
        // (año, mes, tipo, versión) con las importaciones de verdad.
        year: 1997,
        month: 1,
        period: '1997-01',
        importType: 'CONSOLIDADO',
        version: 9000 + (lotesDePruebaCreados += 1),
        checksum: marca,
      },
      select: { id: true },
    });

    const proveedor = await prisma.supplier.create({
      data: { ruc, name: marca, normalizedName: marca, slug: marca },
      select: { id: true },
    });

    await prisma.order.create({
      data: {
        importBatchId: lote.id,
        orderNumber: `OC-${marca}`,
        ruc,
        supplierId: proveedor.id,
        statusId: opciones.statusId ?? null,
        managementPeriodId: opciones.managementPeriodId ?? null,
        rawData: { prueba: true },
        dedupeKey: marca,
      },
    });

    lotesDePrueba.push(lote.id);
    proveedoresDePrueba.push(proveedor.id);
  }

  beforeAll(async () => {
    svc = await import('@/services/catalogService');
    ({ prisma } = await import('@/lib/prisma'));

    // Restos de una corrida anterior que se cortó antes de limpiar: sin esto, el lote de
    // prueba chocaría con la clave única (año, mes, tipo, versión).
    await prisma.importBatch.deleteMany({
      where: { filename: { startsWith: 'prueba-catalogo-' } },
    });
    await prisma.supplier.deleteMany({
      where: { slug: { startsWith: 'prueba-catalogo-' } },
    });
  });

  afterAll(async () => {
    await prisma.orderStatus.deleteMany({ where: { code: { in: [CODIGO, CODIGO_BORRABLE] } } });
    await prisma.managementPeriod.deleteMany({
      where: { name: { in: [NOMBRE_GESTION, NOMBRE_GESTION_CON_ORDENES] } },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: creados } } });

    // Las órdenes caen en cascada con su lote. El proveedor va después: la
    // relación es RESTRICT, así que no se puede borrar mientras tenga órdenes.
    await prisma.importBatch.deleteMany({ where: { id: { in: lotesDePrueba } } });
    await prisma.supplier.deleteMany({ where: { id: { in: proveedoresDePrueba } } });
  });

  it('crea un estado y guarda el código y los alias como los busca el importador', async () => {
    const { id } = await svc.crearEstado(
      entradaEstado({
        // Se teclea como sea: el servicio lo normaliza.
        code: 'prueba catalogo',
        label: '  Prueba de catálogo  ',
        aliases: ['  Prueba  ', 'PRUEBA', '', 'en trámite'],
      }),
      { userId: null },
    );
    creados.push(id);

    const creado = await prisma.orderStatus.findUnique({
      where: { id },
      select: { code: true, label: true, aliases: true, countsEconomically: true },
    });

    expect(creado?.code).toBe(CODIGO);
    expect(creado?.label).toBe('Prueba de catálogo');
    // Normalizados con la misma función que usa el importador, sin repetidos ni vacíos.
    expect(creado?.aliases).toEqual(['prueba', 'en tramite']);
    expect(creado?.countsEconomically).toBe(true);
  });

  it('deja rastro en la auditoría de lo que se crea', async () => {
    const { id } = await svc.crearEstado(entradaEstado({ code: CODIGO_BORRABLE }), { userId: null });
    creados.push(id);

    const rastro = await prisma.auditLog.findFirst({
      where: { entityId: id, entity: 'OrderStatus', action: 'CREATE' },
      select: { metadata: true },
    });

    expect(rastro).not.toBeNull();

    // Se limpia aquí mismo: otra prueba usa este código para comprobar el borrado.
    await svc.eliminarEstado(id, { userId: null });
  });

  it('no deja que un estado anulado cuente como gasto', async () => {
    await expect(
      svc.crearEstado(entradaEstado({ isCancelled: true, countsEconomically: true }), {
        userId: null,
      }),
    ).rejects.toThrow(/excluyentes/);
  });

  it('no deja clasificar dos veces el estado desconocido', async () => {
    // Sin contar como gasto, para que salte la regla de «solo puede haber uno» y no la
    // de la red de seguridad.
    await expect(
      svc.crearEstado(entradaEstado({ isUnknown: true, countsEconomically: false }), {
        userId: null,
      }),
    ).rejects.toThrow(/solo puede haber uno/);
  });

  it('no elimina un estado que están usando las órdenes, y lo explica', async () => {
    const devengada = await prisma.orderStatus.findUnique({
      where: { code: 'DEVENGADA' },
      select: { id: true },
    });
    expect(devengada).not.toBeNull();

    // La orden que lo usa la crea la prueba: si no, esto solo pasaría donde ya hubiera
    // datos importados.
    await crearOrdenDePrueba({ statusId: devengada!.id });

    await expect(svc.eliminarEstado(devengada!.id, { userId: null })).rejects.toThrow(
      /orden\(es\) lo usan/,
    );

    // Y sigue donde estaba.
    expect(await prisma.orderStatus.count({ where: { id: devengada!.id } })).toBe(1);
  });

  it('elimina un estado que no usa nadie', async () => {
    const { id } = await svc.crearEstado(entradaEstado({ code: CODIGO_BORRABLE }), { userId: null });

    await svc.eliminarEstado(id, { userId: null });

    expect(await prisma.orderStatus.count({ where: { id } })).toBe(0);
  });

  it('crea una gestión con sus fechas y la lista en formato de formulario', async () => {
    const { id } = await svc.crearGestion(
      {
        name: NOMBRE_GESTION,
        startDate: '1900-01-01',
        endDate: '1901-12-31',
        description: 'Gestión de prueba',
      },
      { userId: null },
    );
    creados.push(id);

    const gestiones = await svc.listarGestiones();
    const creada = gestiones.find((gestion) => gestion.id === id);

    expect(creada?.name).toBe(NOMBRE_GESTION);
    expect(creada?.startDate).toBe('1900-01-01');
    expect(creada?.endDate).toBe('1901-12-31');
    expect(creada?.ordenes).toBe(0);

    await svc.eliminarGestion(id, { userId: null });
    expect(await prisma.managementPeriod.count({ where: { id } })).toBe(0);
  });

  it('no deja crear una gestión que termina antes de empezar', async () => {
    await expect(
      svc.crearGestion(
        {
          name: NOMBRE_GESTION,
          startDate: '1901-01-01',
          endDate: '1900-01-01',
          description: '',
        },
        { userId: null },
      ),
    ).rejects.toThrow(/terminar antes de empezar/);
  });

  it('no elimina una gestión que usan las órdenes, y lo explica', async () => {
    // La gestión y la orden se crean aquí: antes se buscaba una gestión que ya tuviera
    // órdenes, y en una base recién sembrada no hay ninguna.
    const { id } = await svc.crearGestion(
      {
        name: NOMBRE_GESTION_CON_ORDENES,
        startDate: '1900-01-01',
        endDate: '1901-12-31',
        description: 'Gestión de prueba con órdenes',
      },
      { userId: null },
    );
    creados.push(id);

    await crearOrdenDePrueba({ managementPeriodId: id });

    await expect(svc.eliminarGestion(id, { userId: null })).rejects.toThrow(
      /No se puede eliminar la gestión/,
    );

    expect(await prisma.managementPeriod.count({ where: { id } })).toBe(1);
  });
});
