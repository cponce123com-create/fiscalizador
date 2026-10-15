'use client';

import { useState } from 'react';
import { Download, ExternalLink, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Boton } from '@/components/ui/button';
import { enlacesAnualesSeace, MUNICIPIO_SEACE, RUC_SEACE } from '@/lib/descargas-seace';
import { SEACE_EXTENSION_ID } from '@/lib/seace-extension-id';
import type { MunicipalidadActiva } from '@/lib/municipalidad';

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage: (id: string, mensaje: object, respuesta: (dato?: { ok: boolean; error?: string }) => void) => void;
};

export function DescargasSeace({ anioActual, municipalidades }: { anioActual: number; municipalidades: MunicipalidadActiva[] }) {
  const inicial = municipalidades[0] ?? { id: 'mun-san-ramon', nombre: MUNICIPIO_SEACE, nombreCorto: 'San Ramón', ruc: RUC_SEACE, slug: 'san-ramon', provincia: 'Chanchamayo', departamento: 'Junín', tipoEntidad: 'DISTRITAL' };
  const [anio, setAnio] = useState(anioActual - 1);
  const [municipalityId, setMunicipalityId] = useState(inicial.id);
  const [mensaje, setMensaje] = useState('');
  const [instalacion, setInstalacion] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const seleccionada = municipalidades.find(m => m.id === municipalityId) ?? inicial;
  const ruc = seleccionada.ruc;
  const municipio = seleccionada.nombre;
  const rucValido = /^\d{11}$/.test(ruc);
  const meses = rucValido ? enlacesAnualesSeace(anio, ruc, anioActual) : [];

  function descargarAnio() {
    const runtime = (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
    const pedirInstalacion = () => {
      setInstalacion(true);
      setMensaje('Instala el descargador gratuito una sola vez siguiendo los pasos de abajo. Después recarga esta página y vuelve a pulsar Descargar los 12 Excel.');
      setIniciando(false);
    };
    if (!runtime?.sendMessage) { pedirInstalacion(); return; }
    setIniciando(true);
    try {
      runtime.sendMessage(SEACE_EXTENSION_ID, { accion: 'descargar-anio', anio, ruc, municipio: municipio.trim() || 'Municipalidad' }, dato => {
        if (runtime.lastError || !dato) { pedirInstalacion(); return; }
        setIniciando(false);
        setMensaje(dato.ok ? 'Se abrió el descargador automático. Mantén su pestaña abierta: allí verás los Excel guardados y cualquier error de SEACE.' : dato.error ?? 'No se pudo iniciar la descarga.');
      });
    } catch { pedirInstalacion(); }
  }

  return <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-xl font-semibold">Descargar los libros de SEACE</h1>
      <p className="mt-2 text-sm text-muted-foreground">Selecciona el año. El descargador consulta los doce meses en orden, exporta cada Excel original y espera a que Chrome termine de guardarlo antes de continuar.</p>
    </div>
    <section className="flex flex-col gap-4 rounded-xl border border-control bg-card p-4 sm:p-5">
      <p className="break-words font-medium">{municipio.trim() || 'Municipalidad'}<span className="block text-sm font-normal text-muted-foreground">RUC {ruc}</span></p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[18rem] flex-col gap-2 text-sm font-medium">Municipalidad
          <select value={municipalityId} disabled={iniciando} onChange={e => { setMunicipalityId(e.target.value); setMensaje(''); }} className="min-h-11 rounded-lg border border-control bg-background px-4">
            {municipalidades.map(m => <option key={m.id} value={m.id}>{m.nombreCorto} · {m.ruc}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Año
          <select value={anio} disabled={iniciando} onChange={e => { setAnio(Number(e.target.value)); setMensaje(''); }} className="min-h-11 rounded-lg border border-control bg-background px-4">
            {Array.from({ length: anioActual - 1999 }, (_, i) => anioActual - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Boton disabled={!rucValido || iniciando} onClick={descargarAnio}><Download className="h-4 w-4" aria-hidden="true" />{iniciando ? 'Abriendo descargador…' : 'Descargar los 12 Excel'}</Boton>
        <Boton variant="outline" onClick={() => setInstalacion(v => !v)}>Instalar descargador gratuito</Boton>
      </div>
      <p className="text-sm text-muted-foreground">La descarga trabaja en tu Chrome usando el RUC registrado en Municipalidades. Cierra otras pestañas de SEACE antes de empezar. Para agregar otra entidad, primero créala en <Link href="/admin/municipalidades" className="underline">Municipalidades</Link>.</p>
      {!rucValido && <p role="alert" className="text-sm text-destructive">La municipalidad seleccionada no tiene un RUC válido de once dígitos.</p>}
    </section>
    {mensaje && <p role="status" className="rounded-lg border border-control p-3 text-sm">{mensaje}</p>}
    {instalacion && <section className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4 sm:p-5">
      <h2 className="font-semibold">Instalación única en Chrome de escritorio</h2>
      <p className="text-sm">Esta extensión permite que el botón del panel controle SEACE y compruebe el final de cada descarga. Se ejecuta localmente, sin enviar los libros ni las cookies al portal.</p>
      <a href="/api/admin/descargas-seace/extension" className="boton-enlace inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Download className="h-4 w-4" aria-hidden="true" />Descargar extensión ZIP</a>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Descarga el ZIP y extrae todos sus archivos en una carpeta permanente.</li>
        <li>Escribe <code>chrome://extensions</code> en la barra de direcciones y activa <strong>Modo de desarrollador</strong>.</li>
        <li>Pulsa <strong>Cargar descomprimida</strong> y selecciona la carpeta donde está <code>manifest.json</code>.</li>
        <li>Recarga este panel. Elige el año y pulsa <strong>Descargar los 12 Excel</strong>.</li>
      </ol>
      <p className="text-sm text-muted-foreground">También puedes pulsar el icono de la extensión en Chrome y elegir allí el año. Mantén abierta la pestaña del descargador. Si SEACE pide una verificación o devuelve un archivo de otro mes, el proceso se detendrá y mostrará el motivo. La descarga completa en SEACE debe comprobarse en tu navegador.</p>
    </section>}
    <details className="rounded-xl border border-control p-4">
      <summary className="cursor-pointer font-medium">Enlaces manuales de los meses</summary>
      <p className="my-3 text-sm text-muted-foreground">Alternativa manual: consulta y descarga un mes antes de abrir otro. Abrir los doce a la vez puede cruzar las exportaciones de SEACE.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map(mes => <div key={mes.mes} className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" aria-hidden="true" />{mes.nombre} {anio}</h2>
          <a href={mes.url} target="_blank" rel="noopener noreferrer" className="boton-enlace inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-control px-4 py-2 text-sm font-medium"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir mes en SEACE</a>
        </div>)}
      </div>
    </details>
    <p className="text-sm text-muted-foreground">Después de descargar los Excel, súbelos en <Link href="/admin/importar" className="underline">Importar</Link> para revisar y confirmar los datos.</p>
  </div>;
}
