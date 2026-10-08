import 'dotenv/config';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Prueba de integración del portal público contra la base de datos real.
 *
 * Contrasta cada cifra con las medidas durante la construcción
 * (`scripts/diagnostico-datos.ts`). Es la red de seguridad: si alguien cambia una
 * consulta y altera un total, esta prueba lo dice con el número exacto.
 *
 * Los montos se comparan como CADENA decimal, nunca como número, porque es así
 * como viajan en la aplicación y es la única forma de detectar un error de
 * redondeo.
 *
 * Se salta si no hay base de datos configurada, para que la suite siga siendo
 * ejecutable sin credenciales. El módulo se importa de forma dinámica para que el
 * salto sea real: `lib/prisma.ts` valida el entorno al importarse.
 */

const hayBaseDeDatos = process.env.INTEGRATION_TESTS_ENABLED === '1';

/**
 * Estas pruebas contrastan las cifras publicadas del libro de referencia (2023-06), y
 * los totales que comprueban son globales: solo valen si la base contiene ESE libro y
 * ningún otro.
 *
 * Se decide ANTES de declarar la suite, y no dentro de `beforeAll`, porque un error ahí
 * marca el fichero entero como fallido: `npm test` terminaría en rojo aunque no hubiera
 * nada roto, que es justo lo que hay que evitar en una suite que depende de datos.
 */
async function haySoloElLibroDeReferencia(): Promise<boolean> {
  if (!hayBaseDeDatos) return false;

  const { prisma } = await import('@/lib/prisma');

  const importados = await prisma.importBatch.findMany({
    where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } },
    select: { originalFilename: true },
  });

  if (importados.length !== 1) return false;

  return /lista-ocos-2023-06/i.test(importados[0]?.originalFilename ?? '');
}

const conElLibroDeReferencia = await haySoloElLibroDeReferencia();

