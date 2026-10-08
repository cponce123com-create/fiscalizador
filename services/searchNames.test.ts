import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buscarNombre } from '@/lib/busqueda-nombres';

describe.skipIf(process.env.INTEGRATION_TESTS_ENABLED !== '1')('nombres mixtos de personas y candidaturas', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let personaId = ''; let electoralId = '';
  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    const p = await prisma.person.create({ data: { dni: '99443322', fullName: 'POMA MEDINA GENARO', slug: 'busqueda-mixta-' + Date.now(), description: 'Persona de prueba', source: 'Fixture' } });
    personaId = p.id;
    const e = await prisma.electoralPerson.create({ data: { fullName: 'POMA MEDINA GENARO' } });
    electoralId = e.id;
  });
  afterAll(async () => {
    if (!prisma) return;
    if (personaId) await prisma.person.deleteMany({ where: { id: personaId } });
    if (electoralId) await prisma.electoralPerson.deleteMany({ where: { id: electoralId } });
  });
  it('encuentra todas las palabras sin exigir orden y evita coincidencias de una sola palabra', async () => {
    const { listarPersonas } = await import('./personsService');
    for (const texto of ['genaro poma', 'POMA GENARO', ' genaro   poma ']) {
      expect((await listarPersonas({ texto })).map(p => p.id)).toContain(personaId);
      expect(await prisma.electoralPerson.count({ where: { id: electoralId, ...buscarNombre(texto) } })).toBe(1);
    }
    expect((await listarPersonas({ texto: 'genaro inexistente' })).map(p => p.id)).not.toContain(personaId);
    expect(await prisma.electoralPerson.count({ where: { id: electoralId, ...buscarNombre('genaro inexistente') } })).toBe(0);
  });
});
