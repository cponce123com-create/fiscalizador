import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { dniDesdeRuc, esquemaPerfilProveedor, type DatosPerfilProveedor } from '@/lib/supplier-profile';
import { registrarAuditoria } from '@/services/auditService';

export async function listarPerfilesProveedores(q = '', tipo = '', page = '1') {
  const texto = q.trim().slice(0, 100);
  const where: Prisma.SupplierWhereInput = {
    ...(tipo === '10' || tipo === '20' ? { ruc: { startsWith: tipo } } : {}),
    ...(texto ? { OR: [
      { name: { contains: texto, mode: 'insensitive' } },
      { ruc: { contains: texto } },
      ...(/^\d{8}$/.test(texto) ? [{ ruc: { startsWith: `10${texto}` } }] : []),
    ] } : {}),
  };
  const total = await prisma.supplier.count({ where });
  const paginas = Math.max(1, Math.ceil(total / 20));
  const numero = Number(page);
  const pagina = Math.min(paginas, Number.isSafeInteger(numero) && numero > 0 ? numero : 1);
  const proveedores = await prisma.supplier.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20, skip: (pagina - 1) * 20,
    select: { id: true, name: true, ruc: true, profile: { select: { id: true } }, _count: { select: { orders: true } } },
  });
  return { proveedores, total, pagina, paginas };
}
export async function obtenerPerfilProveedor(id: string) {
  return prisma.supplier.findUnique({ where: { id }, select: { id: true, name: true, ruc: true, slug: true, profile: { include: { contacts: { orderBy: { createdAt: 'asc' } } } }, _count: { select: { orders: true } } } });
}
export async function guardarPerfilProveedor(datos: DatosPerfilProveedor, userId: string) {
  const input = esquemaPerfilProveedor.parse(datos);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id = ${input.supplierId} FOR UPDATE`;
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { ruc: true } });
    if (!supplier) throw new NoEncontrado('No existe este proveedor.');
    const propioDni = dniDesdeRuc(supplier.ruc);
    if (propioDni && input.contacts.some(c => c.dni === propioDni)) throw new ErrorDeNegocio('No registres al propio proveedor como persona vinculada.');
    const anterior = await tx.supplierProfile.findUnique({ where: { supplierId: input.supplierId }, select: { updatedAt: true } });
    if ((anterior?.updatedAt.toISOString() ?? '') !== input.version) throw new ErrorDeNegocio('La ficha cambió en otra edición. Recarga la página antes de guardar.');
    const data = { publicDistrict: input.publicDistrict ?? null, birthDate: propioDni ? input.birthDate ?? null : null, birthplace: input.birthplace, currentAddress: input.currentAddress, notes: input.notes, updatedById: userId };
    const perfil = await tx.supplierProfile.upsert({ where: { supplierId: input.supplierId }, create: { supplierId: input.supplierId, createdById: userId, ...data }, update: data });
    await tx.supplierProfileContact.deleteMany({ where: { profileId: perfil.id } });
    if (input.contacts.length) await tx.supplierProfileContact.createMany({ data: input.contacts.map(c => ({ ...c, profileId: perfil.id })) });
    await registrarAuditoria(tx, { userId, action: anterior ? 'UPDATE' : 'CREATE', entity: 'SupplierProfile', entityId: perfil.id, metadata: { supplierId: input.supplierId, linkedPersons: input.contacts.length } });
    return perfil;
  });
}
