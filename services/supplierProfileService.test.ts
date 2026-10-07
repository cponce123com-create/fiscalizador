import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), supplier: vi.fn(), previous: vi.fn(), save: vi.fn(), removeContacts: vi.fn(), contacts: vi.fn(), audit: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { guardarPerfilProveedor } from './supplierProfileService';
const datos = { supplierId: 'id', version: '', birthplace: 'San Ramón', currentAddress: 'Dirección registrada', notes: null, contacts: [{ dni: '12345678', fullName: 'Familiar de prueba', relationship: 'Hermano', source: null, notes: null }] };
describe('guardado de perfiles privados', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async fn => fn({ $queryRaw: mocks.lock, supplier: { findUnique: mocks.supplier }, supplierProfile: { findUnique: mocks.previous, upsert: mocks.save }, supplierProfileContact: { deleteMany: mocks.removeContacts, createMany: mocks.contacts }, auditLog: { create: mocks.audit } }));
    mocks.supplier.mockResolvedValue({ ruc: '10001234569' }); mocks.previous.mockResolvedValue(null); mocks.save.mockResolvedValue({ id: 'perfil' });
  });
  it('guarda relaciones solo en la ficha privada y audita sin DNIs/direcciones', async () => {
    await guardarPerfilProveedor(datos, 'admin');
    expect(mocks.contacts).toHaveBeenCalledWith({ data: [{ ...datos.contacts[0], profileId: 'perfil' }] });
    const audit = JSON.stringify(mocks.audit.mock.calls);
    expect(audit).not.toContain('12345678'); expect(audit).not.toContain(datos.currentAddress);
  });
  it('rechaza vínculos con el propio proveedor y escrituras obsoletas', async () => {
    await expect(guardarPerfilProveedor({ ...datos, contacts: [{ ...datos.contacts[0], dni: '00123456' }] }, 'admin')).rejects.toThrow('propio');
    mocks.previous.mockResolvedValue({ updatedAt: new Date('2026-01-01') });
    await expect(guardarPerfilProveedor(datos, 'admin')).rejects.toThrow('otra edición');
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
