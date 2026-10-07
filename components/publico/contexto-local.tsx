'use client';

import { useEffect, useState } from 'react';
import { CloudSun, DollarSign } from 'lucide-react';
import type { ContextoLocal } from '@/services/contextService';

export function IndicadoresLocales() {
  const [datos, setDatos] = useState<ContextoLocal | null>(null);
  const [terminado, setTerminado] = useState(false);
  useEffect(() => {
    const control = new AbortController();
    const timeout = setTimeout(() => control.abort(), 8000);
    fetch('/api/contexto', { signal: control.signal })
      .then(respuesta => respuesta.ok ? respuesta.json() : null)
      .then(datos => { if (!control.signal.aborted) setDatos(datos); })
      .catch(() => { /* Las fuentes externas no bloquean el portal. */ })
      .finally(() => { clearTimeout(timeout); setTerminado(true); });
    return () => { clearTimeout(timeout); control.abort(); };
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
