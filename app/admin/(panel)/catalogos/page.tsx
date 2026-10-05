import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  accionActualizarEstado,
  accionActualizarGestion,
  accionActualizarTipoDeContratacion,
  accionActualizarTipoDeOrden,
  accionCrearEstado,
  accionCrearGestion,
  accionCrearTipoDeContratacion,
  accionCrearTipoDeOrden,
  accionEliminarEstado,
  accionEliminarGestion,
  accionEliminarTipoDeContratacion,
  accionEliminarTipoDeOrden,
} from '@/app/admin/catalogos/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import {
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
} from '@/components/ui/card';
import { Aviso, Insignia } from '@/components/ui/data';
import { AreaTexto, Campo, GrupoCampo } from '@/components/ui/form';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import {
  listarEstados,
  listarGestiones,
  listarTiposDeContratacion,
  listarTiposDeOrden,
  type EstadoCatalogo,
  type GestionCatalogo,
  type TipoCatalogo,
} from '@/services/catalogService';

export const metadata: Metadata = {
  title: 'Catálogos',
};

/**
 * Catálogos configurables del importador.
 *
 * Existen para que clasificar un estado nuevo —decidir si cuenta como gasto— no exija
 * desplegar la aplicación (docs/prompt.md secciones 14 y 31). Todo lo que se cambia aquí
 * se ve en el portal, así que la página exige el mismo permiso que importar y cada
 * cambio queda auditado.
 */

function TarjetaNuevo({
  titulo,
  descripcion,
  accion,
  etiqueta,
  children,
}: {
  titulo: string;
  descripcion: string;
  accion: (estado: { error: string | null; ok: string | null }, formData: FormData) => Promise<{
    error: string | null;
    ok: string | null;
  }>;
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>{titulo}</TarjetaTitulo>
        <TarjetaDescripcion>{descripcion}</TarjetaDescripcion>
      </TarjetaEncabezado>

      <TarjetaContenido>
        <FormularioAccion accion={accion} etiqueta={etiqueta}>
          {children}
        </FormularioAccion>
      </TarjetaContenido>
    </Tarjeta>
  );
}

function TarjetaElemento({
  titulo,
  descripcion,
  insignias,
  children,
}: {
  titulo: string;
  descripcion: string;
  insignias: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <TarjetaTitulo>{titulo}</TarjetaTitulo>
            <TarjetaDescripcion>{descripcion}</TarjetaDescripcion>
          </div>

          <div className="flex flex-wrap items-center gap-2">{insignias}</div>
        </div>
      </TarjetaEncabezado>

      <TarjetaContenido>{children}</TarjetaContenido>
    </Tarjeta>
  );
}

/** Edición y borrado de una entrada, plegados para que la lista se lea de un vistazo. */
function BloqueEdicion({
  children,
  accionEliminar,
  id,
  aviso,
  confirmacion,
  etiquetaEliminar,
}: {
  children: ReactNode;
  accionEliminar: (estado: { error: string | null; ok: string | null }, formData: FormData) => Promise<{
    error: string | null;
    ok: string | null;
  }>;
  id: string;
  aviso: string;
  confirmacion: string;
  etiquetaEliminar: string;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
        Editar
      </summary>

      <div className="mt-4 flex flex-col gap-6">
        {children}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">{aviso}</p>

          <FormularioAccion
            accion={accionEliminar}
            etiqueta={etiquetaEliminar}
            variante="destructive"
            size="sm"
            className="items-start"
            confirmar={confirmacion}
          >
            <input type="hidden" name="id" value={id} />
          </FormularioAccion>
        </div>
      </div>
    </details>
  );
}

