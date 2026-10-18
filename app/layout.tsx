import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { METADATA_BASE } from '@/lib/site';
import { leerConfiguracionPortal } from '@/services/portalService';

import './globals.css';

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const DESCRIPCION =
  'Explora órdenes de compra, proveedores y gastos municipales de la Selva Central. Conecta información pública y compara gestiones.';

const metadataPorDefecto: Metadata = {
  // Hace absolutas las URLs de OpenGraph y el canónico; sin él, Next avisa en desarrollo.
  metadataBase: METADATA_BASE,
  title: {
    default: 'Fiscalizador · Transparencia en la Selva Central',
    template: '%s | Fiscalizador',
  },
  description: DESCRIPCION,
  applicationName: 'Fiscalizador',
  // Es un portal de consulta pública: que lo indexen es justo el objetivo.
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    siteName: 'Fiscalizador',
    title: 'Fiscalizador · Transparencia en la Selva Central',
    description: DESCRIPCION,
  },
  twitter: {
    card: 'summary',
    title: 'Fiscalizador · Transparencia en la Selva Central',
    description: DESCRIPCION,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const config = await leerConfiguracionPortal();
  // La pieza social está compuesta para el recorte 1.91:1 de WhatsApp/Facebook.
  // Si falta, generamos una pieza institucional con el logo global del admin.
  const imagen = config.imagenSocial || '/api/public/portada-social?v=1';
  return {
    ...metadataPorDefecto,
    icons: {
      icon: config.favicon ? { url: config.favicon, type: 'image/png', sizes: '256x256' } : '/favicon.ico',
      ...(config.favicon ? { apple: { url: config.favicon, type: 'image/png', sizes: '256x256' } } : {}),
    },
    openGraph: { ...metadataPorDefecto.openGraph, ...(imagen ? { images: [{ url: imagen, width: 1200, height: 630, alt: 'Fiscalizador · Transparencia en la Selva Central' }] } : {}) },
    twitter: { ...metadataPorDefecto.twitter, card: imagen ? 'summary_large_image' : 'summary', ...(imagen ? { images: [imagen] } : {}) },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
