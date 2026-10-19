import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { clavesUso, leerIA, proveedorListo, RESERVA_TOKENS } from '@/services/ai/settings';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { guardarIA } from '@/app/admin/ia/actions';
import { AsistenteIA } from '@/components/publico/asistente-ia';

export default async function PanelIA() {
  await requierePermiso('settings:manage');
  const [config, usos] = await Promise.all([leerIA(), prisma.appSetting.findMany({ where: { key: { in: clavesUso() } } })]);
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">Inteligencia artificial</h1><p className="mt-2 text-sm text-muted-foreground">El asistente interpreta preguntas. Fiscalizador consulta los libros y calcula los montos. No modifica órdenes ni publica acusaciones.</p></div>
    <p className="rounded-xl border bg-card p-4 text-sm">Conexión: {proveedorListo() ? 'Clave y modelo configurados (conectividad pendiente de probar).' : 'Falta configurar AI_API_KEY y AI_MODEL en Render.'} El proveedor y el modelo se seleccionan mediante variables de entorno. La clave nunca se muestra en este panel.</p>
    <FormularioAccion accion={guardarIA} etiqueta="Guardar configuración">
      <label className="flex gap-3"><input type="checkbox" name="enabled" defaultChecked={config.enabled} />Activar asistente para pruebas del superadmin</label>
      <label className="flex gap-3"><input type="checkbox" name="publicEnabled" defaultChecked={config.publicEnabled} />Habilitar también para visitantes</label>
      <label className="flex flex-col gap-2">Presupuesto diario de tokens reservados<input className="rounded-lg border p-3" name="dailyTokens" type="number" min={12000} max={500000} required defaultValue={config.dailyTokens} /></label>
      <label className="flex flex-col gap-2">Presupuesto mensual de tokens reservados<input className="rounded-lg border p-3" name="monthlyTokens" type="number" min={12000} max={9000000} required defaultValue={config.monthlyTokens} /></label>
    </FormularioAccion>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Consumo reservado · horario de Perú</h2><p className="mt-2 text-sm">Cada interpretación nueva reserva {RESERVA_TOKENS.toLocaleString('es-PE')} tokens, incluso si el proveedor falla. Es un tope conservador, no el consumo facturado. Las preguntas reutilizadas no llaman a la IA; las cifras se consultan nuevamente.</p><ul className="mt-3 space-y-2">{clavesUso().map(key => { const uso = usos.find(u => u.key === key)?.value as { reservado?: number; llamadas?: number } | undefined; return <li key={key}>{key.replace('ia:uso:', '')}: {uso?.reservado ?? 0} tokens reservados · {uso?.llamadas ?? 0} llamadas</li>; })}</ul></section>
    <AsistenteIA />
  </div>;
}
