'use client';

import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

/** Solo admite el alojamiento que ya usa el proyecto para fotos de proveedores. */
export function FotoProveedor({ url, nombre, formato = 'cuadrado' }: { url?: string | null; nombre: string; formato?: 'cuadrado' | 'carne' }) {
  const [fallida, setFallida] = useState(false);
  const interna = /^\/api\/public\/proveedores\/[A-Za-z0-9_-]+\/foto(?:\?v=\d+)?$/.test(url ?? '');
  let permitida = interna;
  try {
    const imagen = new URL(url ?? '');
    permitida = interna || imagen.protocol === 'https:' && imagen.hostname === 'res.cloudinary.com' && !imagen.username && !imagen.password && !imagen.port;
  } catch { /* La ausencia de foto muestra el icono. */ }
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-primary ${formato === 'carne' ? 'aspect-[3/4] w-16 rounded-lg sm:w-[72px]' : 'h-14 w-14 rounded-xl'}`}>
    {permitida && !fallida ? <Image unoptimized={interna} src={url!} alt={`Foto de ${nombre}`} fill sizes={formato === 'carne' ? '(min-width: 640px) 72px, 64px' : '56px'} className={formato === 'carne' ? 'object-cover object-top' : 'object-cover'} onError={() => setFallida(true)} /> : <Building2 className="h-6 w-6" aria-hidden="true" />}
  </span>;
}
