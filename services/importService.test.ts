import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { periodoEnNombre } from '@/services/importService';

/**
 * Pruebas de la deducción del periodo de un libro.
 *
 * `periodoEnNombre` es pura y se prueba siempre. `detectarPeriodo` consulta los
 * catálogos de la base de datos (igual que `analizar`), así que sus pruebas son de
 * integración y se saltan si no hay `DATABASE_URL`, para que la suite siga siendo
 * ejecutable sin credenciales.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

/** Encabezados reales del Portal de Transparencia. */
const ENCABEZADOS = [
  'N°',
  'Tipo de Orden',
  'Número de orden',
  'Tipo de Contratación',
  'Descripción y Finalidad de la contratación',
  'Nro. Exp. SIAF',
  'Fecha de Emisión',
  'Fecha de Compromiso',
  'Estado',
  'Monto',
  'RUC',
  'Denominación o razón Social',
];

/** Fila con la misma forma que el libro real del portal. */
function fila(
  numero: number,
  fechaEmision: string | null,
  orden: string,
  ruc = '20541487710',
  razonSocial = 'PROVEEDOR DE PRUEBA S.A.C.',
  estado = 'Devengada',
): (string | null)[] {
  return [
    String(numero),
    'O/C',
    orden,
    'Contrataciones hasta 8 UIT (LEY 30225)',
    'Compra de prueba',
    '1740',
    fechaEmision,
    fechaEmision,
    estado,
    'S/. 100',
    ruc,
    razonSocial,
  ];
}

/** Construye un libro .xlsx en memoria, sin tocar el disco. */
function libro(filas: (string | null)[][]): Buffer {
  const hoja = XLSX.utils.aoa_to_sheet([ENCABEZADOS, ...filas]);
  const libroXlsx = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libroXlsx, hoja, 'Sheet0');
  return Buffer.from(XLSX.write(libroXlsx, { type: 'array', bookType: 'xlsx' }));
}

describe('periodoEnNombre', () => {
  it('lee el periodo de un nombre con año y mes', () => {
    expect(periodoEnNombre('Lista-OCOS-2023-06.xls')).toBe('2023-06');
  });

  it('admite el mes sin cero a la izquierda', () => {
    expect(periodoEnNombre('Lista-OCOS-2023-6.xls')).toBe('2023-06');
  });

  it('admite espacio, guion y guion bajo como separador', () => {
    expect(periodoEnNombre('libro 2023 06.xlsx')).toBe('2023-06');
    expect(periodoEnNombre('libro-2023-06.csv')).toBe('2023-06');
    expect(periodoEnNombre('libro_2023_06.csv')).toBe('2023-06');
  });

  it('admite el formato compacto AAAA-MM sin separador', () => {
    expect(periodoEnNombre('OCOS-202306.xls')).toBe('2023-06');
  });

  it('devuelve null cuando el nombre no trae periodo', () => {
    // Es el caso real: el portal publica a veces «Lista-OCOS (5).xls».
    expect(periodoEnNombre('Lista-OCOS (5).xls')).toBeNull();
    expect(periodoEnNombre('libro-2023.xls')).toBeNull();
    expect(periodoEnNombre('sin-fecha.xls')).toBeNull();
  });

  it('no confunde un mes imposible con un periodo', () => {
    expect(periodoEnNombre('Lista-2023-13.xls')).toBeNull();
    expect(periodoEnNombre('Lista-2023-00.xls')).toBeNull();
  });

  it('no recorta un número más largo para fabricar un periodo', () => {
    expect(periodoEnNombre('Lista-12023-06.xls')).toBeNull();
    expect(periodoEnNombre('Lista-2023-061.xls')).toBeNull();
  });
});

