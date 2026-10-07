'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
export function FotoPerfilProveedor({ supplierId, tieneFoto, version, editable }: { supplierId: string; tieneFoto: boolean; version: string; editable: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ruta = `/api/admin/proveedores/${supplierId}/foto`;
  async function enviar(form?: FormData) {
    setOcupado(true); setMensaje('');
    try {
      const response = await fetch(ruta, { method: form ? 'POST' : 'DELETE', body: form, credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar la foto.');
      setMensaje(form ? 'Foto guardada.' : 'Foto retirada.');
      router.refresh();
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo actualizar la foto.'); }
    finally { setOcupado(false); }
  }
  return <section className="flex flex-wrap items-start gap-5 rounded-lg border border-border bg-card p-5">
    {tieneFoto ? <Image key={version} unoptimized src={`${ruta}?v=${encodeURIComponent(version)}`} alt="Foto del perfil del proveedor" width={160} height={160} className="h-40 w-40 rounded-lg object-cover" /> : <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Sin foto</div>}
    <div className="flex flex-col gap-3"><h2 className="font-semibold">Foto pública del proveedor</h2>{editable ? <><p className="text-xs text-muted-foreground">JPEG, PNG o WebP, hasta 2 MB. Guarda la ficha antes de cambiar la foto.</p><form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void enviar(form); }} className="flex flex-col gap-3"><label className="text-sm">Seleccionar foto<input required disabled={ocupado} type="file" name="foto" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm" /></label><button disabled={ocupado} className="w-fit rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{ocupado ? 'Guardando…' : 'Guardar foto'}</button></form>{tieneFoto ? <button type="button" disabled={ocupado} className="w-fit text-sm text-destructive underline" onClick={() => void enviar()}>Retirar foto</button> : null}</> : null}<p role="status" aria-live="polite" className="text-sm">{mensaje}</p></div>
  </section>;
}
