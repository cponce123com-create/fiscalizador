import { z } from 'zod';
export const MAX_CONTACTOS_PROVEEDOR = 10;
export function dniDesdeRuc(ruc: string): string | null {
  return /^10\d{9}$/.test(ruc) ? ruc.slice(2, 10) : null;
}
const textoOpcional = (max: number) => z.string().trim().max(max).nullable().transform(v => v || null);
export const esquemaPerfilProveedor = z.object({
  supplierId: z.string().min(1).max(64),
  version: z.string().max(40),
  birthplace: textoOpcional(250),
  currentAddress: textoOpcional(500),
  notes: textoOpcional(3000),
  contacts: z.array(z.object({
    dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
    fullName: z.string().trim().min(2, 'Escribe el nombre de la persona vinculada.').max(200),
    relationship: z.string().trim().min(2, 'Indica el tipo de vínculo.').max(100),
    source: textoOpcional(500),
    notes: textoOpcional(1000),
  })).max(MAX_CONTACTOS_PROVEEDOR, 'Puedes registrar como máximo 10 personas vinculadas.').refine(contactos => new Set(contactos.map(c => c.dni)).size === contactos.length, 'No repitas un DNI en los vínculos.'),
});
export type DatosPerfilProveedor = z.infer<typeof esquemaPerfilProveedor>;
