import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leer: vi.fn(), leerVarias: vi.fn(), municipalidad: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { appSetting: { findUnique: mocks.leer, findMany: mocks.leerVarias }, municipality: { findUnique: mocks.municipalidad } } }));
import { configuracionesPorMunicipalidad, leerConfiguracionPortal } from './portalService';
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
  it('usa claves y nombre independientes para otra municipalidad', async () => {
    mocks.leer.mockResolvedValue(null);
    mocks.municipalidad.mockResolvedValue({ name: 'Municipalidad Distrital de Perené' });
    const config = await leerConfiguracionPortal('mun-perene');
    expect(mocks.leer).toHaveBeenCalledWith({ where: { key: 'portal-ciudadano:mun-perene' } });
    expect(config.municipio).toBe('Municipalidad Distrital de Perené');
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
  it('comparte logo y favicon globales entre municipalidades y mantiene portada municipal', async () => {
    mocks.municipalidad.mockResolvedValue({ name: 'Municipalidad Distrital de Perené' });
    mocks.leer.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'portal-imagen-logo') return { value: { url: 'https://res.cloudinary.com/test/image/upload/logo-global.webp', publicId: null, cloud: null, credito: '' } };
      if (where.key === 'portal-imagen-favicon') return { value: { url: 'https://res.cloudinary.com/test/image/upload/favicon-global.png', publicId: null, cloud: null, credito: '' } };
      if (where.key === 'portal-imagen-portada:mun-perene') return { value: { url: 'https://res.cloudinary.com/test/image/upload/perene.webp', publicId: null, cloud: null, credito: 'Perené · Foto propia' } };
      return null;
    });
    expect(await leerConfiguracionPortal('mun-perene')).toMatchObject({ logo: 'https://res.cloudinary.com/test/image/upload/logo-global.webp', favicon: 'https://res.cloudinary.com/test/image/upload/favicon-global.png', fotoPortada: 'https://res.cloudinary.com/test/image/upload/perene.webp' });
  });
  it('carga la identidad de muchas municipalidades en una sola consulta', async () => {
    mocks.leerVarias.mockResolvedValue([
      { key: 'portal-ciudadano:mun-perene', value: { ...configuracionPorDefecto(), municipio: 'Perené', titular: 'Titular Perené' } },
      { key: 'portal-imagen-logo', value: { url: 'https://res.cloudinary.com/test/image/upload/logo.webp', publicId: null, cloud: null, credito: '' } },
    ]);
    const municipalidades = [
      { id: 'mun-san-ramon', slug: 'san-ramon', nombre: 'Municipalidad Distrital de San Ramón', nombreCorto: 'San Ramón', ruc: '20146657142', provincia: 'Chanchamayo', departamento: 'Junín', tipoEntidad: 'DISTRITAL' },
      { id: 'mun-perene', slug: 'perene', nombre: 'Municipalidad Distrital de Perené', nombreCorto: 'Perené', ruc: '20123456789', provincia: 'Chanchamayo', departamento: 'Junín', tipoEntidad: 'DISTRITAL' },
    ];
    const resultado = await configuracionesPorMunicipalidad(municipalidades);
    expect(mocks.leerVarias).toHaveBeenCalledTimes(1);
    expect(resultado.perene).toMatchObject({ municipio: 'Perené', titular: 'Titular Perené', logo: 'https://res.cloudinary.com/test/image/upload/logo.webp' });
    expect(resultado['san-ramon'].municipio).toBe('Municipalidad Distrital de San Ramón');
  });
});
