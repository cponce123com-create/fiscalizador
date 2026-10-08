'use client';

import { useRef, useState } from 'react';
import { Copy, ExternalLink, CalendarDays, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Boton } from '@/components/ui/button';
import { enlacesAnualesSeace, MUNICIPIO_SEACE, RUC_SEACE } from '@/lib/descargas-seace';

export function DescargasSeace({ anioActual }: { anioActual: number }) {
  const [anio, setAnio] = useState(anioActual - 1);
  const [ruc, setRuc] = useState(RUC_SEACE);
  const [municipio, setMunicipio] = useState(MUNICIPIO_SEACE);
  const [mensaje, setMensaje] = useState('');
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mesActivo, setMesActivo] = useState<number | null>(null);
  const [preparados, setPreparados] = useState<number[]>([]);
  const [error, setError] = useState('');
  const detener = useRef(false);
  const rucValido = /^\d{11}$/.test(ruc);
  const meses = rucValido ? enlacesAnualesSeace(anio, ruc, anioActual) : [];
  const texto = `${municipio.trim() || 'Municipalidad'} · RUC ${ruc} · ${anio}\n\n${meses.map(m => `${m.nombre}: ${m.url}`).join('\n\n')}`;

  function abrirTodos() {
    let abiertas = 0;
    // Ejecutar durante el clic: los temporizadores hacen que el navegador bloquee más pestañas.
    for (const mes of meses) {
      const ventana = window.open('about:blank', '_blank');
      if (!ventana) continue;
      // Desvincular antes de navegar sin confundir noopener con un popup bloqueado.
      ventana.opener = null;
      ventana.location.replace(mes.url);
      abiertas++;
    }
    setMensaje(abiertas === 12
      ? 'Se abrieron los doce meses. En cada pestaña, pulsa el botón para descargar Excel de SEACE.'
      : `Se abrieron ${abiertas} de 12 pestañas. Permite las ventanas emergentes de este portal y vuelve a intentarlo, o abre cada mes con su botón.`);
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setMensaje('Los doce enlaces se copiaron al portapapeles.'); }
    catch { setMostrarTexto(true); setMensaje('Selecciona y copia los enlaces del cuadro de texto.'); }
  }

  async function descargar(soloMes?: number) {
    if (descargando) return;
    setDescargando(true); setError(''); detener.current = false;
    try {
      const lista = soloMes ? meses.filter(m => m.mes === soloMes) : meses.filter(m => !preparados.includes(m.mes));
      for (const mes of lista) {
        if (detener.current) break;
        setMesActivo(mes.mes);
        const respuesta = await fetch('/api/admin/descargas-seace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio, mes: mes.mes, ruc, municipio: municipio.trim() || 'Municipalidad' }) });
        if (!respuesta.ok) {
          const fallo = await respuesta.json().catch(() => ({}));
          throw new Error(`${mes.nombre}: ${fallo.error ?? 'No se pudo descargar este mes.'}`);
        }
        const blob = await respuesta.blob();
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = /filename="([^"]+)"/.exec(respuesta.headers.get('Content-Disposition') ?? '')?.[1] ?? `Ordenes-y-servicios-${anio}-${mes.mes}.xls`;
        document.body.appendChild(enlace); enlace.click(); enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setPreparados(prev => prev.includes(mes.mes) ? prev : [...prev, mes.mes]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión.'); }
    finally { setDescargando(false); setMesActivo(null); }
  }

  return <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-xl font-semibold">Libros mensuales de SEACE</h1>
      <p className="mt-2 text-sm text-muted-foreground">Elige el año y abre los doce meses de órdenes de compra y servicios, sin escribir las fechas en SEACE.</p>
    </div>
    <div className="flex flex-col gap-4 rounded-xl border border-control bg-card p-4 sm:p-5">
      <p className="break-words font-medium">{municipio.trim() || 'Municipalidad'} <span className="block text-sm font-normal text-muted-foreground">RUC {ruc}</span></p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium">Año
          <select value={anio} disabled={descargando} onChange={e => { setAnio(Number(e.target.value)); setMensaje(''); setPreparados([]); setError(''); }} className="min-h-11 rounded-lg border border-control bg-background px-4">
            {Array.from({ length: anioActual - 1999 }, (_, i) => anioActual - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Boton disabled={!rucValido || descargando || preparados.length === 12} onClick={() => void descargar()}>{descargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}{preparados.length ? 'Descargar meses pendientes' : 'Descargar los 12 Excel'}</Boton>
        {descargando && <Boton variant="outline" onClick={() => { detener.current = true; }}>Pausar al terminar este mes</Boton>}
        <Boton disabled={!rucValido} onClick={abrirTodos}><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir los 12 meses</Boton>
        <Boton variant="outline" disabled={!rucValido} onClick={() => void copiar()}><Copy className="h-4 w-4" aria-hidden="true" />Copiar los 12 enlaces</Boton>
      </div>
      <details className="rounded-lg border border-control p-3">
        <summary className="cursor-pointer text-sm font-medium">Consultar otra municipalidad</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">Nombre de la municipalidad<input value={municipio} disabled={descargando} maxLength={120} onChange={e => { setMunicipio(e.target.value); setMensaje(''); setPreparados([]); setError(''); }} className="min-h-11 rounded-lg border border-control bg-background px-3" /></label>
          <label className="flex flex-col gap-2 text-sm">RUC de la entidad<input value={ruc} disabled={descargando} maxLength={11} inputMode="numeric" onChange={e => { setRuc(e.target.value); setMensaje(''); setPreparados([]); setError(''); }} aria-invalid={!rucValido} className="min-h-11 rounded-lg border border-control bg-background px-3" /></label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Estos campos cambian únicamente los enlaces de esta consulta. Al recargar, vuelve San Ramón.</p>
      </details>
      {!rucValido && <p role="alert" className="text-sm text-destructive">Escribe los once dígitos del RUC de la municipalidad para generar los enlaces.</p>}
    </div>
    <div className="rounded-lg border border-control p-4 text-sm">
      <p>«Descargar los 12 Excel» intenta guardar los originales directamente, mes a mes, usando el formulario de SEACE. Permite las descargas múltiples si tu navegador lo solicita.</p>
      <p className="mt-2 text-muted-foreground">Si SEACE bloquea al servidor, la secuencia se detiene y puedes usar los enlaces manuales de abajo. Esta opción aún requiere una prueba real desde Render.</p>
    </div>
    {(preparados.length > 0 || descargando) && <p role="status" className="text-sm">{preparados.length} de 12 archivos enviados al navegador{mesActivo ? ` · consultando ${meses[mesActivo - 1]?.nombre}…` : ''}. Comprueba que se guardaron en Descargas.</p>}
    {error && <p role="alert" className="rounded-lg border border-control p-3 text-sm text-destructive">{error}</p>}
    <div className="rounded-lg border border-control bg-muted p-4 text-sm">
      <p><strong>Cómo descargar:</strong> abre el mes y pulsa el botón para descargar Excel dentro de SEACE. El archivo se guarda en tu computadora.</p>
      <p className="mt-2 text-muted-foreground">El botón «Abrir los 12 meses» abre las consultas en pestañas; no pulsa automáticamente los botones de otra web. Tu navegador puede pedir que permitas ventanas emergentes.</p>
    </div>
    {mensaje && <p role="status" className="rounded-lg border border-control p-3 text-sm">{mensaje}</p>}
    {mostrarTexto && meses.length > 0 && <label className="flex flex-col gap-2 text-sm">Enlaces para copiar<textarea readOnly value={texto} onFocus={e => e.currentTarget.select()} rows={8} className="w-full rounded-lg border border-control bg-background p-3 text-xs" /></label>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meses.map(mes => <div key={mes.mes} className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{mes.nombre} {anio}</h2>
        <Boton variant="outline" disabled={descargando} onClick={() => void descargar(mes.mes)}><Download className="h-4 w-4" aria-hidden="true" />Descargar Excel</Boton>
        {preparados.includes(mes.mes) && <p className="text-xs text-muted-foreground">Archivo enviado al navegador</p>}
        <a href={mes.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${mes.nombre} de ${anio} en SEACE`} className="boton-enlace inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir mes en SEACE</a>
      </div>)}
    </div>
    <p className="text-sm text-muted-foreground">Después de guardar los Excel, súbelos en <Link href="/admin/importar" className="underline">Importar</Link> para revisar y confirmar sus datos.</p>
  </div>;
}
