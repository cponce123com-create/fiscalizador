import { z } from 'zod';

export const configuracionIA = z.object({
  enabled: z.boolean().default(false),
  publicEnabled: z.boolean().default(false),
  dailyTokens: z.number().int().min(12000).max(500000).default(120000),
  monthlyTokens: z.number().int().min(12000).max(9000000).default(1000000),
});
export const planIA = z.object({
  accion: z.enum(['consultar', 'no_admitida']),
  proveedor: z.string().trim().max(100).nullable(),
  categoria: z.string().max(60).nullable(),
  municipalidades: z.array(z.string().max(80)).max(3),
  desde: z.number().int().min(2000).max(2100).nullable(),
  hasta: z.number().int().min(2000).max(2100).nullable(),
  variasMunicipalidades: z.boolean(),
}).strict().refine(p => p.desde === null || p.hasta === null || p.desde <= p.hasta);
export type PlanIA = z.infer<typeof planIA>;
export type ResultadoIA = {
  plan: PlanIA;
  alcance: string;
  filas: { proveedor: string; slug: string; municipalidad: string; municipalidadSlug: string; gestion: string; ordenes: number; monto: string }[];
  fuentes: { id: string; numero: string; descripcion: string | null; municipio: string }[];
  resumen: { municipalidad: string; gestion: string; ordenes: number; monto: string }[];
  limitado: boolean;
};
