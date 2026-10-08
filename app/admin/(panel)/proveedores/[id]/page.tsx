import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requierePermiso } from '@/lib/auth/session';
import { puede } from '@/lib/auth/permissions';
import { dniDesdeRuc, datoProveedorPublicado, esquemaPublicacionProveedor } from '@/lib/supplier-profile';
import { obtenerPerfilProveedor } from '@/services/supplierProfileService';
import { FormularioPerfilProveedor } from '@/components/admin/formulario-perfil-proveedor';
import { FotoPerfilProveedor } from '@/components/admin/foto-perfil-proveedor';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfil de proveedor' };
export default async function PerfilProveedor({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requierePermiso('persons:read');
  const { id } = await params;
  const proveedor = await obtenerPerfilProveedor(id);
  if (!proveedor) notFound();
  const dni = dniDesdeRuc(proveedor.ruc);
  const perfil = proveedor.profile;
  const editable = puede(usuario.role, 'persons:write');
  const reglas = esquemaPublicacionProveedor.safeParse(perfil?.publication);
  const version = perfil?.updatedAt.toISOString() ?? '';
  return <div className="flex flex-col gap-5">
    <Link href="/admin/proveedores" className="w-fit text-sm text-primary underline">Volver a proveedores</Link>
    <header className="rounded-lg border border-border bg-card p-5"><h1 className="text-2xl font-semibold">{proveedor.name}</h1><p className="mt-2 text-sm">RUC: <strong>{proveedor.ruc}</strong> · {proveedor.ruc.startsWith('20') ? 'Persona jurídica' : dni ? 'Persona natural' : 'Otro tipo de RUC'}</p>{dni ? <p className="mt-1 text-sm">DNI extraído del RUC 10: <strong className="tabular-nums">{dni}</strong></p> : proveedor.ruc.startsWith('20') ? <p className="mt-1 text-xs text-muted-foreground">El RUC 20 identifica a la empresa; los representantes se registran como personas vinculadas.</p> : null}<p className="mt-2 text-sm text-muted-foreground">{proveedor._count.orders} órdenes registradas. La ficha se conserva aunque elimines sus importaciones.</p></header>
    <section className="rounded-lg border border-border bg-card p-5">
      {editable ? <FormularioPerfilProveedor key={version} supplierId={id} version={version} isPublic={perfil?.isPublic ?? false} publication={perfil?.publication ?? {}} birthplace={perfil?.birthplace ?? null} publicNotes={perfil?.publicNotes ?? null} publicSourceUrl={perfil?.publicSourceUrl ?? null} publicDistrict={perfil?.publicDistrict ?? null} birthDate={perfil?.birthDate ?? null} currentAddress={perfil?.currentAddress ?? null} notes={perfil?.notes ?? null} contacts={perfil?.contacts ?? []} esEmpresa={proveedor.ruc.startsWith('20')} /> : <div className="flex flex-col gap-3"><h2 className="font-semibold">Datos del perfil</h2><p>Origen / nacimiento: {perfil?.birthplace ?? 'Sin registrar'}</p><p>Dirección actual: {perfil?.currentAddress ?? 'Sin registrar'}</p><p className="whitespace-pre-wrap">Notas: {perfil?.notes ?? 'Sin registrar'}</p><h2 className="font-semibold">Personas vinculadas</h2>{perfil?.contacts.length ? perfil.contacts.map(c => <div key={c.id} className="rounded border border-border p-3"><p>{c.fullName} · DNI {c.dni}</p><p>Vínculo: {c.relationship}</p>{c.source ? <p>Fuente: {c.source}</p> : null}{c.notes ? <p>{c.notes}</p> : null}</div>) : <p>No hay vínculos registrados.</p>}</div>}
    </section>
    <FotoPerfilProveedor key={version} publicada={Boolean(perfil?.photoKey && datoProveedorPublicado(perfil, 'foto'))} fuente={reglas.success ? reglas.data.foto?.sourceUrl ?? '' : ''} supplierId={id} tieneFoto={Boolean(perfil?.photoKey)} version={version} editable={editable} />
    <Link href={`/proveedores/${proveedor.slug}`} target="_blank" rel="noopener noreferrer" className="boton-enlace inline-flex w-fit items-center rounded-lg px-4 py-2 text-sm text-primary">Ver ficha pública del proveedor</Link>
  </div>;
}
