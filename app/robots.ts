import type { MetadataRoute } from 'next';

import { urlDelSitio } from '@/lib/site';

/**
 * `robots.txt`.
 *
 * Se permite todo el portal ciudadano y se vetan el panel y la API: no aportan nada a un
 * buscador, y no conviene que aparezcan indexados.
 */
export default function robots(): MetadataRoute.Robots {
  const base = urlDelSitio();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
