import { ImageResponse } from 'next/og';
import type { GastoAlimentacionGestion } from '@/lib/alimentacion';
import { formatearMonto } from '@/lib/utils';

export type TarjetaCompartida = { titulo: string; resumen: string; ruta: string; municipio: string; filas: GastoAlimentacionGestion[]; foto?: string; proveedor?: { monto: string; ordenes: number } };
/** Solo recibe datos públicos, preparados por el servicio; nunca un HTML del navegador. */
export function renderizarTarjeta(dato: TarjetaCompartida) {
  const maximo = Math.max(0, ...dato.filas.map(f => Number(f.considerado)));
  return new ImageResponse(<div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '38px 48px', background: '#0c1b2b', color: '#f8fafc', fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', fontSize: 21, color: '#67e8cf', marginBottom: 18 }}>FISCALIZADOR · {dato.municipio.slice(0, 65)}</div>
    <div style={{ display: 'flex', fontSize: dato.titulo.length > 65 ? 32 : 42, fontWeight: 700, lineHeight: 1.15, marginBottom: 24 }}>{dato.titulo.slice(0, 120)}</div>
    {dato.proveedor ? <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 22 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado con Satori. */}
      {dato.foto ? <img src={dato.foto} alt="" width={150} height={200} style={{ objectFit: 'cover', objectPosition: 'top', borderRadius: 12 }} /> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ display: 'flex', fontSize: 23 }}>Monto considerado · libros vigentes disponibles</div><div style={{ display: 'flex', fontSize: 49, color: '#67e8cf', fontWeight: 700 }}>{formatearMonto(dato.proveedor.monto)}</div><div style={{ display: 'flex', fontSize: 27 }}>{dato.proveedor.ordenes} órdenes registradas</div></div>
    </div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{dato.filas.map(f => <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23 }}><span>{f.gestion.slice(0, 55)}</span><span>{f.meses ? formatearMonto(f.considerado) : 'Sin libros publicados'}</span></div>
      <div style={{ display: 'flex', height: 9, background: '#243c51', borderRadius: 5 }}><div style={{ display: 'flex', width: `${maximo ? Math.max(0, Number(f.considerado)) / maximo * 100 : 0}%`, background: '#67e8cf', borderRadius: 5 }} /></div>
      <div style={{ display: 'flex', fontSize: 17, color: '#bdcbd9' }}>{f.meses} meses disponibles · {f.ordenes} órdenes</div>
    </div>)}</div>}
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 9, borderTop: '1px solid #395268', paddingTop: 17 }}>
      <div style={{ display: 'flex', fontSize: 18, color: '#bdcbd9' }}>Cobertura parcial. Excluye anuladas y estados no económicos.</div>
      <div style={{ display: 'flex', fontSize: 18, color: '#bdcbd9' }}>Las órdenes no acreditan pagos efectivos. Consulta los documentos de origen.</div>
      <div style={{ display: 'flex', fontSize: 15, color: '#67e8cf' }}>{dato.ruta.slice(0, 130)}</div>
    </div>
  </div>, { width: 1200, height: 630, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
