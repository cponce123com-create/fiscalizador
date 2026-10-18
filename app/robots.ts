import type { MetadataRoute } from 'next';

import { urlDelSitio } from '@/lib/site';

/**
 * `robots.txt`.
 *
 * Se permite todo el portal ciudadano y se vetan el panel y la API: no aportan nada a un
 * buscador, y no conviene que aparezcan indexados. Las imágenes sociales públicas
 * sí deben poder rastrearse para generar las vistas previas.
 */
export default function robots(): MetadataRoute.Robots {
  const base = urlDelSitio();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/public/portada-social', '/api/public/compartir/'],
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
