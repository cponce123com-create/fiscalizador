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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
