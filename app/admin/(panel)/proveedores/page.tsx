import Link from 'next/link';
import { requierePermiso } from '@/lib/auth/session';
import { leerFiltros } from '@/lib/filtros';
import { dniDesdeRuc } from '@/lib/supplier-profile';
import { listarPerfilesProveedores } from '@/services/supplierProfileService';
import { BusquedaProveedores } from '@/components/publico/busqueda-proveedores';
import { Paginacion } from '@/components/publico/paginacion';
import { EstadoVacio, Insignia } from '@/components/ui/data';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfiles de proveedores' };
export default async function ProveedoresAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requierePermiso('persons:read');
  const filtros = { ...leerFiltros(await searchParams), porPagina: 20 };
  const datos = await listarPerfilesProveedores(filtros.texto ?? '', filtros.tipoRuc ?? '', String(filtros.pagina));
  return <div className="flex flex-col gap-5">
    <header><h1 className="text-2xl font-semibold">Perfiles de proveedores</h1><p className="mt-2 text-sm text-muted-foreground">Busca un proveedor y abre su ficha para registrar foto, ubicación y personas vinculadas. La foto, edad, lugar de nacimiento y distrito se muestran en el portal. Notas y vínculos documentados pueden publicarse con una fuente; los borradores permanecen privados.</p></header>
    <BusquedaProveedores filtros={filtros} ruta="/admin/proveedores" />
    <Paginacion filtros={filtros} total={datos.total} ruta="/admin/proveedores" />
    {!datos.proveedores.length ? <EstadoVacio titulo="No se encontraron proveedores" descripcion="Prueba otro nombre, RUC o DNI. Los proveedores se crean al importar sus órdenes." /> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3" scope="col">Proveedor</th><th className="p-3" scope="col">RUC / DNI</th><th className="p-3" scope="col">Órdenes</th><th className="p-3" scope="col">Perfil</th></tr></thead><tbody>{datos.proveedores.map(p => <tr key={p.id} className="border-b border-border last:border-0"><td className="p-3"><Link className="font-medium text-primary underline" href={`/admin/proveedores/${p.id}`}>{p.name}</Link><p className="mt-1 text-xs text-muted-foreground">{p.ruc.startsWith('10') ? 'Persona natural' : p.ruc.startsWith('20') ? 'Persona jurídica' : 'Otro tipo de RUC'}</p></td><td className="p-3 tabular-nums">{p.ruc}{dniDesdeRuc(p.ruc) ? <p className="text-xs text-muted-foreground">DNI: {dniDesdeRuc(p.ruc)}</p> : null}</td><td className="p-3 tabular-nums">{p._count.orders}</td><td className="p-3"><Insignia tono={p.profile ? 'exito' : 'neutro'}>{p.profile ? 'Ficha registrada' : 'Por completar'}</Insignia><Link className="mt-2 block text-primary underline" href={`/admin/proveedores/${p.id}`}>Abrir perfil</Link></td></tr>)}</tbody></table></div>}
    <Paginacion filtros={filtros} total={datos.total} ruta="/admin/proveedores" />
  </div>;
}
