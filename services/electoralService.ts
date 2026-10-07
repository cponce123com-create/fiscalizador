import { ErrorDeNegocio } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from './auditService';
import { esquemaPersonaElectoral, esquemaRegistroElectoral, esquemaCargaElectoral } from '@/lib/electoral';
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
  const { id, ...parsed } = esquemaRegistroElectoral.parse(entrada);
  const data = { ...parsed, listPosition: parsed.listPosition ?? null, registrationStatus: parsed.registrationStatus ?? null, preliminaryOutcome: parsed.preliminaryOutcome ?? null, preliminarySource: parsed.preliminarySource || null };
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
  return prisma.electoralPerson.findFirst({ where: { dni, isPublic: true, records: { some: { isPublic: true } } }, select: { id: true, fullName: true, records: { where: { isPublic: true }, orderBy: { electionYear: 'desc' }, select: { id: true, electionYear: true, position: true, organization: true, mayorCandidate: true, municipality: true, termStart: true, termEnd: true, result: true, listPosition: true, registrationStatus: true, preliminaryOutcome: true, preliminarySource: true, source: true, sourceUrl: true } } } });
}
export async function informacionDocumentadaProveedor(supplierId: string) {
  const ficha = await prisma.supplierProfile.findUnique({ where: { supplierId }, select: { publicNotes: true, publicSourceUrl: true, contacts: { where: { isPublic: true }, select: { id: true, fullName: true, relationship: true, source: true, publicNote: true } } } });
  if (!ficha) return null;
  return { notas: ficha.publicNotes && fuentePublica.safeParse(ficha.publicSourceUrl).success ? ficha.publicNotes : null, fuente: fuentePublica.safeParse(ficha.publicSourceUrl).success ? ficha.publicSourceUrl : null, vinculos: ficha.contacts.filter(c => fuentePublica.safeParse(c.source).success) };
}

/** Carga revisada y atómica; los identificadores nunca se registran en auditoría. */
export async function importarAntecedentesElectorales(entrada: unknown, publicar: boolean, userId: string) {
  const payload = esquemaCargaElectoral.parse(entrada);
  const nombre = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
  return prisma.$transaction(async tx => {
    let nuevos = 0;
    for (const [indice, fila] of payload.records.entries()) {
      const { dni, fullName, sourceRowKey, ...datos } = fila;
      const persona = await tx.electoralPerson.upsert({ where: dni ? { dni } : { id: `pre-${sourceRowKey?.slice(0, 40)}` }, update: {}, create: { ...(dni ? { dni } : { id: `pre-${sourceRowKey?.slice(0, 40)}`, dni: null }), fullName, isPublic: publicar }, select: { id: true, fullName: true } });
      if (nombre(persona.fullName) !== nombre(fullName)) throw new ErrorDeNegocio(`La fila ${indice + 1} coincide por documento con una ficha de otro nombre. Revisa la identidad antes de importar.`);
      const where = { personId_electionYear_position_municipality: { personId: persona.id, electionYear: datos.electionYear, position: datos.position, municipality: datos.municipality } };
      const existente = await tx.electoralRecord.findUnique({ where, select: { id: true } });
      if (existente) continue;
      await tx.electoralRecord.create({ data: { ...datos, personId: persona.id, isPublic: publicar } });
      nuevos++;
    }
    await registrarAuditoria(tx, { userId, action: 'IMPORT', entity: 'ElectoralRecord', metadata: { documentSha256: payload.documentSha256, procesados: payload.records.length, nuevos, publicacion: publicar } });
    return { procesados: payload.records.length, nuevos, existentes: payload.records.length - nuevos };
  }, { timeout: 60000 });
}
