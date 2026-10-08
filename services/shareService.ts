import { cache } from 'react';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { categoriaGastoPorId } from '@/lib/categorias-gasto';
import { datoProveedorPublicado } from '@/lib/supplier-profile';
import { resumenGastos, resumenProveedor } from '@/lib/compartir';
import { urlDelSitio } from '@/lib/site';
import { perfilProveedor } from './statisticsService';
import { gastoAlimentacionPorGestion } from './foodService';
import { gastosPorCategoriaGestion } from './categorySpendingService';
import { leerConfiguracionPortal } from './portalService';
import { leerFotoPrivada } from './privatePhotoStorage';
import type { TarjetaCompartida } from './shareImageService';

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
