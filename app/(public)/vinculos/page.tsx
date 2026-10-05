import type { Metadata } from 'next';
import { Info, Scale } from 'lucide-react';
import Link from 'next/link';

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
import { Seccion } from '@/components/ui/seccion';
import { formatearFechaHora, formatearMonto } from '@/lib/utils';
import { detalleDeEtiqueta, resumenVinculos, vinculosPorEtiqueta } from '@/services/personsService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vínculos declarados',
  description:
    'Proveedores de la municipalidad vinculados con personas señaladas por la administración del portal: aportantes de campaña, postulantes a regidor, comunicadores y familiares de políticos.',
};

/**
 * Sección pública de vínculos declarados.
 *
 * Publica dos cosas distintas y conviene no confundirlas:
 *
 *  - Un HECHO verificable: el proveedor y su gasto, que ya están en el resto del
 *    portal y salen de los libros oficiales.
 *  - Una AFIRMACIÓN de la administración: que ese proveedor está relacionado con
 *    una persona concreta. Por eso cada ficha lleva descripción y fuente, y la
 *    página avisa de que no es una conclusión legal.
 *
 * El DNI no aparece nunca aquí: solo el nombre, lo que se afirma y de dónde sale
 * (Ley 29733 de protección de datos personales).
 */
export default async function PaginaVinculos() {
  const [resumen, porEtiqueta] = await Promise.all([resumenVinculos(), vinculosPorEtiqueta()]);

  // Solo se pide el detalle de las etiquetas que tienen algo que mostrar.
  const conDatos = porEtiqueta.filter((etiqueta) => etiqueta.proveedores > 0);
  const detalles = await Promise.all(
    conDatos.map(async (etiqueta) => ({
      etiqueta,
      ...(await detalleDeEtiqueta(etiqueta.tagId)),
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Vínculos declarados</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Proveedores que contrataron con la municipalidad y que la administración de este portal ha
          vinculado con personas señaladas: aportantes de campaña, postulantes a regidor, comunicadores
          o familiares de políticos.
        </p>
      </header>

      <Aviso tono="advertencia" titulo="Qué es y qué no es esta sección" icono={<Scale className="h-5 w-5" />}>
        <p>
          Los vínculos de esta página los <strong>declara la administración del portal</strong> a partir
          de información pública y de sus propios registros. Cada ficha indica qué se afirma y de dónde
          sale. <strong>No es una conclusión legal, ni una imputación, ni una prueba de delito.</strong>
        </p>
        <p className="mt-2">
          Los montos son los mismos que ya publican las demás secciones del portal y salen de los libros
          del Portal de Transparencia. El DNI de las personas no se publica.
        </p>
      </Aviso>

      <p className="max-w-3xl text-sm text-muted-foreground">
        Cada proveedor dice cómo se le vincula. <strong>Deducido del RUC</strong> significa que el DNI
        de la persona aparece dentro del RUC del proveedor: es un dato comprobable con el número, no
        una afirmación de nadie. <strong>Declarado</strong> significa que la administración afirmó el
        vínculo a mano, y es el que hay que revisar si se cree incorrecto.
      </p>

      {conDatos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay vínculos declarados"
          descripcion="Cuando la administración registre personas señaladas, aquí aparecerán los proveedores vinculados y cuánto han recibido."
          icono={<Info className="h-8 w-8" aria-hidden="true" />}
        />
      ) : (
        <>
          <section aria-labelledby="titulo-resumen" className="flex flex-col gap-4">
            <h2 id="titulo-resumen" className="sr-only">
              Resumen de los vínculos declarados
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Cifra
                etiqueta="Personas señaladas"
                valor={resumen.personas.toLocaleString('es-PE')}
              />
              <Cifra
                etiqueta="Proveedores vinculados"
                valor={resumen.proveedores.toLocaleString('es-PE')}
              />
              <Cifra etiqueta="Órdenes" valor={resumen.ordenes.toLocaleString('es-PE')} />
              <Cifra
                etiqueta="Monto considerado"
                valor={formatearMonto(resumen.considerado)}
                destacado
              />
            </div>

            <p className="text-xs text-muted-foreground">
              El monto considerado excluye las órdenes anuladas y las de estados que no generan gasto,
              igual que en el resto del portal. Un proveedor vinculado a dos personas cuenta una sola vez.
            </p>
          </section>

          {detalles.map(({ etiqueta, personas, proveedores }) => (
            <Seccion
              key={etiqueta.tagId}
              titulo={etiqueta.label}
              descripcion={`${etiqueta.proveedores} proveedor(es) · ${etiqueta.ordenes} orden(es) · ${formatearMonto(etiqueta.considerado)}`}
            >
              <Tabla>
                <TablaEncabezado>
                  <TablaFila>
                    <TablaCeldaEncabezado>Proveedor</TablaCeldaEncabezado>
                    <TablaCeldaEncabezado>RUC</TablaCeldaEncabezado>
                    <TablaCeldaEncabezado className="text-right">Órdenes</TablaCeldaEncabezado>
                    <TablaCeldaEncabezado className="text-right">Considerado</TablaCeldaEncabezado>
                    <TablaCeldaEncabezado>Señalado por</TablaCeldaEncabezado>
                  </TablaFila>
                </TablaEncabezado>

                <TablaCuerpo>
                  {proveedores.map((proveedor) => (
                    <TablaFila key={proveedor.supplierId}>
                      <TablaCelda>
                        <Link
                          href={`/proveedores/${proveedor.slug}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {proveedor.nombre}
                        </Link>
                      </TablaCelda>

                      <TablaCelda className="tabular">{proveedor.ruc}</TablaCelda>

                      <TablaCelda className="tabular text-right">{proveedor.ordenes}</TablaCelda>

                      <TablaCelda className="tabular text-right font-medium">
                        {formatearMonto(proveedor.considerado)}
                      </TablaCelda>

                      <TablaCelda className="text-sm">
                        {proveedor.deducidos.length > 0 ? (
                          <span className="block">
                            {proveedor.deducidos.join(', ')}{' '}
                            <span className="text-xs text-muted-foreground">
                              (deducido del RUC)
                            </span>
                          </span>
                        ) : null}
                        {proveedor.declarados.length > 0 ? (
                          <span className="block">
                            {proveedor.declarados.join(', ')}{' '}
                            <span className="text-xs text-muted-foreground">(declarado)</span>
                          </span>
                        ) : null}
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold">Fichas de esta etiqueta</h3>

                <ul className="flex flex-col gap-4">
                  {personas.map((persona) => (
                    <li key={persona.id} id={persona.slug} className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {persona.fullName}
                        <Insignia tono="neutro" className="ml-2">
                          afirmación de la administración
                        </Insignia>
                      </p>
                      <p className="text-sm text-muted-foreground">{persona.description}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Fuente:</span> {persona.source}
                        {persona.sourceUrl ? (
                          <>
                            {' · '}
                            <a
                              href={persona.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              ver la fuente
                            </a>
                          </>
                        ) : null}
                        {persona.verifiedAt
                          ? ` · verificada el ${formatearFechaHora(persona.verifiedAt)}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Seccion>
          ))}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        ¿Crees que algún vínculo es incorrecto? Consulta la{' '}
        <Link href="/metodologia" className="underline underline-offset-2">
          metodología
        </Link>{' '}
        y cómo reclamar una corrección.
      </p>
    </div>
  );
}

/** Cifra del resumen. El monto considerado se destaca: es la cifra que se viene a ver. */
function Cifra({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={
        destacado
          ? 'rounded-lg border border-primary/30 bg-card p-5 shadow-sm ring-1 ring-primary/15'
          : 'rounded-lg border border-border bg-card p-5 shadow-sm'
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p
        className={
          destacado
            ? 'tabular mt-2 text-2xl font-semibold text-primary'
            : 'tabular mt-2 text-2xl font-semibold text-foreground'
        }
      >
        {valor}
      </p>
    </div>
  );
}