describe.skipIf(!hayBaseDeDatos)('detectarPeriodo contra la base real', () => {
  let svc: typeof import('@/services/importService');

  beforeAll(async () => {
    svc = await import('@/services/importService');
  });

  const RUTA_ARCHIVO = path.join(process.cwd(), 'docs', 'reference', 'Lista-OCOS-2023-06.xls');

  it('deduce 2023-06 del libro real del portal', async () => {
    const buffer = readFileSync(RUTA_ARCHIVO);
    const r = await svc.detectarPeriodo(buffer, 'Lista-OCOS-2023-06.xls');

    expect(r.periodoSugerido).toBe('2023-06');
    expect(r.mesesDetectados).toHaveLength(1);
    expect(r.filasLeidas).toBe(103);
    expect(r.periodoDelNombre).toBe('2023-06');
    expect(r.coincideConElNombre).toBe(true);
  });

  it('deduce el mes de un libro de un solo mes', async () => {
    const buffer = libro([
      fila(1, '2025-03-10 00:00:00.0', '1'),
      fila(2, '2025-03-20 00:00:00.0', '2'),
    ]);

    const r = await svc.detectarPeriodo(buffer, 'libro-sin-periodo.xlsx');

    expect(r.periodoSugerido).toBe('2025-03');
    expect(r.mesesDetectados).toEqual([{ periodo: '2025-03', filas: 2 }]);
    expect(r.periodoDelNombre).toBeNull();
    expect(r.coincideConElNombre).toBeNull();
  });

  it('con dos meses, sugiere el dominante y los lista todos', async () => {
    const buffer = libro([
      fila(1, '2025-03-10 00:00:00.0', '1'),
      fila(2, '2025-03-20 00:00:00.0', '2'),
      fila(3, '2025-04-02 00:00:00.0', '3'),
    ]);

    const r = await svc.detectarPeriodo(buffer, 'libro.xlsx');

    expect(r.periodoSugerido).toBe('2025-03');
    expect(r.mesesDetectados).toEqual([
      { periodo: '2025-03', filas: 2 },
      { periodo: '2025-04', filas: 1 },
    ]);
  });

  it('sin fechas legibles, no sugiere ningún periodo', async () => {
    const buffer = libro([fila(1, null, '1'), fila(2, null, '2')]);

    const r = await svc.detectarPeriodo(buffer, 'libro.xlsx');

    expect(r.periodoSugerido).toBeNull();
    expect(r.mesesDetectados).toEqual([]);
    expect(r.filasLeidas).toBe(2);
  });

  it('avisa cuando el nombre y el contenido no coinciden', async () => {
    const buffer = libro([fila(1, '2025-03-10 00:00:00.0', '1')]);

    const r = await svc.detectarPeriodo(buffer, 'Lista-OCOS-2022-01.xlsx');

    expect(r.periodoSugerido).toBe('2025-03');
    expect(r.periodoDelNombre).toBe('2022-01');
    expect(r.coincideConElNombre).toBe(false);
  });
});

describe.skipIf(!hayBaseDeDatos)('analizarDuplicadosDeContenido contra la base real', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  const NOMBRE = 'libro-duplicados-1999-03.xlsx';
  const RUC = '20666666666';

  let loteId = '';
  let clave: string | null = null;
  let claves: string[] = [];

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');

    // La prueba se siembra sus propias órdenes en lugar de leer las del portal: una
    // base recién vaciada es un estado normal, y estas pruebas tienen que pasar
    // igual.
    const analisis = await svc.analizar({
      buffer: libro([
        fila(1, '1999-03-05 00:00:00.0', 'DUP-1', RUC, 'PRUEBA DUPLICADOS S.A.C.'),
        fila(2, '1999-03-06 00:00:00.0', 'DUP-2', RUC, 'PRUEBA DUPLICADOS S.A.C.'),
      ]),
      originalFilename: NOMBRE,
      year: 1999,
      month: 3,
      importType: 'CONSOLIDADO',
      userId: null,
    });

    loteId = analisis.importBatchId;

    const lote = await prisma.importBatch.findUnique({
      where: { id: loteId },
      select: { storageKey: true },
    });
    clave = lote?.storageKey ?? null;

    await svc.confirmar({ importBatchId: loteId, userId: null, reemplazarPeriodo: true });

    const ordenes = await prisma.order.findMany({
      where: { importBatchId: loteId },
      orderBy: { sourceRow: 'asc' },
      select: { dedupeKey: true },
    });
    claves = ordenes.map((orden) => orden.dedupeKey);
  });

  afterAll(async () => {
    await prisma.importBatch.deleteMany({ where: { originalFilename: NOMBRE } });
    await prisma.supplier.deleteMany({ where: { ruc: RUC } });
    await prisma.auditLog.deleteMany({ where: { entityId: loteId } });

    if (clave) {
      await storage
        .getStorage()
        .remove(clave)
        .catch(() => undefined);
    }
  });

  it('ignora las filas sin clave y no consulta nada', async () => {
    const r = await svc.analizarDuplicadosDeContenido(['', '', '']);

    expect(r).toEqual({ filasNuevas: 0, filasRepetidas: 0, lotes: [] });
  });

  it('reconoce las claves que ya están en el portal', async () => {
    expect(claves).toHaveLength(2);

    const r = await svc.analizarDuplicadosDeContenido([
      ...claves,
      'INVENTADA|20999999999|1.00|2020-01-01',
    ]);

    expect(r.filasRepetidas).toBe(claves.length);
    expect(r.filasNuevas).toBe(1);
    expect(r.lotes.length).toBeGreaterThan(0);
  });

  it('cuenta dos veces una clave repetida que ya está en el portal', async () => {
    const r = await svc.analizarDuplicadosDeContenido([claves[0]!, claves[0]!]);

    expect(r.filasRepetidas).toBe(2);
    expect(r.filasNuevas).toBe(0);
  });

  it('no inventa duplicados con claves que no existen', async () => {
    const r = await svc.analizarDuplicadosDeContenido([
      'INVENTADA-A|20999999999|1.00|2020-01-01',
      'INVENTADA-B|20999999999|2.00|2020-01-02',
    ]);

    expect(r).toEqual({ filasNuevas: 2, filasRepetidas: 0, lotes: [] });
  });
});

