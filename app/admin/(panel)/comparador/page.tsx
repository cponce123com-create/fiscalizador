import Link from 'next/link';
import { CheckCircle2, Circle, SearchCheck, ShieldAlert } from 'lucide-react';

import { accionMarcarRevisionComparador } from '@/app/admin/comparador/actions';
import { puede } from '@/lib/auth/permissions';
import { requierePermiso } from '@/lib/auth/session';
import { formatearFecha, formatearMonto } from '@/lib/utils';
import { comparadorAdmin, type CruceComparador } from '@/services/comparatorService';
import { EstadoVacio, Insignia } from '@/components/ui/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comparador' };

type Estado = 'todos' | 'pendientes' | 'revisados';

function leerEstado(valor: string | string[] | undefined): Estado {
  const estado = Array.isArray(valor) ? valor[0] : valor;
  return estado === 'todos' || estado === 'revisados' ? estado : 'pendientes';
}

export default async function ComparadorAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await requierePermiso('persons:read');
  const params = await searchParams;
  const estado = leerEstado(params.estado);
  const datos = await comparadorAdmin(estado);
  const editable = puede(usuario.role, 'persons:write');

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <SearchCheck size={16} aria-hidden="true" />
          Cruce interno
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Comparador de personas y proveedores</h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          Busca personas del registro electoral, personas señaladas y listado de prensa dentro de los
          proveedores con órdenes en todos los periodos. Las coincidencias por DNI/RUC son fuertes; las
          coincidencias por apellidos son solo alertas para revisión manual.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta etiqueta="Personas evaluadas" valor={datos.totales.sujetos} />
        <Tarjeta etiqueta="Proveedores con órdenes" valor={datos.totales.proveedoresConOrdenes} />
        <Tarjeta etiqueta="Cruces por documento" valor={datos.totales.exactos} />
        <Tarjeta etiqueta="Sugerencias por apellidos" valor={datos.totales.sugerencias} />
        <Tarjeta etiqueta="Pendientes de check" valor={datos.totales.pendientes} />
      </div>

      <nav aria-label="Estado de revisión" className="flex flex-wrap gap-2">
        {[
          ['pendientes', 'Pendientes'],
          ['revisados', 'Revisados'],
          ['todos', 'Todos'],
        ].map(([valor, etiqueta]) => (
          <Link
            key={valor}
            href={`/admin/comparador?estado=${valor}`}
            aria-current={estado === valor ? 'page' : undefined}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${estado === valor ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}
          >
            {etiqueta}
          </Link>
        ))}
      </nav>

      <AvisoMetodo />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Con órdenes confirmadas por documento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aquí sí existe una coincidencia fuerte: el DNI está dentro del RUC 10 o el RUC coincide con
            el listado de prensa.
          </p>
        </div>
        <TablaCruces cruces={datos.exactos} editable={editable} vacio="No hay cruces por documento con este filtro." />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Relacionador inteligente por apellidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Son sugerencias para revisar posibles familiares u homónimos. No se publican como vínculo
            hasta que agregues fuente y validación en el perfil correspondiente.
          </p>
        </div>
        <TablaCruces cruces={datos.sugerencias} editable={editable} vacio="No hay sugerencias pendientes con este filtro." />
      </section>
    </div>
  );
}

function Tarjeta({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{valor.toLocaleString('es-PE')}</p>
    </div>
  );
}

function AvisoMetodo() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p>
        Una coincidencia por apellidos no prueba parentesco ni conflicto de intereses. Úsala como
        cola de trabajo: abre el perfil, sube foto si corresponde y registra fuente antes de publicar.
      </p>
    </div>
  );
}

function TablaCruces({ cruces, editable, vacio }: { cruces: CruceComparador[]; editable: boolean; vacio: string }) {
  if (!cruces.length) return <EstadoVacio titulo={vacio} descripcion="Cambia el filtro de revisión para ver otros resultados." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="p-3">Check</th>
            <th className="p-3">Persona detectada</th>
            <th className="p-3">Proveedor con órdenes</th>
            <th className="p-3">Órdenes</th>
            <th className="p-3">Motivo</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cruces.map((cruce) => (
            <tr key={`${cruce.subjectKey}-${cruce.supplierId}-${cruce.tipo}`} className="border-t border-border align-top">
              <td className="p-3">
                <form action={accionMarcarRevisionComparador}>
                  <input type="hidden" name="subjectKey" value={cruce.subjectKey} />
                  <input type="hidden" name="supplierId" value={cruce.supplierId} />
                  <input type="hidden" name="reviewed" value={cruce.revisado ? 'false' : 'true'} />
                  <button
                    type="submit"
                    disabled={!editable}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${cruce.revisado ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-card text-muted-foreground'}`}
                    title={editable ? 'Cambiar estado de revisión' : 'Solo lectura'}
                  >
                    {cruce.revisado ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                    {cruce.revisado ? 'Revisado' : 'Pendiente'}
                  </button>
                </form>
              </td>
              <td className="max-w-[18rem] p-3">
                <p className="font-medium">{cruce.persona}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cruce.dni ? `DNI ${cruce.dni}` : cruce.ruc ? `RUC ${cruce.ruc}` : 'Sin documento registrado'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {cruce.fuentes.map((fuente) => <Insignia key={fuente} tono="info">{fuente}</Insignia>)}
                </div>
                {cruce.detalle.length ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" title={cruce.detalle.join(' · ')}>{cruce.detalle.join(' · ')}</p> : null}
              </td>
              <td className="min-w-[18rem] p-3">
                <div className="flex gap-3">
                  {cruce.proveedor.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cruce.proveedor.fotoUrl} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover object-top" />
                  ) : (
                    <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Sin foto</span>
                  )}
                  <div className="min-w-0">
                    <Link href={`/admin/proveedores/${cruce.proveedor.id}`} className="font-medium text-primary underline underline-offset-2">
                      {cruce.proveedor.nombre}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">RUC {cruce.proveedor.ruc}</p>
                    <Link href={`/proveedores/${cruce.proveedor.slug}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                      Ver público
                    </Link>
                  </div>
                </div>
              </td>
              <td className="p-3 tabular-nums">
                <p>{cruce.proveedor.ordenes.toLocaleString('es-PE')} órdenes</p>
                <p className="mt-1 font-semibold">{formatearMonto(cruce.proveedor.considerado)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatearFecha(cruce.proveedor.primera)} a {formatearFecha(cruce.proveedor.ultima)}</p>
              </td>
              <td className="max-w-[18rem] p-3">
                <Insignia tono={cruce.tipo === 'documento' ? 'exito' : 'advertencia'}>
                  {cruce.tipo === 'documento' ? 'Coincidencia fuerte' : 'Revisión sugerida'}
                </Insignia>
                <p className="mt-2 text-sm">{cruce.motivo}</p>
                {cruce.coincidencias.length ? <p className="mt-1 text-xs text-muted-foreground">Coincide: {cruce.coincidencias.join(', ')}</p> : null}
              </td>
              <td className="p-3">
                <Link href={`/admin/proveedores/${cruce.proveedor.id}`} className="boton-enlace inline-flex rounded-lg px-3 py-2 text-xs text-primary">
                  Abrir perfil y foto
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
