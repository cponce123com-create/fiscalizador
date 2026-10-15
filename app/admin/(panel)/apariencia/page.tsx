import { guardarApariencia } from '@/app/admin/apariencia/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { requierePermiso } from '@/lib/auth/session';
import { leerConfiguracionPortal } from '@/services/portalService';
import { ImagenPortalControl } from '@/components/admin/imagenes-portal';
import { SelectorMunicipalidad } from '@/components/publico/selector-municipalidad';
import { listarMunicipalidadesActivas, municipalidadActivaDesdeSlug } from '@/services/municipalityService';
import { MUNICIPALIDAD_DEFAULT_ID } from '@/lib/municipalidad';

export const metadata = { title: 'Apariencia y titulares' };
export default async function Apariencia({ searchParams }: { searchParams: Promise<{ municipalidad?: string }> }) {
  await requierePermiso('settings:manage');
  const params = await searchParams;
  const [municipalidades, municipalidad] = await Promise.all([listarMunicipalidadesActivas(), municipalidadActivaDesdeSlug(params.municipalidad)]);
  const config = await leerConfiguracionPortal(municipalidad.id);
  const campo = 'rounded-lg border border-input bg-background px-3 py-3 text-sm';
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Apariencia y titulares</h1><p className="mt-2 text-sm text-muted-foreground">Identifica la municipalidad consultada y publica un aviso en todas las páginas del portal ciudadano.</p></div>
    <section className="space-y-4" aria-labelledby="imagenes-portal">
      <div><h2 id="imagenes-portal" className="text-xl font-semibold">Identidad general de Fiscalizador</h2><p className="mt-2 text-sm text-muted-foreground">El logo y el favicon son únicos y se muestran en todas las municipalidades. Se alojan en Cloudinary al guardar. Usa PNG o WebP, hasta 5 MB.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagenPortalControl municipalityId={MUNICIPALIDAD_DEFAULT_ID} tipo="logo" titulo="Logo general del portal" descripcion="Marca única de Fiscalizador en el encabezado y pie de todas las municipalidades. Se recomienda PNG o WebP con transparencia." url={config.logo} />
        <ImagenPortalControl municipalityId={MUNICIPALIDAD_DEFAULT_ID} tipo="favicon" titulo="Favicon general" descripcion="Icono único de Fiscalizador para pestañas y accesos móviles. Se prepara como PNG cuadrado de 256 px." url={config.favicon} />
      </div>
    </section>
    <div className="rounded-xl border border-border bg-card p-4"><SelectorMunicipalidad municipalidades={municipalidades} /><p className="mt-2 text-xs text-muted-foreground">Editando portada y titulares de {municipalidad.nombre}.</p></div>
    <section className="space-y-4" aria-labelledby="imagenes-municipales">
      <div><h2 id="imagenes-municipales" className="text-xl font-semibold">Imágenes de {municipalidad.nombreCorto}</h2><p className="mt-2 text-sm text-muted-foreground">Estas imágenes sí cambian según la municipalidad seleccionada.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagenPortalControl municipalityId={municipalidad.id} tipo="portada" titulo="Fotografía de portada" descripcion="Resolución ideal: 1920 × 1080 px (16:9). Se recorta automáticamente a ese formato. Usa una fotografía que tengas permiso para publicar." url={config.fotoPortada} credito={config.creditoFoto} />
        <ImagenPortalControl municipalityId={municipalidad.id} tipo="social" titulo="Imagen para compartir enlaces" descripcion="Resolución ideal: 1200 × 630 px (1.91:1), estándar de WhatsApp y Facebook. Esta imagen tiene prioridad en la vista previa de enlaces." url={config.imagenSocial} />
      </div>
    </section>
    <div className="rounded-xl border border-border bg-card p-6"><FormularioAccion accion={guardarApariencia} etiqueta="Guardar cambios">
      <input type="hidden" name="municipalityId" value={municipalidad.id} />
      <input type="hidden" name="municipio" value={municipalidad.nombre} />
      <p className="text-sm"><span className="font-medium">Municipalidad:</span> {municipalidad.nombre}</p>
      <input type="hidden" name="fotoPortada" value={config.fotoPortada} />
      <input type="hidden" name="creditoFoto" value={config.creditoFoto} />
      <fieldset className="space-y-5 border-t border-border pt-5"><legend className="px-2 font-semibold">Cinta de titulares</legend>
        <label className="flex items-center gap-3 text-sm"><input name="cintaActiva" type="checkbox" defaultChecked={config.cintaActiva} className="h-5 w-5" />Mostrar cinta en el portal</label>
        <label className="flex flex-col gap-2 text-sm font-medium">Titular<textarea className={campo} name="titular" rows={3} maxLength={280} defaultValue={config.titular} placeholder="Ejemplo: Ya puedes consultar las órdenes del último mes publicado." /></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Enlace opcional<input className={campo} name="enlace" maxLength={500} defaultValue={config.enlace} placeholder="/fuentes o https://…" /><span className="text-xs font-normal text-muted-foreground">El titular puede abrir una sección o documento de respaldo.</span></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Velocidad<select className={campo} name="velocidad" defaultValue={config.velocidad}><option value="lenta">Lenta</option><option value="normal">Normal</option><option value="rapida">Rápida</option></select></label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Los lectores pueden pausar la cinta. El movimiento se desactiva cuando prefieren animaciones reducidas. Los cambios quedan registrados en la auditoría.</p>
    </FormularioAccion></div>
  </div>;
}
