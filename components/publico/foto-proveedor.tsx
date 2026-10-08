'use client';

import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

/** Solo admite el alojamiento que ya usa el proyecto para fotos de proveedores. */
export function FotoProveedor({ url, nombre }: { url?: string | null; nombre: string }) {
  const [fallida, setFallida] = useState(false);
  const interna = /^\/api\/public\/proveedores\/[A-Za-z0-9_-]+\/foto(?:\?v=\d+)?$/.test(url ?? '');
  let permitida = interna;
  try {
    const imagen = new URL(url ?? '');
    permitida = interna || imagen.protocol === 'https:' && imagen.hostname === 'res.cloudinary.com' && !imagen.username && !imagen.password && !imagen.port;
  } catch { /* La ausencia de foto muestra el icono. */ }
  return <span className="relative flex aspect-[3/4] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-primary sm:w-[72px]">
    {permitida && !fallida ? <Image unoptimized={interna} src={url!} alt={`Foto de ${nombre}`} fill sizes="(min-width: 640px) 72px, 64px" className="object-cover object-top" onError={() => setFallida(true)} /> : <Building2 className="h-6 w-6" aria-hidden="true" />}
  </span>;
}
