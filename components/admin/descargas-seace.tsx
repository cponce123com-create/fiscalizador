'use client';

import { useRef, useState } from 'react';
import { Copy, ExternalLink, CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { Boton } from '@/components/ui/button';
import { enlacesAnualesSeace, MUNICIPIO_SEACE, RUC_SEACE } from '@/lib/descargas-seace';
import { crearMarcadorSeace } from '@/lib/seace-marcador';

export function DescargasSeace({ anioActual }: { anioActual: number }) {
  const [anio, setAnio] = useState(anioActual - 1);
  const [ruc, setRuc] = useState(RUC_SEACE);
  const [municipio, setMunicipio] = useState(MUNICIPIO_SEACE);
  const [mensaje, setMensaje] = useState('');
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [verMarcador, setVerMarcador] = useState(false);
  const [mesAbierto, setMesAbierto] = useState<number | null>(null);
  const [completados, setCompletados] = useState<number[]>([]);
  const pestanaSeace = useRef<Window | null>(null);
  const rucValido = /^\d{11}$/.test(ruc);
  const meses = rucValido ? enlacesAnualesSeace(anio, ruc, anioActual) : [];
  const marcador = rucValido ? crearMarcadorSeace({ anio, ruc, municipio: municipio.trim() || 'Municipalidad' }) : '';
  const texto = `${municipio.trim() || 'Municipalidad'} · RUC ${ruc} · ${anio}\n\n${meses.map(m => `${m.nombre}: ${m.url}`).join('\n\n')}`;

  function abrirMes(indice: number) {
    const mes = meses[indice];
    if (!mes) return;
    try {
      const anterior = pestanaSeace.current;
      if (anterior && !anterior.closed) {
        // Se puede navegar una ventana externa, sin leer su contenido ni su sesión.
        anterior.location.href = mes.url;
        anterior.focus();
      } else {
        const nueva = window.open(mes.url, '_blank');
        if (!nueva) {
          setMensaje('El navegador bloqueó la pestaña. Permite abrir SEACE y vuelve a pulsar el mes.');
          return;
        }
        nueva.opener = null;
        pestanaSeace.current = nueva;
      }
      setMesAbierto(indice);
      setMensaje(`Comprueba que SEACE muestra ${mes.nombre} ${anio} y descarga el Excel antes de abrir otro mes.`);
    } catch {
      setMensaje('No se pudo reutilizar la pestaña. Ciérrala y vuelve a pulsar el mes.');
    }
  }

  function confirmarDescarga() {
    if (mesAbierto === null) return;
    setCompletados(previo => [...new Set([...previo, mesAbierto])]);
    if (mesAbierto < 11) abrirMes(mesAbierto + 1);
    else {
      setMesAbierto(null);
      setMensaje('Marcaste diciembre como descargado. Revisa los Excel guardados antes de importarlos.');
    }
  }

  function reiniciarRecorrido() {
    setMesAbierto(null);
    setCompletados([]);
    setMensaje('');
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setMensaje('Los doce enlaces se copiaron. Utilízalos uno por uno y descarga cada mes antes de abrir el siguiente.'); }
    catch { setMostrarTexto(true); setMensaje('Selecciona y copia los enlaces del cuadro de texto.'); }
  }

  return <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-xl font-semibold">Libros mensuales de SEACE</h1>
      <p className="mt-2 text-sm text-muted-foreground">Elige el año y descarga los meses de órdenes de compra y servicios uno por uno, desde una sola pestaña de SEACE.</p>
    </div>
    <div className="flex flex-col gap-4 rounded-xl border border-control bg-card p-4 sm:p-5">
      <p className="break-words font-medium">{municipio.trim() || 'Municipalidad'} <span className="block text-sm font-normal text-muted-foreground">RUC {ruc}</span></p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium">Año
          <select value={anio} onChange={e => { setAnio(Number(e.target.value)); reiniciarRecorrido(); }} className="min-h-11 rounded-lg border border-control bg-background px-4">
            {Array.from({ length: anioActual - 1999 }, (_, i) => anioActual - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Boton disabled={!rucValido} onClick={() => { setVerMarcador(true); setMensaje('Cierra las otras pestañas de SEACE antes de ejecutar el marcador. No uses el recorrido manual al mismo tiempo.'); }}><ExternalLink className="h-4 w-4" aria-hidden="true" />Descarga automática en mi navegador</Boton>
        <Boton variant="outline" disabled={!rucValido} onClick={() => { setCompletados([]); abrirMes(0); }}><ExternalLink className="h-4 w-4" aria-hidden="true" />Empezar por enero</Boton>
        <Boton variant="outline" disabled={!rucValido} onClick={() => void copiar()}><Copy className="h-4 w-4" aria-hidden="true" />Copiar los 12 enlaces</Boton>
      </div>
      <details className="rounded-lg border border-control p-3">
        <summary className="cursor-pointer text-sm font-medium">Consultar otra municipalidad</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">Nombre de la municipalidad<input value={municipio} maxLength={120} onChange={e => { setMunicipio(e.target.value); reiniciarRecorrido(); }} className="min-h-11 rounded-lg border border-control bg-background px-3" /></label>
          <label className="flex flex-col gap-2 text-sm">RUC de la entidad<input value={ruc} maxLength={11} inputMode="numeric" onChange={e => { setRuc(e.target.value); reiniciarRecorrido(); }} aria-invalid={!rucValido} className="min-h-11 rounded-lg border border-control bg-background px-3" /></label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Estos campos cambian únicamente los enlaces de esta consulta. Al recargar, vuelve San Ramón.</p>
      </details>
      {!rucValido && <p role="alert" className="text-sm text-destructive">Escribe los once dígitos del RUC de la municipalidad para generar los enlaces.</p>}
    </div>
    {verMarcador && rucValido && <section id="automatizacion" className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4 sm:p-5">
      <h2 className="font-semibold">Preparar la descarga de {anio}</h2>
      <p className="text-sm">La descarga se ejecutará en tu computadora. Solo tienes que crear un marcador del navegador para el año elegido.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Muestra la barra de marcadores con <strong>Ctrl + Shift + B</strong>.</li>
        <li>Arrastra el enlace de abajo a esa barra. Si no puedes arrastrarlo, crea un marcador y pega el código del cuadro en su campo URL.</li>
        <li>Cierra las otras pestañas de SEACE. Abre enero con el botón de abajo y pulsa el marcador que creaste dentro de esa página.</li>
        <li>Permite las descargas múltiples si Chrome lo solicita y mantén esa pestaña abierta.</li>
      </ol>
      <a href="#automatizacion" ref={elemento => { if (elemento) elemento.setAttribute('href', marcador); }} draggable onClick={e => { e.preventDefault(); setMensaje('Arrastra este enlace a la barra de marcadores; ejecútalo después en SEACE.'); }} className="boton-enlace inline-flex min-h-11 items-center justify-center rounded-lg border border-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Descargar SEACE {anio}</a>
      <Boton variant="outline" onClick={() => abrirMes(0)}>Abrir enero de {anio} en SEACE</Boton>
      <details><summary className="cursor-pointer text-sm font-medium">Código del marcador para copiar</summary><textarea aria-label="URL del marcador" value={marcador} readOnly onFocus={e => e.currentTarget.select()} rows={4} className="mt-2 w-full rounded-lg border border-control bg-background p-3 text-xs" /></details>
      <p className="text-sm text-muted-foreground">El panel de SEACE mostrará el progreso y permitirá pausar, continuar y reiniciar los meses enviados. Si cambias de año o RUC, crea de nuevo el marcador. Esta opción necesita una prueba en tu navegador; si el sitio bloquea el marcador, usa los enlaces manuales.</p>
    </section>}
    <div className="rounded-lg border border-control bg-muted p-4 text-sm">
      <p><strong>Cómo descargar:</strong> abre el mes y pulsa el botón para descargar Excel dentro de SEACE. El archivo se guarda en tu computadora.</p>
      <p className="mt-2 text-muted-foreground">Cierra las otras pestañas de SEACE antes de empezar. Abrir varios meses a la vez puede hacer que SEACE exporte la última consulta en todas las pestañas. Este recorrido reutiliza una sola pestaña: descarga cada mes antes de continuar. No lo uses mientras trabaja el marcador automático.</p>
    </div>
    {rucValido && <section className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4 sm:p-5" aria-label="Recorrido mensual">
      <h2 className="font-semibold">Descarga mes por mes</h2>
      <p className="text-sm">{mesAbierto === null ? 'Pulsa «Empezar por enero» o elige un mes de abajo.' : `Mes abierto: ${meses[mesAbierto].nombre} ${anio}. Descarga su Excel en SEACE y vuelve aquí para continuar.`}</p>
      {mesAbierto !== null && <Boton onClick={confirmarDescarga}>{mesAbierto === 11 ? 'Ya descargué diciembre · terminar' : `Ya descargué ${meses[mesAbierto].nombre} · abrir ${meses[mesAbierto + 1].nombre}`}</Boton>}
      <p className="text-xs text-muted-foreground">{completados.length}/12 meses marcados por ti como descargados. Comprueba los archivos en Descargas: el portal no puede verificar que SEACE haya guardado el Excel.</p>
    </section>}
    {mensaje && <p role="status" className="rounded-lg border border-control p-3 text-sm">{mensaje}</p>}
    {mostrarTexto && meses.length > 0 && <label className="flex flex-col gap-2 text-sm">Enlaces para copiar<textarea readOnly value={texto} onFocus={e => e.currentTarget.select()} rows={8} className="w-full rounded-lg border border-control bg-background p-3 text-xs" /></label>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meses.map((mes, indice) => <div key={mes.mes} className="flex flex-col gap-3 rounded-xl border border-control bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{mes.nombre} {anio}</h2>
        <Boton onClick={() => abrirMes(indice)} aria-label={`Abrir ${mes.nombre} de ${anio} en SEACE`}><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir mes en SEACE</Boton>
      </div>)}
    </div>
    <p className="text-sm text-muted-foreground">Después de guardar los Excel, súbelos en <Link href="/admin/importar" className="underline">Importar</Link> para revisar y confirmar sus datos.</p>
  </div>;
}
