import { z } from 'zod';
export const MAX_CONTACTOS_PROVEEDOR = 10;
export function dniDesdeRuc(ruc: string): string | null {
  return /^10\d{9}$/.test(ruc) ? ruc.slice(2, 10) : null;
}
export const fuentePublica = z.string().url().max(500).refine(v => { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; }, "Usa un enlace público HTTP o HTTPS.");
const textoOpcional = (max: number) => z.string().trim().max(max).nullable().transform(v => v || null);
export const esquemaPerfilProveedor = z.object({
  supplierId: z.string().min(1).max(64),
  version: z.string().max(40),
  birthplace: textoOpcional(250),
  currentAddress: textoOpcional(500),
  publicNotes: textoOpcional(3000).optional(),
  publicSourceUrl: textoOpcional(500).optional(),
  publicDistrict: textoOpcional(120).optional(),
  birthDate: z.string().nullable().transform(v => v || null).refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "La fecha de nacimiento no es válida.").optional(),
  notes: textoOpcional(3000),
  contacts: z.array(z.object({
    dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
    fullName: z.string().trim().min(2, 'Escribe el nombre de la persona vinculada.').max(200),
    isPublic: z.boolean().default(false),
    publicNote: textoOpcional(1000).optional(),
    relationship: z.string().trim().min(2, 'Indica el tipo de vínculo.').max(100),
    source: textoOpcional(500),
    notes: textoOpcional(1000),
  }).refine(c => !c.isPublic || fuentePublica.safeParse(c.source).success, "Para publicar un vínculo necesitas el enlace a una fuente pública.")).max(MAX_CONTACTOS_PROVEEDOR, 'Puedes registrar como máximo 10 personas vinculadas.').refine(contactos => new Set(contactos.map(c => c.dni)).size === contactos.length, 'No repitas un DNI en los vínculos.'),
}).refine(p => !p.publicNotes || fuentePublica.safeParse(p.publicSourceUrl).success, "Las notas públicas necesitan un enlace de fuente.");
export type DatosPerfilProveedor = z.input<typeof esquemaPerfilProveedor>;
