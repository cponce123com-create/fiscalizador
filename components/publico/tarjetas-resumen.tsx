import { AlertTriangle, Building2, FileX2, Receipt, User } from 'lucide-react';

import { formatearMonto } from '@/lib/utils';
import type { ResumenGeneral } from '@/services/statisticsService';

/**
 * Tarjetas de resumen.
 *
 * No es una rejilla de siete números idénticos: el «monto considerado» es la
 * cifra protagonista, porque es la única que responde a la pregunta que trae el
 * ciudadano («¿qué monto de órdenes está documentado?»). El resto acompaña.
 */
export function TarjetasResumen({ resumen }: { resumen: ResumenGeneral }) {
  const cobertura = describirCobertura(resumen);

  return (
    <section aria-labelledby="titulo-resumen" className="flex flex-col gap-4">
      <h2 id="titulo-resumen" className="sr-only">
        Resumen de órdenes
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cifra protagonista */}
        <div className="rounded-lg border border-primary/30 bg-card p-6 shadow-sm ring-1 ring-primary/15 lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Monto considerado
          </p>
          <p className="tabular mt-2 text-4xl font-semibold text-primary sm:text-5xl">
            {formatearMonto(resumen.totalConsiderado)}
          </p>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Es el monto de órdenes incluido en el análisis: excluye las órdenes anuladas y las que están en
            estados excluidos del análisis. Sobre un total registrado de{' '}
            <span className="tabular font-medium text-foreground">
              {formatearMonto(resumen.totalRegistrado)}
            </span>
            .
          </p>
        </div>

        {/* Lo anulado, explicado */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monto anulado
            </p>
            <p className="tabular mt-2 text-2xl font-semibold text-destructive">
              {formatearMonto(resumen.totalAnulado)}
            </p>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              {resumen.ordenesAnuladas === 1
                ? '1 orden anulada. Existe y se muestra en el listado, pero no suma.'
                : `${resumen.ordenesAnuladas} órdenes anuladas. Existen y se muestran, pero no suman.`}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          etiqueta="Órdenes"
          valor={resumen.ordenes.toLocaleString('es-PE')}
          icono={<Receipt className="h-4 w-4" aria-hidden="true" />}
        />
        <Cifra
          etiqueta="Órdenes anuladas"
          valor={resumen.ordenesAnuladas.toLocaleString('es-PE')}
          icono={<FileX2 className="h-4 w-4" aria-hidden="true" />}
        />
        <Cifra
          etiqueta="Proveedores"
          valor={resumen.proveedores.toLocaleString('es-PE')}
          icono={<Building2 className="h-4 w-4" aria-hidden="true" />}
        />
        <Cifra
          etiqueta="Por tipo de RUC"
          valor={`${resumen.proveedoresRuc10} / ${resumen.proveedoresRuc20}`}
          detalle={`${resumen.proveedoresRuc10} persona natural · ${resumen.proveedoresRuc20} jurídica`}
          icono={<User className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      {cobertura ? (
        <p className="text-xs text-muted-foreground">{cobertura}</p>
      ) : null}
    </section>
  );
}

function Cifra({
  etiqueta,
  valor,
  detalle,
  icono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  icono: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icono}
        <p className="text-xs font-medium uppercase tracking-wide">{etiqueta}</p>
      </div>
      <p className="tabular mt-2 text-2xl font-semibold text-foreground">{valor}</p>
      {detalle ? <p className="mt-1 text-xs text-muted-foreground">{detalle}</p> : null}
    </div>
  );
}

/**
 * Describe la cobertura de datos en lenguaje llano.
 *
 * Un portal de transparencia no debe disimular cuánta información tiene. Si solo
 * hay un mes cargado, se dice.
 */
function describirCobertura(resumen: ResumenGeneral): string | null {
  if (!resumen.primerPeriodo) return null;

  const nombreMes = (periodo: string): string => {
    const [anio, mes] = periodo.split('-');
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'setiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const indice = Number(mes) - 1;
    return `${meses[indice] ?? mes} de ${anio}`;
  };

  if (resumen.mesesCargados === 1) {
    return `Cobertura actual: ${nombreMes(resumen.primerPeriodo)}. Los gráficos de evolución se completarán al importar más libros mensuales.`;
  }

  if (resumen.primerPeriodo === resumen.ultimoPeriodo) {
    return `Cobertura actual: ${nombreMes(resumen.primerPeriodo)}.`;
  }

  return `Cobertura actual: de ${nombreMes(resumen.primerPeriodo)} a ${nombreMes(resumen.ultimoPeriodo as string)} (${resumen.mesesCargados} meses, ${resumen.aniosCargados} ${resumen.aniosCargados === 1 ? 'año' : 'años'}).`;
}
