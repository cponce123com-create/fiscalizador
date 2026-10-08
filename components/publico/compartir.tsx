'use client';
import { useState } from 'react';
import { textoCompartido } from '@/lib/compartir';

/** La imagen se prepara primero; compartirla exige un segundo clic con activación vigente. */
export function Compartir({ titulo, resumen, ruta, imagen }: { titulo: string; resumen: string; ruta: string; imagen: string }) {
  const [url, setUrl] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [nativo, setNativo] = useState(false);
  const texto = textoCompartido(titulo, resumen, url);
  const boton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50';
  async function preparar() {
    setOcupado(true); setMensaje(''); setArchivo(null);
    try {
      const r = await fetch(imagen, { cache: 'no-store' });
      if (!r.ok || !r.headers.get('content-type')?.startsWith('image/png')) throw new Error();
      const file = new File([await r.blob()], 'fiscalizador.png', { type: 'image/png' });
      setArchivo(file); setNativo(Boolean(navigator.canShare?.({ files: [file] }) && navigator.share));
      setMensaje('Imagen lista. Puedes compartirla o descargarla y copiar el texto.');
    } catch { setMensaje('No se pudo preparar la imagen. Puedes compartir el enlace o volver a intentar.'); }
    finally { setOcupado(false); }
  }
  async function compartir() {
    if (!archivo) return;
    try { await navigator.share({ files: [archivo], title: titulo, text: texto }); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setMensaje('Usa Descargar imagen y Copiar texto para compartir en tu aplicación.'); }
  }
  function descargar() {
    if (!archivo) return;
    const enlace = document.createElement('a'); const objectUrl = URL.createObjectURL(archivo);
    enlace.href = objectUrl; enlace.download = archivo.name; enlace.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setMensaje('Título, resumen y enlace copiados.'); }
    catch { setMensaje('Selecciona y copia el texto que aparece debajo.'); }
  }
  return <details className="mt-3 rounded-lg border border-border p-3" onToggle={e => { if (e.currentTarget.open) setUrl(new URL(ruta, window.location.origin).href); }}>
    <summary className="cursor-pointer text-sm font-semibold text-primary">Compartir en redes</summary>
    {url ? <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a className={boton} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a className={boton} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
        <button type="button" className={boton} disabled={ocupado} onClick={preparar}>{ocupado ? 'Preparando…' : 'Preparar imagen'}</button>
        <button type="button" className={boton} onClick={copiar}>Copiar texto</button>
        {archivo ? <><button type="button" className={boton} onClick={descargar}>Descargar imagen</button>{nativo ? <button type="button" className={boton} onClick={compartir}>Compartir imagen</button> : null}</> : null}
      </div>
      <p className="whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">{texto}</p>
      <p className="text-xs text-muted-foreground">WhatsApp y Facebook comparten el enlace con su vista previa. Para publicar la imagen, prepárala y adjúntala con el texto.</p>
      <p role="status" className="text-xs">{mensaje}</p>
    </div> : null}
  </details>;
}
