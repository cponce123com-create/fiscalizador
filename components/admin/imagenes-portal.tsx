'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Upload, Trash2 } from 'lucide-react';
import { MAX_IMAGEN_PORTAL_BYTES, type TipoImagenPortal } from '@/lib/portal-images';

export function ImagenPortalControl({ tipo, titulo, descripcion, url, credito = '' }: {
  tipo: TipoImagenPortal; titulo: string; descripcion: string; url: string; credito?: string;
}) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [creditoActual, setCredito] = useState(credito);
  async function guardar(borrar: boolean) {
    const foto = archivo.current?.files?.[0];
    if (!borrar && (!foto || foto.size > MAX_IMAGEN_PORTAL_BYTES)) { setError(true); setMensaje('Selecciona una imagen de hasta 5 MB.'); return; }
    if (!borrar && tipo === 'portada' && !creditoActual.trim()) { setError(true); setMensaje('Indica el lugar y el crédito de la fotografía.'); return; }
    setTrabajando(true); setMensaje(''); setError(false);
    try {
      const form = new FormData();
      if (foto) form.set('imagen', foto);
      form.set('credito', creditoActual);
      const response = await fetch(`/api/admin/apariencia/imagenes/${tipo}`, { method: borrar ? 'DELETE' : 'POST', body: borrar ? undefined : form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la imagen.');
      setMensaje(data.aviso ?? (borrar ? 'Imagen retirada.' : 'Imagen publicada en el portal.'));
      setPreview(null);
      if (archivo.current) archivo.current.value = '';
      router.refresh();
    } catch (e) { setError(true); setMensaje(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { setTrabajando(false); }
  }
  return <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
    <div><h3 className="font-semibold">{titulo}</h3><p className="mt-1 text-sm text-muted-foreground">{descripcion}</p></div>
    <div className={`relative flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border ${tipo === 'logo' || tipo === 'favicon' ? 'bg-muted/40' : 'bg-emerald-950'}`}>
      {preview || url ? <Image unoptimized src={preview ?? url} alt={`Vista previa: ${titulo}`} fill className="object-contain p-2" /> : <span className="flex items-center gap-2 text-sm text-muted-foreground"><ImagePlus size={20} />Sin imagen personalizada</span>}
    </div>
    <label className="flex flex-col gap-2 text-sm font-medium">Seleccionar imagen<input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" disabled={trabajando} className="w-full min-w-0 rounded-lg border border-input bg-background p-2 text-base file:mr-2 file:rounded file:border-0 file:p-2" onChange={event => {
      const file = event.target.files?.[0]; setMensaje('');
      if (file && file.size > MAX_IMAGEN_PORTAL_BYTES) { event.target.value = ''; setError(true); setMensaje('La imagen supera 5 MB.'); setPreview(null); return; }
      if (!file) { setPreview(null); return; }
      const reader = new FileReader(); reader.onload = () => setPreview(String(reader.result)); reader.readAsDataURL(file);
    }} /></label>
    {tipo === 'portada' ? <label className="flex flex-col gap-2 text-sm font-medium">Lugar y crédito de la fotografía<input value={creditoActual} onChange={e => setCredito(e.target.value)} disabled={trabajando} maxLength={180} className="rounded-lg border border-input bg-background px-3 py-3 text-base" placeholder="San Ramón · Foto: …" /></label> : null}
    <div className="mt-auto flex flex-wrap gap-2"><button type="button" disabled={trabajando} onClick={() => guardar(false)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Upload size={16} />{trabajando ? 'Procesando…' : 'Subir y publicar'}</button><button type="button" disabled={trabajando || !url} onClick={() => guardar(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"><Trash2 size={16} />Retirar</button></div>
    {mensaje ? <p role="status" aria-live="polite" className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{mensaje}</p> : null}
  </section>;
}
