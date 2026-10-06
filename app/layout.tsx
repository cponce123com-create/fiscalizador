import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { METADATA_BASE } from '@/lib/site';

import './globals.css';

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

export const metadata: Metadata = {
  // Hace absolutas las URLs de OpenGraph y el canónico; sin él, Next avisa en desarrollo.
  metadataBase: METADATA_BASE,
  title: {
    default: 'Portal de Transparencia — Órdenes de Compra y Servicio',
    template: '%s | Portal de Transparencia',
  },
  description: DESCRIPCION,
  applicationName: 'Portal de Transparencia',
  // Es un portal de consulta pública: que lo indexen es justo el objetivo.
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    siteName: 'Portal de Transparencia',
    title: 'Portal de Transparencia — Órdenes de Compra y Servicio',
    description: DESCRIPCION,
  },
  twitter: {
    card: 'summary',
    title: 'Portal de Transparencia — Órdenes de Compra y Servicio',
    description: DESCRIPCION,
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
