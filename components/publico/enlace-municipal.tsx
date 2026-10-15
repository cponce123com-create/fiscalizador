'use client';

import Link, { type LinkProps } from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export function EnlaceMunicipal({ href, children, ...props }: LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { children: ReactNode }) {
  const searchParams = useSearchParams();
  const municipalidad = searchParams.get('municipalidad');
  let destino = href;
  if (typeof href === 'string' && municipalidad) {
    const [ruta, fragmento] = href.split('#', 2);
    destino = `${ruta}${ruta.includes('?') ? '&' : '?'}municipalidad=${encodeURIComponent(municipalidad)}${fragmento ? `#${fragmento}` : ''}`;
  }
  return <Link href={destino} {...props}>{children}</Link>;
}
