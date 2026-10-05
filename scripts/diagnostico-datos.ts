import 'dotenv/config';

import { prisma } from '../lib/prisma';

/**
 * Perfil de los datos importados.
 *
 * Sirve para saber qué puede mostrar el portal público y con cuánta cobertura.
 * Un gráfico de evolución con un solo punto no es un gráfico: es un punto. Este
 * script lo detecta antes de diseñar nada encima.
 *
 * Uso:  npx tsx scripts/diagnostico-datos.ts
 */

const CENTAVOS = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '0.00';
  return Number(valor).toFixed(2);
};

function titulo(texto: string): void {
  console.log('');
  console.log('='.repeat(64));
  console.log(texto);
  console.log('='.repeat(64));
}

async function main() {
  const total = await prisma.order.count();
  const proveedores = await prisma.supplier.count();

  titulo('COBERTURA TEMPORAL');
  const porAnio = await prisma.$queryRaw<Array<{ anio: string; n: bigint }>>`
    SELECT to_char("issueDate", 'YYYY') AS anio, COUNT(*) AS n
    FROM "Order" WHERE "issueDate" IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `;
  const porMes = await prisma.$queryRaw<Array<{ mes: string; n: bigint; suma: unknown }>>`
    SELECT to_char("issueDate", 'YYYY-MM') AS mes, COUNT(*) AS n, SUM(amount) AS suma
    FROM "Order" WHERE "issueDate" IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `;

  console.log('  años distintos      : ' + porAnio.length + '  -> ' + porAnio.map((r) => r.anio + ' (' + r.n + ')').join(', '));
  console.log('  meses distintos     : ' + porMes.length + '  -> ' + porMes.map((r) => r.mes + ' (' + r.n + ' órdenes, S/ ' + CENTAVOS(r.suma) + ')').join(', '));
  console.log('  sin fecha de emisión: ' + (total - porMes.reduce((a, r) => a + Number(r.n), 0)));

  titulo('GASTO POR GESTION');
  const gestiones = await prisma.supplierManagementSummary.groupBy({
    by: ['managementPeriodId'],
    _count: { _all: true },
    _sum: { consideredAmount: true, totalAmount: true },
  });
  const nombres = await prisma.managementPeriod.findMany({ select: { id: true, name: true } });
  const nombreDe = new Map(nombres.map((g) => [g.id, g.name]));
  for (const g of gestiones) {
    console.log(
      '  ' + (nombreDe.get(g.managementPeriodId) ?? g.managementPeriodId) +
        ': ' + g._count._all + ' proveedores, considerado S/ ' + CENTAVOS(g._sum.consideredAmount),
    );
  }

  titulo('TIPO DE ORDEN');
  const tipos = await prisma.order.groupBy({ by: ['orderTypeId'], _count: { _all: true }, _sum: { amount: true } });
  const tiposCat = await prisma.orderType.findMany({ select: { id: true, code: true } });
  const codigoDe = new Map(tiposCat.map((t) => [t.id, t.code]));
  for (const t of tipos) {
    console.log('  ' + (t.orderTypeId ? (codigoDe.get(t.orderTypeId) ?? '?') : '(sin tipo)') + ': ' + t._count._all + ' órdenes, S/ ' + CENTAVOS(t._sum.amount));
  }

  titulo('TIPO DE CONTRATACION (top)');
  const contratos = await prisma.order.groupBy({ by: ['contractTypeId'], _count: { _all: true }, _sum: { amount: true } });
  const contratosCat = await prisma.contractType.findMany({ select: { id: true, code: true, label: true } });
  const etiquetaDe = new Map(contratosCat.map((c) => [c.id, c.label]));
  for (const c of contratos.sort((a, b) => b._count._all - a._count._all)) {
    const etiqueta = c.contractTypeId ? (etiquetaDe.get(c.contractTypeId) ?? '?') : '(sin tipo)';
    console.log('  ' + c._count._all + ' órdenes, S/ ' + CENTAVOS(c._sum.amount) + '  ' + etiqueta.slice(0, 60));
  }

  titulo('ESTADO');
  const estados = await prisma.order.groupBy({ by: ['statusId'], _count: { _all: true }, _sum: { amount: true } });
  const estadosCat = await prisma.orderStatus.findMany({ select: { id: true, label: true, countsEconomically: true } });
  const estadoDe = new Map(estadosCat.map((e) => [e.id, e]));
  for (const e of estados) {
    const info = e.statusId ? estadoDe.get(e.statusId) : undefined;
    console.log('  ' + (info?.label ?? '?') + ': ' + e._count._all + ' órdenes, S/ ' + CENTAVOS(e._sum.amount) + (info?.countsEconomically ? '' : '  (no suma)'));
  }

  titulo('PROVEEDORES');
  const top = await prisma.supplierManagementSummary.findMany({
    orderBy: { consideredAmount: 'desc' },
    take: 10,
    select: { consideredAmount: true, orderCount: true, supplier: { select: { name: true, ruc: true } } },
  });
  for (const t of top) {
    console.log('  S/ ' + CENTAVOS(t.consideredAmount).padStart(12) + '  ' + String(t.orderCount).padStart(3) + ' órdenes  ' + t.supplier.ruc + '  ' + t.supplier.name.slice(0, 40));
  }

  const ruc10 = await prisma.supplier.count({ where: { rucPrefix: '10' } });
  const ruc20 = await prisma.supplier.count({ where: { rucPrefix: '20' } });
  console.log('  total proveedores: ' + proveedores + '  (RUC 10: ' + ruc10 + ', RUC 20: ' + ruc20 + ')');

  titulo('MONTOS');
  const registrado = await prisma.order.aggregate({ _sum: { amount: true } });
  const anulado = await prisma.order.aggregate({ where: { isCancelled: true }, _sum: { amount: true }, _count: { _all: true } });
  const considerado = await prisma.order.aggregate({
    where: { isCancelled: false, status: { countsEconomically: true } },
    _sum: { amount: true },
  });
  console.log('  registrado : S/ ' + CENTAVOS(registrado._sum.amount));
  console.log('  anulado    : S/ ' + CENTAVOS(anulado._sum.amount) + '  (' + anulado._count._all + ' órdenes)');
  console.log('  considerado: S/ ' + CENTAVOS(considerado._sum.amount));

  titulo('DIAGNOSTICO PARA EL PORTAL PUBLICO');
  console.log('  evolución mensual : ' + porMes.length + ' punto(s)');
  console.log('  evolución anual   : ' + porAnio.length + ' punto(s)');
  console.log('  gasto por gestión : ' + gestiones.length + ' barra(s)');
  if (porMes.length <= 1 || porAnio.length <= 1 || gestiones.length <= 1) {
    console.log('  AVISO: con un solo punto, los gráficos de evolución no comunican nada.');
  }
}

main()
  .catch((error) => {
    console.error('El diagnóstico falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
