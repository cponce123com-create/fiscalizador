'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Aviso } from '@/components/ui/data';
import { useMontado } from '@/lib/use-montado';
import { formatearMonto } from '@/lib/utils';

/**
 * Gráfico de evolución por periodo.
 *
 * Dos decisiones que conviene entender:
 *
 * 1. **Con menos de dos puntos no se dibuja un gráfico.** Un solo punto no es una
 *    evolución y da impresión de error. En su lugar se explica por qué está vacío.
 *    Cuando se importen más libros, el gráfico aparece solo.
 *
 * 2. **Se dibuja tras montar en el cliente.** `recharts` mide el contenedor con el
 *    DOM; renderizarlo también en el servidor provoca diferencias de hidratación.
 */

export type PuntoGrafico = {
  periodo: string;
  /** Valor numérico, solo para la altura de la barra. */
  valor: number;
  /** Valor exacto como cadena decimal, para el tooltip. */
  exacto: string;
  ordenes: number;
};

export function GraficoEvolucion({
  puntos,
  etiquetaSerie,
  nombrePeriodo,
}: {
  puntos: PuntoGrafico[];
  etiquetaSerie: string;
  nombrePeriodo: string;
}) {
  const montado = useMontado();

  if (puntos.length < 2) {
    const unico = puntos[0];

    return (
      <Aviso tono="info" titulo="Todavía no hay evolución que mostrar">
        {unico ? (
          <>
            Solo hay un periodo cargado ({unico.periodo}, con {unico.ordenes}{' '}
            {unico.ordenes === 1 ? 'orden' : 'órdenes'} y {formatearMonto(unico.exacto)}). Un
            gráfico de un único punto no muestra ninguna tendencia.
          </>
        ) : (
          'No hay periodos con datos.'
        )}{' '}
        Este gráfico se completará al importar más libros mensuales.
      </Aviso>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        {etiquetaSerie} por {nombrePeriodo}. Pasa el cursor por una barra para ver la cifra exacta.
      </p>

      <div style={{ width: '100%', height: 260 }}>
        {montado ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puntos} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
                width={72}
                tickFormatter={(valor: number) =>
                  new Intl.NumberFormat('es-PE', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(valor)
                }
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={({ active, payload }) => {
                  const punto = payload?.[0]?.payload as PuntoGrafico | undefined;
                  if (!active || !punto) return null;
                  return <div className="max-w-64 rounded-lg border border-border bg-card p-3 text-xs shadow-lg">
                    <p className="font-semibold text-foreground">{nombrePeriodo}: {punto.periodo}</p>
                    <p className="mt-2 text-muted-foreground">{etiquetaSerie}</p>
                    <p className="tabular text-base font-semibold text-primary">{formatearMonto(punto.exacto)}</p>
                    <p className="mt-1 text-muted-foreground">{punto.ordenes} {punto.ordenes === 1 ? 'orden registrada' : 'órdenes registradas'}</p>
                  </div>;
                }}
              />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {puntos.map((punto) => (
                  <Cell key={punto.periodo} fill="var(--primary)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        )}
      </div>
    </div>
  );
}
