import { guardarApariencia } from '@/app/admin/apariencia/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { requierePermiso } from '@/lib/auth/session';
import { leerConfiguracionPortal } from '@/services/portalService';
import { ImagenPortalControl } from '@/components/admin/imagenes-portal';

export const metadata = { title: 'Apariencia y titulares' };
export default async function Apariencia() {
  await requierePermiso('settings:manage');
  const config = await leerConfiguracionPortal();
  const campo = 'rounded-lg border border-input bg-background px-3 py-3 text-sm';
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Apariencia y titulares</h1><p className="mt-2 text-sm text-muted-foreground">Identifica la municipalidad consultada y publica un aviso en todas las páginas del portal ciudadano.</p></div>
    <section className="space-y-4" aria-labelledby="imagenes-portal">
      <div><h2 id="imagenes-portal" className="text-xl font-semibold">Identidad e imágenes del portal</h2><p className="mt-2 text-sm text-muted-foreground">Sube desde tu equipo. Las imágenes se alojan en Cloudinary y se publican al guardar cada tarjeta. JPEG, PNG o WebP, hasta 5 MB. Usa PNG o WebP con transparencia para el logo.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagenPortalControl tipo="logo" titulo="Logo del portal" descripcion="Encabezado, pie de página y portada cuando no hay fotografía. Sin personalizar, se utiliza el escudo existente." url={config.logo} />
        <ImagenPortalControl tipo="favicon" titulo="Favicon" descripcion="Icono de la pestaña del navegador y acceso en dispositivos móviles. Se prepara como PNG cuadrado de 256 px." url={config.favicon} />
        <ImagenPortalControl tipo="portada" titulo="Fotografía de portada" descripcion="Imagen principal de la página de inicio. Usa una fotografía que tengas permiso para publicar." url={config.fotoPortada} credito={config.creditoFoto} />
        <ImagenPortalControl tipo="social" titulo="Imagen para compartir enlaces" descripcion="Vista previa de enlaces en redes sociales y mensajería. Se recorta al centro a 1200 × 630 px." url={config.imagenSocial} />
      </div>
    </section>
    <div className="rounded-xl border border-border bg-card p-6"><FormularioAccion accion={guardarApariencia} etiqueta="Guardar cambios">
      <label className="flex flex-col gap-2 text-sm font-medium">Municipalidad<input className={campo} name="municipio" required maxLength={120} defaultValue={config.municipio} /></label>
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
