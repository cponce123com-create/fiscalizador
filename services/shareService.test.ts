import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ perfil: vi.fn(), ficha: vi.fn(), foto: vi.fn(), gastos: vi.fn(), alimentos: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { supplierProfile: { findUnique: mocks.ficha } } }));
vi.mock('./statisticsService', () => ({ perfilProveedor: mocks.perfil }));
vi.mock('./privatePhotoStorage', () => ({ leerFotoPrivada: mocks.foto }));
vi.mock('./portalService', () => ({ leerConfiguracionPortal: async () => ({ municipio: 'San Ramón' }) }));
vi.mock('./foodService', () => ({ gastoAlimentacionPorGestion: mocks.alimentos }));
vi.mock('./categorySpendingService', () => ({ gastosPorCategoriaGestion: mocks.gastos }));
import { prepararTarjetaPublica } from './shareService';
import { renderizarTarjeta } from './shareImageService';

describe('imágenes públicas compartibles', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.perfil.mockResolvedValue({ id: 'p', nombre: 'Juan Pérez', ordenes: 8, totalConsiderado: '400.00' }); mocks.ficha.mockResolvedValue({ isPublic: false, photoKey: 'privada', publication: {} }); });
  it('rechaza rutas ajenas al catálogo antes de consultar la base', async () => {
    expect(await prepararTarjetaPublica('gasto', 'desconocido')).toBeNull();
    expect(await prepararTarjetaPublica('proveedor', '../privado')).toBeNull();
    expect(await prepararTarjetaPublica('otra', 'p')).toBeNull();
    expect(mocks.perfil).not.toHaveBeenCalled(); expect(mocks.gastos).not.toHaveBeenCalled();
  });
  it('no lee fotos privadas y no exporta campos personales ni claves', async () => {
    const tarjeta = await prepararTarjetaPublica('proveedor', 'juan');
    expect(mocks.foto).not.toHaveBeenCalled();
    expect(tarjeta?.foto).toBeUndefined();
    expect(JSON.stringify(tarjeta)).not.toContain('privada');
    expect(tarjeta?.proveedor).toEqual({ ordenes: 8, monto: '400.00' });
  });
  it('sigue generando el perfil si falla una foto publicada', async () => {
    mocks.ficha.mockResolvedValue({ isPublic: true, photoKey: 'foto', publication: { foto: { enabled: true, verifiedAt: '2026-10-08T00:00:00.000Z' } } });
    mocks.foto.mockRejectedValue(new Error('storage'));
    expect((await prepararTarjetaPublica('proveedor', 'juan'))?.proveedor?.ordenes).toBe(8);
    expect(mocks.foto).toHaveBeenCalledWith('foto');
  });
  it('incorpora solo fotos habilitadas y verificadas como PNG vertical', async () => {
    mocks.ficha.mockResolvedValue({ isPublic: true, photoKey: 'foto', publication: { foto: { enabled: true, verifiedAt: '2026-10-08T00:00:00.000Z' } } });
    mocks.foto.mockResolvedValue(await sharp({ create: { width: 10, height: 10, channels: 3, background: '#123456' } }).png().toBuffer());
    const tarjeta = await prepararTarjetaPublica('proveedor', 'juan');
    expect(tarjeta?.foto).toMatch(/^data:image\/png;base64,/);
    expect(await sharp(Buffer.from(tarjeta!.foto!.split(',')[1], 'base64')).metadata()).toMatchObject({ width: 150, height: 200 });
    expect(await sharp(Buffer.from(await renderizarTarjeta(tarjeta!).arrayBuffer())).metadata()).toMatchObject({ width: 1200, height: 630 });
  });
  it('genera un PNG real de 1200 × 630 con cobertura y cifras de tres gestiones', async () => {
    const filas = [0, 1, 2].map(i => ({ id: String(i), gestion: `${2015 + i * 4}-${2018 + i * 4}`, considerado: String(i * 50), meses: i * 4, ordenes: i * 10, anuladas: 0 }));
    const response = renderizarTarjeta({ titulo: 'Gastos en alimentación', resumen: '', ruta: 'https://fiscalizador.onrender.com/alimentacion', municipio: 'San Ramón', filas });
    const png = Buffer.from(await response.arrayBuffer());
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
