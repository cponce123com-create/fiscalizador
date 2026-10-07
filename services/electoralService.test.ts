import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ persona: vi.fn(), perfil: vi.fn(), transaction: vi.fn(), upsert: vi.fn(), encontrar: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { electoralPerson: { findFirst: mocks.persona }, supplierProfile: { findUnique: mocks.perfil }, $transaction: mocks.transaction } }));
vi.mock('./auditService', () => ({ registrarAuditoria: mocks.audit }));
import { antecedentesElectoralesProveedor, informacionDocumentadaProveedor, guardarPersonaElectoral, guardarRegistroElectoral, importarAntecedentesElectorales } from './electoralService';

describe('cruce electoral y datos públicos de fiscalización', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.transaction.mockImplementation(fn => fn({ electoralPerson: { upsert: mocks.upsert, create: mocks.create, update: mocks.update }, electoralRecord: { findUnique: mocks.encontrar, create: mocks.create, update: mocks.update } })); });
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
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'registro', personId: 'persona' }, data: expect.objectContaining({ preliminaryOutcome: null, preliminarySource: null }) }));
  });
  it('importa nuevos registros y omite duplicados sin sustituir datos', async () => {
    const fila = { fullName: 'Nombre de prueba', dni: '00123456', electionYear: 2022, position: 'REGIDOR', organization: 'Lista de prueba', mayorCandidate: 'Nombre de prueba', municipality: 'San Ramón', termStart: 2023, termEnd: 2026, result: 'IMPROCEDENTE', source: 'Acta pública, página 2', sourceUrl: 'https://ejemplo.test/acta' };
    const carga = { version: 1, documentSha256: 'a'.repeat(64), records: [fila] };
    mocks.upsert.mockResolvedValue({ id: 'persona', fullName: 'Nombre de prueba' });
    mocks.encontrar.mockResolvedValue(null);
    expect(await importarAntecedentesElectorales(carga, true, 'admin')).toEqual({ procesados: 1, nuevos: 1, existentes: 0 });
    expect(mocks.create).toHaveBeenCalledWith({ data: { electionYear: 2022, position: 'REGIDOR', organization: 'Lista de prueba', mayorCandidate: 'Nombre de prueba', municipality: 'San Ramón', termStart: 2023, termEnd: 2026, result: 'IMPROCEDENTE', source: 'Acta pública, página 2', sourceUrl: 'https://ejemplo.test/acta', personId: 'persona', isPublic: true } });
    mocks.create.mockClear(); mocks.encontrar.mockResolvedValue({ id: 'existente' });
    expect(await importarAntecedentesElectorales(carga, true, 'admin')).toEqual({ procesados: 1, nuevos: 0, existentes: 1 });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('00123456');
    mocks.upsert.mockResolvedValue({ id: 'persona', fullName: 'Otro nombre' });
    await expect(importarAntecedentesElectorales(carga, false, 'admin')).rejects.toThrow('Revisa la identidad');
  });

  it('reimporta candidatos sin DNI por clave estable sin buscar identidad por nombre', async () => {
    const fila = { fullName: 'Nombre de prueba', dni: '', sourceRowKey: 'b'.repeat(64), electionYear: 2026, position: 'REGIDOR', organization: 'Lista de prueba', mayorCandidate: 'Nombre de prueba', municipality: 'San Ramón', termStart: 2027, termEnd: 2030, result: 'POR_VERIFICAR', source: 'Transcripción de Voto Informado, pendiente verificación', sourceUrl: 'https://ejemplo.test/candidato', listPosition: 1, preliminaryOutcome: 'POSIBLE_ELECTO', preliminarySource: 'Proyección aportada, sin acta oficial.' };
    const carga = { version: 2, documentSha256: 'a'.repeat(64), records: [fila] };
    mocks.upsert.mockResolvedValue({ id: 'pre-' + 'b'.repeat(40), fullName: fila.fullName });
    mocks.encontrar.mockResolvedValue(null);
    expect(await importarAntecedentesElectorales(carga, true, 'admin')).toEqual({ procesados: 1, nuevos: 1, existentes: 0 });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pre-' + 'b'.repeat(40) }, update: {}, create: expect.objectContaining({ dni: null }) }));
    expect(mocks.create.mock.calls[0][0].data.result).toBe('POR_VERIFICAR');
    mocks.create.mockClear(); mocks.encontrar.mockResolvedValue({ id: 'existente' });
    expect(await importarAntecedentesElectorales(carga, true, 'admin')).toEqual({ procesados: 1, nuevos: 0, existentes: 1 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

});
