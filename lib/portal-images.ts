import { z } from 'zod';

export const TIPOS_IMAGEN_PORTAL = ['logo', 'favicon', 'portada', 'social'] as const;
export const esquemaTipoImagenPortal = z.enum(TIPOS_IMAGEN_PORTAL);
export type TipoImagenPortal = z.infer<typeof esquemaTipoImagenPortal>;
export const MAX_IMAGEN_PORTAL_BYTES = 5 * 1024 * 1024;
export const claveImagenPortal = (tipo: TipoImagenPortal) => `portal-imagen-${tipo}`;
export const esquemaImagenPortal = z.object({
  url: z.string().max(500).refine(valor => {
    if (!valor) return true;
    try { const url = new URL(valor); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port; } catch { return false; }
  }),
  publicId: z.string().regex(/^fiscalizador\/portal\/[a-f0-9-]{36}$/).nullable(),
  cloud: z.string().regex(/^[A-Za-z0-9_-]+$/).nullable(),
  credito: z.string().trim().max(180).default(''),
});
export type ImagenPortal = z.infer<typeof esquemaImagenPortal>;