function CamposEstado({
  idPrefijo,
  estado,
  ordenPorDefecto,
}: {
  idPrefijo: string;
  estado?: EstadoCatalogo;
  ordenPorDefecto: number;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <GrupoCampo
          etiqueta="Nombre"
          htmlFor={`${idPrefijo}-label`}
          obligatorio
          ayuda="Es lo que se lee en el portal y en los listados."
        >
          <Campo
            id={`${idPrefijo}-label`}
            name="label"
            required
            maxLength={120}
            defaultValue={estado?.label}
            placeholder="Comprometida"
          />
        </GrupoCampo>

        <GrupoCampo
          etiqueta="Código"
          htmlFor={`${idPrefijo}-code`}
          obligatorio
          ayuda="Se guarda en MAYÚSCULAS_CON_GUIONES."
        >
          <Campo
            id={`${idPrefijo}-code`}
            name="code"
            required
            maxLength={64}
            defaultValue={estado?.code}
            placeholder="COMPROMETIDA"
          />
        </GrupoCampo>

        <GrupoCampo
          etiqueta="Orden"
          htmlFor={`${idPrefijo}-position`}
          ayuda="Cuanto menor, antes aparece."
        >
          <Campo
            id={`${idPrefijo}-position`}
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={estado?.position ?? ordenPorDefecto}
          />
        </GrupoCampo>
      </div>

      <GrupoCampo
        etiqueta="Cómo viene escrito en los libros"
        htmlFor={`${idPrefijo}-aliases`}
        ayuda="Separados por comas. Además del nombre y el código, el importador reconoce estas formas."
      >
        <Campo
          id={`${idPrefijo}-aliases`}
          name="aliases"
          maxLength={500}
          defaultValue={estado?.aliases.join(', ')}
          placeholder="comprometido, comprometidas, compromiso"
        />
      </GrupoCampo>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Qué significa</legend>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="countsEconomically"
            defaultChecked={estado?.countsEconomically ?? true}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary"
          />
          <span>
            Cuenta como gasto: suma al <strong>monto considerado</strong> del portal.
            <span className="block text-xs text-muted-foreground">
              Devengada, Emitida y Comprometida sí; Anulada no.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isCancelled"
            defaultChecked={estado?.isCancelled ?? false}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary"
          />
          <span>
            Está anulada: se publica aparte y nunca suma al gasto.
            <span className="block text-xs text-muted-foreground">
              No puede contar como gasto a la vez: son excluyentes.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isUnknown"
            defaultChecked={estado?.isUnknown ?? false}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary"
          />
          <span>
            Es el estado de lo que no se reconoce: aquí caen los estados sin clasificar.
            <span className="block text-xs text-muted-foreground">
              Solo puede haber uno, y no cuenta como gasto.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={estado?.isActive ?? true}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary"
          />
          <span>
            Activo: el importador lo reconoce en los libros nuevos.
            <span className="block text-xs text-muted-foreground">
              Desactivarlo no toca lo ya importado.
            </span>
          </span>
        </label>
      </fieldset>
    </>
  );
}

function CamposTipo({
  idPrefijo,
  tipo,
  nombre,
  ordenPorDefecto,
}: {
  idPrefijo: string;
  tipo?: TipoCatalogo;
  nombre: string;
  ordenPorDefecto: number;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <GrupoCampo etiqueta="Nombre" htmlFor={`${idPrefijo}-label`} obligatorio>
          <Campo
            id={`${idPrefijo}-label`}
            name="label"
            required
            maxLength={200}
            defaultValue={tipo?.label}
            placeholder={nombre === 'tipo de orden' ? 'Orden de Compra' : 'Contrataciones hasta 8 UIT'}
          />
        </GrupoCampo>

        <GrupoCampo
          etiqueta="Código"
          htmlFor={`${idPrefijo}-code`}
          obligatorio
          ayuda="Se guarda en MAYÚSCULAS_CON_GUIONES."
        >
          <Campo
            id={`${idPrefijo}-code`}
            name="code"
            required
            maxLength={64}
            defaultValue={tipo?.code}
            placeholder={nombre === 'tipo de orden' ? 'O/C' : 'HASTA_8_UIT'}
          />
        </GrupoCampo>

        <GrupoCampo
          etiqueta="Orden"
          htmlFor={`${idPrefijo}-position`}
          ayuda="Cuanto menor, antes aparece."
        >
          <Campo
            id={`${idPrefijo}-position`}
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={tipo?.position ?? ordenPorDefecto}
          />
        </GrupoCampo>
      </div>

      <GrupoCampo
        etiqueta="Cómo viene escrito en los libros"
        htmlFor={`${idPrefijo}-aliases`}
        ayuda="Separados por comas."
      >
        <Campo
          id={`${idPrefijo}-aliases`}
          name="aliases"
          maxLength={500}
          defaultValue={tipo?.aliases.join(', ')}
        />
      </GrupoCampo>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={tipo?.isActive ?? true}
          className="h-4 w-4 rounded border-input text-primary"
        />
        Activo: el importador lo reconoce en los libros nuevos.
      </label>
    </>
  );
}

