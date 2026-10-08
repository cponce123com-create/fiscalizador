import Link from 'next/link';
import { formatearFecha, formatearMonto } from '@/lib/utils';
import type { ContratacionPrensa } from '@/lib/prensa';
import { FotoProveedor } from './foto-proveedor';

export function TarjetaPrensa({ fila }: { fila: ContratacionPrensa }) {
  return <Link href={fila.perfilUrl} className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:p-5">
    <div className="flex items-start gap-3"><FotoProveedor key={fila.fotoUrl} url={fila.fotoUrl} nombre={fila.nombre} /><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{fila.nombre}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{fila.tipo} · RUC {fila.ruc}</p></div></div>
    {fila.ordenes > 0 ? <div><p className="text-xs text-muted-foreground">Monto considerado · todos los periodos</p><p className="tabular mt-1 break-words text-xl sm:text-2xl font-semibold text-primary">{formatearMonto(fila.considerado)}</p><p className="mt-2 text-xs text-muted-foreground">{fila.ordenes} {fila.ordenes === 1 ? 'orden' : 'órdenes'}{fila.anuladas ? ` · ${fila.anuladas} anuladas, excluidas del monto` : ''}</p><p className="mt-1 break-words text-xs text-muted-foreground">{formatearFecha(fila.primera)} a {formatearFecha(fila.ultima)}</p></div> : <p className="text-sm text-muted-foreground">Sin coincidencias en los libros vigentes publicados.</p>}
    <span className="mt-auto text-sm font-semibold text-primary">{fila.ordenes > 0 ? 'Ver perfil y todas sus órdenes →' : 'Consultar ficha de seguimiento →'}</span>
  </Link>;
}
