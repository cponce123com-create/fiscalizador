import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leer: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { appSetting: { findUnique: mocks.leer } } }));
import { leerConfiguracionPortal } from './portalService';
import { configuracionPorDefecto } from '@/lib/portal-settings';
describe('lectura pública de la configuración', () => {
  beforeEach(() => vi.clearAllMocks());
  it('funciona sin configuración previamente guardada', async () => {
    mocks.leer.mockResolvedValue(null);
    expect(await leerConfiguracionPortal()).toEqual(configuracionPorDefecto());
  });
  it('no publica una configuración antigua o inválida', async () => {
    mocks.leer.mockResolvedValue({value: {cintaActiva: true, enlace: 'javascript:alert(1)'}});
    expect((await leerConfiguracionPortal()).cintaActiva).toBe(false);
  });
  it('devuelve el titular guardado sin datos administrativos', async () => {
    const config = {...configuracionPorDefecto(), cintaActiva: true, titular: 'Consulta las fuentes', enlace:'/fuentes'};
    mocks.leer.mockResolvedValue({value:config,updatedAt:new Date()});
    expect(await leerConfiguracionPortal()).toEqual(config);
  });
  it('conecta imágenes guardadas y permite retirar la portada antigua sin borrar titulares', async () => {
    const config = { ...configuracionPorDefecto(), titular: 'Titular vigente', fotoPortada: 'https://res.cloudinary.com/test/image/upload/antigua.webp', creditoFoto: 'Foto anterior' };
    mocks.leer.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'portal-ciudadano') return { value: config };
      if (where.key === 'portal-imagen-portada') return { value: { url: '', publicId: null, cloud: null, credito: '' } };
      if (where.key === 'portal-imagen-logo') return { value: { url: 'https://res.cloudinary.com/test/image/upload/logo.webp', publicId: 'fiscalizador/portal/01234567-0123-0123-0123-012345678901', cloud: 'test', credito: '' } };
      return null;
    });
    expect(await leerConfiguracionPortal()).toMatchObject({ titular: 'Titular vigente', fotoPortada: '', creditoFoto: '', logo: 'https://res.cloudinary.com/test/image/upload/logo.webp' });
  });
});
