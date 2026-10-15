import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Datos personales y privacidad', description: 'Criterios de tratamiento y publicación de datos personales en Fiscalizador.' };

export default function Privacidad() {
  return <article className="mx-auto max-w-4xl space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Información institucional</p><h1 className="titulo-editorial mt-2 text-3xl font-bold sm:text-4xl">Datos personales y privacidad</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Fiscalizador trata datos vinculados con contratación pública y antecedentes documentados para facilitar el control ciudadano. Que un dato esté disponible en una fuente pública no elimina la obligación de contextualizarlo y usarlo responsablemente.</p></header>
    <div className="space-y-4">
      <Seccion titulo="Qué información se publica">Identificación de proveedores, órdenes municipales, montos, periodos, documentos de origen y, cuando existe una base documentada, información pública complementaria relevante para la fiscalización.</Seccion>
      <Seccion titulo="Finalidad">Permitir búsquedas, cruces y comparaciones de interés público. La información no debe utilizarse para acoso, suplantación, discriminación ni para atribuir delitos sin resolución o evidencia suficiente.</Seccion>
      <Seccion titulo="Exactitud y contexto">Los registros reflejan las fuentes disponibles y pueden contener errores de origen. Las órdenes muestran contratación registrada, no necesariamente pagos efectivos. Los usuarios deben revisar el documento de respaldo antes de formular conclusiones.</Seccion>
      <Seccion titulo="Rectificación y observaciones">Una persona puede comunicar una inexactitud y aportar una fuente verificable para su revisión. Las correcciones no deben borrar la trazabilidad de los libros originales ni modificar silenciosamente la evidencia.</Seccion>
      <Seccion titulo="Seguridad">El panel administrativo, las imágenes y los registros internos se protegen con controles de acceso. No se publican notas internas, credenciales ni datos que no hayan sido habilitados expresamente para consulta pública.</Seccion>
    </div>
  </article>;
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="panel-portada"><h2 className="titulo-editorial text-xl font-bold">{titulo}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p></section>;
}
