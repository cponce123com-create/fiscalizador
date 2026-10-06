import type { Metadata } from 'next';
import { FileCheck2, FileSpreadsheet, Info, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Aviso } from '@/components/ui/data';
import { PLAZO_RESPUESTA_DIAS, leerContactoCorrecciones } from '@/lib/contacto';

/**
 * Correo para solicitar correcciones, resuelto en el servidor al compilar (es una
 * variable `NEXT_PUBLIC_`). `null` cuando no está configurado.
 */
const contactoCorrecciones = leerContactoCorrecciones(
  process.env.NEXT_PUBLIC_CONTACTO_CORRECCIONES,
);

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
          De dónde salen los datos que ves en este portal, cómo se procesan y por qué algunas cifras
          se muestran pero no se suman.
        </p>
      </header>

      <Seccion
        titulo="De dónde salen los datos"
        icono={<FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}
      >
        <p>
          La fuente son los <strong>libros mensuales de órdenes de compra y de servicio</strong>{' '}
          publicados en el Portal de Transparencia. Son archivos de hoja de cálculo que se descargan
          tal cual y se cargan en este sistema mediante un asistente de importación.
        </p>
        <p>
          No hay ninguna otra vía de entrada. Los datos no se escriben a mano ni se corrigen a mano:
          lo que aparece en el portal es lo que había en el archivo.
        </p>
      </Seccion>

      <Seccion
        titulo="Cómo se importan"
        icono={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
      >
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
          El archivo original se conserva íntegro y asociado a su importación. Cada registro guarda
          además su contenido tal como venía en el libro, de modo que cualquier cifra publicada
          puede rastrearse hasta la fila exacta de la que salió.
        </p>
      </Seccion>

      <Seccion
        titulo="Qué se normaliza y qué no"
        icono={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      >
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

      <Seccion
        titulo="Por qué una orden anulada no suma"
        icono={<Info className="h-5 w-5" aria-hidden="true" />}
      >
        <p>
          Cada orden tiene un estado. El sistema no deduce nada del texto: los estados están en un
          catálogo que indica, para cada uno, si <strong>se incluye en el análisis</strong> y si
          corresponde a una <strong>anulación</strong>.
        </p>
        <p>De ahí salen las dos cifras principales del portal:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Monto registrado:</strong> la suma de todas las órdenes, incluidas las anuladas.
            Es lo que aparece en el libro.
          </li>
          <li>
            <strong>Monto considerado:</strong> excluye las órdenes anuladas y las que están en
            estados excluidos del análisis. Es el monto de órdenes incluido en este análisis; no
            acredita pagos realizados ni representa el presupuesto municipal.
          </li>
        </ul>
        <p>
          Las órdenes anuladas <strong>no desaparecen</strong>: se muestran en los listados,
          marcadas y con la indicación de que no suman. Ocultarlas sería esconder información
          pública.
        </p>
      </Seccion>

      <Seccion
        titulo="Qué significan las advertencias"
        icono={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
      >
        <p>Durante la importación se clasifican los hallazgos en tres niveles:</p>
        <ul className="flex flex-col gap-2">
          <li>
            <strong>Error:</strong> la fila no puede convertirse en una orden. Ocurre cuando falta
            el número de orden o el RUC, que son imprescindibles para identificarla.
          </li>
          <li>
            <strong>Advertencia:</strong> la fila se importa, pero hay algo que conviene revisar (un
            monto ilegible, un estado no catalogado, un registro repetido). No se bloquea
            automáticamente: lo decide una persona.
          </li>
          <li>
            <strong>Información:</strong> observaciones que no afectan a los datos, como que una
            fecha no cae en ninguna gestión registrada.
          </li>
        </ul>
      </Seccion>

      <Seccion
        titulo="Versionado y trazabilidad"
        icono={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <p>
          Importar un periodo que ya estaba cargado <strong>no borra</strong> lo anterior: crea una
          instantánea completa nueva y conserva la anterior como historial. Solo la versión vigente
          se suma. Los periodos antiguos con versiones ambiguas requieren revisión. El sistema avisa
          antes de hacerlo y exige confirmación explícita.
        </p>
        <p>
          Cada importación queda registrada con quién la hizo, cuándo, qué archivo se usó y qué
          resultó. Nada se elimina sin dejar rastro.
        </p>
      </Seccion>

      <Seccion
        titulo="Exactitud de las cifras"
        icono={<Info className="h-5 w-5" aria-hidden="true" />}
      >
        <p>
          Los montos se almacenan con precisión decimal exacta y se suman en la base de datos, no en
          el navegador. Es una decisión técnica con consecuencia directa: sumar importes con
          decimales en coma flotante produce desviaciones de céntimos que, acumuladas, alteran los
          totales.
        </p>
        <p>
          Las órdenes no acreditan transferencias, pagos, avance físico ni el presupuesto total. En
          Fuentes y cobertura se distinguen libros completos declarados, pendientes de revisión y
          ausentes. Las comparaciones entre gestiones con distinta cobertura no permiten concluir
          qué gestión gastó más. La cobertura de datos se indica en la portada. Si solo hay un mes
          cargado, se dice; no se disimula con gráficos vacíos ni se rellenan los huecos con ceros.
        </p>
      </Seccion>

      <Seccion
        id="correcciones"
        titulo="Cómo solicitar una corrección o rectificación"
        icono={<Mail className="h-5 w-5" aria-hidden="true" />}
      >
        <p>
          Si un dato no coincide con el archivo original, o consideras que una ficha de persona
          señalada es inexacta, puedes pedir que se revise. Cada solicitud se atiende contra la
          fuente: el libro del que salió la cifra y, cuando corresponde, la evidencia que aportes.
        </p>
        <p>Para que podamos localizar el caso, incluye:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Qué quieres corregir.</strong> La ficha o el proveedor afectado, con su nombre o
            RUC y, si es una orden concreta, su número.
          </li>
          <li>
            <strong>Qué es lo incorrecto.</strong> El dato que figura en el portal y el que debería
            figurar, explicando por qué.
          </li>
          <li>
            <strong>La evidencia.</strong> El documento o enlace que respalde la corrección (la
            página del archivo original, una resolución, una publicación oficial…).
          </li>
          <li>
            <strong>Cómo responderte.</strong> Un medio de contacto, que no se publicará.
          </li>
        </ul>
        {contactoCorrecciones ? (
          <>
            <p>
              Envía la solicitud a{' '}
              <a
                href={`mailto:${contactoCorrecciones}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {contactoCorrecciones}
              </a>
              . Respondemos en un plazo máximo de {PLAZO_RESPUESTA_DIAS} días hábiles.
            </p>
            <p>
              Este canal sirve para pedir que un dato se ajuste a su fuente. No sustituye a los
              procedimientos de denuncia ni elimina registros: una rectificación corrige, no borra.
            </p>
          </>
        ) : (
          <Aviso
            tono="advertencia"
            titulo="El canal de correcciones aún no está configurado"
            icono={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          >
            <p>
              Falta definir la variable de entorno{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                NEXT_PUBLIC_CONTACTO_CORRECCIONES
              </code>
              . Hasta que se configure y se vuelva a desplegar, no hay una dirección a la que enviar
              solicitudes de corrección.
            </p>
          </Aviso>
        )}
      </Seccion>

      <footer className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <p>
          ¿Detectaste un dato que no cuadra con el archivo original? Es la información más útil que
          puedes aportar.{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Vuelve a la portada
          </Link>{' '}
          para comprobar la cifra concreta y sigue lo indicado en{' '}
          <a href="#correcciones" className="font-medium text-primary hover:underline">
            cómo solicitar una corrección
          </a>
          .
        </p>
      </footer>
    </article>
  );
}

function Seccion({
  titulo,
  icono,
  id,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-primary">{icono}</span>
        {titulo}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}