describe.skipIf(!hayBaseDeDatos)('reimportar un libro no duplica sus órdenes', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');
  });

  /**
   * RUC y periodo de prueba. Ni el RUC ni el mes 1999-01 aparecen en los libros
   * reales, así que la prueba no puede pisar datos del portal; además borra todo lo
   * que crea, incluido el archivo original guardado.
   */
  const RUC = '20999999999';
  const NOMBRE = 'libro-duplicado-1999-01.xlsx';

  function libroDePrueba(): Buffer {
    return libro([
      fila(1, '1999-01-05 00:00:00.0', 'T-1', RUC, 'PRUEBA DUPLICADOS S.A.C.'),
      fila(2, '1999-01-06 00:00:00.0', 'T-2', RUC, 'PRUEBA DUPLICADOS S.A.C.'),
      fila(3, '1999-01-07 00:00:00.0', 'T-3', RUC, 'PRUEBA DUPLICADOS S.A.C.'),
    ]);
  }

  async function claveDeLote(id: string): Promise<string | null> {
    const lote = await prisma.importBatch.findUnique({
      where: { id },
      select: { storageKey: true },
    });
    return lote?.storageKey ?? null;
  }

  it('la segunda importación conserva el historial sin duplicar el universo vigente', async () => {
    const existiaAntes = await prisma.supplier.findUnique({
      where: { ruc: RUC },
      select: { id: true },
    });

    // El MISMO buffer para las dos importaciones: es el caso real de volver a
    // soltar el mismo archivo.
    const buffer = libroDePrueba();
    const claves: string[] = [];

    try {
      // Primera importación: las tres filas entran.
      const primero = await svc.analizar({
        buffer,
        originalFilename: NOMBRE,
        year: 1999,
        month: 1,
        importType: 'CONSOLIDADO',
        userId: null,
      });
      const clave = await claveDeLote(primero.importBatchId);
      if (clave) claves.push(clave);

      const r1 = await svc.confirmar({
        importBatchId: primero.importBatchId,
        userId: null,
        reemplazarPeriodo: true,
      });

      expect(r1.ordenesInsertadas).toBe(3);
      expect(r1.ordenesOmitidasPorDuplicado).toBe(0);

      // Segunda vuelta: el análisis ya reconoce el libro por su huella y por su
      // contenido.
      const segundo = await svc.analizar({
        buffer,
        originalFilename: NOMBRE,
        year: 1999,
        month: 1,
        importType: 'CONSOLIDADO',
        userId: null,
      });

      expect(segundo.loteMismoChecksum?.id).toBe(primero.importBatchId);
      expect(segundo.duplicadoContenido.filasRepetidas).toBe(3);
      expect(segundo.duplicadoContenido.filasNuevas).toBe(0);

      // La nueva instantánea conserva todas las filas y archiva la anterior.
      const r2 = await svc.confirmar({
        importBatchId: segundo.importBatchId,
        userId: null,
        reemplazarPeriodo: true,
      });

      expect(r2.ordenesInsertadas).toBe(3);
      expect(r2.ordenesOmitidasPorDuplicado).toBe(0);

      // La comprobación de fondo: no hay órdenes de más.
      expect(await prisma.order.count({ where: { ruc: RUC } })).toBe(6);
      expect(await prisma.order.count({ where: { ruc: RUC, importBatch: { isCurrent: true } } })).toBe(3);
    } finally {
      // Los lotes se llevan sus órdenes y hallazgos por cascada.
      const creados = await prisma.importBatch.findMany({
        where: { originalFilename: NOMBRE },
        select: { id: true },
      });

      await prisma.importBatch.deleteMany({ where: { originalFilename: NOMBRE } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: creados.map((lote) => lote.id) } },
      });
      if (!existiaAntes) await prisma.supplier.deleteMany({ where: { ruc: RUC } });
      for (const clave of claves) {
        await storage
          .getStorage()
          .remove(clave)
          .catch(() => undefined);
      }
    }
  });
});

