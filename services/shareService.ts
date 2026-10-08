import { cache } from 'react';
import sharp from 'sharp';
import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { categoriaGastoPorId } from '@/lib/categorias-gasto';
import { datoProveedorPublicado } from '@/lib/supplier-profile';
import { resumenGastos, resumenProveedor } from '@/lib/compartir';
import { urlDelSitio } from '@/lib/site';
import { estadisticasPorEtapa, type EstadisticaEtapa, type VentanaEstadistica } from './statisticsExplorerService';
import { perfilProveedor } from './statisticsService';
import { gastoAlimentacionPorGestion } from './foodService';
import { gastosPorCategoriaGestion } from './categorySpendingService';
import { leerConfiguracionPortal } from './portalService';
import { leerFotoPrivada } from './privatePhotoStorage';
import type { TarjetaCompartida } from './shareImageService';

const ESTADISTICAS_COMPARTIBLES: Record<string, { titulo: string; ventana: VentanaEstadistica; grupo?: '10' | '20' | 'otros'; ruta: string }> = {
  'ruc-10': { titulo: 'RUC 10 · personas naturales', ventana: 'gestion', grupo: '10', ruta: '/estadisticas#por-ruc' },
  'ruc-20': { titulo: 'RUC 20 · personas jurídicas', ventana: 'gestion', grupo: '20', ruta: '/estadisticas#por-ruc' },
  'ruc-otros': { titulo: 'Otros tipos de RUC', ventana: 'gestion', grupo: 'otros', ruta: '/estadisticas#por-ruc' },
  'primeros-100': { titulo: 'Primeros 100 días', ventana: 'primeros-100', ruta: '/estadisticas#etapas' },
  'ultimo-anio': { titulo: 'Último año de mandato', ventana: 'ultimo-anio', ruta: '/estadisticas#etapas' },
};

const suma = (filas: EstadisticaEtapa[], campo: 'considerado' | 'anulado') => filas.reduce((n, f) => n.plus(f[campo]), new Prisma.Decimal(0)).toFixed(2);
function agruparEstadistica(filas: EstadisticaEtapa[], ventana: VentanaEstadistica, grupo?: string) {
  const seleccion = filas.filter(f => f.ventana === ventana && (!grupo || f.grupo === grupo));
  return [...new Set(seleccion.map(f => f.id))].map(id => {
    const partes = seleccion.filter(f => f.id === id);
    return { ...partes[0], considerado: suma(partes, 'considerado'), anulado: suma(partes, 'anulado'), ordenes: partes.reduce((n, f) => n + f.ordenes, 0), anuladas: partes.reduce((n, f) => n + f.anuladas, 0) };
  });
}

export const prepararTarjetaPublica = cache(async (tipo: string, id: string): Promise<TarjetaCompartida | null> => {
  if (id.length > 180 || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  const base = urlDelSitio();
  if (tipo === 'gasto') {
    const categoria = id === 'alimentacion' ? null : categoriaGastoPorId(id);
    if (!categoria && id !== 'alimentacion') return null;
    const filas = id === 'alimentacion' ? await gastoAlimentacionPorGestion() : (await gastosPorCategoriaGestion()).filter(f => f.categoria === id);
    const config = await leerConfiguracionPortal();
    return { titulo: categoria?.titulo ?? 'Gastos en alimentación', resumen: resumenGastos(filas), ruta: `${base}${id === 'alimentacion' ? '/alimentacion' : `/gastos/${id}`}`, municipio: config.municipio, filas };
  }
  if (tipo === 'estadistica') {
    const definicion = ESTADISTICAS_COMPARTIBLES[id];
    if (!definicion) return null;
    const [filas, config] = await Promise.all([estadisticasPorEtapa(), leerConfiguracionPortal()]);
    const agrupadas = agruparEstadistica(filas, definicion.ventana, definicion.grupo);
    return { titulo: definicion.titulo, resumen: resumenGastos(agrupadas), ruta: `${base}${definicion.ruta}`, municipio: config.municipio, filas: agrupadas };
  }
  if (tipo !== 'proveedor') return null;
  const perfil = await perfilProveedor(id);
  if (!perfil) return null;
  const [config, ficha] = await Promise.all([leerConfiguracionPortal(), prisma.supplierProfile.findUnique({ where: { supplierId: perfil.id }, select: { isPublic: true, publication: true, photoKey: true } })]);
  let foto: string | undefined;
  if (ficha?.photoKey && datoProveedorPublicado(ficha, 'foto')) {
    try {
      // Normaliza fotos antiguas a PNG; nunca entrega la clave ni la URL autenticada.
      const png = await sharp(await leerFotoPrivada(ficha.photoKey), { limitInputPixels: 16_000_000 }).rotate().resize(150, 200, { fit: 'cover', position: 'attention' }).png().toBuffer();
      foto = `data:image/png;base64,${png.toString('base64')}`;
    } catch { /* El perfil sigue siendo compartible sin fotografía. */ }
  }
  return { titulo: perfil.nombre, resumen: resumenProveedor(perfil.nombre, perfil.ordenes, perfil.totalConsiderado), municipio: config.municipio, ruta: `${base}/proveedores/${encodeURIComponent(id)}`, filas: [], foto, proveedor: { monto: perfil.totalConsiderado, ordenes: perfil.ordenes } };
});
