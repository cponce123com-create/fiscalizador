import type { Metadata } from 'next';
import { Building2, Info } from 'lucide-react';

import { accionGuardarMunicipalidad } from '@/app/admin/municipalidades/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { Aviso, Insignia } from '@/components/ui/data';
import { Campo, GrupoCampo, Selector } from '@/components/ui/form';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import { listarMunicipalidadesAdmin } from '@/services/municipalityService';
import { CATEGORIAS_ENTIDAD_PUBLICA, nombreCategoriaEntidadPublica } from '@/lib/entidad-publica';

export const metadata: Metadata = { title: 'Entidades públicas' };

export default async function PaginaMunicipalidades() {
  const usuario = await usuarioActual();
  if (!usuario || !puede(usuario.role, 'settings:manage')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para administrar municipalidades">
        Esta configuración cambia la cobertura pública del portal y requiere rol SUPERADMIN.
      </Aviso>
    );
  }

  const municipalidades = await listarMunicipalidadesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-primary">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Cobertura de contrataciones
        </p>
        <h1 className="text-xl font-semibold">Entidades públicas</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Registra las entidades cuyas órdenes analizarás. San Ramón sigue como predeterminada;
          el catálogo ya distingue municipalidades, educación, salud, empresas públicas y proyectos especiales.
        </p>
      </header>

      <Aviso tono="info" titulo="Datos separados por entidad" icono={<Info className="h-4 w-4" />}>
        Cada libro y cada orden queda asociado a una entidad pública. Los proveedores se pueden cruzar
        entre entidades por RUC, mientras las órdenes, rankings y estadísticas conservan su entidad de origen.
      </Aviso>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Agregar entidad</h2>
        <FormularioAccion accion={accionGuardarMunicipalidad} etiqueta="Guardar entidad" className="mt-4">
          <CamposMunicipalidad />
        </FormularioAccion>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Entidades registradas</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {municipalidades.map((municipalidad) => (
            <article key={municipalidad.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{municipalidad.nombre}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nombreCategoriaEntidadPublica(municipalidad.categoria)} · {municipalidad.departamento} · {municipalidad.provincia} · RUC {municipalidad.ruc}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Slug público: {municipalidad.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {municipalidad.predeterminada ? <Insignia tono="exito">por defecto</Insignia> : null}
                  <Insignia tono={municipalidad.activa ? 'info' : 'neutro'}>{municipalidad.activa ? 'activa' : 'oculta'}</Insignia>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Importaciones</dt>
                  <dd className="font-semibold tabular-nums">{municipalidad.importaciones}</dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Órdenes</dt>
                  <dd className="font-semibold tabular-nums">{municipalidad.ordenes}</dd>
                </div>
              </dl>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">Editar</summary>
                <FormularioAccion accion={accionGuardarMunicipalidad} etiqueta="Actualizar" variante="outline" className="mt-4">
                  <input type="hidden" name="id" value={municipalidad.id} />
                  <CamposMunicipalidad municipalidad={municipalidad} />
                </FormularioAccion>
              </details>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CamposMunicipalidad({ municipalidad }: { municipalidad?: Awaited<ReturnType<typeof listarMunicipalidadesAdmin>>[number] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GrupoCampo etiqueta="Nombre oficial" htmlFor={`nombre-${municipalidad?.id ?? 'nuevo'}`} obligatorio>
        <Campo id={`nombre-${municipalidad?.id ?? 'nuevo'}`} name="nombre" defaultValue={municipalidad?.nombre ?? ''} placeholder="Municipalidad Distrital de San Ramón" required />
      </GrupoCampo>
      <GrupoCampo etiqueta="Nombre corto" htmlFor={`nombreCorto-${municipalidad?.id ?? 'nuevo'}`} obligatorio ayuda="Así se verá en el selector público.">
        <Campo id={`nombreCorto-${municipalidad?.id ?? 'nuevo'}`} name="nombreCorto" defaultValue={municipalidad?.nombreCorto ?? ''} placeholder="San Ramón" required />
      </GrupoCampo>
      <GrupoCampo etiqueta="RUC" htmlFor={`ruc-${municipalidad?.id ?? 'nuevo'}`} obligatorio>
        <Campo id={`ruc-${municipalidad?.id ?? 'nuevo'}`} name="ruc" defaultValue={municipalidad?.ruc ?? ''} inputMode="numeric" pattern="\d{11}" required />
      </GrupoCampo>
      <GrupoCampo etiqueta="Slug público" htmlFor={`slug-${municipalidad?.id ?? 'nuevo'}`} ayuda="Opcional. Si lo dejas vacío, se genera desde el nombre corto.">
        <Campo id={`slug-${municipalidad?.id ?? 'nuevo'}`} name="slug" defaultValue={municipalidad?.slug ?? ''} placeholder="san-ramon" />
      </GrupoCampo>
      <GrupoCampo etiqueta="Departamento o ámbito" htmlFor={`departamento-${municipalidad?.id ?? 'nuevo'}`} obligatorio ayuda="Usa el departamento correspondiente o indica Nacional/Multirregional cuando aplique.">
        <Campo id={`departamento-${municipalidad?.id ?? 'nuevo'}`} name="departamento" defaultValue={municipalidad?.departamento ?? ''} placeholder="Ej.: Junín, Pasco, Nacional, Multirregional" required />
      </GrupoCampo>
      <GrupoCampo etiqueta="Provincia o ámbito" htmlFor={`provincia-${municipalidad?.id ?? 'nuevo'}`} obligatorio ayuda="Usa la provincia correspondiente o indica Multirregional/Nacional.">
        <Campo id={`provincia-${municipalidad?.id ?? 'nuevo'}`} name="provincia" defaultValue={municipalidad?.provincia ?? ''} placeholder="Ej.: Chanchamayo, Oxapampa, Multirregional" required />
      </GrupoCampo>
      <GrupoCampo etiqueta="Categoría" htmlFor={`categoria-${municipalidad?.id ?? 'nuevo'}`} obligatorio>
        <Selector id={`categoria-${municipalidad?.id ?? 'nuevo'}`} name="categoria" defaultValue={municipalidad?.categoria ?? 'MUNICIPALIDAD'} required>
          {CATEGORIAS_ENTIDAD_PUBLICA.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
        </Selector>
      </GrupoCampo>
      <GrupoCampo etiqueta="Nivel territorial (para municipalidades)" htmlFor={`tipoEntidad-${municipalidad?.id ?? 'nuevo'}`}>
        <Selector id={`tipoEntidad-${municipalidad?.id ?? 'nuevo'}`} name="tipoEntidad" defaultValue={municipalidad?.tipoEntidad ?? (municipalidad?.categoria && municipalidad.categoria !== 'MUNICIPALIDAD' ? 'NO_APLICA' : 'DISTRITAL')} required>
          <option value="NO_APLICA">No aplica</option>
          <option value="DISTRITAL">Distrital</option>
          <option value="PROVINCIAL">Provincial</option>
          <option value="CENTRO_POBLADO">Centro poblado</option>
        </Selector>
      </GrupoCampo>
      <GrupoCampo etiqueta="Color principal" htmlFor={`colorPrincipal-${municipalidad?.id ?? 'nuevo'}`} ayuda="Opcional, para una siguiente fase de identidad visual por municipalidad.">
        <Campo id={`colorPrincipal-${municipalidad?.id ?? 'nuevo'}`} name="colorPrincipal" defaultValue={municipalidad?.colorPrincipal ?? ''} placeholder="#006b3f" />
      </GrupoCampo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={municipalidad?.activa ?? true} className="h-4 w-4" />
        Activa en el selector público
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="predeterminada" defaultChecked={municipalidad?.predeterminada ?? false} className="h-4 w-4" />
        Usar como predeterminada
      </label>
    </div>
  );
}
