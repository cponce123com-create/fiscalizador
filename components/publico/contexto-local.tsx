'use client';

import { useEffect, useState } from 'react';
import { CloudSun, DollarSign } from 'lucide-react';
import type { ContextoLocal } from '@/services/contextService';

export function IndicadoresLocales() {
  const [datos, setDatos] = useState<ContextoLocal | null>(null);
  const [terminado, setTerminado] = useState(false);
  useEffect(() => {
    let cancelado = false;
    let control: AbortController | null = null;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function consultar() {
      control = new AbortController();
      // El BCRP dispone de 12 s en servidor; deja margen para red y arranque.
      timeout = setTimeout(() => control?.abort(), 18000);
      let completo = false;
      try {
        const respuesta = await fetch('/api/contexto', { signal: control.signal, cache: 'no-store' });
        if (!respuesta.ok) throw new Error('Contexto no disponible');
        const resultado: ContextoLocal = await respuesta.json();
        if (!cancelado && !control.signal.aborted) {
          setDatos(resultado);
          completo = Boolean(resultado?.dolar && resultado?.clima);
        }
      } catch { /* Mantener visibles los datos previos mientras se reintenta. */ }
      finally {
        clearTimeout(timeout);
        if (!cancelado) {
          setTerminado(true);
          // Recuperarse sin exigir recargar la página; actualizar también datos válidos.
          reintento = setTimeout(consultar, completo ? 15 * 60_000 : 35_000);
        }
      }
    }
    void consultar();
    return () => { cancelado = true; clearTimeout(timeout); clearTimeout(reintento); control?.abort(); };
  }, []);
  const fechaClima = datos?.clima ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(new Date(datos.clima.fecha)) : '';
  const fechaCambio = datos?.dolar ? datos.dolar.fecha.split('-').reverse().join('/') : '';
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] sm:text-xs" aria-label="Clima y tipo de cambio">
    <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline" title="Clima estimado por modelos · Open-Meteo (CC BY 4.0)">
      <CloudSun size={16} className="text-amber-300" aria-hidden="true" />
      <span>San Ramón · {datos?.clima ? `${Math.round(datos.clima.temperatura)} °C · ${datos.clima.condicion}` : terminado ? 'Clima no disponible' : 'Consultando clima…'}<span className="block text-[10px] text-emerald-100/80">Open-Meteo · estimación{fechaClima ? ` · ${fechaClima} h` : ''}</span></span>
    </a>
    <a href="https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/tipo-de-cambio" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline" title="Tipo de cambio del sistema bancario SBS publicado por BCRP; no es una cotización en tiempo real">
      <DollarSign size={16} className="text-amber-300" aria-hidden="true" />
      <span>Dólar · {datos?.dolar ? `Compra S/ ${datos.dolar.compra} · Venta S/ ${datos.dolar.venta}` : terminado ? 'Dato no disponible' : 'Consultando dato…'}<span className="block text-[10px] text-emerald-100/80">BCRP / SBS · último dato{fechaCambio ? ` · ${fechaCambio}` : ''}</span></span>
    </a>
  </div>;
}
