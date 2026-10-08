'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useMontado } from '@/lib/use-montado';
import { formatearMonto } from '@/lib/utils';

/**
 * Gráfico de barras horizontales.
 *
 * Horizontal y no vertical a propósito: las etiquetas de tipo de contratación son
 * largas («Contrataciones hasta 8 UIT (LEY 30225)((No incluye…)») y en vertical
 * quedarían cortadas o inclinadas hasta ser ilegibles. Así se leen de izquierda a
 * derecha, que además es como se comparan longitudes.
 */

export type BarraGrafico = {
  etiqueta: string;
  /** Valor numérico, solo para la longitud de la barra. */
  valor: number;
  /** Valor exacto como cadena decimal, para el tooltip. */
  exacto: string;
  /** Texto secundario del tooltip (por ejemplo, el número de órdenes). */
  detalle: string;
  /** Se atenúa para marcar los grupos sin datos cargados. */
  atenuada?: boolean;
};

/** Acorta una etiqueta larga sin cortar palabras a la mitad. */
function acortar(texto: string, limite = 42): string {
  if (texto.length <= limite) return texto;

  const recorte = texto.slice(0, limite);
  const ultimoEspacio = recorte.lastIndexOf(' ');
  return `${ultimoEspacio > 20 ? recorte.slice(0, ultimoEspacio) : recorte}…`;
}

export function GraficoBarras({
  barras,
  etiquetaSerie,
  alto,
}: {
  barras: BarraGrafico[];
  etiquetaSerie: string;
  alto?: number;
}) {
  const montado = useMontado();

  if (barras.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        No hay datos para este desglose.
      </p>
    );
  }

  // Se reserva espacio proporcional al número de barras para que las etiquetas
  // no se solapen cuando hay muchas.
  const altura = alto ?? Math.max(140, barras.length * 56);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div style={{ width: '100%', height: altura }}>
        {montado ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barras}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
                tickFormatter={(valor: number) =>
                  new Intl.NumberFormat('es-PE', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(valor)
                }
              />
              <YAxis
                type="category"
                dataKey="etiqueta"
                width={190}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
                tickFormatter={(valor: string) => acortar(valor)}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={({ active, payload }) => {
                  const barra = payload?.[0]?.payload as BarraGrafico | undefined;
                  if (!active || !barra) return null;
                  return <div className="max-w-72 rounded-lg border border-border bg-card p-3 text-xs shadow-lg">
                    <p className="font-semibold text-foreground">{barra.etiqueta}</p>
                    <p className="mt-2 text-muted-foreground">{etiquetaSerie}</p>
                    <p className="tabular text-base font-semibold text-primary">{formatearMonto(barra.exacto)}</p>
                    <p className="mt-1 text-muted-foreground">{barra.detalle}</p>
                  </div>;
                }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {barras.map((barra, indice) => (
                  <Cell
                    key={`${barra.etiqueta}-${indice}`}
                    fill={barra.atenuada ? 'var(--muted-foreground)' : 'var(--primary)'}
                  />
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
