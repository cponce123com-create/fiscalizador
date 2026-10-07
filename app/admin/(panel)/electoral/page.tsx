import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requierePermiso } from '@/lib/auth/session';
import { puede } from '@/lib/auth/permissions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { BusquedaEnVivo } from '@/components/publico/busqueda-en-vivo';
import { AntecedentesElectorales } from '@/components/publico/antecedentes-electorales';
import { accionPersonaElectoral, accionRegistroElectoral, accionEliminarRegistroElectoral, accionImportarElectoral } from '@/app/admin/electoral/actions';
import type { ElectoralRecord } from '@/lib/generated/prisma/client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registro electoral' };
const campo = 'rounded-md border border-input bg-background px-3 py-2 text-sm';
function CamposRegistro({ registro }: { registro?: ElectoralRecord | null }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm">Año de elección<input className={campo} name="electionYear" type="number" min={1900} max={2100} required defaultValue={registro?.electionYear ?? 2022} /></label>
    <label className="flex flex-col gap-1 text-sm">Cargo<select className={campo} name="position" defaultValue={registro?.position ?? 'REGIDOR'}><option value="REGIDOR">Regidor</option><option value="ALCALDE">Alcalde</option><option value="CONSEJERO">Consejero</option><option value="OTRO">Otro</option></select></label>
    <label className="flex flex-col gap-1 text-sm">Partido, movimiento o lista<input className={campo} name="organization" maxLength={200} minLength={2} required defaultValue={registro?.organization} /></label>
    <label className="flex flex-col gap-1 text-sm">Candidato a alcalde de esa lista<input className={campo} name="mayorCandidate" maxLength={200} minLength={2} required defaultValue={registro?.mayorCandidate} /></label>
    <label className="flex flex-col gap-1 text-sm">Municipalidad<input className={campo} name="municipality" maxLength={200} minLength={2} required defaultValue={registro?.municipality ?? 'Municipalidad Distrital de San Ramón'} /></label>
    <label className="flex flex-col gap-1 text-sm">Resultado<select className={campo} name="result" defaultValue={registro?.result ?? 'POR_VERIFICAR'}><option value="ELECTO">Electo</option><option value="NO_ELECTO">No electo</option><option value="IMPROCEDENTE">Candidatura improcedente</option><option value="POR_VERIFICAR">Por verificar</option></select></label>
    <label className="flex flex-col gap-1 text-sm">Inicio del periodo<input className={campo} name="termStart" type="number" min={1900} max={2100} required defaultValue={registro?.termStart ?? 2023} /></label>
    <label className="flex flex-col gap-1 text-sm">Fin del periodo<input className={campo} name="termEnd" type="number" min={1900} max={2100} required defaultValue={registro?.termEnd ?? 2026} /></label>
    <label className="flex flex-col gap-1 text-sm">Documento y referencia<input className={campo} name="source" minLength={12} maxLength={500} required placeholder="Acta de proclamación, fecha y página" defaultValue={registro?.source} /></label>
    <label className="flex flex-col gap-1 text-sm">Enlace público de la fuente<input className={campo} name="sourceUrl" type="url" maxLength={500} required defaultValue={registro?.sourceUrl} /></label>
    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isPublic" defaultChecked={registro?.isPublic ?? false} />Publicar este antecedente: he contrastado los datos con el documento.</label>
  </div>;
}
export default async function RegistroElectoral({ searchParams }: { searchParams: Promise<{ q?: string; persona?: string; registro?: string; page?: string }> }) {
  const user = await requierePermiso('persons:read');
  const editable = puede(user.role, 'persons:write');
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 120);
  const where = q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { dni: { contains: q } }] } : {};
  const total = await prisma.electoralPerson.count({ where });
  const paginas = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(paginas, Math.max(1, Number.parseInt(params.page ?? '1') || 1));
  const [personas, persona] = await Promise.all([
    prisma.electoralPerson.findMany({ where, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20, select: { id: true, fullName: true, dni: true, isPublic: true, _count: { select: { records: true } } } }),
    params.persona ? prisma.electoralPerson.findUnique({ where: { id: params.persona }, include: { records: { orderBy: { electionYear: 'desc' } } } }) : null,
  ]);
  const registro = persona?.records.find(r => r.id === params.registro);
  const consulta = new URLSearchParams({ ...(q ? { q } : {}), ...(params.persona ? { persona: params.persona } : {}), page: String(page) }).toString();
  return <div className="flex flex-col gap-6">
    <header><h1 className="text-2xl font-semibold">Registro electoral</h1><p className="mt-2 text-sm text-muted-foreground">Perfiles independientes de las compras: candidatos, listas, resultados y periodos con su documento de origen. Sin DNI se conserva la ficha, pero no se enlaza automáticamente con proveedores.</p></header>
    {editable ? <section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-3 font-semibold">Importar acta preparada</h2><p className="mb-4 text-sm text-muted-foreground">Carga el JSON extraído y revisado del acta. Se procesan hasta 200 antecedentes juntos, sin duplicar ni sustituir registros existentes. El documento de identidad permanece en el administrador.</p><FormularioAccion accion={accionImportarElectoral} etiqueta="Importar antecedentes"><label className="flex flex-col gap-2 text-sm">Archivo de carga JSON<input type="file" name="archivo" required accept="application/json,.json" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicar" defaultChecked />Publicar las personas y antecedentes nuevos con sus fuentes.</label></FormularioAccion></section> : null}
    <BusquedaEnVivo ruta="/admin/electoral" consulta={consulta} className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm">Buscar persona por nombre o DNI<input type="search" name="q" maxLength={120} defaultValue={q} className={campo} /></label><button className="rounded-md border border-border px-3 py-2">Buscar</button></BusquedaEnVivo>
    <div className="grid gap-3 sm:grid-cols-2">{personas.map(p => <Link key={p.id} href={`/admin/electoral?persona=${p.id}`} className="rounded-lg border border-border p-4 hover:bg-muted"><strong>{p.fullName}</strong><p className="mt-1 text-xs text-muted-foreground">{p.dni ? `DNI ${p.dni}` : 'DNI pendiente'} · {p._count.records} antecedentes · {p.isPublic ? 'Perfil habilitado para publicación' : 'Borrador'}</p></Link>)}</div>
    <nav aria-label="Paginación electoral" className="flex items-center gap-4 text-sm">{page > 1 ? <Link href={`/admin/electoral?${new URLSearchParams({ q, page: String(page - 1) })}`}>Anterior</Link> : null}<span>{total} personas · página {page} de {paginas}</span>{page < paginas ? <Link href={`/admin/electoral?${new URLSearchParams({ q, page: String(page + 1) })}`}>Siguiente</Link> : null}</nav>
    {editable ? <section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-4 font-semibold">{persona ? `Editar identidad: ${persona.fullName}` : 'Crear persona electoral'}</h2><FormularioAccion key={persona?.updatedAt.toISOString() ?? 'nueva'} accion={accionPersonaElectoral} etiqueta="Guardar persona"><input type="hidden" name="id" value={persona?.id ?? ''} /><label className="flex flex-col gap-1 text-sm">Nombres y apellidos<input className={campo} name="fullName" required minLength={3} maxLength={200} defaultValue={persona?.fullName} /></label><label className="flex flex-col gap-1 text-sm">DNI · privado y opcional<input className={campo} name="dni" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} defaultValue={persona?.dni ?? ''} /></label><label className="flex items-center gap-2 text-sm"><input name="isPublic" type="checkbox" defaultChecked={persona?.isPublic ?? false} />Habilitar perfil público. Solo se mostrarán antecedentes marcados para publicar.</label></FormularioAccion>{persona ? <Link href="/admin/electoral" className="mt-4 block text-sm text-primary underline">Crear otra persona</Link> : null}</section> : null}
    {persona ? <section className="flex flex-col gap-4"><h2 className="text-xl font-semibold">Antecedentes de {persona.fullName}</h2>{persona.isPublic ? <Link href={`/electoral/${persona.id}`} className="text-sm text-primary underline">Ver perfil público si tiene antecedentes publicados</Link> : null}<AntecedentesElectorales registros={persona.records} />{editable ? <>{persona.records.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3"><Link href={`/admin/electoral?persona=${persona.id}&registro=${r.id}`} className="text-sm text-primary underline">Editar {r.electionYear} · {r.position} ({r.isPublic ? 'Publicado' : 'Borrador'})</Link><FormularioAccion accion={accionEliminarRegistroElectoral} etiqueta="Eliminar antecedente" variante="destructive" confirmar="¿Eliminar este antecedente electoral?"><input type="hidden" name="id" value={r.id} /></FormularioAccion></div>)}<div className="rounded-lg border border-border bg-card p-5"><h3 className="mb-4 font-semibold">{registro ? 'Editar antecedente' : 'Añadir antecedente electoral'}</h3><FormularioAccion key={registro?.updatedAt.toISOString() ?? persona.id} accion={accionRegistroElectoral} etiqueta="Guardar antecedente"><input type="hidden" name="personId" value={persona.id} /><input type="hidden" name="id" value={registro?.id ?? ''} /><CamposRegistro registro={registro} /></FormularioAccion>{registro ? <Link href={`/admin/electoral?persona=${persona.id}`} className="mt-3 block text-sm text-primary underline">Añadir otro antecedente</Link> : null}</div></> : null}</section> : null}
  </div>;
}
