import { describe, expect, it } from 'vitest';
import { categoriaGastoPorId, categoriasGasto, coincideCategoriaGasto } from './categorias-gasto';
describe('clasificación de gastos por descripción', () => {
  it.each([
    ['alquiler-camionetas', 'ALQUILER DE CAMIONETA 4X4', 'Mantenimiento de camioneta'],
    ['alquiler-camionetas', 'Arrendamiento de pick-up', 'Alquiler de local'],
    ['maquinaria-pesada', 'Reparación de retroexcavadora', 'Alquiler de retroexcavadora'],
    ['maquinaria-pesada', 'Repuestos para cargador frontal', 'Mantenimiento de impresora'],
    ['consultorias', 'Servicio de CONSULTORÍA para expediente técnico', 'Compra de útiles'],
    ['consultorias', 'Asesoría jurídica', 'Elaboración de expediente técnico'],
    ['expedientes-tecnicos', 'Actualización de expedientes técnicos', 'Archivadores para expedientes'],
    ['beneficios-personal', 'Canastas navideñas para los trabajadores', 'Canastas para damnificados'],
    ['beneficios-personal', 'Leche para el personal obrero', 'Leche para el programa Vaso de Leche'],
    ['beneficios-personal', 'Cumplimiento de convenio sindical SITRAMUN', 'Compra de leche evaporada'],
    ['vaso-de-leche', 'Suministro de hojuelas para el PVL', 'Leche para personal'],
    ['vaso-de-leche', 'Programa Vaso de Leche', 'Vasos descartables'],
    ['mantenimiento-vehiculos', 'Reparación de motocicletas y camionetas', 'Alquiler de camioneta'],
    ['mantenimiento-vehiculos', 'Mantenimiento de moto', 'Mantenimiento de motoniveladora'],
  ])('%s distingue conceptos: %s', (id, positivo, negativo) => {
    const c = categoriaGastoPorId(id)!;
    expect(coincideCategoriaGasto(c, positivo)).toBe(true);
    expect(coincideCategoriaGasto(c, negativo)).toBe(false);
    expect(coincideCategoriaGasto(c, null)).toBe(false);
  });
  it('permite conceptos compartidos sin duplicar categorías', () => {
    expect(categoriasGasto.filter(c => coincideCategoriaGasto(c, 'Consultoría de expediente técnico')).map(c => c.id)).toEqual(['consultorias', 'expedientes-tecnicos']);
    expect(new Set(categoriasGasto.map(c => c.id)).size).toBe(7);
    expect(categoriaGastoPorId('inexistente')).toBeUndefined();
  });
});
