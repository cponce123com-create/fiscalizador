import { describe, expect, it } from 'vitest';
import { dniDesdeRuc, esquemaPerfilProveedor } from './supplier-profile';
const contacto = { dni: '00123456', fullName: 'Persona de prueba', relationship: 'Familiar', source: '', notes: '' };
const base = { supplierId: 'id', version: '', birthplace: '', currentAddress: '', notes: '', contacts: [] };
describe('perfil privado de proveedor', () => {
  it('extrae los ocho dígitos del DNI y conserva ceros iniciales solo para RUC 10', () => {
    expect(dniDesdeRuc('10001234569')).toBe('00123456');
    expect(dniDesdeRuc('20001234569')).toBeNull();
    expect(dniDesdeRuc('1000123456')).toBeNull();
    expect(dniDesdeRuc('10abcdefgh9')).toBeNull();
  });
  it('acepta hasta 10 personas, rechaza duplicados y un undécimo vínculo', () => {
    const contacts = Array.from({ length: 10 }, (_, i) => ({ ...contacto, dni: String(i).padStart(8, '0') }));
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts }).success).toBe(true);
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts: [...contacts, { ...contacto, dni: '99999999' }] }).success).toBe(false);
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts: [contacto, contacto] }).success).toBe(false);
  });
  it('rechaza DNIs incompletos y acepta datos opcionales vacíos o ya normalizados', () => {
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts: [{ ...contacto, dni: '123' }] }).success).toBe(false);
    const normalizado = esquemaPerfilProveedor.parse(base);
    expect(normalizado.currentAddress).toBeNull();
    expect(esquemaPerfilProveedor.parse(normalizado)).toEqual(normalizado);
  });
});
