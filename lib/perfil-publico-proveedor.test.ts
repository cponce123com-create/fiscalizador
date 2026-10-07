import { describe, expect, it } from 'vitest';
import { datosPublicosProveedor } from './perfil-publico-proveedor';

describe('perfil público de proveedor', () => {
  const ficha = { isPublic: true, publication: Object.fromEntries(['dni', 'edad', 'nacimiento', 'distrito', 'foto'].map(c => [c, { enabled: true, sourceUrl: 'https://ejemplo.test/fuente', verifiedAt: '2026-10-07T00:00:00.000Z' }])), birthplace: 'San Ramón', publicDistrict: 'La Merced', birthDate: '1990-10-08', photoKey: 'clave-privada', updatedAt: new Date('2026-10-07'), currentAddress: 'Calle privada 123', notes: 'nota privada', contacts: [{ dni: '12345678' }] };
  it('publica únicamente la proyección permitida y calcula cumpleaños', () => {
    const datos = datosPublicosProveedor('10123456789', ficha, 'abc', new Date('2026-10-07'));
    expect(datos).toEqual({ dni: '12345678', edad: 35, nacimiento: 'San Ramón', distrito: 'La Merced', foto: '/api/public/proveedores/abc/foto?v=1791331200000' });
    expect(datosPublicosProveedor('10123456789', ficha, 'abc', new Date('2026-10-08')).edad).toBe(36);
    expect(JSON.stringify(datos)).not.toMatch(/Calle privada|nota privada|clave-privada|1990-10-08/);
  });
  it('no atribuye DNI ni edad a empresas y no copia direcciones antiguas', () => {
    expect(datosPublicosProveedor('20123456789', ficha, 'abc').dni).toBeNull();
    expect(datosPublicosProveedor('20123456789', ficha, 'abc').edad).toBeNull();
    expect(datosPublicosProveedor('10123456789', { ...ficha, publicDistrict: null }, 'abc').distrito).toBeNull();
    expect(datosPublicosProveedor('10123456789', null, 'abc').foto).toBeNull();
  });
  it('oculta los datos sin habilitación, fuente válida o revisión, y permite revocar un campo', () => {
    const vacio = { dni: null, edad: null, nacimiento: null, distrito: null, foto: null };
    expect(datosPublicosProveedor('10123456789', { ...ficha, isPublic: false }, 'abc')).toEqual(vacio);
    expect(datosPublicosProveedor('10123456789', { ...ficha, publication: {} }, 'abc')).toEqual(vacio);
    expect(datosPublicosProveedor('10123456789', { ...ficha, publication: { dni: { enabled: true, sourceUrl: 'javascript:alert(1)', verifiedAt: '2026-10-07T00:00:00.000Z' } } }, 'abc')).toEqual(vacio);
    expect(datosPublicosProveedor('10123456789', { ...ficha, publication: { foto: { enabled: true, sourceUrl: 'https://ejemplo.test' } } }, 'abc').foto).toBeNull();
  });

});