describe.skipIf(!conElLibroDeReferencia)('statisticsService contra la base real', () => {
  let svc: typeof import('@/services/statisticsService');
  let filtros: typeof import('@/lib/filtros');

  beforeAll(async () => {
    svc = await import('@/services/statisticsService');
    filtros = await import('@/lib/filtros');
  });

  describe('resumen general (las tarjetas)', () => {
    it('cuenta 103 órdenes y 72 proveedores', async () => {
      const r = await svc.resumenGeneral();

      expect(r.ordenes).toBe(103);
      expect(r.proveedores).toBe(72);
    });

    it('reparte los proveedores por tipo de RUC', async () => {
      const r = await svc.resumenGeneral();

      expect(r.proveedoresRuc10).toBe(56);
      expect(r.proveedoresRuc20).toBe(16);
      // Los dos tipos deben sumar el total: no hay RUC con otro prefijo.
      expect(r.proveedoresRuc10 + r.proveedoresRuc20).toBe(r.proveedores);
    });

    it('reproduce los montos exactos, como cadena decimal', async () => {
      const r = await svc.resumenGeneral();

      expect(r.totalRegistrado).toBe('1066136.59');
      expect(r.totalAnulado).toBe('38994.87');
      expect(r.totalConsiderado).toBe('1027141.72');
    });

    it('el considerado es el registrado menos el anulado', async () => {
      const r = await svc.resumenGeneral();

      // Comprobado en centavos para no arrastrar error de coma flotante.
      const centavos = (v: string) => Math.round(Number(v) * 100);
      expect(centavos(r.totalRegistrado) - centavos(r.totalAnulado)).toBe(
        centavos(r.totalConsiderado),
      );
    });

    it('reporta la cobertura real: un solo periodo cargado', async () => {
      const r = await svc.resumenGeneral();

      expect(r.mesesCargados).toBe(1);
      expect(r.aniosCargados).toBe(1);
      expect(r.primerPeriodo).toBe('2023-06');
      expect(r.ultimoPeriodo).toBe('2023-06');
      expect(r.ordenesAnuladas).toBe(1);
    });
  });

  describe('ranking de proveedores', () => {
    it('sitúa a URRUCHI primero, con 13 órdenes', async () => {
      const ranking = await svc.rankingProveedores(10);
      const primero = ranking[0];

      expect(primero?.ruc).toBe('20610345990');
      expect(primero?.nombre).toBe('INVERSIONES URRUCHI S.A.C.');
      expect(primero?.ordenes).toBe(13);
      expect(primero?.considerado).toBe('370716.09');
    });

    it('calcula el peso sobre el total considerado', async () => {
      const ranking = await svc.rankingProveedores(10);

      // 370716.09 sobre 1027141.72 es el 36,1% del monto considerado.
      expect(ranking[0]?.peso).toBeCloseTo(36.1, 1);
      // Los diez primeros no pueden sumar más del 100%.
      const sumaPesos = ranking.reduce((a, f) => a + f.peso, 0);
      expect(sumaPesos).toBeLessThanOrEqual(100);
    });

    it('devuelve los resultados ordenados de mayor a menor', async () => {
      const ranking = await svc.rankingProveedores(10);
      const montos = ranking.map((f) => Number(f.considerado));

      for (let i = 1; i < montos.length; i++) {
        expect(montos[i]).toBeLessThanOrEqual(montos[i - 1] as number);
      }
    });

    it('marca la única orden anulada del archivo', async () => {
      const ranking = await svc.rankingProveedores(10);
      const conAnulada = ranking.filter((f) => f.anuladas > 0);

      // La orden 245 anulada pertenece a URRUCHI.
      expect(conAnulada).toHaveLength(1);
      expect(conAnulada[0]?.ruc).toBe('20610345990');
    });
  });

  describe('evolución', () => {
    it('devuelve un único punto mensual, coherente con la cobertura', async () => {
      const mensual = await svc.evolucionMensual();

      expect(mensual).toHaveLength(1);
      expect(mensual[0]?.periodo).toBe('2023-06');
      expect(mensual[0]?.ordenes).toBe(103);
      expect(mensual[0]?.registrado).toBe('1066136.59');
      expect(mensual[0]?.considerado).toBe('1027141.72');
    });

    it('devuelve un único punto anual', async () => {
      const anual = await svc.evolucionAnual();

      expect(anual).toHaveLength(1);
      expect(anual[0]?.periodo).toBe('2023');
    });
  });

  describe('gasto por gestión', () => {
    it('lista las tres gestiones, aunque dos no tengan datos', async () => {
      const gestiones = await svc.gastoPorGestion();

      expect(gestiones).toHaveLength(3);
      expect(gestiones.map((g) => g.gestion)).toEqual(['2015-2018', '2019-2022', '2023-2026']);
    });

    it('solo la gestión 2023-2026 tiene órdenes', async () => {
      const gestiones = await svc.gastoPorGestion();
      const conDatos = gestiones.filter((g) => g.ordenes > 0);

      expect(conDatos).toHaveLength(1);
      expect(conDatos[0]?.gestion).toBe('2023-2026');
      expect(conDatos[0]?.ordenes).toBe(103);
      expect(conDatos[0]?.proveedores).toBe(72);
      expect(conDatos[0]?.considerado).toBe('1027141.72');
    });

    it('las gestiones sin datos quedan en cero, no en null', async () => {
      const gestiones = await svc.gastoPorGestion();

      for (const g of gestiones.filter((x) => x.ordenes === 0)) {
        expect(g.considerado).toBe('0.00');
        expect(g.proveedores).toBe(0);
      }
    });
  });

  describe('tipos de contratación', () => {
    it('expone el hallazgo: 5 órdenes concentran el 32% del monto', async () => {
      const contrataciones = await svc.tiposContratacion(6);
      const procesos = contrataciones.find((c) => c.etiqueta.includes('Procesos de Selección'));

      expect(procesos).toBeDefined();
      expect(procesos?.ordenes).toBe(5);
      expect(procesos?.considerado).toBe('328629.95');

      // 328629.95 sobre 1027141.72 es el 32,0%.
      const peso = (Number(procesos?.considerado) / 1027141.72) * 100;
      expect(peso).toBeCloseTo(32.0, 1);
    });

    it('conserva el defecto del origen en la etiqueta larga', async () => {
      const contrataciones = await svc.tiposContratacion(6);
      const ochoUit = contrataciones.find((c) => c.etiqueta.includes('8 UIT'));

      // El doble paréntesis es del archivo fuente y no se corrige.
      expect(ochoUit?.etiqueta).toContain('((No incluye');
      expect(ochoUit?.ordenes).toBe(98);
    });
  });

  describe('reparto por tipo de orden', () => {
    it('reparte 40 órdenes de compra y 63 de servicio', async () => {
      const tipos = await svc.repartoPorTipoOrden();
      const porCodigo = Object.fromEntries(tipos.map((t) => [t.codigo, t]));

      expect(porCodigo['O/C']?.ordenes).toBe(40);
      expect(porCodigo['O/C']?.registrado).toBe('886667.69');
      expect(porCodigo['O/S']?.ordenes).toBe(63);
      expect(porCodigo['O/S']?.registrado).toBe('179468.90');
    });

    it('los dos tipos suman las 103 órdenes', async () => {
      const tipos = await svc.repartoPorTipoOrden();
      const total = tipos.reduce((a, t) => a + t.ordenes, 0);

      expect(total).toBe(103);
    });
  });

  describe('últimos registros', () => {
    it('devuelve ocho registros con proveedor y estado', async () => {
      const ultimos = await svc.ultimosRegistros(8);

      expect(ultimos).toHaveLength(8);
      for (const registro of ultimos) {
        expect(registro.proveedor).not.toBe('');
        expect(registro.ruc).toHaveLength(11);
        expect(registro.orderNumber).not.toBe('');
      }
    });

    it('ordena por fecha de emisión descendente', async () => {
      const ultimos = await svc.ultimosRegistros(8);
      const fechas = ultimos
        .map((r) => r.issueDate?.getTime() ?? 0)
        .filter((t) => t > 0);

      for (let i = 1; i < fechas.length; i++) {
        expect(fechas[i]).toBeLessThanOrEqual(fechas[i - 1] as number);
      }
    });
  });

  describe('coherencia entre bloques', () => {
    it('la suma del considerado por gestión coincide con el total', async () => {
      const [resumen, gestiones] = await Promise.all([svc.resumenGeneral(), svc.gastoPorGestion()]);

      const suma = gestiones.reduce((a, g) => a + Math.round(Number(g.considerado) * 100), 0);
      expect(suma).toBe(Math.round(Number(resumen.totalConsiderado) * 100));
    });

    it('la suma del considerado por mes coincide con el total', async () => {
      const [resumen, mensual] = await Promise.all([svc.resumenGeneral(), svc.evolucionMensual()]);

      const suma = mensual.reduce((a, p) => a + Math.round(Number(p.considerado) * 100), 0);
      expect(suma).toBe(Math.round(Number(resumen.totalConsiderado) * 100));
    });

    it('la suma del considerado por tipo de orden coincide con el total', async () => {
      const [resumen, tipos] = await Promise.all([svc.resumenGeneral(), svc.repartoPorTipoOrden()]);

      const suma = tipos.reduce((a, t) => a + Math.round(Number(t.considerado) * 100), 0);
      expect(suma).toBe(Math.round(Number(resumen.totalConsiderado) * 100));
    });

    it('ningún bloque incluye la orden anulada en el considerado', async () => {
      const [resumen, gestiones, tipos] = await Promise.all([
        svc.resumenGeneral(),
        svc.gastoPorGestion(),
        svc.repartoPorTipoOrden(),
      ]);

      // El registrado supera al considerado exactamente en lo anulado.
      const diferencia = Math.round(
        (Number(resumen.totalRegistrado) - Number(resumen.totalConsiderado)) * 100,
      );
      expect(diferencia).toBe(3899487);

      // Y el considerado nunca puede superar al registrado en ningún bloque.
      for (const g of gestiones) {
        expect(Number(g.considerado)).toBeLessThanOrEqual(Number(resumen.totalRegistrado));
      }
      for (const t of tipos) {
        expect(Number(t.considerado)).toBeLessThanOrEqual(Number(t.registrado));
      }
    });
  });

  describe('datosPortada', () => {
    it('reúne todos los bloques en una sola llamada', async () => {
      const datos = await svc.datosPortada();

      expect(datos.resumen.ordenes).toBe(103);
      expect(datos.ranking.length).toBeGreaterThan(0);
      expect(datos.mensual.length).toBe(1);
      expect(datos.anual.length).toBe(1);
      expect(datos.gestiones).toHaveLength(3);
      expect(datos.contrataciones.length).toBeGreaterThan(0);
      expect(datos.tiposOrden).toHaveLength(2);
      expect(datos.ultimos).toHaveLength(8);
    });
  });

  describe('listado de órdenes', () => {
    it('devuelve solo una página, no las 103 órdenes', async () => {
      const r = await svc.listarOrdenes(filtros.filtrosPorDefecto());

      // Es la comprobación clave de la sección 22: no se cargan miles de
      // registros. Si alguien quitara el `take`, esta prueba lo detectaría.
      expect(r.filas).toHaveLength(20);
      expect(r.total).toBe(103);
      expect(r.totalPaginas).toBe(6);
    });

    it('la última página trae solo las filas que quedan', async () => {
      const r = await svc.listarOrdenes(filtros.leerFiltros({ pagina: '6' }));

      // 103 = 5 páginas completas de 20 más 3 filas.
      expect(r.filas).toHaveLength(3);
    });

    it('las páginas no repiten filas', async () => {
      const [p1, p2] = await Promise.all([
        svc.listarOrdenes(filtros.leerFiltros({ pagina: '1' })),
        svc.listarOrdenes(filtros.leerFiltros({ pagina: '2' })),
      ]);

      const ids1 = new Set(p1.filas.map((f) => f.id));
      const repetidos = p2.filas.filter((f) => ids1.has(f.id));

      expect(repetidos).toHaveLength(0);
    });

    it('una página más allá del final devuelve vacío sin fallar', async () => {
      const r = await svc.listarOrdenes(filtros.leerFiltros({ pagina: '999' }));

      expect(r.filas).toHaveLength(0);
      expect(r.total).toBe(103);
    });

    describe('filtros', () => {
      it('separa por tipo de RUC', async () => {
        const [r20, r10] = await Promise.all([
          svc.listarOrdenes(filtros.leerFiltros({ tipoRuc: '20' })),
          svc.listarOrdenes(filtros.leerFiltros({ tipoRuc: '10' })),
        ]);

        expect(r20.total).toBe(37);
        expect(r10.total).toBe(66);
        // Los dos tipos suman el total: no hay RUC con otro prefijo.
        expect(r20.total + r10.total).toBe(103);
      });

      it('encuentra las órdenes de un proveedor por su nombre', async () => {
        const r = await svc.listarOrdenes(filtros.leerFiltros({ texto: 'urruchi' }));

        expect(r.total).toBe(13);
      });

      it('la búsqueda no distingue mayúsculas', async () => {
        const [minusculas, mayusculas] = await Promise.all([
          svc.listarOrdenes(filtros.leerFiltros({ texto: 'urruchi' })),
          svc.listarOrdenes(filtros.leerFiltros({ texto: 'URRUCHI' })),
        ]);

        expect(minusculas.total).toBe(mayusculas.total);
      });

      it('el mes sin año significa ese mes en cualquier año', async () => {
        const [junio, diciembre] = await Promise.all([
          svc.listarOrdenes(filtros.leerFiltros({ mes: '6' })),
          svc.listarOrdenes(filtros.leerFiltros({ mes: '12' })),
        ]);

        // Todos los datos son de junio de 2023.
        expect(junio.total).toBe(103);
        expect(diciembre.total).toBe(0);
      });

      it('el año y el mes combinados acotan a ese mes', async () => {
        const r = await svc.listarOrdenes(filtros.leerFiltros({ anio: '2023', mes: '6' }));

        expect(r.total).toBe(103);
      });

      it('un año sin datos no devuelve nada', async () => {
        const r = await svc.listarOrdenes(filtros.leerFiltros({ anio: '2020' }));

        expect(r.total).toBe(0);
      });

      it('unos parámetros inválidos no rompen la consulta', async () => {
        const r = await svc.listarOrdenes(
          filtros.leerFiltros({ pagina: 'abc', tipoRuc: '99', anio: '1800', mes: '77' }),
        );

        expect(r.total).toBe(103);
        expect(r.filas).toHaveLength(20);
      });
    });

    describe('ordenación', () => {
      it('ordena por monto ascendente cuando se pide', async () => {
        const r = await svc.listarOrdenes(
          filtros.leerFiltros({ orden: 'monto', direccion: 'asc' }),
        );

        const montos = r.filas.map((f) => Number(f.amount ?? 0));
        for (let i = 1; i < montos.length; i++) {
          expect(montos[i]).toBeGreaterThanOrEqual(montos[i - 1] as number);
        }
      });

      it('por defecto ordena por fecha descendente', async () => {
        const r = await svc.listarOrdenes(filtros.filtrosPorDefecto());

        const fechas = r.filas.map((f) => f.issueDate?.getTime() ?? 0);
        for (let i = 1; i < fechas.length; i++) {
          expect(fechas[i]).toBeLessThanOrEqual(fechas[i - 1] as number);
        }
      });
    });

    it('marca la orden anulada y no la esconde', async () => {
      const r = await svc.listarOrdenes(filtros.leerFiltros({ texto: '245' }));
      const anuladas = r.filas.filter((f) => f.isCancelled);

      // La sección 14 exige que aparezca en las tablas.
      expect(anuladas.length).toBeGreaterThan(0);
    });
  });

  describe('listado de proveedores', () => {
    it('devuelve los 72 proveedores paginados', async () => {
      const r = await svc.listarProveedores(filtros.filtrosPorDefecto());

      expect(r.total).toBe(72);
      expect(r.filas).toHaveLength(20);
      expect(r.totalPaginas).toBe(4);
    });

    it('está ordenado alfabéticamente', async () => {
      const r = await svc.listarProveedores(filtros.leerFiltros({ porPagina: '100' }));

      const nombres = r.filas.map((f) => f.nombre);
      const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
      expect(nombres).toEqual(ordenados);
    });

    it('separa por tipo de RUC', async () => {
      const [r10, r20] = await Promise.all([
        svc.listarProveedores(filtros.leerFiltros({ tipoRuc: '10' })),
        svc.listarProveedores(filtros.leerFiltros({ tipoRuc: '20' })),
      ]);

      expect(r10.total).toBe(56);
      expect(r20.total).toBe(16);
      expect(r10.total + r20.total).toBe(72);
    });

    it('encuentra un proveedor por su razón social', async () => {
      const r = await svc.listarProveedores(filtros.leerFiltros({ texto: 'urruchi' }));

      expect(r.total).toBe(1);
      expect(r.filas[0]?.ruc).toBe('20610345990');
      expect(r.filas[0]?.ordenes).toBe(13);
      expect(r.filas[0]?.considerado).toBe('370716.09');
    });

    it('encuentra palabras del nombre en distinto orden y sin exigir tildes', async () => {
      for (const texto of ['URRÚCHI inversiones', 'inversiones urruchi']) {
        const r = await svc.listarProveedores(filtros.leerFiltros({ texto }));
        expect(r.total).toBe(1);
        expect(r.filas[0]?.ruc).toBe('20610345990');
      }
    });

    it('no convierte porcentajes ni guiones bajos en comodines', async () => {
      for (const texto of ['%%%', '___', 'urruchi inexistente']) {
        const r = await svc.listarProveedores(filtros.leerFiltros({ texto }));
        expect(r.total).toBe(0);
        expect(r.filas).toEqual([]);
      }
    });

    it('encuentra un proveedor por su RUC', async () => {
      const r = await svc.listarProveedores(filtros.leerFiltros({ texto: '20610345990' }));

      expect(r.total).toBe(1);
      expect(r.filas[0]?.nombre).toBe('INVERSIONES URRUCHI S.A.C.');
    });

    it('incluye la primera y la última aparición', async () => {
      const r = await svc.listarProveedores(filtros.leerFiltros({ texto: 'urruchi' }));

      // Fechas de emisión del libro fuente: la primera orden es del 16 y la
      // última del 27 (comprobado también contra el propio .xls).
      expect(r.filas[0]?.primeraAparicion).toBe('2023-06-16');
      expect(r.filas[0]?.ultimaAparicion).toBe('2023-06-27');
    });

    it('los montos considerados suman el total del portal', async () => {
      const [r, resumen] = await Promise.all([
        svc.listarProveedores(filtros.leerFiltros({ porPagina: '100' })),
        svc.resumenGeneral(),
      ]);

      const suma = r.filas.reduce((a, f) => a + Math.round(Number(f.considerado) * 100), 0);
      expect(suma).toBe(Math.round(Number(resumen.totalConsiderado) * 100));
    });
  });

  describe('perfil del proveedor', () => {
    it('devuelve los totales de URRUCHI con los tres montos separados', async () => {
      const perfil = await svc.perfilProveedor('inversiones-urruchi-s-a-c');

      expect(perfil).not.toBeNull();
      expect(perfil?.ruc).toBe('20610345990');
      expect(perfil?.nombre).toBe('INVERSIONES URRUCHI S.A.C.');
      expect(perfil?.ordenes).toBe(13);
      expect(perfil?.anuladas).toBe(1);
      expect(perfil?.totalRegistrado).toBe('409710.96');
      expect(perfil?.totalAnulado).toBe('38994.87');
      expect(perfil?.totalConsiderado).toBe('370716.09');
    });

    it('el registrado es la suma del considerado y el anulado', async () => {
      const perfil = await svc.perfilProveedor('inversiones-urruchi-s-a-c');
      const centavos = (v: string | undefined) => Math.round(Number(v) * 100);

      expect(centavos(perfil?.totalConsiderado) + centavos(perfil?.totalAnulado)).toBe(
        centavos(perfil?.totalRegistrado),
      );
    });

    it('sitúa su primera y última aparición', async () => {
      const perfil = await svc.perfilProveedor('inversiones-urruchi-s-a-c');

      // Fechas de emisión del libro fuente: la primera orden es del 16 y la
      // última del 27 (comprobado también contra el propio .xls).
      expect(perfil?.primeraAparicion).toBe('2023-06-16');
      expect(perfil?.ultimaAparicion).toBe('2023-06-27');
      expect(perfil?.aniosPresentes).toEqual([2023]);
    });

    it('con un solo libro, sus historiales tienen una entrada cada uno', async () => {
      const perfil = await svc.perfilProveedor('inversiones-urruchi-s-a-c');

      expect(perfil?.porGestion).toHaveLength(1);
      expect(perfil?.porGestion[0]?.etiqueta).toBe('2023-2026');
      expect(perfil?.porGestion[0]?.ordenes).toBe(13);
      expect(perfil?.porAnio).toHaveLength(1);
      expect(perfil?.porAnio[0]?.etiqueta).toBe('2023');
      expect(perfil?.porMes).toHaveLength(1);
      expect(perfil?.porMes[0]?.etiqueta).toBe('2023-06');
    });

    it('la suma de sus órdenes por mes coincide con su considerado', async () => {
      const perfil = await svc.perfilProveedor('inversiones-urruchi-s-a-c');

      const suma = (perfil?.porMes ?? []).reduce(
        (a, m) => a + Math.round(Number(m.considerado) * 100),
        0,
      );
      expect(suma).toBe(Math.round(Number(perfil?.totalConsiderado) * 100));
    });

    it('devuelve null si el proveedor no existe', async () => {
      expect(await svc.perfilProveedor('no-existe-este-proveedor')).toBeNull();
    });
  });

  describe('ranking completo', () => {
    it('ofrece solo gestiones publicadas y filtra igual la portada y el ranking completo', async () => {
      const periodos = await svc.periodosDelRanking();
      expect(periodos.map(p => p.nombre)).toEqual(['2023-2026']);
      const gestionId = periodos[0]!.id;
      const [portada, completo, vacio] = await Promise.all([
        svc.rankingProveedores(10, gestionId),
        svc.rankingCompleto(filtros.leerFiltros({ gestion: gestionId })),
        svc.rankingProveedores(10, 'gestion-sin-ordenes'),
      ]);
      expect(completo.total).toBe(72);
      expect(portada[0]?.supplierId).toBe(completo.filas[0]?.supplierId);
      expect(portada[0]?.considerado).toBe(completo.filas[0]?.considerado);
      expect(portada[0]?.peso).toBe(completo.filas[0]?.peso);
      expect(vacio).toEqual([]);
    });

    it('todos los periodos mantiene el conjunto global en ambas consultas', async () => {
      const [portada, global, completo] = await Promise.all([
        svc.rankingProveedores(10, 'todas'),
        svc.rankingProveedores(10),
        svc.rankingCompleto(filtros.leerFiltros({ gestion: 'todas' })),
      ]);
      expect(portada).toEqual(global);
      expect(completo.total).toBe(72);
    });

    it('sitúa a URRUCHI primero con su peso', async () => {
      const r = await svc.rankingCompleto(filtros.filtrosPorDefecto());

      expect(r.total).toBe(72);
      expect(r.filas[0]?.posicion).toBe(1);
      expect(r.filas[0]?.ruc).toBe('20610345990');
      expect(r.filas[0]?.peso).toBeCloseTo(36.1, 1);
    });

    it('las posiciones son consecutivas y arrancan en 1', async () => {
      const r = await svc.rankingCompleto(filtros.filtrosPorDefecto());

      expect(r.filas.map((f) => f.posicion)).toEqual(
        Array.from({ length: r.filas.length }, (_, i) => i + 1),
      );
    });

    it('la segunda página continúa la numeración', async () => {
      const r = await svc.rankingCompleto(filtros.leerFiltros({ pagina: '2' }));

      expect(r.filas[0]?.posicion).toBe(21);
    });

    it('separa RUC 10 y RUC 20', async () => {
      const [r20, r10] = await Promise.all([
        svc.rankingCompleto(filtros.leerFiltros({ tipoRuc: '20' })),
        svc.rankingCompleto(filtros.leerFiltros({ tipoRuc: '10' })),
      ]);

      expect(r20.total).toBe(16);
      expect(r10.total).toBe(56);
    });

    it('al filtrar, la posición 1 es la del conjunto filtrado', async () => {
      const r = await svc.rankingCompleto(filtros.leerFiltros({ tipoRuc: '20' }));

      // No debe ser la posición global de ese proveedor, sino la primera del
      // subconjunto: si no, el ranking filtrado mostraría 1, 4, 7…
      expect(r.filas[0]?.posicion).toBe(1);
      expect(r.filas[0]?.ruc.startsWith('20')).toBe(true);
    });

    it('el peso se calcula sobre el total del conjunto filtrado', async () => {
      const r = await svc.rankingCompleto(filtros.leerFiltros({ tipoRuc: '20' }));

      // Cada peso va redondeado a un decimal, así que la suma puede desviarse
      // unas décimas del 100 %; lo que se comprueba es que el total de
      // referencia es el del conjunto filtrado (16 proveedores), no el global.
      const sumaPesos = r.filas.reduce((a, f) => a + f.peso, 0);
      expect(sumaPesos).toBeGreaterThan(99);
      expect(sumaPesos).toBeLessThan(101);
      // El primero de un subconjunto de 16 concentra mucho más que el 36% global.
      expect(r.filas[0]?.peso).toBeGreaterThan(36);
    });

    it('devuelve los montos registrado, anulado y considerado', async () => {
      const r = await svc.rankingCompleto(filtros.leerFiltros({ texto: 'urruchi' }));

      expect(r.filas[0]?.registrado).toBe('409710.96');
      expect(r.filas[0]?.anulado).toBe('38994.87');
      expect(r.filas[0]?.considerado).toBe('370716.09');
    });
  });

  describe('proveedores en varias gestiones', () => {
    it('con un solo libro cargado no hay ninguno', async () => {
      const r = await svc.proveedoresMultiGestion(2);

      // Es el estado correcto, no un fallo: ningún proveedor aparece todavía en
      // dos gestiones distintas.
      expect(r.filas).toHaveLength(0);
    });

    it('informa de que el máximo actual es una gestión', async () => {
      const r = await svc.proveedoresMultiGestion(2);

      expect(r.maximoGestiones).toBe(1);
      expect(r.totalProveedores).toBe(72);
    });

    it('bajando el mínimo a una gestión, aparecen los 72', async () => {
      const r = await svc.proveedoresMultiGestion(1);

      expect(r.filas).toHaveLength(72);
      for (const fila of r.filas) {
        expect(fila.gestiones).toBe(1);
        expect(fila.detalle).toHaveLength(1);
        expect(fila.detalle[0]?.gestion).toBe('2023-2026');
      }
    });
  });

  describe('opciones de los filtros', () => {
    it('refleja la cobertura real: un año y una gestión con datos', async () => {
      const opciones = await svc.opcionesDeFiltros();

      expect(opciones.anios).toEqual([2023]);
      expect(opciones.gestiones).toHaveLength(3);
      expect(opciones.tiposOrden).toHaveLength(2);
      expect(opciones.estados.length).toBeGreaterThanOrEqual(2);
    });

    it('incluye el código del tipo de orden en la etiqueta', async () => {
      const opciones = await svc.opcionesDeFiltros();
      const codigos = opciones.tiposOrden.map((t) => t.etiqueta);

      expect(codigos.some((c) => c.startsWith('O/C'))).toBe(true);
      expect(codigos.some((c) => c.startsWith('O/S'))).toBe(true);
    });
  });

  describe('comparativa por gestión (estadísticas)', () => {
    it('incluye las tres gestiones, con solo una cargada', async () => {
      const filas = await svc.comparativaPorGestion();

      expect(filas).toHaveLength(3);
      expect(filas.map((f) => f.gestion)).toEqual(['2015-2018', '2019-2022', '2023-2026']);
    });

    it('reproduce los montos de la gestión con datos', async () => {
      const filas = await svc.comparativaPorGestion();
      const conDatos = filas.find((f) => f.gestion === '2023-2026');

      expect(conDatos?.ordenes).toBe(103);
      expect(conDatos?.anuladas).toBe(1);
      expect(conDatos?.proveedores).toBe(72);
      expect(conDatos?.registrado).toBe('1066136.59');
      expect(conDatos?.anulado).toBe('38994.87');
      expect(conDatos?.considerado).toBe('1027141.72');
    });

    it('calcula el peso contra el total del portal', async () => {
      const filas = await svc.comparativaPorGestion();
      const conDatos = filas.find((f) => f.gestion === '2023-2026');

      expect(conDatos?.peso).toBe(100);
      // Los pesos suman el 100%: solo una gestión tiene datos.
      const suma = filas.reduce((a, f) => a + f.peso, 0);
      expect(suma).toBeCloseTo(100, 0);
    });

    it('calcula el ticket medio de la gestión con datos', async () => {
      const filas = await svc.comparativaPorGestion();
      const conDatos = filas.find((f) => f.gestion === '2023-2026');

      // 1027141.72 / 103 = 9972.2497…
      expect(conDatos?.ticketMedio).toBe('9972.25');
    });

    it('las gestiones sin datos quedan en cero, no en null', async () => {
      const filas = await svc.comparativaPorGestion();
      const vacias = filas.filter((f) => f.ordenes === 0);

      expect(vacias).toHaveLength(2);
      for (const fila of vacias) {
        expect(fila.registrado).toBe('0.00');
        expect(fila.anulado).toBe('0.00');
        expect(fila.considerado).toBe('0.00');
        expect(fila.proveedores).toBe(0);
        expect(fila.anuladas).toBe(0);
        expect(fila.peso).toBe(0);
        expect(fila.ticketMedio).toBe('0.00');
      }
    });

    it('los montos de cada gestión suman los totales del portal', async () => {
      const [filas, resumen] = await Promise.all([
        svc.comparativaPorGestion(),
        svc.resumenGeneral(),
      ]);

      const centavos = (v: string) => Math.round(Number(v) * 100);
      const suma = filas.reduce((a, f) => a + centavos(f.considerado), 0);
      expect(suma).toBe(centavos(resumen.totalConsiderado));
    });
  });

  describe('concentración del gasto', () => {
    it('informa del total de proveedores y del monto considerado', async () => {
      const r = await svc.concentracionGasto();

      expect(r.totalProveedores).toBe(72);
      expect(r.totalConsiderado).toBe('1027141.72');
    });

    it('el mayor proveedor es URRUCHI, con su monto exacto', async () => {
      const r = await svc.concentracionGasto();
      const top1 = r.cortes.find((c) => c.proveedores === 1);

      expect(top1?.considerado).toBe('370716.09');
      expect(top1?.peso).toBeCloseTo(36.1, 1);
    });

    it('los cortes son acumulados y crecientes', async () => {
      const r = await svc.concentracionGasto();
      const montos = r.cortes.map((c) => Number(c.considerado));

      for (let i = 1; i < montos.length; i++) {
        expect(montos[i]).toBeGreaterThanOrEqual(montos[i - 1] as number);
      }
      // El corte mayor no puede superar el total.
      expect(montos[montos.length - 1]).toBeLessThanOrEqual(Number(r.totalConsiderado));
    });

    it('devuelve los cuatro cortes esperados', async () => {
      const r = await svc.concentracionGasto();

      expect(r.cortes.map((c) => c.proveedores)).toEqual([1, 5, 10, 20]);
      for (const corte of r.cortes) {
        expect(corte.peso).toBeGreaterThan(0);
        expect(corte.peso).toBeLessThanOrEqual(100);
      }
    });
  });
});
