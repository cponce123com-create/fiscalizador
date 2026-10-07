import type { Metadata } from 'next';
import { DescargasSeace } from '@/components/admin/descargas-seace';
import { Aviso } from '@/components/ui/data';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import { seaceConfigurado, ultimaDescarga } from '@/services/seaceDownloadService';

export const metadata: Metadata = { title: 'Descargas SEACE' };
export default async function PaginaDescargas() {
  const usuario = await usuarioActual();
  if (!usuario || !puede(usuario.role, 'imports:write')) {
    return <Aviso tono="error" titulo="No tienes permiso para descargar libros">Esta sección requiere el permiso de importación.</Aviso>;
  }
  return <DescargasSeace configurado={seaceConfigurado()} inicial={await ultimaDescarga(usuario.id)} anioActual={new Date().getFullYear()} />;
}
