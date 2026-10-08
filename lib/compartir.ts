import type { Metadata } from 'next';
import type { GastoAlimentacionGestion } from './alimentacion';
import { formatearMonto } from './utils';

export function imagenCompartida(tipo: 'gasto' | 'proveedor', id: string) {
  return `/api/public/compartir/${tipo}/${encodeURIComponent(id)}`;
}
export function textoCompartido(titulo: string, resumen: string, url: string) {
  return `${titulo}\n\n${resumen}\n\nConsulta las órdenes y sus fuentes: ${url}`;
}
export function resumenGastos(filas: GastoAlimentacionGestion[]) {
  return filas.map(f => `${f.gestion}: ${f.meses ? formatearMonto(f.considerado) : 'sin libros publicados'} (${f.meses} meses disponibles)`).join(' · ') + '. Cobertura parcial; las órdenes no acreditan pagos efectivos.';
}
export function resumenProveedor(nombre: string, ordenes: number, considerado: string) {
  return `${nombre}: ${ordenes} órdenes y ${formatearMonto(considerado)} de monto considerado en todos los libros vigentes disponibles. Las órdenes no acreditan pagos efectivos.`;
}
export function metadataCompartida(titulo: string, resumen: string, ruta: string, imagen: string): Metadata {
  return { title: titulo, description: resumen, alternates: { canonical: ruta },
    openGraph: { type: 'website', locale: 'es_PE', siteName: 'Fiscalizador', title: titulo, description: resumen, url: ruta, images: [{ url: imagen, width: 1200, height: 630, alt: titulo }] },
    twitter: { card: 'summary_large_image', title: titulo, description: resumen, images: [imagen] } };
}
