import type { Metadata } from 'next';
import type { GastoAlimentacionGestion } from './alimentacion';
import { formatearMonto } from './utils';

export function imagenCompartida(tipo: 'gasto' | 'proveedor', id: string) {
  return `/api/public/compartir/${tipo}/${encodeURIComponent(id)}?v=2`;
}
export function textoCompartido(titulo: string, resumen: string, url: string) {
  return `📊 *${titulo}*\n\n${resumen}\n\n🔎 *Explora las órdenes y sus fuentes*\n${url}`;
}
export function resumenGastos(filas: GastoAlimentacionGestion[]) {
  return filas.map(f => `🗓️ *Gestión ${f.gestion}*\n${f.meses ? `💰 *${formatearMonto(f.considerado)}*\n📋 ${f.ordenes} órdenes · ${f.meses} meses disponibles` : '📋 Sin libros publicados'}`).join('\n\n');
}
export function resumenProveedor(nombre: string, ordenes: number, considerado: string) {
  return `👤 ${nombre}\n💰 *${formatearMonto(considerado)}* en monto considerado\n📋 *${ordenes} órdenes registradas*\n🗂️ Todos los libros vigentes disponibles`;
}
export function metadataCompartida(titulo: string, resumen: string, ruta: string, imagen: string): Metadata {
  resumen = resumen.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  return { title: titulo, description: resumen, alternates: { canonical: ruta },
    openGraph: { type: 'website', locale: 'es_PE', siteName: 'Fiscalizador', title: titulo, description: resumen, url: ruta, images: [{ url: imagen, width: 1200, height: 630, alt: titulo }] },
    twitter: { card: 'summary_large_image', title: titulo, description: resumen, images: [imagen] } };
}
