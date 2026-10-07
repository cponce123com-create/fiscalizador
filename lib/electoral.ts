import { z } from 'zod';
import { fuentePublica } from './supplier-profile';

export const esquemaPersonaElectoral = z.object({
  id: z.string().max(64).optional(),
  fullName: z.string().trim().min(3).max(200),
  dni: z.string().trim().transform(v => v || null).refine(v => !v || /^\d{8}$/.test(v), 'El DNI debe tener ocho dígitos.'),
  isPublic: z.boolean(),
});
const provisional = {
  listPosition: z.preprocess(v => v === '' || v === null ? undefined : v, z.coerce.number().int().min(1).max(20).optional()),
  registrationStatus: z.preprocess(v => v === '' ? undefined : v, z.enum(['INSCRITO', 'RENUNCIA', 'IMPROCEDENTE', 'POR_VERIFICAR']).optional()),
  preliminaryOutcome: z.preprocess(v => v === '' ? undefined : v, z.literal('POSIBLE_ELECTO').optional()),
  preliminarySource: z.string().trim().max(1000).optional(),
};
export const esquemaRegistroElectoral = z.object({
  ...provisional,
  id: z.string().max(64).optional(),
  personId: z.string().min(1).max(64),
  electionYear: z.coerce.number().int().min(1900).max(2100),
  position: z.enum(['ALCALDE', 'REGIDOR', 'CONSEJERO', 'OTRO']),
  organization: z.string().trim().min(2).max(200),
  mayorCandidate: z.string().trim().min(2).max(200),
  municipality: z.string().trim().min(2).max(200),
  termStart: z.coerce.number().int().min(1900).max(2100),
  termEnd: z.coerce.number().int().min(1900).max(2100),
  result: z.enum(['ELECTO', 'NO_ELECTO', 'IMPROCEDENTE', 'POR_VERIFICAR']),
  source: z.string().trim().min(12).max(500),
  sourceUrl: fuentePublica,
  isPublic: z.boolean(),
}).refine(v => v.termEnd >= v.termStart && v.termStart >= v.electionYear, 'Revisa el periodo de gobierno y el año electoral.').refine(v => !v.preliminaryOutcome || (v.preliminarySource?.length ?? 0) >= 12, 'La proyección necesita indicar su fuente y carácter provisional.');

export const esquemaCargaElectoral = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  records: z.array(z.object({
    ...provisional,
    sourceRowKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    fullName: z.string().trim().min(3).max(200),
    dni: z.string().refine(v => v === '' || /^\d{8}$/.test(v), 'DNI no válido.'),
    electionYear: z.coerce.number().int().min(1900).max(2100),
    position: z.enum(['ALCALDE', 'REGIDOR', 'CONSEJERO', 'OTRO']),
    organization: z.string().trim().min(2).max(200),
    mayorCandidate: z.string().trim().min(2).max(200),
    municipality: z.string().trim().min(2).max(200),
    termStart: z.coerce.number().int().min(1900).max(2100),
    termEnd: z.coerce.number().int().min(1900).max(2100),
    result: z.enum(['ELECTO', 'NO_ELECTO', 'IMPROCEDENTE', 'POR_VERIFICAR']),
    source: z.string().trim().min(12).max(500),
    sourceUrl: fuentePublica,
  }).refine(v => v.termEnd >= v.termStart && v.termStart >= v.electionYear, 'Periodo no válido.').refine(v => !v.preliminaryOutcome || (v.preliminarySource?.length ?? 0) >= 12, 'La proyección necesita fuente.')).min(1).max(200),
}).refine(v => new Set(v.records.map(r => `${r.dni || r.sourceRowKey}|${r.electionYear}|${r.position}|${r.municipality}`)).size === v.records.length, 'La carga repite un antecedente.')
.refine(v => v.records.every(r => v.version === 1 ? /^\d{8}$/.test(r.dni) : Boolean(r.dni || r.sourceRowKey)), 'Las filas sin DNI necesitan una clave estable de origen en formato versión 2.');

export function normalizarNombreElectoral(nombre: string) {
  return nombre.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
}
export function detectarCoincidenciasElectorales<T extends { id: string; fullName: string; dni: string | null }>(personas: T[]) {
  const grupos = new Map<string, T[]>();
  for (const persona of personas) {
    const clave = normalizarNombreElectoral(persona.fullName);
    grupos.set(clave, [...(grupos.get(clave) ?? []), persona]);
  }
  return [...grupos.values()].filter(g => g.length > 1);
}
