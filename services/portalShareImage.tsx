import { ImageResponse } from 'next/og';

/** Pieza institucional; no depende de cifras ni atribuye vínculos a personas. */
export function renderizarPortadaSocial(logo?: string) {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#063c32', color: '#ffffff', padding: 64, flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ display: 'flex', width: 124, height: 124, background: '#ffffff', borderRadius: 26, alignItems: 'center', justifyContent: 'center', color: '#063c32', fontSize: 84, fontWeight: 700 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Imagen PNG generada por Satori. */}
          {logo ? <img src={logo} width={100} height={100} alt="" style={{ objectFit: 'contain' }} /> : 'F'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 66, fontWeight: 700 }}>Fiscalizador</div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: '#8ee3bf' }}>OBSERVATORIO CIUDADANO</div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 52, fontSize: 53, fontWeight: 700, lineHeight: 1.12, maxWidth: 1000 }}>La información pública, conectada.</div>
      <div style={{ display: 'flex', marginTop: 22, fontSize: 28, lineHeight: 1.4, color: '#d6eee4', maxWidth: 980 }}>Explora proveedores, órdenes y gastos municipales de la Selva Central.</div>
      <div style={{ display: 'flex', marginTop: 'auto', borderTop: '1px solid #387362', paddingTop: 22, justifyContent: 'space-between', alignItems: 'center', fontSize: 22 }}>
        <span style={{ color: '#edcf7e' }}>Datos abiertos. Ciudadanía informada.</span>
        <span>fiscalizador.org</span>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300', 'X-Content-Type-Options': 'nosniff' } },
  );
}
