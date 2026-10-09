import { describe, expect, it } from 'vitest';
import { categoriaGastoPorId, categoriasGasto, coincideCategoriaGasto } from './categorias-gasto';
describe('clasificación de gastos por descripción', () => {
  it.each([
    ['combustible', 'Adquisición de GASOHOL y gasolina de 90 octanos', 'Compra de lubricantes'],
    ['combustible', 'Suministro de DIÉSEL B5 S50', 'Compra de papel bond'],
    ['combustible', 'Compra de combustible y petróleo', 'Servicio de alimentación'],
    ['combustible', 'Suministro de biodiésel DB5', 'Adquisición de combustible nuclear'],
    ['prensa', 'Servicio de difusión y spots radiales', 'Compra de prensa hidráulica'],
    ['prensa', 'PUBLICIDAD EN MEDIOS DE COMUNICACIÓN', 'Adquisición de radios portátiles'],
    ['prensa', 'Servicio periodístico y cobertura de prensa', 'Impresión de talonarios'],
    ['equipos-computo', 'Adquisición de TÓNER y computadoras', 'Compra de equipos de sonido'],
    ['equipos-computo', 'Reparación de laptop e impresora', 'Implementación de maquinaria pesada'],
    ['equipos-computo', 'Compra de monitor LED y teclado', 'Contratación de monitores de vacaciones útiles'],
    ['equipos-computo', 'Cartuchos de tinta para impresoras', 'Compra de cartuchos de escopeta'],
    ['equipos-computo', 'Adquisición de discos SSD y memoria RAM', 'Útiles escolares'],
    ['equipos-computo', 'Implementación de redes informáticas y routers', 'Compra de redes de pesca'],
    ['seguridad-serenazgo', 'Servicio de serenazgo y patrullaje municipal', 'Servicio de seguridad ocupacional'],
    ['seguridad-serenazgo', 'Adquisición de cámaras de seguridad y alarmas', 'Compra de cámaras fotográficas'],
    ['seguridad-serenazgo', 'Radios portátiles para seguridad ciudadana', 'Publicidad radial'],
    ['seguridad-serenazgo', 'Uniformes y chalecos para serenos', 'Uniformes para personal administrativo'],
    ['limpieza-residuos', 'Servicio de limpieza pública y recojo de basura', 'Limpieza de oficinas'],
    ['limpieza-residuos', 'Mantenimiento de compactadora de residuos sólidos', 'Mantenimiento de maquinaria pesada'],
    ['limpieza-residuos', 'Compra de contenedores para residuos sólidos', 'Compra de contenedores de agua'],
    ['limpieza-residuos', 'Bolsas negras y escobas para barrido de calles', 'Escobas para limpieza de local'],
    ['maquinaria-pesada', 'Implementación de maquinaria pesada', 'Implementación de equipo de cómputo'],
    ['maquinaria-pesada', 'Seguro de volquete y póliza de excavadora', 'Seguro del personal'],
    ['maquinaria-pesada', 'Revisión técnica de motoniveladora', 'Revisión de expediente técnico'],
    ['maquinaria-pesada', 'Neumáticos y aceite para retroexcavadora', 'Compra de aceite para almuerzos'],
    ['maquinaria-pesada', 'Repotenciación de cargador frontal', 'Alquiler de volquete'],
    ['mantenimiento-vehiculos', 'SOAT de camioneta y motocicleta', 'Seguro de oficina'],
    ['mantenimiento-vehiculos', 'Pólizas de seguros para pick-up', 'Alquiler de moto'],
    ['mantenimiento-vehiculos', 'Implementación y equipamiento de motos', 'Implementación de excavadora'],
    ['mantenimiento-vehiculos', 'Llantas y baterías para camionetas', 'Baterías para impresora'],
    ['mantenimiento-vehiculos', 'Reparaciones y lubricación de motocicleta', 'Compra de camioneta nueva'],
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
    ['aniversario', 'Servicio para aniversario del distrito', 'Compra de papel bond'],
    ['reinado', 'Organización de certamen de belleza y coronación', 'Mantenimiento de camioneta'],
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
    expect(new Set(categoriasGasto.map(c => c.id)).size).toBe(17);
    expect(categoriaGastoPorId('inexistente')).toBeUndefined();
  });
});
