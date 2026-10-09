import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';
import { catalogoPrensa } from '@/lib/prensa';
import { dniDesdeRuc } from '@/lib/supplier-profile';

type Fuente = 'Personas' | 'Electoral' | 'Prensa';

type Sujeto = {
  key: string;
  nombre: string;
  dni: string | null;
  ruc: string | null;
  fuentes: Fuente[];
  detalle: string[];
};

type ProveedorBase = {
  id: string;
  ruc: string;
  nombre: string;
  slug: string;
  dni: string | null;
  ordenes: number;
  considerado: string;
  primera: string | null;
  ultima: string | null;
  tieneFoto: boolean;
  fotoVersion: string | null;
  tokens: string[];
};

export type CruceComparador = {
  subjectKey: string;
  supplierId: string;
  persona: string;
  dni: string | null;
  ruc: string | null;
  fuentes: Fuente[];
  detalle: string[];
  proveedor: {
    id: string;
    nombre: string;
    ruc: string;
    slug: string;
    ordenes: number;
    considerado: string;
    primera: string | null;
    ultima: string | null;
    fotoUrl: string | null;
  };
  tipo: 'documento' | 'apellidos';
  motivo: string;
  coincidencias: string[];
  puntaje: number;
  revisado: boolean;
};

const conectores = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'DA', 'DAS', 'DOS']);
const societarios = new Set(['SAC', 'SA', 'SRL', 'EIRL', 'EIRLTDA', 'EMPRESA', 'MUNICIPALIDAD']);

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
}

function tokensNombre(texto: string): string[] {
  return [...new Set(normalizar(texto).replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !conectores.has(t) && !societarios.has(t)))];
}

function claveSujeto(dni: string | null, ruc: string | null, fallback: string): string {
  if (dni) return `dni:${dni}`;
  if (ruc) return `ruc:${ruc}`;
  return fallback;
}

function fusionarSujeto(mapa: Map<string, Sujeto>, entrada: Sujeto) {
  const actual = mapa.get(entrada.key);
  if (!actual) {
    mapa.set(entrada.key, entrada);
    return;
  }
  actual.nombre = actual.nombre.length >= entrada.nombre.length ? actual.nombre : entrada.nombre;
  actual.dni ??= entrada.dni;
  actual.ruc ??= entrada.ruc;
  for (const fuente of entrada.fuentes) if (!actual.fuentes.includes(fuente)) actual.fuentes.push(fuente);
  for (const detalle of entrada.detalle) if (!actual.detalle.includes(detalle)) actual.detalle.push(detalle);
}

function fotoUrl(proveedor: ProveedorBase): string | null {
  return proveedor.tieneFoto ? `/api/admin/proveedores/${proveedor.id}/foto${proveedor.fotoVersion ? `?v=${proveedor.fotoVersion}` : ''}` : null;
}

async function sujetosRegistrados(): Promise<Sujeto[]> {
  const [personas, electorales] = await Promise.all([
    prisma.person.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, dni: true, fullName: true, tags: { select: { tag: { select: { label: true } } } } },
    }),
    prisma.electoralPerson.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        dni: true,
        fullName: true,
        records: { orderBy: [{ electionYear: 'desc' }, { position: 'asc' }], take: 3, select: { electionYear: true, position: true, organization: true, result: true } },
      },
    }),
  ]);
  const mapa = new Map<string, Sujeto>();
  for (const persona of personas) {
    fusionarSujeto(mapa, {
      key: claveSujeto(persona.dni, null, `persona:${persona.id}`),
      nombre: persona.fullName,
      dni: persona.dni,
      ruc: null,
      fuentes: ['Personas'],
      detalle: persona.tags.map(t => t.tag.label),
    });
  }
  for (const persona of electorales) {
    fusionarSujeto(mapa, {
      key: claveSujeto(persona.dni, null, `electoral:${persona.id}`),
      nombre: persona.fullName,
      dni: persona.dni,
      ruc: null,
      fuentes: ['Electoral'],
      detalle: persona.records.map(r => `${r.electionYear}: ${r.position} · ${r.organization}${r.result ? ` · ${r.result}` : ''}`),
    });
  }
  for (const persona of catalogoPrensa) {
    const dni = dniDesdeRuc(persona.ruc);
    fusionarSujeto(mapa, {
      key: claveSujeto(dni, persona.ruc, `prensa:${persona.ruc}`),
      nombre: persona.nombre,
      dni,
      ruc: persona.ruc,
      fuentes: ['Prensa'],
      detalle: ['Listado de seguimiento de prensa'],
    });
  }
  return [...mapa.values()];
}

async function proveedoresConOrdenes(): Promise<ProveedorBase[]> {
  const filas = await prisma.$queryRaw<Array<{
    id: string;
    ruc: string;
    nombre: string;
    slug: string;
    dni: string | null;
    ordenes: number;
    considerado: string;
    primera: string | null;
    ultima: string | null;
    tieneFoto: boolean;
    fotoVersion: string | null;
  }>>`
    SELECT s.id, s.ruc, s.name AS nombre, s.slug,
      CASE WHEN s.ruc LIKE '10_________' THEN substring(s.ruc FROM 3 FOR 8) ELSE NULL END AS dni,
      COUNT(o.id)::int AS ordenes,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS considerado,
      to_char(MIN(o."issueDate"), 'YYYY-MM-DD') AS primera,
      to_char(MAX(o."issueDate"), 'YYYY-MM-DD') AS ultima,
      EXISTS (SELECT 1 FROM "SupplierProfile" p WHERE p."supplierId" = s.id AND p."photoKey" IS NOT NULL) AS "tieneFoto",
      (SELECT floor(extract(epoch FROM p."updatedAt") * 1000)::bigint::text FROM "SupplierProfile" p WHERE p."supplierId" = s.id AND p."photoKey" IS NOT NULL) AS "fotoVersion"
    FROM "Supplier" s
    JOIN "CurrentOrder" o ON o."supplierId" = s.id
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY s.id, s.ruc, s.name, s.slug
    ORDER BY COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0) DESC, s.name ASC
  `;
  return filas.map(f => ({ ...f, ordenes: Number(f.ordenes), considerado: decimalMonetario(f.considerado), tieneFoto: Boolean(f.tieneFoto), tokens: tokensNombre(f.nombre) }));
}

