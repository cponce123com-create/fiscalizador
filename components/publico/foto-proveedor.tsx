'use client';

import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

/** Solo admite el alojamiento que ya usa el proyecto para fotos de proveedores. */
export function FotoProveedor({ url, nombre }: { url?: string | null; nombre: string }) {
  const [fallida, setFallida] = useState(false);
  let permitida = false;
  try {
    const imagen = new URL(url ?? '');
    permitida = imagen.protocol === 'https:' && imagen.hostname === 'res.cloudinary.com' && !imagen.username && !imagen.password && !imagen.port;
  } catch { /* La ausencia de foto muestra el icono. */ }
  return <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-primary">
    {permitida && !fallida ? <Image src={url!} alt={`Foto de ${nombre}`} fill sizes="56px" className="object-cover" onError={() => setFallida(true)} /> : <Building2 className="h-6 w-6" aria-hidden="true" />}
  </span>;
}
