import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ persona: vi.fn(), perfil: vi.fn(), transaction: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { electoralPerson: { findFirst: mocks.persona }, supplierProfile: { findUnique: mocks.perfil }, $transaction: mocks.transaction } }));
vi.mock('./auditService', () => ({ registrarAuditoria: mocks.audit }));
import { antecedentesElectoralesProveedor, informacionDocumentadaProveedor, guardarPersonaElectoral, guardarRegistroElectoral } from './electoralService';

describe('cruce electoral y datos públicos de fiscalización', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.transaction.mockImplementation(fn => fn({ electoralPerson: { create: mocks.create, update: mocks.update }, electoralRecord: { create: mocks.create, update: mocks.update } })); });
  it('busca solo documento exacto y registros publicados; no intenta RUC 20', async () => {
    mocks.persona.mockResolvedValue(null);
    expect(await antecedentesElectoralesProveedor('20123456789')).toBeNull();
    expect(mocks.persona).not.toHaveBeenCalled();
    await antecedentesElectoralesProveedor('10001234569');
    expect(mocks.persona).toHaveBeenCalledWith(expect.objectContaining({ where: { dni: '00123456', isPublic: true, records: { some: { isPublic: true } } } }));
    const consulta = mocks.persona.mock.calls[0][0];
    expect(consulta.select.dni).toBeUndefined();
    expect(consulta.select.records.where).toEqual({ isPublic: true });
  });
  it('publica solo notas y vínculos con fuente y jamás selecciona DNI o notas privadas', async () => {
    mocks.perfil.mockResolvedValue({ publicNotes: 'Observación documentada', publicSourceUrl: 'https://ejemplo.test/acta', contacts: [{ id: 'ok', fullName: 'Nombre', relationship: 'Socio', source: 'https://ejemplo.test/registro', publicNote: 'Hecho documentado' }, { id: 'invalido', source: 'javascript:alert(1)' }] });
    const datos = await informacionDocumentadaProveedor('proveedor');
    expect(datos?.vinculos).toHaveLength(1);
    const consulta = mocks.perfil.mock.calls[0][0];
    expect(consulta.select.contacts.where).toEqual({ isPublic: true });
    expect(consulta.select.contacts.select.dni).toBeUndefined();
    expect(consulta.select.contacts.select.notes).toBeUndefined();
    expect(consulta.select.notes).toBeUndefined();
  });
  it('audita creación y actualización sin incluir identificadores privados', async () => {
    mocks.create.mockResolvedValue({ id: 'persona' });
    await guardarPersonaElectoral({ fullName: 'Nombre de prueba', dni: '00123456', isPublic: false }, 'admin');
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), { userId: 'admin', action: 'CREATE', entity: 'ElectoralPerson', entityId: 'persona' });
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('00123456');
    mocks.update.mockResolvedValue({ id: 'registro' });
    await guardarRegistroElectoral({ id: 'registro', personId: 'persona', electionYear: 2022, position: 'REGIDOR', organization: 'Lista de prueba', mayorCandidate: 'Nombre de prueba', municipality: 'San Ramón', termStart: 2023, termEnd: 2026, result: 'ELECTO', source: 'Acta pública, página 2', sourceUrl: 'https://ejemplo.test/acta', isPublic: true }, 'admin');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'registro', personId: 'persona' } }));
  });
});