describe.skipIf(!hayBaseDeDatos)('eliminarImportacion contra la base real', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');
  });

  /**
   * RUC y meses de prueba. Julio, agosto y setiembre de 2023 caen dentro de la
   * gestión 2023-2026: es lo que hace falta para que el lote genere un resumen por
   * gestión, que es justo lo que hay que limpiar al borrarlo.
   */
  const RUC = '20888888888';
  const RUC_HUERFANO = '20999999991';
  const NOMBRE_A = 'libro-eliminar-a-2023-07.xlsx';
  const NOMBRE_B = 'libro-eliminar-b-2023-08.xlsx';
  const NOMBRE_C = 'libro-eliminar-c-2023-09.xlsx';
  const NOMBRE_D = 'libro-eliminar-d-2023-10.xlsx';

  const lotes: string[] = [];
  const claves: string[] = [];

  /** Importa un libro de prueba y devuelve el identificador de su lote. */
  async function importar(
    nombre: string,
    month: number,
    filas: (string | null)[][],
  ): Promise<string> {
    const analisis = await svc.analizar({
      buffer: libro(filas),
      originalFilename: nombre,
      year: 2023,
      month,
      importType: 'CONSOLIDADO',
      userId: null,
    });

    lotes.push(analisis.importBatchId);

    const lote = await prisma.importBatch.findUnique({
      where: { id: analisis.importBatchId },
      select: { storageKey: true },
    });
    if (lote?.storageKey) claves.push(lote.storageKey);

    await svc.confirmar({
      importBatchId: analisis.importBatchId,
      userId: null,
      reemplazarPeriodo: true,
    });

    return analisis.importBatchId;
  }

  afterAll(async () => {
    await prisma.importBatch.deleteMany({
      where: { originalFilename: { in: [NOMBRE_A, NOMBRE_B, NOMBRE_C, NOMBRE_D] } },
    });
    await prisma.supplier.deleteMany({ where: { ruc: { in: [RUC, RUC_HUERFANO] } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: lotes } } });

    for (const clave of claves) {
      await storage
        .getStorage()
        .remove(clave)
        .catch(() => undefined);
    }
  });

  it('borra el lote y sus órdenes, y conserva el proveedor mientras le queden otras', async () => {
    const loteA = await importar(NOMBRE_A, 7, [
      fila(1, '2023-07-05 00:00:00.0', 'EA-1', RUC, 'PRUEBA ELIMINAR S.A.C.'),
      fila(2, '2023-07-06 00:00:00.0', 'EA-2', RUC, 'PRUEBA ELIMINAR S.A.C.'),
    ]);

    await importar(NOMBRE_B, 8, [
      fila(1, '2023-08-05 00:00:00.0', 'EB-1', RUC, 'PRUEBA ELIMINAR S.A.C.'),
      fila(2, '2023-08-06 00:00:00.0', 'EB-2', RUC, 'PRUEBA ELIMINAR S.A.C.'),
    ]);

    const proveedor = await prisma.supplier.findUnique({
      where: { ruc: RUC },
      select: { id: true },
    });
    expect(proveedor).not.toBeNull();
    expect(await prisma.order.count({ where: { supplierId: proveedor!.id } })).toBe(4);

    const resultado = await svc.eliminarImportacion({ importBatchId: loteA, userId: null });

    expect(resultado.ordenesEliminadas).toBe(2);
    expect(resultado.proveedoresEliminados).toBe(0);
    expect(resultado.proveedoresConservados).toBe(1);
    expect(resultado.archivoEliminado).toBe(true);

    expect(await prisma.importBatch.findUnique({ where: { id: loteA } })).toBeNull();
    expect(await prisma.order.count({ where: { supplierId: proveedor!.id } })).toBe(2);

    // El resumen se rehace: no puede seguir contando las órdenes que se borraron.
    const restante = await prisma.order.findFirst({
      where: { supplierId: proveedor!.id },
      select: { managementPeriodId: true },
    });
    expect(restante?.managementPeriodId).toBeTruthy();

    const resumen = await prisma.supplierManagementSummary.findUnique({
      where: {
        supplierId_managementPeriodId: {
          supplierId: proveedor!.id,
          managementPeriodId: restante!.managementPeriodId!,
        },
      },
      select: { orderCount: true },
    });
    expect(resumen?.orderCount).toBe(2);

    // El rastro sobrevive al lote: la auditoría no tiene clave foránea hacia él.
    const rastro = await prisma.auditLog.findFirst({
      where: { entity: 'ImportBatch', entityId: loteA, action: 'DELETE' },
    });
    expect(rastro).not.toBeNull();
  });

  it('si no se piden, los proveedores sin órdenes se conservan y su resumen se borra', async () => {
    const loteB = await prisma.importBatch.findFirst({
      where: { originalFilename: NOMBRE_B },
      select: { id: true },
    });
    expect(loteB).not.toBeNull();

    const resultado = await svc.eliminarImportacion({
      importBatchId: loteB!.id,
      userId: null,
      borrarProveedoresHuerfanos: false,
    });

    expect(resultado.ordenesEliminadas).toBe(2);
    expect(resultado.proveedoresEliminados).toBe(0);
    expect(resultado.proveedoresConservados).toBe(1);

    const proveedor = await prisma.supplier.findUnique({
      where: { ruc: RUC },
      select: { id: true },
    });
    expect(proveedor).not.toBeNull();

    // Sin órdenes, el resumen no se queda en cero: desaparece.
    expect(
      await prisma.supplierManagementSummary.count({ where: { supplierId: proveedor!.id } }),
    ).toBe(0);
  });

  it('borra los proveedores que se quedan sin ninguna orden', async () => {
    const loteC = await importar(NOMBRE_C, 9, [
      fila(1, '2023-09-05 00:00:00.0', 'EC-1', RUC_HUERFANO, 'PRUEBA HUERFANA S.A.C.'),
    ]);

    const resultado = await svc.eliminarImportacion({ importBatchId: loteC, userId: null });

    expect(resultado.ordenesEliminadas).toBe(1);
    expect(resultado.proveedoresEliminados).toBe(1);
    expect(resultado.proveedoresConservados).toBe(0);
    expect(
      await prisma.supplier.findUnique({ where: { ruc: RUC_HUERFANO }, select: { id: true } }),
    ).toBeNull();
  });

  it('no elimina una importación que se está procesando ahora mismo', async () => {
    const lote = await prisma.importBatch.create({
      data: {
        filename: 'prueba-en-proceso',
        originalFilename: NOMBRE_D,
        // Periodo imposible en los libros reales: el lote de prueba comparte clave
        // única (año, mes, tipo, versión) con las importaciones de verdad.
        year: 1998,
        month: 1,
        period: '1998-01',
        importType: 'CONSOLIDADO',
        version: 1,
        checksum: 'prueba-en-proceso',
        status: 'PROCESSING',
        // Arrancado hace un instante: el lote está vivo, no colgado.
        processingStartedAt: new Date(),
      },
      select: { id: true },
    });

    await expect(
      svc.eliminarImportacion({ importBatchId: lote.id, userId: null }),
    ).rejects.toThrow(/se está procesando/);

    await prisma.importBatch.delete({ where: { id: lote.id } });
  });
});

