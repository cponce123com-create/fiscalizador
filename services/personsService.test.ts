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

  /**
   * DNI que no pertenece a ningún proveedor del portal.
   *
   * Sirve para comprobar que una ficha sin vínculos no se publica. La prueba comprueba
   * que de verdad no coincide con ningún RUC, para que no falle por sorpresa el día que
   * aparezca uno.
   */
  const DNI_SIN_VINCULO = '87654321';

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
        sourceUrl: 'https://ejemplo.test/acta-de-prueba',
        isPublic: true,
        tagIds: [tagId],
      },
      { userId: null },
    );
    personaId = persona.id;
    auditados.push(personaId);

    // Vínculo manual: la empresa no se deduce del DNI, la declara el administrador.
    const enlace = await svc.vincularProveedor(
      { personId: personaId, ruc: rucEmpresa, note: 'Vínculo de prueba.', sourceUrl: 'https://ejemplo.test/relacion' },
      { userId: null },
    );
    auditados.push(enlace.id);
  });

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { dni: { in: [dniReal, DNI_SIN_VINCULO] } } });
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
      { personId: personaId, ruc: rucEmpresa, note: 'Vínculo de prueba.', sourceUrl: 'https://ejemplo.test/relacion' },
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
          sourceUrl: '',
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
      sourceUrl: '',
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

  it('no deja publicar con una fuente que no dice nada', async () => {
    await expect(
      svc.crearPersona(
        {
          dni: '00000000',
          fullName: 'OTRA PERSONA',
          description: 'Descripción.',
          source: 'Un acta.',
          sourceUrl: '',
          isPublic: true,
          tagIds: [],
        },
        { userId: null },
      ),
    ).rejects.toThrow(/fuente tiene que ser concreta/);
  });

  it('no admite dos personas con el mismo DNI', async () => {
    await expect(
      svc.crearPersona(
        {
          dni: dniReal,
          fullName: 'DUPLICADA',
          description: 'Descripción.',
          source: 'Suite de pruebas automatizadas.',
          sourceUrl: '',
          isPublic: true,
          tagIds: [],
        },
        { userId: null },
      ),
    ).rejects.toThrow(/Ya hay una persona registrada/);
  });

  /** Reconstruye la entrada del formulario a partir de la ficha, para poder editarla. */
  function entradaDe(detalle: import('@/services/personsService').PersonaDetalle) {
    return {
      dni: detalle.dni,
      fullName: detalle.fullName,
      description: detalle.description,
      source: detalle.source,
      sourceUrl: detalle.sourceUrl ?? '',
      tagIds: detalle.etiquetas.map((etiqueta) => etiqueta.id),
    };
  }

  it('no publica una ficha que no señala a ningún proveedor', async () => {
    // El DNI elegido no puede coincidir con el RUC de nadie: si coincidiera, la ficha
    // tendría un vínculo y la prueba no mediría lo que quiere medir.
    const coincidencias = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n
      FROM "Supplier"
      WHERE "rucPrefix" = '10' AND substring(ruc FROM 3 FOR 8) = ${DNI_SIN_VINCULO}
    `;
    expect(Number(coincidencias[0]?.n ?? 0)).toBe(0);

    const creada = await svc.crearPersona(
      {
        dni: DNI_SIN_VINCULO,
        fullName: 'PERSONA SIN VINCULOS',
        description: 'Ficha sin ningún proveedor detrás.',
        source: 'Suite de pruebas.',
        sourceUrl: '',
        isPublic: true,
        tagIds: [tagId],
      },
      { userId: null },
    );
    auditados.push(creada.id);

    const publico = await svc.detalleDeEtiqueta(tagId);
    const panel = await svc.detalleDeEtiqueta(tagId, { soloPublicas: false });

    // No sale al portal: afirmaría algo sobre una persona sin señalar a nadie.
    expect(publico.personas.map((persona) => persona.fullName)).not.toContain(
      'PERSONA SIN VINCULOS',
    );

    // En el panel sí se ve, marcada, para poder completarla.
    const enPanel = panel.personas.find((persona) => persona.id === creada.id);
    expect(enPanel?.tieneVinculos).toBe(false);
  });

  it('una ficha oculta no se publica aunque tenga vínculos', async () => {
    const antes = await svc.personaPorId(personaId);

    // Editar una ficha que YA está publicada no reinicia la fecha de verificación.
    await svc.actualizarPersona(personaId, { ...entradaDe(antes), isPublic: true }, { userId: null });
    expect((await svc.personaPorId(personaId)).verifiedAt).toEqual(antes.verifiedAt);

    // Ocultarla la saca del portal...
    await svc.actualizarPersona(
      personaId,
      { ...entradaDe(antes), isPublic: false },
      { userId: null },
    );
    expect((await svc.detalleDeEtiqueta(tagId)).personas.map((p) => p.id)).not.toContain(personaId);

    // ...y volver a publicarla la devuelve, con fecha de verificación nueva.
    await svc.actualizarPersona(personaId, { ...entradaDe(antes), isPublic: true }, { userId: null });
    const republicada = await svc.personaPorId(personaId);

    expect(republicada.isPublic).toBe(true);
    expect(republicada.verifiedAt).not.toBeNull();
    expect(republicada.verifiedAt!.getTime()).toBeGreaterThanOrEqual(
      antes.verifiedAt?.getTime() ?? 0,
    );
    expect((await svc.detalleDeEtiqueta(tagId)).personas.map((p) => p.id)).toContain(personaId);
  });

  it('publica una ficha cuyo único vínculo se deduce del RUC', async () => {
    const detalle = await svc.personaPorId(personaId);
    const manual = detalle.vinculosManuales[0];
    expect(manual).toBeDefined();

    await svc.desvincularProveedor(manual!.id, { userId: null });
    auditados.push(manual!.id);

    try {
      const vinculados = await svc.proveedoresVinculados(personaId);
      // Solo queda el deducido del DNI: el manual está fuera.
      expect(vinculados.every((vinculo) => vinculo.origen === 'AUTOMATICO')).toBe(true);

      const publico = await svc.detalleDeEtiqueta(tagId);
      const ficha = publico.personas.find((persona) => persona.id === personaId);

      expect(ficha).toBeDefined();
      expect(ficha?.tieneVinculos).toBe(true);
      // La ficha pública lleva su fuente y la fecha en la que se verificó.
      expect(ficha?.sourceUrl).toBe('https://ejemplo.test/acta-de-prueba');
      expect(ficha?.verifiedAt).toBeInstanceOf(Date);
    } finally {
      // Se deja el vínculo como estaba para el resto de pruebas.
      const restaurado = await svc.vincularProveedor(
        { personId: personaId, ruc: rucEmpresa, note: 'Vínculo de prueba.', sourceUrl: 'https://ejemplo.test/relacion' },
        { userId: null },
      );
      auditados.push(restaurado.id);
    }
  });

  it('distingue el vínculo deducido del declarado a mano', async () => {
    const detalle = await svc.detalleDeEtiqueta(tagId);

    const deducido = detalle.proveedores.find((proveedor) => proveedor.ruc === rucNatural);
    const declarado = detalle.proveedores.find((proveedor) => proveedor.ruc === rucEmpresa);

    // El de la persona natural sale del DNI que lleva dentro su RUC.
    expect(deducido?.deducidos).toEqual(['PERSONA DE PRUEBA']);
    expect(deducido?.declarados).toEqual([]);

    // El de la empresa lo declaró la administración a mano.
    expect(declarado?.declarados).toEqual(['PERSONA DE PRUEBA']);
    expect(declarado?.deducidos).toEqual([]);
  });

  it('no vincula un RUC que no existe en el portal', async () => {
    await expect(
      svc.vincularProveedor(
        { personId: personaId, ruc: '00000000000', note: 'Relación documentada de prueba', sourceUrl: 'https://ejemplo.test/relacion' },
        { userId: null },
      ),
    ).rejects.toThrow(/No hay ningún proveedor con el RUC/);
  });
});
