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
  'Consulta y análisis de las órdenes de compra y de servicio registradas en el Portal de Transparencia.';

const metadataPorDefecto: Metadata = {
  // Hace absolutas las URLs de OpenGraph y el canónico; sin él, Next avisa en desarrollo.
  metadataBase: METADATA_BASE,
  title: {
    default: 'Fiscalizador · San Ramón — Vigilancia ciudadana',
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
    title: 'Fiscalizador · San Ramón — Vigilancia ciudadana',
    description: DESCRIPCION,
  },
  twitter: {
    card: 'summary',
    title: 'Fiscalizador · San Ramón — Vigilancia ciudadana',
    description: DESCRIPCION,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const config = await leerConfiguracionPortal();
  return {
    ...metadataPorDefecto,
    icons: {
      icon: config.favicon ? { url: config.favicon, type: 'image/png', sizes: '256x256' } : '/favicon.ico',
      ...(config.favicon ? { apple: { url: config.favicon, type: 'image/png', sizes: '256x256' } } : {}),
    },
    openGraph: { ...metadataPorDefecto.openGraph, ...(config.imagenSocial ? { images: [{ url: config.imagenSocial, width: 1200, height: 630, alt: 'Fiscalizador · San Ramón' }] } : {}) },
    twitter: { ...metadataPorDefecto.twitter, card: config.imagenSocial ? 'summary_large_image' : 'summary', ...(config.imagenSocial ? { images: [config.imagenSocial] } : {}) },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
