import type { Metadata } from 'next';
import { FileCheck2, FileSpreadsheet, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Metodología',
  description:
    'De dónde salen los datos del portal, cómo se procesan y qué significan las advertencias.',
};

/**
 * Página de metodología.
 *
 * Es estática a propósito: explica el método, no los datos. En un portal de
 * transparencia, decir de dónde sale cada cifra y qué se hizo con ella es parte
 * del producto, no un anexo.
 */
export default function PaginaMetodologia() {
  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Metodología</h1>
        <p className="text-sm text-muted-foreground">
          De dónde salen los datos que ves en este portal, cómo se procesan y por qué algunas
          cifras se muestran pero no se suman.
        </p>
      </header>

      <Seccion titulo="De dónde salen los datos" icono={<FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}>
        <p>
          La fuente son los <strong>libros mensuales de órdenes de compra y de servicio</strong>{' '}
          publicados en el Portal de Transparencia. Son archivos de hoja de cálculo que se
          descargan tal cual y se cargan en este sistema mediante un asistente de importación.
        </p>
        <p>
          No hay ninguna otra vía de entrada. Los datos no se escriben a mano ni se corrigen a
          mano: lo que aparece en el portal es lo que había en el archivo.
        </p>
      </Seccion>

      <Seccion titulo="Cómo se importan" icono={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}>
        <p>La importación tiene dos fases separadas, y esa separación es deliberada:</p>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong>Análisis.</strong> El sistema lee el archivo, detecta las columnas, valida las
            filas y muestra una vista previa con todos los problemas encontrados.{' '}
            <em>En esta fase no se guarda ninguna orden.</em>
          </li>
          <li>
            <strong>Confirmación.</strong> Solo cuando la persona responsable revisa el resultado,
            se guarda todo de una vez. Si algo falla a mitad, no queda nada a medias.
          </li>
        </ol>
        <p>
          El archivo original se conserva íntegro y asociado a su importación. Cada registro
          guarda además su contenido tal como venía en el libro, de modo que cualquier cifra
          publicada puede rastrearse hasta la fila exacta de la que salió.
        </p>
      </Seccion>

      <Seccion titulo="Qué se normaliza y qué no" icono={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}>
        <p>
          El portal <strong>no corrige en silencio</strong>. Cuando un valor no se entiende, se
          conserva el texto original y se marca para que alguien lo revise. En particular:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Fechas.</strong> Se aceptan tanto el formato del portal como el día/mes/año. Si
            una fecha admite dos lecturas posibles, se marca como ambigua.
          </li>
          <li>
            <strong>Montos.</strong> Se interpretan con la convención peruana (la coma separa
            miles). Un monto que no se puede leer <em>no se convierte en cero</em>: se guarda sin
            valor y se advierte, porque un cero falso alteraría todos los totales.
          </li>
          <li>
            <strong>RUC.</strong> Se comprueba que tenga once dígitos y que su dígito verificador
            sea correcto. Si el dígito no cuadra, el RUC <em>se conserva tal cual</em> y se emite
            una advertencia: puede ser un error del archivo de origen.
          </li>
        </ul>
        <p>
          Los defectos que vienen en el archivo fuente —por ejemplo, caracteres mal codificados en
          algunas descripciones— se mantienen sin tocar. Alterarlos sería falsear el dato público.
        </p>
      </Seccion>

      <Seccion titulo="Por qué una orden anulada no suma" icono={<Info className="h-5 w-5" aria-hidden="true" />}>
        <p>
          Cada orden tiene un estado. El sistema no deduce nada del texto: los estados están en un
          catálogo que indica, para cada uno, si <strong>genera gasto</strong> y si corresponde a
          una <strong>anulación</strong>.
        </p>
        <p>De ahí salen las dos cifras principales del portal:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Monto registrado:</strong> la suma de todas las órdenes, incluidas las
            anuladas. Es lo que aparece en el libro.
          </li>
          <li>
            <strong>Monto considerado:</strong> excluye las órdenes anuladas y las que están en
            estados que no generan gasto. Es la cifra que responde a «cuánto se gastó de verdad».
          </li>
        </ul>
        <p>
          Las órdenes anuladas <strong>no desaparecen</strong>: se muestran en los listados,
          marcadas y con la indicación de que no suman. Ocultarlas sería esconder información
          pública.
        </p>
      </Seccion>

      <Seccion titulo="Qué significan las advertencias" icono={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}>
        <p>
          Durante la importación se clasifican los hallazgos en tres niveles:
        </p>
        <ul className="flex flex-col gap-2">
          <li>
            <strong>Error:</strong> la fila no puede convertirse en una orden. Ocurre cuando falta
            el número de orden o el RUC, que son imprescindibles para identificarla.
          </li>
          <li>
            <strong>Advertencia:</strong> la fila se importa, pero hay algo que conviene revisar
            (un monto ilegible, un estado no catalogado, un registro repetido). No se bloquea
            automáticamente: lo decide una persona.
          </li>
          <li>
            <strong>Información:</strong> observaciones que no afectan a los datos, como que una
            fecha no cae en ninguna gestión registrada.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Versionado y trazabilidad" icono={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}>
        <p>
          Importar un periodo que ya estaba cargado <strong>no borra</strong> lo anterior: crea
          una versión nueva y conserva la anterior. El sistema avisa antes de hacerlo y exige
          confirmación explícita.
        </p>
        <p>
          Cada importación queda registrada con quién la hizo, cuándo, qué archivo se usó y qué
          resultó. Nada se elimina sin dejar rastro.
        </p>
      </Seccion>

      <Seccion titulo="Exactitud de las cifras" icono={<Info className="h-5 w-5" aria-hidden="true" />}>
        <p>
          Los montos se almacenan con precisión decimal exacta y se suman en la base de datos, no
          en el navegador. Es una decisión técnica con consecuencia directa: sumar importes con
          decimales en coma flotante produce desviaciones de céntimos que, acumuladas, alteran los
          totales.
        </p>
        <p>
          La cobertura de datos se indica siempre en la portada. Si solo hay un mes cargado, se
          dice; no se disimula con gráficos vacíos ni se rellenan los huecos con ceros.
        </p>
      </Seccion>

      <footer className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <p>
          ¿Detectaste un dato que no cuadra con el archivo original? Es la información más útil que
          puedes aportar.{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Vuelve a la portada
          </Link>{' '}
          y comprueba la cifra concreta antes de reportarla.
        </p>
      </footer>
    </article>
  );
}

function Seccion({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-primary">{icono}</span>
        {titulo}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}
