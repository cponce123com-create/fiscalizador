import { guardarApariencia } from '@/app/admin/apariencia/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { requierePermiso } from '@/lib/auth/session';
import { leerConfiguracionPortal } from '@/services/portalService';

export const metadata = { title: 'Apariencia y titulares' };
export default async function Apariencia() {
  await requierePermiso('settings:manage');
  const config = await leerConfiguracionPortal();
  const campo = 'rounded-lg border border-input bg-background px-3 py-3 text-sm';
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Apariencia y titulares</h1><p className="mt-2 text-sm text-muted-foreground">Identifica la municipalidad consultada y publica un aviso en todas las páginas del portal ciudadano.</p></div>
    <div className="rounded-xl border border-border bg-card p-6"><FormularioAccion accion={guardarApariencia} etiqueta="Guardar cambios">
      <label className="flex flex-col gap-2 text-sm font-medium">Municipalidad<input className={campo} name="municipio" required maxLength={120} defaultValue={config.municipio} /></label>
      <fieldset className="space-y-5 border-t border-border pt-5"><legend className="px-2 font-semibold">Imagen de portada</legend>
        <label className="flex flex-col gap-2 text-sm font-medium">URL de la fotografía (opcional)<input className={campo} name="fotoPortada" type="url" maxLength={500} defaultValue={config.fotoPortada} placeholder="https://res.cloudinary.com/…" /><span className="text-xs font-normal text-muted-foreground">Usa una fotografía real de San Ramón que tengas permiso para publicar. Sin fotografía, se muestra el escudo existente.</span></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Lugar y crédito de la fotografía<input className={campo} name="creditoFoto" maxLength={180} defaultValue={config.creditoFoto} placeholder="San Ramón, Chanchamayo · Foto: …" /></label>
      </fieldset>
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
