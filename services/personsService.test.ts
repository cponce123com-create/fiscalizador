import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas de los vínculos declarados contra la base real.
 *
 * El escenario no inventa proveedores: elige del portal la persona natural con más
 * órdenes y la empresa con más órdenes, y comprueba que el DNI del RUC de la primera
 * encuentra a su proveedor. Así la prueba falla si algún día deja de cumplirse la
 * regla del RUC peruano (`10 + DNI + dígito verificador`), que es de lo que depende
 * toda la deducción.
 *
 * Todo lo que crea lo borra después, incluidos los rastros de auditoría.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

/**
 * El escenario no inventa proveedores: los elige del portal, así que sin órdenes
 * cargadas no hay nada que comprobar.
 *
 * Se decide ANTES de declarar la suite, y no dentro de `beforeAll`, porque un error ahí
 * marca el fichero entero como fallido aunque no haya nada roto.
 */
async function hayProveedoresConOrdenes(): Promise<boolean> {
  if (!hayBaseDeDatos) return false;

  const { prisma } = await import('@/lib/prisma');

  return (await prisma.order.count()) > 0;
}

const conDatosDelPortal = await hayProveedoresConOrdenes();

describe.skipIf(!conDatosDelPortal)('personsService contra la base real', () => {
  let svc: typeof import('@/services/personsService');
  let prisma: typeof import('@/lib/prisma').prisma;

  const CODIGO_ETIQUETA = 'TEST_VINCULOS';

  let tagId: string;
  let personaId: string;
  let dniReal: string;
  let rucNatural: string;
  let rucEmpresa: string;
  /** Identificadores auditados por esta prueba, para poder limpiarlos. */
  const auditados: string[] = [];

  beforeAll(async () => {
    svc = await import('@/services/personsService');
    ({ prisma } = await import('@/lib/prisma'));

    // Persona natural con más órdenes y empresa con más órdenes, del portal real.
    const naturales = await prisma.$queryRaw<Array<{ ruc: string }>>`
      SELECT s.ruc AS ruc
      FROM "Supplier" s
      JOIN "Order" o ON o."supplierId" = s.id
      WHERE s."rucPrefix" = '10'
      GROUP BY s.ruc
      ORDER BY COUNT(*) DESC, s.ruc ASC
      LIMIT 1
    `;
    const empresas = await prisma.$queryRaw<Array<{ ruc: string }>>`
      SELECT s.ruc AS ruc
      FROM "Supplier" s
      JOIN "Order" o ON o."supplierId" = s.id
      WHERE s."rucPrefix" = '20'
      GROUP BY s.ruc
      ORDER BY COUNT(*) DESC, s.ruc ASC
      LIMIT 1
    `;

    if (!naturales[0] || !empresas[0]) {
      throw new Error(
        'Estas pruebas comprueban la deducción del DNI contra proveedores reales del ' +
          'portal, y ahora mismo no hay ninguno con órdenes. Carga el libro de ' +
          'referencia (`npm run verify`, o impórtalo desde el panel) antes de correrlas.',
      );
    }

    rucNatural = naturales[0].ruc;
    rucEmpresa = empresas[0].ruc;
    // El DNI vive en los ocho dígitos centrales del RUC de una persona natural.
    dniReal = rucNatural.slice(2, 10);

    // Restos de una ejecución anterior interrumpida.
    await prisma.person.deleteMany({ where: { dni: dniReal } });
    await prisma.personTag.deleteMany({ where: { code: CODIGO_ETIQUETA } });

    const etiqueta = await svc.crearEtiqueta(
      {
        code: CODIGO_ETIQUETA,
        label: 'Prueba de vínculos',
        position: 99,
        isActive: true,
        isPublic: true,
      },
      { userId: null },
    );
    tagId = etiqueta.id;
    auditados.push(tagId);

    const persona = await svc.crearPersona(
      {
        dni: dniReal,
        fullName: 'PERSONA DE PRUEBA',
        description: 'Ficha creada por la suite de pruebas automatizadas.',
        source: 'Suite de pruebas.',
        isPublic: true,
        tagIds: [tagId],
      },
      { userId: null },
    );
    personaId = persona.id;
    auditados.push(personaId);

    // Vínculo manual: la empresa no se deduce del DNI, la declara el administrador.
    const enlace = await svc.vincularProveedor(
      { personId: personaId, ruc: rucEmpresa, note: 'Vínculo de prueba.' },
      { userId: null },
    );
    auditados.push(enlace.id);
  });

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { dni: dniReal } });
    await prisma.personTag.deleteMany({ where: { code: CODIGO_ETIQUETA } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: auditados } } });
  });

  it('deduce el proveedor de una persona natural por el DNI que lleva dentro su RUC', async () => {
    const vinculados = await svc.proveedoresVinculados(personaId);
    const natural = vinculados.find((v) => v.ruc === rucNatural);

    expect(natural).toBeDefined();
    expect(natural!.origen).toBe('AUTOMATICO');
    expect(natural!.nota).toBeNull();
    expect(natural!.considerado).toMatch(/^[0-9]+\.[0-9]{2}$/);
  });

  it('suma el mismo monto considerado que el resto del portal', async () => {
    const vinculados = await svc.proveedoresVinculados(personaId);
    const natural = vinculados.find((v) => v.ruc === rucNatural)!;

    // Consulta independiente (Prisma, no SQL crudo) con la misma regla: excluir las
    // anuladas y los estados que no cuentan económicamente.
    const esperado = await prisma.order.aggregate({
      where: {
        supplierId: natural.supplierId,
        isCancelled: false,
        status: { countsEconomically: true },
      },
      _sum: { amount: true },
    });

    expect(Number(natural.considerado)).toBeCloseTo(Number(esperado._sum.amount ?? 0), 2);
    expect(Number(natural.considerado)).toBeGreaterThan(0);

    const totalOrdenes = await prisma.order.count({ where: { supplierId: natural.supplierId } });
    expect(natural.ordenes).toBe(totalOrdenes);
  });

  it('incluye la empresa vinculada a mano y la distingue de la deducida', async () => {
    const vinculados = await svc.proveedoresVinculados(personaId);

    expect(vinculados).toHaveLength(2);

    const empresa = vinculados.find((v) => v.ruc === rucEmpresa);
    expect(empresa?.origen).toBe('MANUAL');
    expect(empresa?.nota).toBe('Vínculo de prueba.');
  });

  it('la etiqueta suma el gasto de sus proveedores', async () => {
    const porEtiqueta = await svc.vinculosPorEtiqueta();
    const etiqueta = porEtiqueta.find((fila) => fila.tagId === tagId);

    expect(etiqueta).toBeDefined();
    expect(etiqueta!.personas).toBe(1);
    expect(etiqueta!.proveedores).toBe(2);

    const vinculados = await svc.proveedoresVinculados(personaId);
    const suma = vinculados.reduce((total, fila) => total + Number(fila.considerado), 0);
    const ordenes = vinculados.reduce((total, fila) => total + fila.ordenes, 0);

    expect(Number(etiqueta!.considerado)).toBeCloseTo(suma, 2);
    expect(etiqueta!.ordenes).toBe(ordenes);
  });

  it('el detalle de la etiqueta dice qué persona señala cada proveedor', async () => {
    const detalle = await svc.detalleDeEtiqueta(tagId);

    expect(detalle.personas.map((p) => p.fullName)).toEqual(['PERSONA DE PRUEBA']);
    expect(detalle.proveedores).toHaveLength(2);

    for (const proveedor of detalle.proveedores) {
      expect(proveedor.personas).toContain('PERSONA DE PRUEBA');
    }
  });

  it('el resumen no cuenta dos veces un proveedor compartido', async () => {
    const resumen = await svc.resumenVinculos();

    expect(resumen.personas).toBeGreaterThanOrEqual(1);
    expect(resumen.proveedores).toBeGreaterThanOrEqual(2);

    const vinculados = await svc.proveedoresVinculados(personaId);
    const suma = vinculados.reduce((total, fila) => total + Number(fila.considerado), 0);
    expect(Number(resumen.considerado)).toBeGreaterThanOrEqual(suma);
  });

  it('deja rastro en la auditoría', async () => {
    const registros = await prisma.auditLog.findMany({
      where: { entity: 'Person', entityId: personaId },
      select: { action: true },
    });

    expect(registros.map((registro) => registro.action)).toContain('CREATE');
  });

  it('desvincula un vínculo manual y lo vuelve a dejar como estaba', async () => {
    const detalle = await svc.personaPorId(personaId);
    const enlace = detalle.vinculosManuales.find((vinculo) => vinculo.ruc === rucEmpresa);

    expect(enlace).toBeDefined();
    expect(enlace!.nombre.length).toBeGreaterThan(0);

    await svc.desvincularProveedor(enlace!.id, { userId: null });
    expect((await svc.personaPorId(personaId)).vinculosManuales).toHaveLength(0);

    // Se restaura: la prueba no debe dejar el escenario a medias.
    const restaurado = await svc.vincularProveedor(
      { personId: personaId, ruc: rucEmpresa, note: 'Vínculo de prueba.' },
      { userId: null },
    );
    auditados.push(restaurado.id);
    expect((await svc.personaPorId(personaId)).vinculosManuales).toHaveLength(1);
  });

  it('rechaza un DNI que no tiene ocho dígitos', async () => {
    await expect(
      svc.crearPersona(
        {
          dni: '1234567',
          fullName: 'OTRA PERSONA',
          description: 'Descripción.',
          source: 'Fuente.',
          isPublic: true,
          tagIds: [],
        },
        { userId: null },
      ),
    ).rejects.toThrow(/8 dígitos/);
  });

  it('exige descripción y fuente: es lo que se publica sobre una persona real', async () => {
    const base = {
      dni: '00000000',
      fullName: 'OTRA PERSONA',
      description: 'Descripción.',
      source: 'Fuente.',
      isPublic: true,
      tagIds: [],
    };

    await expect(
      svc.crearPersona({ ...base, description: '   ' }, { userId: null }),
    ).rejects.toThrow(/descripción es obligatoria/);

    await expect(
      svc.crearPersona({ ...base, source: '' }, { userId: null }),
    ).rejects.toThrow(/fuente es obligatoria/);
  });

  it('no admite dos personas con el mismo DNI', async () => {
    await expect(
      svc.crearPersona(
        {
          dni: dniReal,
          fullName: 'DUPLICADA',
          description: 'Descripción.',
          source: 'Fuente.',
          isPublic: true,
          tagIds: [],
        },
        { userId: null },
      ),
    ).rejects.toThrow(/Ya hay una persona registrada/);
  });

  it('no vincula un RUC que no existe en el portal', async () => {
    await expect(
      svc.vincularProveedor(
        { personId: personaId, ruc: '00000000000', note: null },
        { userId: null },
      ),
    ).rejects.toThrow(/No hay ningún proveedor con el RUC/);
  });
});