describe.skipIf(!hayBaseDeDatos)('decisiones sobre las filas antes de importar', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  const NOMBRE = 'libro-exclusion-2023-07.xlsx';
  // Inventados, pero con el dígito verificador válido: si no lo fuera, cada fila
  // traería su propia advertencia y la prueba no mediría lo que quiere medir.
  const RUC_LIMPIO = '20444444445';
  const RUC_AVISO = '20555555556';

  let analisis: Awaited<ReturnType<typeof svc.analizar>>;
  let clave: string | null = null;

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');

    analisis = await svc.analizar({
      buffer: libro([
        fila(1, '2023-07-05 00:00:00.0', 'EX-1', RUC_LIMPIO, 'LIMPIO UNO S.A.C.'),
        fila(2, '2023-07-06 00:00:00.0', 'EX-2', RUC_LIMPIO, 'LIMPIO DOS S.A.C.'),
        // Sin razón social: advertencia. Se importaría tal cual, y es la fila que se va
        // a dejar fuera en la segunda prueba.
        fila(3, '2023-07-07 00:00:00.0', 'EX-3', RUC_AVISO, ''),
        // Sin RUC: error. No se puede importar: una orden necesita proveedor.
        fila(4, '2023-07-08 00:00:00.0', 'EX-4', '', ''),
      ]),
      originalFilename: NOMBRE,
      year: 2023,
      month: 7,
      importType: 'CONSOLIDADO',
      userId: null,
    });

    const lote = await prisma.importBatch.findUnique({
      where: { id: analisis.importBatchId },
      select: { storageKey: true },
    });
    clave = lote?.storageKey ?? null;
  });

  afterAll(async () => {
    await prisma.importBatch.deleteMany({ where: { originalFilename: NOMBRE } });
    await prisma.supplier.deleteMany({ where: { ruc: { in: [RUC_LIMPIO, RUC_AVISO] } } });
    await prisma.auditLog.deleteMany({ where: { entityId: analisis.importBatchId } });

    if (clave) {
      await storage
        .getStorage()
        .remove(clave)
        .catch(() => undefined);
    }
  });

  it('devuelve las filas que se importarían con algo que revisar, con sus datos', () => {
    expect(analisis.filasConHallazgos).toHaveLength(1);

    const fila = analisis.filasConHallazgos[0]!;

    expect(fila.orderNumber).toBe('EX-3');
    expect(fila.ruc).toBe(RUC_AVISO);
    expect(fila.issues.map((issue) => issue.code)).toContain('PROVEEDOR_NOMBRE_VACIO');

    // Solo están las que se pueden importar: las que tienen un error no se pueden
    // incluir ni excluir, no hay nada que decidir sobre ellas.
    expect(
      analisis.filasConHallazgos.some((candidata) =>
        candidata.issues.some((issue) => issue.severity === 'ERROR'),
      ),
    ).toBe(false);
  });

  it('deja fuera la fila indicada, sin crear su proveedor ni su resumen', async () => {
    const aviso = analisis.filasConHallazgos[0]!;

    const resultado = await svc.confirmar({
      importBatchId: analisis.importBatchId,
      userId: null,
      reemplazarPeriodo: true,
      filasExcluidas: [aviso.sourceRow],
    });

    expect(resultado.ordenesInsertadas).toBe(2);
    expect(resultado.ordenesExcluidasPorDecision).toBe(1);

    // Las dos filas limpias entraron y la dejada fuera no.
    expect(await prisma.order.count({ where: { ruc: RUC_LIMPIO } })).toBe(2);
    expect(await prisma.order.count({ where: { orderNumber: 'EX-3' } })).toBe(0);
    expect(await prisma.order.count({ where: { orderNumber: 'EX-4' } })).toBe(0);

    // El proveedor de la fila dejada fuera no llega a existir: si se filtrara más
    // tarde, quedaría una ficha en cero en el listado público.
    expect(
      await prisma.supplier.findUnique({ where: { ruc: RUC_AVISO }, select: { id: true } }),
    ).toBeNull();
  });
});

