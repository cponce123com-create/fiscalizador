'use client';
import { useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { Boton } from '@/components/ui/button';
import { MESES_SEACE, type DescargaSeace } from '@/lib/descargas-seace';

export function DescargasSeace({ configurado, inicial, anioActual }: { configurado: boolean; inicial: DescargaSeace | null; anioActual: number }) {
  const [anio, setAnio] = useState(inicial?.anio ?? anioActual - 1);
  const [dato, setDato] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [mesActivo, setMesActivo] = useState<number | null>(null);
  const [error, setError] = useState('');
  const pausar = useRef(false);
  const completados = dato?.meses.filter(m => m.estado === 'descargado').length ?? 0;
  async function peticion(body: object) {
    const respuesta = await fetch('/api/admin/descargas-seace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await respuesta.json();
    if (!respuesta.ok) throw new Error(json.error ?? 'No se pudo completar la solicitud.');
    return json;
  }
  async function ejecutar(soloMes?: number) {
    if (ocupado) return;
    setOcupado(true); setError(''); pausar.current = false;
    try {
      let actual: DescargaSeace = dato ?? await peticion({ accion: 'crear', anio });
      setDato(actual);
      const meses = soloMes ? [soloMes] : actual.meses.filter(m => m.estado !== 'descargado').map(m => m.mes);
      for (const mes of meses) {
        if (pausar.current) break;
        setMesActivo(mes);
        actual = await peticion({ accion: 'mes', id: actual.id, mes });
        setDato(actual);
      }
      if (actual.meses.every(m => m.estado === 'descargado')) {
        const enlace = document.createElement('a');
        enlace.href = `/api/admin/descargas-seace?id=${actual.id}&zip=1`;
        enlace.download = '';
        document.body.appendChild(enlace); enlace.click(); enlace.remove();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión.'); }
    finally { setOcupado(false); setMesActivo(null); }
  }
  async function eliminar() {
    if (!dato || !confirm('¿Eliminar esta descarga temporal para seleccionar otro año? Las importaciones existentes se conservan.')) return;
    setOcupado(true); setError('');
    try { await peticion({ accion: 'eliminar', id: dato.id }); setDato(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar.'); }
    finally { setOcupado(false); }
  }
  return <div className="flex flex-col gap-6">
    <div><h1 className="text-xl font-semibold">Descargar libros de SEACE</h1><p className="mt-2 text-sm text-muted-foreground">Municipalidad Distrital de San Ramón · selecciona un año para descargar los doce Excel mensuales de órdenes y servicios.</p></div>
    {!configurado && <div role="alert" className="rounded-lg border border-control bg-muted p-4 text-sm">Falta conectar el servicio de navegador. Configura SEACE_WORKER_URL y SEACE_WORKER_TOKEN en Render siguiendo docs/descargas-seace-admin.md.</div>}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-control bg-card p-4">
      <label className="flex flex-col gap-2 text-sm font-medium">Año<select value={anio} onChange={e => setAnio(Number(e.target.value))} disabled={ocupado || Boolean(dato)} className="min-h-11 rounded-lg border border-control bg-background px-4">{Array.from({ length: anioActual - 1999 }, (_, i) => anioActual - i).map(a => <option key={a} value={a}>{a}</option>)}</select></label>
      <Boton disabled={!configurado || ocupado || completados === 12} onClick={() => void ejecutar()}>{ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{dato ? 'Continuar / reintentar pendientes' : 'Descargar los 12 libros'}</Boton>
      {ocupado && <Boton variant="outline" onClick={() => { pausar.current = true; }}>Pausar al terminar este mes</Boton>}
      {dato && <Boton variant="outline" disabled={ocupado} onClick={() => void eliminar()}>Eliminar descarga temporal</Boton>}
    </div>
    <p className="text-sm text-muted-foreground">Los originales se conservan durante 24 horas. Después de descargar el ZIP, puedes subirlos en <Link href="/admin/importar" className="underline">Importar</Link> para revisar y confirmar sus datos.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {dato && <>
      <div aria-live="polite" className="text-sm font-medium">{completados} de 12 libros descargados{mesActivo ? ` · consultando ${MESES_SEACE[mesActivo - 1]}…` : ''}</div>
      <progress value={completados} max={12} aria-label="Libros descargados" className="h-3 w-full accent-primary" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{dato.meses.map(fila => <div key={fila.mes} className="flex flex-col gap-2 rounded-xl border border-control bg-card p-4">
        <h2 className="font-semibold">{MESES_SEACE[fila.mes - 1]} {dato.anio}</h2>
        <p className="text-sm">{mesActivo === fila.mes ? 'Descargando…' : fila.estado === 'descargado' ? 'Excel descargado' : fila.estado === 'error' ? 'Requiere reintento' : 'Pendiente'}</p>
        {fila.archivo && <p className="break-all text-xs text-muted-foreground">{fila.archivo}</p>}
        {fila.detalle && <p className="text-xs text-destructive">{fila.detalle}</p>}
        {fila.estado === 'error' && <Boton variant="outline" size="sm" disabled={ocupado || !configurado} onClick={() => void ejecutar(fila.mes)}><RotateCw className="h-4 w-4" />Reintentar mes</Boton>}
      </div>)}</div>
      {completados > 0 && !ocupado && <a className="boton-enlace inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={`/api/admin/descargas-seace?id=${dato.id}&zip=1`}><Download className="h-4 w-4" />{completados === 12 ? 'Descargar ZIP · 12 libros' : `Descargar ZIP parcial · ${completados} de 12 libros`}</a>}
      {completados < 12 && !ocupado && <p className="text-sm text-muted-foreground">Un mes sin descarga no se considera un mes sin gastos. Revisa los pendientes en SEACE.</p>}
    </>}
  </div>;
}
