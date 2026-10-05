import type { Metadata } from 'next';
import { Info, Tags } from 'lucide-react';
import Link from 'next/link';

import {
  accionActualizarEtiqueta,
  accionCrearEtiqueta,
  accionEliminarEtiqueta,
} from '@/app/admin/etiquetas/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import {
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
} from '@/components/ui/card';
import { Aviso, EstadoVacio, Insignia } from '@/components/ui/data';
import { Campo, GrupoCampo } from '@/components/ui/form';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import { listarEtiquetas, type EtiquetaPersona } from '@/services/personsService';

export const metadata: Metadata = {
  title: 'Etiquetas',
};

/**
 * Catálogo de etiquetas de personas.
 *
 * Es un catálogo y no texto libre porque de él salen las sumas del portal: «cuánto
 * ganan los comunicadores» solo cuadra si la etiqueta se escribe siempre igual. El
 * código se normaliza en el servicio, así que da igual cómo se teclee aquí.
 *
 * Una etiqueta inactiva o no pública sigue existiendo y sus vínculos se conservan:
 * simplemente deja de aparecer en el portal.
 */

function CamposEtiqueta({
  idPrefijo,
  etiqueta,
  ordenPorDefecto,
}: {
  idPrefijo: string;
  etiqueta?: EtiquetaPersona;
  ordenPorDefecto: number;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <GrupoCampo
          etiqueta="Nombre"
          htmlFor={`${idPrefijo}-label`}
          obligatorio
          ayuda="Es lo que se lee en el portal."
        >
          <Campo
            id={`${idPrefijo}-label`}
            name="label"
            required
            maxLength={120}
            defaultValue={etiqueta?.label}
            placeholder="Comunicador"
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
            defaultValue={etiqueta?.code}
            placeholder="COMUNICADOR"
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
            defaultValue={etiqueta?.position ?? ordenPorDefecto}
          />
        </GrupoCampo>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={etiqueta?.isActive ?? true}
            className="h-4 w-4 rounded border-input text-primary"
          />
          Activa (se puede asignar a personas)
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={etiqueta?.isPublic ?? true}
            className="h-4 w-4 rounded border-input text-primary"
          />
          Visible en el portal
        </label>
      </div>
    </>
  );
}

export default async function PaginaEtiquetas() {
  const usuario = await usuarioActual();

  if (!usuario || !puede(usuario.role, 'persons:read')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para ver las etiquetas">
        Tu rol actual es {usuario?.role ?? 'desconocido'}.
      </Aviso>
    );
  }

  const puedeEscribir = puede(usuario.role, 'persons:write');
  const etiquetas = await listarEtiquetas({ incluirInactivas: true });

  const siguienteOrden = etiquetas.reduce(
    (mayor, etiqueta) => Math.max(mayor, etiqueta.position),
    0,
  ) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">
          Cómo se agrupan las personas señaladas: comunicadores, postulantes a regidor, aportantes de
          campaña… De aquí salen las sumas por etiqueta de la sección pública.
        </p>
      </div>

      <Aviso tono="info" titulo="Una etiqueta no borra nada" icono={<Info className="h-4 w-4" />}>
        Desactivar o despublicar una etiqueta la quita del portal, pero conserva las personas que la
        llevan y sus vínculos. Solo eliminarla deshace las asignaciones.
      </Aviso>

      {puedeEscribir ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Nueva etiqueta</TarjetaTitulo>
            <TarjetaDescripcion>
              El código no se puede repetir: es la clave con la que se agrupan las sumas.
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido>
            <FormularioAccion accion={accionCrearEtiqueta} etiqueta="Crear etiqueta">
              <CamposEtiqueta idPrefijo="nueva" ordenPorDefecto={siguienteOrden} />
            </FormularioAccion>
          </TarjetaContenido>
        </Tarjeta>
      ) : (
        <Aviso tono="advertencia" titulo="Puedes consultar, pero no editar">
          El catálogo se mantiene con el rol ADMIN o superior.
        </Aviso>
      )}

      {etiquetas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay etiquetas"
          descripcion="Crea la primera con el formulario de arriba: por ejemplo, «Comunicador»."
          icono={<Tags className="h-8 w-8" aria-hidden="true" />}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {etiquetas.map((etiqueta) => (
            <Tarjeta key={etiqueta.id}>
              <TarjetaEncabezado>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <TarjetaTitulo>{etiqueta.label}</TarjetaTitulo>
                    <TarjetaDescripcion>
                      {etiqueta.code} · orden {etiqueta.position} · {etiqueta.personas} persona(s)
                    </TarjetaDescripcion>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {etiqueta.isActive ? (
                      <Insignia tono="exito">activa</Insignia>
                    ) : (
                      <Insignia tono="neutro">inactiva</Insignia>
                    )}

                    {etiqueta.isPublic ? (
                      <Insignia tono="info">en el portal</Insignia>
                    ) : (
                      <Insignia tono="neutro">oculta</Insignia>
                    )}
                  </div>
                </div>
              </TarjetaEncabezado>

              {puedeEscribir ? (
                <TarjetaContenido>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Editar
                    </summary>

                    <div className="mt-4 flex flex-col gap-6">
                      <FormularioAccion
                        accion={accionActualizarEtiqueta}
                        etiqueta="Guardar cambios"
                        variante="outline"
                      >
                        <input type="hidden" name="id" value={etiqueta.id} />
                        <CamposEtiqueta
                          idPrefijo={`editar-${etiqueta.id}`}
                          etiqueta={etiqueta}
                          ordenPorDefecto={etiqueta.position}
                        />
                      </FormularioAccion>

                      <div className="flex flex-col gap-2 border-t border-border pt-4">
                        <p className="text-xs text-muted-foreground">
                          Eliminarla deshace sus asignaciones ({etiqueta.personas} persona(s)). Las
                          fichas de esas personas se conservan.
                        </p>

                        <FormularioAccion
                          accion={accionEliminarEtiqueta}
                          etiqueta="Eliminar etiqueta"
                          variante="destructive"
                          size="sm"
                          className="items-start"
                          confirmar={`¿Eliminar la etiqueta «${etiqueta.label}»?`}
                        >
                          <input type="hidden" name="id" value={etiqueta.id} />
                        </FormularioAccion>
                      </div>
                    </div>
                  </details>
                </TarjetaContenido>
              ) : null}
            </Tarjeta>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Las etiquetas se asignan desde{' '}
        <Link href="/admin/personas" className="underline underline-offset-2">
          Personas
        </Link>
        .
      </p>
    </div>
  );
}
