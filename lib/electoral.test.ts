import { describe, expect, it } from 'vitest';
import { esquemaPersonaElectoral, esquemaRegistroElectoral, esquemaCargaElectoral, detectarCoincidenciasElectorales } from './electoral';
import { esquemaPerfilProveedor } from './supplier-profile';

describe('antecedentes electorales y publicación documentada', () => {
  const registro = { personId: 'persona', electionYear: '2022', position: 'REGIDOR', organization: 'Lista de prueba', mayorCandidate: 'Candidato de prueba', municipality: 'San Ramón', termStart: '2023', termEnd: '2026', result: 'ELECTO', source: 'Acta de proclamación, página 2', sourceUrl: 'https://ejemplo.test/acta', isPublic: false };
  it('conserva personas sin DNI para no inventar un enlace de identidad', () => {
    expect(esquemaPersonaElectoral.parse({ fullName: 'Persona de prueba', dni: '', isPublic: false }).dni).toBeNull();
    expect(esquemaPersonaElectoral.safeParse({ fullName: 'Persona de prueba', dni: '123', isPublic: true }).success).toBe(false);
  });
  it('valida periodo, resultado y fuente pública sin credenciales', () => {
    expect(esquemaRegistroElectoral.parse(registro).electionYear).toBe(2022);
    expect(esquemaRegistroElectoral.safeParse({ ...registro, termEnd: 2020 }).success).toBe(false);
    expect(esquemaRegistroElectoral.safeParse({ ...registro, sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(esquemaRegistroElectoral.safeParse({ ...registro, sourceUrl: 'https://user:secret@ejemplo.test' }).success).toBe(false);
  });
  it('exige evidencia para notas y vínculos públicos pero permite borradores', () => {
    const base = { supplierId: 'id', version: '', birthplace: '', currentAddress: '', notes: '', contacts: [] };
    const contacto = { dni: '00123456', fullName: 'Persona de prueba', relationship: 'Familiar', source: null, notes: null };
    expect(esquemaPerfilProveedor.parse({ ...base, contacts: [contacto] }).contacts[0].isPublic).toBe(false);
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts: [{ ...contacto, isPublic: true }] }).success).toBe(false);
    expect(esquemaPerfilProveedor.safeParse({ ...base, contacts: [{ ...contacto, isPublic: true, source: 'https://ejemplo.test/documento' }] }).success).toBe(true);
    expect(esquemaPerfilProveedor.safeParse({ ...base, publicNotes: 'Nota sin fuente.' }).success).toBe(false);
  });
  it('conserva improcedentes y rechaza repetidos dentro del mismo archivo', () => {
    const fila = { ...registro, dni: '00123456', fullName: 'Nombre de prueba', result: 'IMPROCEDENTE' };
    expect(esquemaCargaElectoral.safeParse({ version: 1, documentSha256: 'a'.repeat(64), records: [fila] }).success).toBe(true);
    expect(esquemaCargaElectoral.safeParse({ version: 1, documentSha256: 'a'.repeat(64), records: [fila, fila] }).success).toBe(false);
  });

  it('admite candidaturas sin documento solamente con clave estable versión 2 y exige fuente provisional', () => {
    const fila = { ...registro, result: 'POR_VERIFICAR', fullName: 'Nombre de prueba', dni: '', sourceRowKey: 'b'.repeat(64), preliminaryOutcome: 'POSIBLE_ELECTO', preliminarySource: 'Proyección del administrador, pendiente acta oficial.' };
    const carga = { version: 2, documentSha256: 'a'.repeat(64), records: [fila] };
    expect(esquemaCargaElectoral.parse(carga).records[0].result).toBe('POR_VERIFICAR');
    expect(esquemaCargaElectoral.safeParse({ ...carga, version: 1 }).success).toBe(false);
    expect(esquemaCargaElectoral.safeParse({ ...carga, records: [{ ...fila, sourceRowKey: undefined }] }).success).toBe(false);
    expect(esquemaCargaElectoral.safeParse({ ...carga, records: [{ ...fila, preliminarySource: '' }] }).success).toBe(false);
  });

  it('detecta nombres completos coincidentes sin unir automáticamente nombres parecidos', () => {
    const personas = [{ id: 'a', fullName: '  José   Pérez ', dni: null }, { id: 'b', fullName: 'JOSE PEREZ', dni: '00123456' }, { id: 'c', fullName: 'José Pérez López', dni: null }];
    expect(detectarCoincidenciasElectorales(personas).map(g => g.map(p => p.id))).toEqual([['a', 'b']]);
  });

});
