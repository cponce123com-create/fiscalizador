import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas de los catálogos configurables contra la base real.
 *
 * Comprueban las reglas que protegen las cifras publicadas —qué puede contar como gasto,
 * qué no se puede borrar— y que el código y los alias se guarden como el importador los
 * busca. Todo lo que crean lo borran después, incluidos los rastros de auditoría.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hayBaseDeDatos)('catalogService contra la base real', () => {
  let svc: typeof import('@/services/catalogService');
  let prisma: typeof import('@/lib/prisma').prisma;

  const CODIGO = 'PRUEBA_CATALOGO';
  const CODIGO_BORRABLE = 'PRUEBA_BORRABLE';
  const NOMBRE_GESTION = 'PRUEBA-GESTION-1900-1901';

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

  beforeAll(async () => {
    svc = await import('@/services/catalogService');
    ({ prisma } = await import('@/lib/prisma'));
  });

  afterAll(async () => {
    await prisma.orderStatus.deleteMany({ where: { code: { in: [CODIGO, CODIGO_BORRABLE] } } });
    await prisma.managementPeriod.deleteMany({ where: { name: NOMBRE_GESTION } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: creados } } });
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
    const gestion = await prisma.managementPeriod.findFirst({
      where: { orders: { some: {} } },
      select: { id: true },
    });
    expect(gestion).not.toBeNull();

    await expect(svc.eliminarGestion(gestion!.id, { userId: null })).rejects.toThrow(
      /No se puede eliminar la gestión/,
    );

    expect(await prisma.managementPeriod.count({ where: { id: gestion!.id } })).toBe(1);
  });
});
