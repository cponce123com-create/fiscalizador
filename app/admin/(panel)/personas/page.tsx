import { BusquedaEnVivo } from '@/components/publico/busqueda-en-vivo';
import type { Metadata } from 'next';
import { Info, Search, UserRoundPlus, Users } from 'lucide-react';
import Link from 'next/link';

import {
  accionActualizarPersona,
  accionCrearPersona,
  accionDesvincularProveedor,
  accionEliminarPersona,
  accionVincularProveedor,
} from '@/app/admin/personas/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { Boton } from '@/components/ui/button';
import {
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
} from '@/components/ui/card';
import {
  Aviso,
  EstadoVacio,
  Insignia,
  Tabla,
  TablaCelda,
  TablaCeldaEncabezado,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from '@/components/ui/data';
import { AreaTexto, Campo, Etiqueta, GrupoCampo } from '@/components/ui/form';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import { NoEncontrado } from '@/lib/errors';
import { formatearFechaHora, formatearMonto } from '@/lib/utils';
import {
  listarEtiquetas,
  listarPersonas,
  opcionesDeProveedor,
  personaPorId,
  proveedoresVinculados,
  type EtiquetaPersona,
  type PersonaDetalle,
  type ProveedorVinculado,
} from '@/services/personsService';

export const metadata: Metadata = {
  title: 'Personas',
};

/**
 * Registro de personas señaladas y de los proveedores que se les vinculan.
 *
 * El vínculo con los proveedores NO se escribe a mano: se deduce del DNI, que en
 * una persona natural viaja dentro de su RUC (`10 + DNI + dígito verificador`). Lo
 * que se declara a mano es la ficha de la persona (quién es y por qué se la
 * señala) y, cuando el DNI no basta, el vínculo con una empresa.
 *
 * La ficha abierta se elige por la URL (`?ficha=`), no con estado en el navegador:
 * así se puede enlazar a una persona concreta y el listado no carga los vínculos de
 * todas a la vez.
 */

/** Campos de una ficha. Se comparten entre el alta y la edición. */
function CamposPersona({
  idPrefijo,
  etiquetas,
  persona,
}: {
  idPrefijo: string;
  etiquetas: readonly EtiquetaPersona[];
  persona?: {
    dni: string;
    fullName: string;
    description: string;
    source: string;
    sourceUrl: string | null;
    isPublic: boolean;
    etiquetas: readonly { id: string }[];
  };
}) {
  const marcadas = new Set(persona?.etiquetas.map((etiqueta) => etiqueta.id) ?? []);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <GrupoCampo
          etiqueta="DNI"
          htmlFor={`${idPrefijo}-dni`}
          obligatorio
          ayuda="Ocho dígitos. Es el puente con los proveedores: no se publica."
        >
          <Campo
            id={`${idPrefijo}-dni`}
            name="dni"
            inputMode="numeric"
 …82 tokens truncated…     name="fullName"
            required
            maxLength={200}
            defaultValue={persona?.fullName}
            placeholder="Nombres y apellidos"
          />
        </GrupoCampo>
      </div>

      <GrupoCampo
        etiqueta="Descripción"
        htmlFor={`${idPrefijo}-descripcion`}
        obligatorio
        ayuda="Qué se afirma de esta persona. Es lo que verá cualquiera en el portal."
      >
        <AreaTexto
          id={`${idPrefijo}-descripcion`}
          name="description"
          required
          maxLength={4000}
          defaultValue={persona?.description}
          placeholder="Postuló a regidor por la agrupación X en las elecciones de 2022."
        />
      </GrupoCampo>

      <GrupoCampo
        etiqueta="Fuente"
        htmlFor={`${idPrefijo}-fuente`}
        obligatorio
        ayuda="De dónde sale el dato: un acta, una resolución, una nota de prensa. Para publicar se exige que sea concreta."
      >
        <Campo
          id={`${idPrefijo}-fuente`}
          name="source"
          required
          maxLength={500}
          defaultValue={persona?.source}
          placeholder="Acta de proclamación de candidatos, Jurado Nacional de Elecciones."
        />
      </GrupoCampo>

      <GrupoCampo
        etiqueta="Enlace a la fuente"
        htmlFor={`${idPrefijo}-fuente-url`}
        ayuda="Opcional. Si la fuente está en internet, el enlace permite comprobarla."
      >
        <Campo
          id={`${idPrefijo}-fuente-url`}
          name="sourceUrl"
          type="url"
          maxLength={500}
          defaultValue={persona?.sourceUrl ?? ''}
          placeholder="https://ejemplo.pe/acta-de-proclamacion.pdf"
        />
      </GrupoCampo>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Etiquetas</legend>

        {etiquetas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay etiquetas.{' '}
            <Link href="/admin/etiquetas" className="underline underline-offset-2">
              Crea la primera
            </Link>{' '}
            para poder agrupar después («cuánto ganan los comunicadores»).
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {etiquetas.map((etiqueta) => (
              <label key={etiqueta.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={etiqueta.id}
                  defaultChecked={marcadas.has(etiqueta.id)}
                  className="h-4 w-4 rounded border-input text-primary"
                />
                {etiqueta.label}
                {etiqueta.isActive ? null : (
                  <span className="text-xs text-muted-foreground">(inactiva)</span>
                )}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={persona?.isPublic ?? false}
          className="mt-0.5 h-4 w-4 rounded border-input text-primary"
        />
        <span>
          Publicar en la sección «Vínculos declarados» del portal
          <span className="block text-xs text-muted-foreground">
            Desmarcada por defecto: una ficha se publica cuando alguien lo decide. Para publicar
            hace falta una fuente concreta (al menos 12 caracteres) y que la ficha señale a algún
            proveedor; sin vínculos no sale al portal aunque esté marcada.
          </span>
        </span>
      </label>
    </>
  );
}

export default async function PaginaPersonas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ficha?: string }>;
}) {
  const usuario = await usuarioActual();

  if (!usuario || !puede(usuario.role, 'persons:read')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para ver el registro de personas">
        Tu rol actual es {usuario?.role ?? 'desconocido'}. El registro contiene DNIs, así que solo lo
        ven los roles EDITOR y superiores.
      </Aviso>
    );
  }

  const puedeEscribir = puede(usuario.role, 'persons:write');
  const params = await searchParams;
  const texto = (params.q ?? '').trim().slice(0, 100);
  const fichaId = (params.ficha ?? '').trim();

  const [personas, etiquetas, proveedores] = await Promise.all([
    listarPersonas({ texto }),
    listarEtiquetas(),
    opcionesDeProveedor(),
  ]);

  // La ficha pedida por la URL puede no existir (un enlace viejo, por ejemplo). En ese
  // caso se sigue mostrando el listado en lugar de romper la página.
  let ficha: PersonaDetalle | null = null;
  let vinculos: ProveedorVinculado[] = [];

  if (fichaId) {
    try {
      [ficha, vinculos] = await Promise.all([
        personaPorId(fichaId),
        proveedoresVinculados(fichaId),
      ]);
    } catch (error) {
      if (!(error instanceof NoEncontrado)) throw error;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Personas y vínculos</h1>
        <p className="text-sm text-muted-foreground">
          Registro de personas señaladas por la administración. El vínculo con un proveedor se
          deduce del DNI que lleva dentro su RUC, así que no hay que buscarlo a mano.
        </p>
      </div>

      <Aviso tono="info" titulo="Lo que se publica y lo que no" icono={<Info className="h-4 w-4" />}>
        En <Link href="/vinculos" className="underline underline-offset-2">Vínculos declarados</Link>{' '}
        se publican el nombre, la descripción, la fuente y, si la hay, su enlace, junto con los
        proveedores vinculados y cuánto han recibido. Una ficha solo sale al portal si está
        <strong> publicada</strong>, tiene una <strong>fuente concreta</strong> y señala a
        <strong> algún proveedor</strong>. El DNI no se publica nunca. Cada alta, cambio y baja
        queda en la auditoría.
      </Aviso>

      {puedeEscribir ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Añadir una persona</TarjetaTitulo>
            <TarjetaDescripcion>
              El ingreso es manual: DNI, nombre y descripción. Con el DNI, el sistema encuentra solo a
              los proveedores que son personas naturales.
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido>
            <FormularioAccion accion={accionCrearPersona} etiqueta="Guardar ficha">
              <CamposPersona idPrefijo="nueva" etiquetas={etiquetas} />
            </FormularioAccion>
          </TarjetaContenido>
        </Tarjeta>
      ) : (
        <Aviso tono="advertencia" titulo="Puedes consultar, pero no editar">
          El registro se mantiene con el rol ADMIN o superior.
        </Aviso>
      )}

      {ficha ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <TarjetaTitulo>{ficha.fullName}</TarjetaTitulo>
                <TarjetaDescripcion>
                  DNI {ficha.dni} · {ficha.etiquetas.map((etiqueta) => etiqueta.label).join(', ') || 'sin etiquetas'} ·{' '}
                  {vinculos.length} proveedor(es) vinculado(s)
                  {ficha.verifiedAt
                    ? ` · fuente verificada el ${formatearFechaHora(ficha.verifiedAt)}`
                    : ''}
                </TarjetaDescripcion>
              </div>

              <div className="flex items-center gap-3">
                {!ficha.isPublic ? (
                  <Insignia tono="neutro">oculta</Insignia>
                ) : vinculos.length > 0 ? (
                  <Insignia tono="exito">publicada</Insignia>
                ) : (
                  <Insignia tono="advertencia">sin vínculos: no se publica</Insignia>
                )}

                <Link
                  href={texto ? `/admin/personas?q=${encodeURIComponent(texto)}` : '/admin/personas'}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Cerrar ficha
                </Link>
              </div>
            </div>
          </TarjetaEncabezado>

          <TarjetaContenido className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Proveedores vinculados</h2>

              {vinculos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ningún proveedor coincide con este DNI. Si la persona es titular de una empresa,
                  añade el vínculo a mano aquí abajo.
                </p>
              ) : (
                <Tabla>
                  <TablaEncabezado>
                    <TablaFila>
                      <TablaCeldaEncabezado>Proveedor</TablaCeldaEncabezado>
                      <TablaCeldaEncabezado>RUC</TablaCeldaEncabezado>
                      <TablaCeldaEncabezado>Vínculo</TablaCeldaEncabezado>
                      <TablaCeldaEncabezado className="text-right">Órdenes</TablaCeldaEncabezado>
                      <TablaCeldaEncabezado className="text-right">Considerado</TablaCeldaEncabezado>
                      {puedeEscribir ? <TablaCeldaEncabezado /> : null}
                    </TablaFila>
                  </TablaEncabezado>

                  <TablaCuerpo>
                    {vinculos.map((vinculo) => (
                      <TablaFila key={vinculo.supplierId}>
                        <TablaCelda>
                          <Link
                            href={`/proveedores/${vinculo.slug}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {vinculo.nombre}
                          </Link>
                          {vinculo.nota ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {vinculo.nota}
                            </span>
                          ) : null}
                        </TablaCelda>

                        <TablaCelda className="tabular">{vinculo.ruc}</TablaCelda>

                        <TablaCelda>
                          {vinculo.origen === 'AUTOMATICO' ? (
                            <Insignia tono="info">por el DNI</Insignia>
                          ) : (
                            <Insignia tono="neutro">a mano</Insignia>
                          )}
                        </TablaCelda>

                        <TablaCelda className="tabular text-right">{vinculo.ordenes}</TablaCelda>

                        <TablaCelda className="tabular text-right font-medium">
                          {formatearMonto(vinculo.considerado)}
                        </TablaCelda>

                        {puedeEscribir ? (
                          <TablaCelda className="text-right">
                            {vinculo.origen === 'MANUAL' ? (
                              <FormularioAccion
                                accion={accionDesvincularProveedor}
                                etiqueta="Quitar"
                                variante="outline"
                                size="sm"
                                className="items-end gap-1"
                                confirmar="¿Quitar este vínculo manual?"
                              >
                                <input type="hidden" name="linkId" value={enlaceManual(ficha, vinculo.supplierId)} />
                              </FormularioAccion>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                se deduce del DNI
                              </span>
                            )}
                          </TablaCelda>
                        ) : null}
                      </TablaFila>
                    ))}
                  </TablaCuerpo>
                </Tabla>
              )}
            </div>

            {puedeEscribir ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <h2 className="text-sm font-semibold">Añadir un vínculo manual</h2>
                <p className="text-xs text-muted-foreground">
                  Para lo que el DNI no alcanza: una empresa de la que la persona es titular, por
                  ejemplo.
                </p>

                <FormularioAccion
                  accion={accionVincularProveedor}
                  etiqueta="Vincular proveedor"
                  variante="outline"
                  size="sm"
                  className="gap-3"
                >
                  <input type="hidden" name="personId" value={ficha.id} />

                  <div className="flex flex-wrap items-end gap-3">
                    <GrupoCampo etiqueta="RUC" htmlFor="vinculo-ruc" obligatorio>
                      <Campo
                        id="vinculo-ruc"
                        name="ruc"
                        list="proveedores-sugeridos"
                        inputMode="numeric"
                        maxLength={11}
                        required
                        placeholder="20541487710"
                        className="w-48"
                      />
                    </GrupoCampo>

                    <GrupoCampo etiqueta="Descripción documentada del vínculo" htmlFor="vinculo-nota" obligatorio>
                      <Campo
                        id="vinculo-nota"
                        name="note"
                        required
                        minLength={12}
                        maxLength={500}
                        placeholder="Titular de la empresa"
                        className="w-64"
                      />
                    </GrupoCampo>
                  </div>

                  <GrupoCampo etiqueta="URL de evidencia del vínculo" htmlFor="linkSourceUrl" obligatorio><Campo id="linkSourceUrl" name="linkSourceUrl" type="url" required maxLength={500} /></GrupoCampo>
                  <GrupoCampo etiqueta="Vigencia desde (si está documentada)" htmlFor="validFrom"><Campo id="validFrom" name="validFrom" type="date" /></GrupoCampo>
                  <GrupoCampo etiqueta="Vigencia hasta (si está documentada)" htmlFor="validUntil"><Campo id="validUntil" name="validUntil" type="date" /></GrupoCampo>
                  <datalist id="proveedores-sugeridos">
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.ruc} value={proveedor.ruc}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </datalist>
                </FormularioAccion>
              </div>
            ) : null}

            {puedeEscribir ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <h2 className="text-sm font-semibold">Editar la ficha</h2>

                <FormularioAccion
                  accion={accionActualizarPersona}
                  etiqueta="Guardar cambios"
                  variante="outline"
                >
                  <input type="hidden" name="id" value={ficha.id} />
                  <CamposPersona idPrefijo="editar" etiquetas={etiquetas} persona={ficha} />
                </FormularioAccion>
              </div>
            ) : null}

            {puedeEscribir ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h2 className="text-sm font-semibold text-destructive">Eliminar la ficha</h2>
                <p className="text-xs text-muted-foreground">
                  Se borran sus etiquetas y sus vínculos manuales. Las órdenes del portal no se
                  tocan. La baja queda registrada en la auditoría.
                </p>

                <FormularioAccion
                  accion={accionEliminarPersona}
                  etiqueta="Eliminar ficha"
                  variante="destructive"
                  size="sm"
                  className="items-start"
                  confirmar={`¿Eliminar la ficha de ${ficha.fullName}? Esta acción no se puede deshacer.`}
                >
                  <input type="hidden" name="id" value={ficha.id} />
                </FormularioAccion>
              </div>
            ) : null}
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <BusquedaEnVivo ruta="/admin/personas" consulta={new URLSearchParams({ ...(texto ? { q: texto } : {}), ...(params.ficha ? { ficha: params.ficha } : {}) }).toString()} className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <Etiqueta htmlFor="q">Buscar</Etiqueta>
          <Campo
            id="q"
            name="q"
            type="search"
            defaultValue={texto}
            placeholder="Nombre, DNI o descripción"
          />
        </div>

        <Boton type="submit" variant="outline">
          <Search className="h-4 w-4" aria-hidden="true" />
          Filtrar
        </Boton>

        {texto ? (
          <Link
            href="/admin/personas"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Limpiar
          </Link>
        ) : null}
      </BusquedaEnVivo>

      {personas.length === 0 ? (
        <EstadoVacio
          titulo={texto ? 'Ninguna persona coincide con la búsqueda' : 'Todavía no hay personas'}
          descripcion={
            texto
              ? 'Prueba con otro nombre o con el DNI.'
              : 'Añade la primera ficha con el formulario de arriba: DNI, nombre y descripción.'
          }
          icono={texto ? <Search className="h-8 w-8" aria-hidden="true" /> : <Users className="h-8 w-8" aria-hidden="true" />}
        />
      ) : (
        <Tabla>
          <TablaEncabezado>
            <TablaFila>
              <TablaCeldaEncabezado>Nombre</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>DNI</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Etiquetas</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Proveedores</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Portal</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Ficha</TablaCeldaEncabezado>
            </TablaFila>
          </TablaEncabezado>

          <TablaCuerpo>
            {personas.map((persona) => (
              <TablaFila key={persona.id}>
                <TablaCelda>
                  <span className="font-medium">{persona.fullName}</span>
                  <span className="mt-0.5 block max-w-[26rem] truncate text-xs text-muted-foreground" title={persona.description}>
                    {persona.description}
                  </span>
                </TablaCelda>

                <TablaCelda className="tabular">{persona.dni}</TablaCelda>

                <TablaCelda>
                  {persona.etiquetas.length === 0 ? (
                    <span className="text-xs text-muted-foreground">sin etiquetas</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {persona.etiquetas.map((etiqueta) => (
                        <Insignia key={etiqueta.id} tono="neutro">
                          {etiqueta.label}
                        </Insignia>
                      ))}
                    </span>
                  )}
                </TablaCelda>

                <TablaCelda className="tabular text-right">{persona.proveedores}</TablaCelda>

                <TablaCelda>
                  {!persona.isPublic ? (
                    <Insignia tono="neutro">oculta</Insignia>
                  ) : persona.proveedores > 0 ? (
                    <Insignia tono="exito">publicada</Insignia>
                  ) : (
                    <Insignia tono="advertencia">sin vínculos: no se publica</Insignia>
                  )}
                </TablaCelda>

                <TablaCelda className="text-right">
                  <Link
                    href={`/admin/personas?${texto ? `q=${encodeURIComponent(texto)}&` : ''}ficha=${persona.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                  >
                    <UserRoundPlus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Abrir
                  </Link>
                </TablaCelda>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}
    </div>
  );
}

/** Identificador del vínculo manual que corresponde a un proveedor de la ficha. */
function enlaceManual(ficha: { vinculosManuales: readonly { id: string; supplierId: string }[] }, supplierId: string): string {
  return ficha.vinculosManuales.find((enlace) => enlace.supplierId === supplierId)?.id ?? '';
}