async function revisionesPara(cruces: Pick<CruceComparador, 'subjectKey' | 'supplierId'>[]) {
  if (!cruces.length) return new Set<string>();
  const sujetos = [...new Set(cruces.map(c => c.subjectKey))];
  const proveedores = [...new Set(cruces.map(c => c.supplierId))];
  const filas = await prisma.$queryRaw<Array<{ subjectKey: string; supplierId: string }>>`
    SELECT "subjectKey", "supplierId" FROM "ComparatorReview"
    WHERE reviewed = true AND "subjectKey" IN (${Prisma.join(sujetos)}) AND "supplierId" IN (${Prisma.join(proveedores)})
  `;
  return new Set(filas.map(f => `${f.subjectKey}|${f.supplierId}`));
}

export async function comparadorAdmin(estado: 'todos' | 'pendientes' | 'revisados' = 'pendientes') {
  const [sujetos, proveedores] = await Promise.all([sujetosRegistrados(), proveedoresConOrdenes()]);
  const porDni = new Map(proveedores.filter(p => p.dni).map(p => [p.dni!, p]));
  const porRuc = new Map(proveedores.map(p => [p.ruc, p]));
  const exactos: CruceComparador[] = [];
  const exactKey = new Set<string>();

  for (const sujeto of sujetos) {
    const proveedor = sujeto.ruc ? porRuc.get(sujeto.ruc) : sujeto.dni ? porDni.get(sujeto.dni) : null;
    if (!proveedor) continue;
    const key = `${sujeto.key}|${proveedor.id}`;
    exactKey.add(key);
    exactos.push({
      subjectKey: sujeto.key,
      supplierId: proveedor.id,
      persona: sujeto.nombre,
      dni: sujeto.dni,
      ruc: sujeto.ruc ?? proveedor.ruc,
      fuentes: sujeto.fuentes,
      detalle: sujeto.detalle,
      proveedor: { ...proveedor, fotoUrl: fotoUrl(proveedor) },
      tipo: 'documento',
      motivo: sujeto.ruc === proveedor.ruc ? 'RUC exacto en listado de seguimiento' : 'DNI coincide con el RUC 10 del proveedor',
      coincidencias: sujeto.dni ? [sujeto.dni] : [proveedor.ruc],
      puntaje: 100,
      revisado: false,
    });
  }

  const sugerencias: CruceComparador[] = [];
  const proveedoresNaturales = proveedores.filter(p => p.ruc.startsWith('10'));
  for (const sujeto of sujetos) {
    const tokens = tokensNombre(sujeto.nombre);
    if (tokens.length < 2) continue;
    for (const proveedor of proveedoresNaturales) {
      if (sujeto.dni && proveedor.dni === sujeto.dni) continue;
      if (exactKey.has(`${sujeto.key}|${proveedor.id}`)) continue;
      const compartidos = tokens.filter(t => proveedor.tokens.includes(t));
      const fuertes = compartidos.filter(t => t.length >= 4);
      if (compartidos.length < 2 && !fuertes.some(t => t.length >= 5)) continue;
      const puntaje = compartidos.length >= 2 ? 45 + compartidos.length * 10 : 25;
      sugerencias.push({
        subjectKey: sujeto.key,
        supplierId: proveedor.id,
        persona: sujeto.nombre,
        dni: sujeto.dni,
        ruc: sujeto.ruc,
        fuentes: sujeto.fuentes,
        detalle: sujeto.detalle,
        proveedor: { ...proveedor, fotoUrl: fotoUrl(proveedor) },
        tipo: 'apellidos',
        motivo: compartidos.length >= 2 ? 'Coinciden dos o más apellidos/palabras del nombre' : 'Coincide un apellido poco común; requiere revisión manual',
        coincidencias: compartidos,
        puntaje,
        revisado: false,
      });
    }
  }

  sugerencias.sort((a, b) => b.puntaje - a.puntaje || Number(b.proveedor.considerado) - Number(a.proveedor.considerado));
  const limitadas = sugerencias.slice(0, 120);
  const revisados = await revisionesPara([...exactos, ...limitadas]);
  const marcar = (cruce: CruceComparador) => ({ ...cruce, revisado: revisados.has(`${cruce.subjectKey}|${cruce.supplierId}`) });
  const filtrar = (cruce: CruceComparador) => estado === 'todos' || (estado === 'revisados' ? cruce.revisado : !cruce.revisado);
  const exactosMarcados = exactos.map(marcar);
  const sugerenciasMarcadas = limitadas.map(marcar);
  return {
    exactos: exactosMarcados.filter(filtrar),
    sugerencias: sugerenciasMarcadas.filter(filtrar),
    totales: {
      exactos: exactosMarcados.length,
      sugerencias: sugerenciasMarcadas.length,
      pendientes: [...exactosMarcados, ...sugerenciasMarcadas].filter(c => !c.revisado).length,
      revisados: [...exactosMarcados, ...sugerenciasMarcadas].filter(c => c.revisado).length,
      sujetos: sujetos.length,
      proveedoresConOrdenes: proveedores.length,
    },
  };
}
