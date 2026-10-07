import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from './auditService';
import { esquemaPersonaElectoral, esquemaRegistroElectoral } from '@/lib/electoral';
import { dniDesdeRuc, fuentePublica } from '@/lib/supplier-profile';
import type { z } from 'zod';

export async function guardarPersonaElectoral(entrada: z.input<typeof esquemaPersonaElectoral>, userId: string) {
  const { id, ...data } = esquemaPersonaElectoral.parse(entrada);
  return prisma.$transaction(async tx => {
    const persona = id ? await tx.electoralPerson.update({ where: { id }, data }) : await tx.electoralPerson.create({ data });
    await registrarAuditoria(tx, { userId, action: id ? 'UPDATE' : 'CREATE', entity: 'ElectoralPerson', entityId: persona.id });
    return persona;
  });
}
export async function guardarRegistroElectoral(entrada: z.input<typeof esquemaRegistroElectoral>, userId: string) {
  const { id, ...data } = esquemaRegistroElectoral.parse(entrada);
  return prisma.$transaction(async tx => {
    const registro = id ? await tx.electoralRecord.update({ where: { id, personId: data.personId }, data }) : await tx.electoralRecord.create({ data });
    await registrarAuditoria(tx, { userId, action: id ? 'UPDATE' : 'CREATE', entity: 'ElectoralRecord', entityId: registro.id });
    return registro;
  });
}
export async function eliminarRegistroElectoral(id: string, userId: string) {
  return prisma.$transaction(async tx => {
    const registro = await tx.electoralRecord.delete({ where: { id } });
    await registrarAuditoria(tx, { userId, action: 'DELETE', entity: 'ElectoralRecord', entityId: id });
    return registro;
  });
}
/** Solo coincidencia exacta del documento. Nunca se enlaza por parecido del nombre. */
export async function antecedentesElectoralesProveedor(ruc: string) {
  const dni = dniDesdeRuc(ruc);
  if (!dni) return null;
  return prisma.electoralPerson.findFirst({ where: { dni, isPublic: true, records: { some: { isPublic: true } } }, select: { id: true, fullName: true, records: { where: { isPublic: true }, orderBy: { electionYear: 'desc' }, select: { id: true, electionYear: true, position: true, organization: true, mayorCandidate: true, municipality: true, termStart: true, termEnd: true, result: true, source: true, sourceUrl: true } } } });
}
export async function informacionDocumentadaProveedor(supplierId: string) {
  const ficha = await prisma.supplierProfile.findUnique({ where: { supplierId }, select: { publicNotes: true, publicSourceUrl: true, contacts: { where: { isPublic: true }, select: { id: true, fullName: true, relationship: true, source: true, publicNote: true } } } });
  if (!ficha) return null;
  return { notas: ficha.publicNotes && fuentePublica.safeParse(ficha.publicSourceUrl).success ? ficha.publicNotes : null, fuente: fuentePublica.safeParse(ficha.publicSourceUrl).success ? ficha.publicSourceUrl : null, vinculos: ficha.contacts.filter(c => fuentePublica.safeParse(c.source).success) };
}
