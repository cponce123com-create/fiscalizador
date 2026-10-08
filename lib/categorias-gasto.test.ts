import { describe, expect, it } from 'vitest';
import { categoriaGastoPorId, categoriasGasto, coincideCategoriaGasto } from './categorias-gasto';
describe('clasificación de gastos por descripción', () => {
  it.each([
    ['utiles-oficina', 'ÚTILES DE OFICINA Y ECONOMATO', 'Útiles escolares'],
    ['utiles-oficina', 'Impresión de talonarios', 'Mantenimiento de impresora'],
    ['utiles-oficina', 'Tóner y papel bond', 'Alquiler de oficinas'],
    ['utiles-oficina', 'Fotocopiado de documentos', 'Papeles de trabajo de consultoría'],
    ['utiles-oficina', 'Adquisición de archivadores y lapiceros', 'Compra de carpetas escolares'],
    ['vacaciones-navidad', 'Programa de VACACIONES ÚTILES', 'Pago de vacaciones del personal'],
    ['vacaciones-navidad', 'Canastas navideñas', 'Adquisición de alimentos en diciembre'],
    ['vacaciones-navidad', 'Chocolatada por Navidad', 'Servicio de almuerzo'],
    ['vacaciones-navidad', 'Panetones para actividad navideña', 'Compra de pan para comedor'],
    ['apoyo-social', 'APOYO SOCIAL Y COYUNTURAL', 'Apoyo administrativo'],
    ['apoyo-social', 'Asistencia social a población vulnerable', 'Asistencia técnica'],
    ['apoyo-social', 'Ayuda humanitaria', 'Apoyo al programa de mantenimiento'],
    ['apoyo-social', 'Apoyo a los damnificados', 'Compra de combustible'],
    ['apoyo-social', 'Subvenciones sociales', 'Subvención para evento deportivo'],
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
    expect(new Set(categoriasGasto.map(c => c.id)).size).toBe(10);
    expect(categoriaGastoPorId('inexistente')).toBeUndefined();
  });
});
