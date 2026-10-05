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

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hayBaseDeDatos)('statisticsService contra la base real', () => {
  let svc: typeof import('@/services/statisticsService');

  beforeAll(async () => {
    svc = await import('@/services/statisticsService');
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
});