describe.skipIf(!hayBaseDeDatos)('estados ya clasificados en el catálogo', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  const NOMBRE = 'libro-estados-2023-08.xlsx';
  // Inventado, con el dígito verificador válido.
  const RUC = '20333333334';

  let analisis: Awaited<ReturnType<typeof svc.analizar>>;
  let clave: string | null = null;

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');

    analisis = await svc.analizar({
      buffer: libro([
        fila(1, '2023-08-05 00:00:00.0', 'EE-1', RUC, 'PROVEEDOR DE PRUEBA S.A.C.', 'Emitida'),
        fila(2, '2023-08-06 00:00:00.0', 'EE-2', RUC, 'PROVEEDOR DE PRUEBA S.A.C.', 'Comprometida'),
      ]),
      originalFilename: NOMBRE,
      year: 2023,
      month: 8,
      importType: 'CONSOLIDADO',
      userId: null,
    });

    const lote = await prisma.importBatch.findUnique({
      where: { id: analisis.importBatchId },
      select: { storageKey: true },
    });
    clave = lote?.storageKey ?? null;
  });

  afterAll(async () => {
    await prisma.importBatch.deleteMany({ where: { originalFilename: NOMBRE } });
    await prisma.supplier.deleteMany({ where: { ruc: RUC } });
    await prisma.auditLog.deleteMany({ where: { entityId: analisis.importBatchId } });

    if (clave) {
      await storage
        .getStorage()
        .remove(clave)
        .catch(() => undefined);
    }
  });

  it('no marca como desconocido un estado que el catálogo ya clasifica', () => {
    const desconocidos = analisis.issues.filter((issue) => issue.code === 'ESTADO_DESCONOCIDO');

    expect(desconocidos).toHaveLength(0);
    // Y suma al monto considerado: es la decisión que tomó el administrador al
    // clasificar «Emitida» y «Comprometida» como gasto.
    expect(analisis.summary.consideredCents).toBe(analisis.summary.registeredCents);
  });

  it('guarda cada orden con su estado y sin marcarla como anulada', async () => {
    await svc.confirmar({
      importBatchId: analisis.importBatchId,
      userId: null,
      reemplazarPeriodo: true,
    });

    const ordenes = await prisma.order.findMany({
      where: { importBatchId: analisis.importBatchId },
      orderBy: { sourceRow: 'asc' },
      select: {
        isCancelled: true,
        status: { select: { code: true, countsEconomically: true } },
      },
    });

    expect(ordenes.map((orden) => orden.status?.code)).toEqual(['EMITIDA', 'COMPROMETIDA']);
    expect(ordenes.every((orden) => !orden.isCancelled)).toBe(true);
    expect(ordenes.every((orden) => orden.status?.countsEconomically === true)).toBe(true);
  });
});

