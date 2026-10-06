/**
 * URL pública del sitio.
 *
 * La usan `metadataBase`, el `sitemap.xml` y la línea `Sitemap:` de `robots.txt`, que
 * exigen URLs absolutas. Se configura con `NEXT_PUBLIC_SITE_URL` —no es un secreto,
 * viaja en el HTML— y en Render se define en `render.yaml`.
 */
export const URL_DEL_SITIO = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? null;

/**
 * `metadataBase` ya resuelto, o `undefined` si no hay URL o no es válida.
 *
 * Se calcula aquí, y no en el layout, para que una variable mal escrita no tumbe el
 * build con una excepción críptica.
 */
export const METADATA_BASE: URL | undefined = (() => {
  if (!URL_DEL_SITIO) return undefined;

  try {
    return new URL(URL_DEL_SITIO);
  } catch {
    console.warn(`NEXT_PUBLIC_SITE_URL no es una URL válida y se ignora: ${URL_DEL_SITIO}`);
    return undefined;
  }
})();

/**
 * URL base para el sitemap y `robots.txt`.
 *
 * Si falta la variable se cae a `localhost`, que es lo útil en desarrollo. En
 * producción, un sitemap apuntando a localhost sería un error silencioso, así que se
 * avisa por el registro.
 */
export function urlDelSitio(): string {
  if (URL_DEL_SITIO) return URL_DEL_SITIO;

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'Falta NEXT_PUBLIC_SITE_URL: el sitemap y robots.txt apuntarán a localhost. ' +
        'Defínela en el entorno (en Render, en render.yaml).',
    );
  }

  return 'http://localhost:3000';
}
