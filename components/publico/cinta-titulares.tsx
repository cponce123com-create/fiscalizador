'use client';

import { useState } from 'react';
import { Megaphone, Pause, Play } from 'lucide-react';
import type { ConfiguracionPortal } from '@/lib/portal-settings';

export function CintaTitulares({ config }: { config: ConfiguracionPortal }) {
  const [pausada, setPausada] = useState(false);
  if (!config.cintaActiva || !config.titular) return null;
  const contenido = config.enlace ? <a href={config.enlace} className="underline underline-offset-4">{config.titular}</a> : config.titular;
  return <section aria-label="Aviso del portal" className="border-b border-emerald-800 bg-emerald-950 text-white">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300"><Megaphone size={16} aria-hidden="true" /><span className="hidden sm:inline">Actualidad</span></span>
      <div className="cinta-ventana min-w-0 flex-1 overflow-hidden"><div className={`cinta-texto cinta-${config.velocidad}`} style={{ animationPlayState: pausada ? 'paused' : 'running' }}>{contenido}</div></div>
      <button type="button" onClick={() => setPausada(!pausada)} aria-label={pausada ? 'Reanudar titular' : 'Pausar titular'} aria-pressed={pausada} className="rounded-lg border border-white/30 p-2 hover:bg-white/10">{pausada ? <Play size={16} /> : <Pause size={16} />}</button>
    </div>
  </section>;
}
