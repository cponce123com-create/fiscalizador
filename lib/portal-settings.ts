import { z } from 'zod';

const imagenPublica = z.string().trim().max(500).default('').refine(valor => {
  if (!valor) return true;
  try { const url = new URL(valor); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port; } catch { return false; }
}, 'Usa una imagen HTTPS alojada en res.cloudinary.com.');

export const esquemaPortal = z.object({
  logo: imagenPublica,
  favicon: imagenPublica,
  imagenSocial: imagenPublica,
  municipio: z.string().trim().min(3).max(120),
  cintaActiva: z.boolean(),
  titular: z.string().trim().max(280),
  enlace: z.string().trim().max(500).refine((valor) => {
    if (!valor) return true;
    if (valor.startsWith('/') && !valor.startsWith('//') && !valor.includes('\\')) return true;
    try { const url = new URL(valor); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }, 'Usa una ruta del portal o una URL http/https.'),
  velocidad: z.enum(['lenta', 'normal', 'rapida']),
  fotoPortada: z.string().trim().max(500).default('').refine(valor => {
    if (!valor) return true;
    try { const url = new URL(valor); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port; } catch { return false; }
  }, 'Usa una imagen HTTPS alojada en res.cloudinary.com.'),
  creditoFoto: z.string().trim().max(180).default(''),
}).refine((datos) => !datos.cintaActiva || datos.titular.length > 0, {
  message: 'Escribe un titular antes de activar la cinta.', path: ['titular'],
}).refine(datos => !datos.fotoPortada || datos.creditoFoto.length > 0, {
  message: 'Indica el lugar y el crédito de la fotografía.', path: ['creditoFoto'],
});
export type ConfiguracionPortal = z.infer<typeof esquemaPortal>;
export const CLAVE_PORTAL = 'portal-ciudadano';
export function configuracionPorDefecto(): ConfiguracionPortal {
  return { municipio: process.env.NEXT_PUBLIC_MUNICIPALIDAD?.trim() || 'Municipalidad Distrital de San Ramón', cintaActiva: false, titular: '', enlace: '', velocidad: 'normal', fotoPortada: '', creditoFoto: '', logo: '', favicon: '', imagenSocial: '' };
}