describe.skipIf(!hayBaseDeDatos)('atomicidad y recuperación del importador', () => {
  let svc: typeof import('@/services/importService');
  let prisma: typeof import('@/lib/prisma').prisma;
  let storage: typeof import('@/services/storageService');

  // Periodo imposible en los libros reales, para no chocar con datos de verdad.
  const ANIO = 1996;
  const RUC = '20666666667';
  const NOMBRES = [
    'libro-atomico-1.xlsx',
    'libro-atomico-2.xlsx',
    'libro-atomico-3.xlsx',
    'libro-atomico-4.xlsx',
    'libro-atomico-5a.xlsx',
    'libro-atomico-5b.xlsx',
  ];

  const lotes: string[] = [];
  const claves: string[] = [];

  beforeAll(async () => {
    svc = await import('@/services/importService');
    ({ prisma } = await import('@/lib/prisma'));
    storage = await import('@/services/storageService');
  });

  afterAll(async () => {
    await prisma.importBatch.deleteMany({ where: { originalFilename: { in: NOMBRES } } });
    await prisma.supplier.deleteMany({ where: { ruc: RUC } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: lotes } } });

    for (const clave of claves) {
      await storage
        .getStorage()
        .remove(clave)
        .catch(() => undefined);
    }
  });

  /** Guarda el lote y la clave de su archivo para la limpieza final. */
  async function recordarLote(id: string): Promise<void> {
    lotes.push(id);
    const lote = await prisma.importBatch.findUnique({
      where: { id },
      select: { storageKey: true },
    });
    if (lote?.storageKey) claves.push(lote.storageKey);
  }

  /** Crea un lote en VALIDATING a partir de un libro de una sola fila. */
  async function analizarLote(nombre: string, month: number, orden: string) {
    const resultado = await svc.analizar({
      buffer: libro([fila(1, `1996-${String(month).padStart(2, '0')}-05 00:00:00.0`, orden, RUC)]),
      originalFilename: nombre,
      year: ANIO,
      month,
      importType: 'CONSOLIDADO',
      userId: null,
    });

    await recordarLote(resultado.importBatchId);
    return resultado;
  }

  /** Deja el lote como si su proceso hubiera muerto hace un rato. */
  async function colgar(id: string): Promise<void> {
    await prisma.importBatch.update({
      where: { id },
      data: { status: 'PROCESSING', processingStartedAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
  }

  it('confirma un lote cuyo proceso había caducado y anota la recuperación', async () => {
    const { importBatchId } = await analizarLote('libro-atomico-1.xlsx', 1, 'AT-1');
    await colgar(importBatchId);

    const resultado = await svc.confirmar({
      importBatchId,
      userId: null,
      reemplazarPeriodo: true,
    });

    expect(resultado.ordenesInsertadas).toBe(1);

    const lote = await prisma.importBatch.findUnique({
      where: { id: importBatchId },
      select: { status: true },
    });
    expect(lote?.status).toMatch(/^COMPLETED/);

    const recuperacion = await prisma.auditLog.findFirst({
      where: { entityId: importBatchId, action: 'UPDATE' },
      select: { metadata: true },
    });
    expect(JSON.stringify(recuperacion?.metadata ?? {})).toContain('caducado');
  });

  it('rechaza confirmar un lote que se está procesando ahora mismo', async () => {
    const { importBatchId } = await analizarLote('libro-atomico-2.xlsx', 2, 'AT-2');

    await prisma.importBatch.update({
      where: { id: importBatchId },
      data: { status: 'PROCESSING', processingStartedAt: new Date() },
    });

    await expect(
      svc.confirmar({ importBatchId, userId: null, reemplazarPeriodo: true }),
    ).rejects.toThrow(/se está procesando/);
  });

  it('solo una de dos confirmaciones simultáneas procesa el lote', async () => {
    const { importBatchId } = await analizarLote('libro-atomico-3.xlsx', 3, 'AT-3');

    const resultados = await Promise.allSettled([
      svc.confirmar({ importBatchId, userId: null, reemplazarPeriodo: true }),
      svc.confirmar({ importBatchId, userId: null, reemplazarPeriodo: true }),
    ]);

    const cumplidas = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    expect(cumplidas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(String(rechazadas[0]?.reason)).toMatch(/se está procesando|ya fue importado/);
  });

  it('elimina una importación cuyo proceso quedó colgado', async () => {
    const { importBatchId } = await analizarLote('libro-atomico-4.xlsx', 4, 'AT-4');
    await colgar(importBatchId);

    const resultado = await svc.eliminarImportacion({ importBatchId, userId: null });

    expect(resultado.ordenesEliminadas).toBe(0);
    expect(await prisma.importBatch.findUnique({ where: { id: importBatchId } })).toBeNull();
  });

  it('reparte versiones distintas cuando dos análisis del mismo periodo se cruzan', async () => {
    const [a, b] = await Promise.all([
      svc.analizar({
        buffer: libro([fila(1, '1996-05-05 00:00:00.0', 'AT-V1', RUC)]),
        originalFilename: 'libro-atomico-5a.xlsx',
        year: ANIO,
        month: 5,
        importType: 'CONSOLIDADO',
        userId: null,
      }),
      svc.analizar({
        buffer: libro([fila(1, '1996-05-06 00:00:00.0', 'AT-V2', RUC)]),
        originalFilename: 'libro-atomico-5b.xlsx',
        year: ANIO,
        month: 5,
        importType: 'CONSOLIDADO',
        userId: null,
      }),
    ]);

    await recordarLote(a.importBatchId);
    await recordarLote(b.importBatchId);

    const versiones = [a.version, b.version].sort((x, y) => x - y);
    expect(versiones[0]).not.toBe(versiones[1]);
  });
});
