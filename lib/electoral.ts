import { z } from 'zod';
import { fuentePublica } from './supplier-profile';

export const esquemaPersonaElectoral = z.object({
  id: z.string().max(64).optional(),
  fullName: z.string().trim().min(3).max(200),
  dni: z.string().trim().transform(v => v || null).refine(v => !v || /^\d{8}$/.test(v), 'El DNI debe tener ocho dígitos.'),
  isPublic: z.boolean(),
});
export const esquemaRegistroElectoral = z.object({
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
}).refine(v => v.termEnd >= v.termStart && v.termStart >= v.electionYear, 'Revisa el periodo de gobierno y el año electoral.');

export const esquemaCargaElectoral = z.object({
  version: z.literal(1),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  records: z.array(z.object({
    fullName: z.string().trim().min(3).max(200),
    dni: z.string().regex(/^\d{8}$/),
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
  }).refine(v => v.termEnd >= v.termStart && v.termStart >= v.electionYear, 'Periodo no válido.')).min(1).max(200),
}).refine(v => new Set(v.records.map(r => `${r.dni}|${r.electionYear}|${r.position}|${r.municipality}`)).size === v.records.length, 'La carga repite un antecedente.');