function CamposGestion({
  idPrefijo,
  gestion,
}: {
  idPrefijo: string;
  gestion?: GestionCatalogo;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <GrupoCampo etiqueta="Nombre" htmlFor={`${idPrefijo}-name`} obligatorio ayuda="Por ejemplo, 2023-2026.">
          <Campo
            id={`${idPrefijo}-name`}
            name="name"
            required
            maxLength={120}
            defaultValue={gestion?.name}
            placeholder="2023-2026"
          />
        </GrupoCampo>

        <GrupoCampo etiqueta="Empieza" htmlFor={`${idPrefijo}-start`} obligatorio>
          <Campo
            id={`${idPrefijo}-start`}
            name="startDate"
            type="date"
            required
            defaultValue={gestion?.startDate}
          />
        </GrupoCampo>

        <GrupoCampo etiqueta="Termina" htmlFor={`${idPrefijo}-end`} obligatorio>
          <Campo
            id={`${idPrefijo}-end`}
            name="endDate"
            type="date"
            required
            defaultValue={gestion?.endDate}
          />
        </GrupoCampo>
      </div>

      <GrupoCampo
        etiqueta="Descripción"
        htmlFor={`${idPrefijo}-description`}
        ayuda="Opcional. Se ve en el panel, no en el portal."
      >
        <AreaTexto
          id={`${idPrefijo}-description`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={gestion?.description ?? ''}
          placeholder="Periodo de gobierno 2023-2026"
        />
      </GrupoCampo>
    </>
  );
}

export default async function PaginaCatalogos() {
  const usuario = await usuarioActual();

  if (!usuario || !puede(usuario.role, 'imports:write')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para gestionar los catálogos">
        Tu rol actual es {usuario?.role ?? 'desconocido'}. Los catálogos deciden qué suma al gasto
        publicado, así que se mantienen con el rol ADMIN o superior.
      </Aviso>
    );
  }

  const [estados, tiposDeOrden, tiposDeContratacion, gestiones] = await Promise.all([
    listarEstados(),
    listarTiposDeOrden(),
    listarTiposDeContratacion(),
    listarGestiones(),
  ]);

  const siguiente = (posiciones: readonly number[]) =>
    posiciones.reduce((mayor, valor) => Math.max(mayor, valor), 0) + 1;

  const ordenEstados = siguiente(estados.map((estado) => estado.position));
  const ordenTiposDeOrden = siguiente(tiposDeOrden.map((tipo) => tipo.position));
  const ordenTiposDeContratacion = siguiente(tiposDeContratacion.map((tipo) => tipo.position));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Catálogos</h1>
        <p className="text-sm text-muted-foreground">
          Lo que el importador reconoce al leer un libro: estados, tipos de orden, tipos de
          contratación y gestiones. Son datos, no código: clasificar un estado nuevo no exige
          desplegar la aplicación.
        </p>
      </div>

      <Aviso tono="info" titulo="Lo que cambies aquí se ve en el portal" icono={<Info className="h-4 w-4" />}>
        El <strong>estado</strong> decide qué suma al monto considerado, así que cambiarlo mueve las
        cifras públicas al instante. Desactivar una entrada no borra nada de lo ya importado: solo
        deja de reconocerse en los libros siguientes.
      </Aviso>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Estados</h2>
          <p className="text-sm text-muted-foreground">
            El estado de cada orden decide si suma al gasto publicado. Aquí se clasifica lo que
            aparece en los libros: si un mes trae un estado nuevo, se añade una vez y deja de caer
            en «Desconocido».
          </p>
        </div>

        <TarjetaNuevo
          titulo="Nuevo estado"
          descripcion="El código no se puede repetir: es la clave con la que se reconoce en los libros."
          accion={accionCrearEstado}
          etiqueta="Crear estado"
        >
          <CamposEstado idPrefijo="nuevo-estado" ordenPorDefecto={ordenEstados} />
        </TarjetaNuevo>

        {estados.map((estado) => (
          <TarjetaElemento
            key={estado.id}
            titulo={estado.label}
            descripcion={`${estado.code} · orden ${estado.position} · ${estado.ordenes} orden(es)`}
            insignias={
              <>
                {estado.countsEconomically ? (
                  <Insignia tono="exito">cuenta como gasto</Insignia>
                ) : (
                  <Insignia tono="neutro">no cuenta</Insignia>
                )}
                {estado.isCancelled ? <Insignia tono="error">anulada</Insignia> : null}
                {estado.isUnknown ? <Insignia tono="advertencia">sin clasificar</Insignia> : null}
                {estado.isActive ? null : <Insignia tono="neutro">inactivo</Insignia>}
              </>
            }
          >
            <BloqueEdicion
              accionEliminar={accionEliminarEstado}
              id={estado.id}
              aviso={
                estado.ordenes > 0
                  ? `No se puede eliminar: ${estado.ordenes} orden(es) lo usan. Desactívalo si no quieres que se reconozca en las próximas importaciones.`
                  : 'No lo usa ninguna orden, así que se puede eliminar.'
              }
              confirmacion={`¿Eliminar el estado «${estado.label}»?`}
              etiquetaEliminar="Eliminar estado"
            >
              <FormularioAccion
                accion={accionActualizarEstado}
                etiqueta="Guardar cambios"
                variante="outline"
              >
                <input type="hidden" name="id" value={estado.id} />
                <CamposEstado
                  idPrefijo={`estado-${estado.id}`}
                  estado={estado}
                  ordenPorDefecto={estado.position}
                />
              </FormularioAccion>
            </BloqueEdicion>
          </TarjetaElemento>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Tipos de orden</h2>
          <p className="text-sm text-muted-foreground">
            La clase de documento: orden de compra, orden de servicio, y las que aparezcan.
          </p>
        </div>

        <TarjetaNuevo
          titulo="Nuevo tipo de orden"
          descripcion="El código no se puede repetir."
          accion={accionCrearTipoDeOrden}
          etiqueta="Crear tipo de orden"
        >
          <CamposTipo
            idPrefijo="nuevo-tipo-orden"
            nombre="tipo de orden"
            ordenPorDefecto={ordenTiposDeOrden}
          />
        </TarjetaNuevo>

        {tiposDeOrden.map((tipo) => (
          <TarjetaElemento
            key={tipo.id}
            titulo={tipo.label}
            descripcion={`${tipo.code} · orden ${tipo.position} · ${tipo.ordenes} orden(es)`}
            insignias={
              tipo.isActive ? (
                <Insignia tono="exito">activo</Insignia>
              ) : (
                <Insignia tono="neutro">inactivo</Insignia>
              )
            }
          >
            <BloqueEdicion
              accionEliminar={accionEliminarTipoDeOrden}
              id={tipo.id}
              aviso={
                tipo.ordenes > 0
                  ? `No se puede eliminar: ${tipo.ordenes} orden(es) lo usan. Desactívalo si no quieres que se reconozca en las próximas importaciones.`
                  : 'No lo usa ninguna orden, así que se puede eliminar.'
              }
              confirmacion={`¿Eliminar el tipo de orden «${tipo.label}»?`}
              etiquetaEliminar="Eliminar tipo de orden"
            >
              <FormularioAccion
                accion={accionActualizarTipoDeOrden}
                etiqueta="Guardar cambios"
                variante="outline"
              >
                <input type="hidden" name="id" value={tipo.id} />
                <CamposTipo
                  idPrefijo={`tipo-orden-${tipo.id}`}
                  tipo={tipo}
                  nombre="tipo de orden"
                  ordenPorDefecto={tipo.position}
                />
              </FormularioAccion>
            </BloqueEdicion>
          </TarjetaElemento>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Tipos de contratación</h2>
          <p className="text-sm text-muted-foreground">
            El régimen por el que se contrató: hasta 8 UIT, proceso de selección, y los que
            aparezcan en los libros.
          </p>
        </div>

        <TarjetaNuevo
          titulo="Nuevo tipo de contratación"
          descripcion="El código no se puede repetir."
          accion={accionCrearTipoDeContratacion}
          etiqueta="Crear tipo de contratación"
        >
          <CamposTipo
            idPrefijo="nuevo-tipo-contrato"
            nombre="tipo de contratación"
            ordenPorDefecto={ordenTiposDeContratacion}
          />
        </TarjetaNuevo>

        {tiposDeContratacion.map((tipo) => (
          <TarjetaElemento
            key={tipo.id}
            titulo={tipo.label}
            descripcion={`${tipo.code} · orden ${tipo.position} · ${tipo.ordenes} orden(es)`}
            insignias={
              tipo.isActive ? (
                <Insignia tono="exito">activo</Insignia>
              ) : (
                <Insignia tono="neutro">inactivo</Insignia>
              )
            }
          >
            <BloqueEdicion
              accionEliminar={accionEliminarTipoDeContratacion}
              id={tipo.id}
              aviso={
                tipo.ordenes > 0
                  ? `No se puede eliminar: ${tipo.ordenes} orden(es) lo usan. Desactívalo si no quieres que se reconozca en las próximas importaciones.`
                  : 'No lo usa ninguna orden, así que se puede eliminar.'
              }
              confirmacion={`¿Eliminar el tipo de contratación «${tipo.label}»?`}
              etiquetaEliminar="Eliminar tipo de contratación"
            >
              <FormularioAccion
                accion={accionActualizarTipoDeContratacion}
                etiqueta="Guardar cambios"
                variante="outline"
              >
                <input type="hidden" name="id" value={tipo.id} />
                <CamposTipo
                  idPrefijo={`tipo-contrato-${tipo.id}`}
                  tipo={tipo}
                  nombre="tipo de contratación"
                  ordenPorDefecto={tipo.position}
                />
              </FormularioAccion>
            </BloqueEdicion>
          </TarjetaElemento>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Gestiones</h2>
          <p className="text-sm text-muted-foreground">
            Los periodos de gobierno. Cada orden se asigna a la gestión en la que cae su fecha de
            emisión: si las fechas están mal, las órdenes se reasignan solas al corregirlas.
          </p>
        </div>

        <TarjetaNuevo
          titulo="Nueva gestión"
          descripcion="El nombre no se puede repetir."
          accion={accionCrearGestion}
          etiqueta="Crear gestión"
        >
          <CamposGestion idPrefijo="nueva-gestion" />
        </TarjetaNuevo>

        {gestiones.map((gestion) => (
          <TarjetaElemento
            key={gestion.id}
            titulo={gestion.name}
            descripcion={`${gestion.startDate} a ${gestion.endDate} · ${gestion.ordenes} orden(es)`}
            insignias={
              <>
                {gestion.ordenes > 0 ? (
                  <Insignia tono="info">en uso</Insignia>
                ) : (
                  <Insignia tono="neutro">sin órdenes</Insignia>
                )}
              </>
            }
          >
            <BloqueEdicion
              accionEliminar={accionEliminarGestion}
              id={gestion.id}
              aviso={
                gestion.ordenes + gestion.resumenes + gestion.lotes > 0
                  ? `No se puede eliminar: la usan ${gestion.ordenes} orden(es), ${gestion.resumenes} resumen(es) y ${gestion.lotes} lote(s).`
                  : 'No la usa nada, así que se puede eliminar.'
              }
              confirmacion={`¿Eliminar la gestión «${gestion.name}»?`}
              etiquetaEliminar="Eliminar gestión"
            >
              <FormularioAccion
                accion={accionActualizarGestion}
                etiqueta="Guardar cambios"
                variante="outline"
              >
                <input type="hidden" name="id" value={gestion.id} />
                <CamposGestion idPrefijo={`gestion-${gestion.id}`} gestion={gestion} />
              </FormularioAccion>
            </BloqueEdicion>
          </TarjetaElemento>
        ))}
      </section>
    </div>
  );
}
