import { describe, it, expect } from 'vitest';
import { imagenCompartida, metadataCompartida, resumenGastos, resumenProveedor, textoCompartido } from './compartir';

describe('contenido para redes', () => {
  it('no presenta la ausencia de libros como gasto cero ni las órdenes como pagos', () => {
    const resumen = resumenGastos([{ id: 'g', gestion: '2015-2018', meses: 0, ordenes: 0, anuladas: 0, considerado: '0.00' }]);
    expect(resumen).toContain('Sin libros publicados');
    expect(resumen).not.toContain('S/');
    expect(resumen).not.toContain('pagos');
    expect(resumenProveedor('Nombre', 8, '120.00')).toContain('Todos los libros vigentes');
  });
  it('cada perfil tiene título, resumen, canónico e imagen propios', () => {
    const imagen = imagenCompartida('proveedor', 'juan-perez');
    const metadata = metadataCompartida('Juan Pérez', 'Resumen documentado', '/proveedores/juan-perez', imagen);
    expect(metadata.openGraph).toMatchObject({ title: 'Juan Pérez', description: 'Resumen documentado', url: '/proveedores/juan-perez', images: [{ url: imagen, width: 1200, height: 630, alt: 'Juan Pérez' }] });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(textoCompartido('Título', 'Resumen', 'https://portal.pe/perfil')).toBe('📊 *Título*\n\nResumen\n\n🔎 *Explora las órdenes y sus fuentes*\nhttps://portal.pe/perfil');
  });
  it('separa las gestiones y destaca cifras sin trasladar marcas de WhatsApp a los metadatos', () => {
    const resumen = resumenGastos([{ id: 'g', gestion: '2015-2018', meses: 48, ordenes: 415, anuladas: 0, considerado: '232808.50' }]);
    expect(resumen).toContain('🗓️ *Gestión 2015-2018*\n💰 *');
    expect(resumen).toContain('📋 415 órdenes · 48 meses disponibles');
    expect(resumen).not.toContain('Cobertura parcial');
    expect(metadataCompartida('Título', resumen, '/alimentacion', '/imagen').description).not.toMatch(/[\n*]/);
  });
});
