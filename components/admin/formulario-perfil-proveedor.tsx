'use client';
import { useState } from 'react';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { accionGuardarPerfilProveedor } from '@/app/admin/proveedores/actions';
import { MAX_CONTACTOS_PROVEEDOR } from '@/lib/supplier-profile';
type Contacto = { isPublic?: boolean; publicNote?: string | null; dni: string; fullName: string; relationship: string; source: string | null; notes: string | null };
export function FormularioPerfilProveedor({ supplierId, version, birthplace, currentAddress, publicDistrict, birthDate, publicNotes, publicSourceUrl, notes, contacts, esEmpresa }: {
  publicNotes: string | null; publicSourceUrl: string | null; publicDistrict: string | null; birthDate: string | null; supplierId: string; version: string; birthplace: string | null; currentAddress: string | null; notes: string | null; contacts: Contacto[]; esEmpresa: boolean;
}) {
  const [personas, setPersonas] = useState(contacts);
  function cambiar(index: number, campo: keyof Contacto, valor: string | boolean) { setPersonas(actual => actual.map((p, i) => i === index ? { ...p, [campo]: valor } : p)); }
  const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
  return <FormularioAccion accion={accionGuardarPerfilProveedor} etiqueta="Guardar perfil y vínculos">
    <input type="hidden" name="supplierId" value={supplierId} /><input type="hidden" name="version" value={version} /><input type="hidden" name="contacts" value={JSON.stringify(personas)} />
    <p className="text-xs text-muted-foreground">La foto, edad, lugar de nacimiento/origen y distrito se muestran públicamente. El DNI se muestra parcialmente oculto. Las notas privadas y la dirección completa permanecen privadas. Puedes publicar notas y vínculos en los campos correspondientes, con una fuente pública.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm">{esEmpresa ? 'Lugar de origen / constitución' : 'Lugar de nacimiento'}<input name="birthplace" maxLength={250} defaultValue={birthplace ?? ''} className={inputClass} /></label>
      <label className="flex flex-col gap-2 text-sm">{esEmpresa ? 'Dirección completa · privada' : 'Dirección completa · privada'}<input name="currentAddress" maxLength={500} defaultValue={currentAddress ?? ''} className={inputClass} /></label>
      <label className="flex flex-col gap-2 text-sm">Distrito actual · público<input name="publicDistrict" maxLength={120} defaultValue={publicDistrict ?? ''} placeholder="San Ramón" className={inputClass} /></label>
      {!esEmpresa ? <label className="flex flex-col gap-2 text-sm">Fecha de nacimiento · solo se publica la edad<input type="date" name="birthDate" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={birthDate ?? ''} className={inputClass} /></label> : null}
    </div>
    <label className="flex flex-col gap-2 text-sm">Notas del perfil<textarea name="notes" maxLength={3000} defaultValue={notes ?? ''} rows={3} className={inputClass} /></label>
    <label className="flex flex-col gap-2 text-sm">Notas públicas de fiscalización<textarea name="publicNotes" maxLength={3000} defaultValue={publicNotes ?? ''} rows={3} className={inputClass} placeholder="Describe el hecho documentado y su fecha, sin presentar una sospecha como conclusión." /></label>
    <label className="flex flex-col gap-2 text-sm">Fuente de las notas públicas<input type="url" name="publicSourceUrl" maxLength={500} defaultValue={publicSourceUrl ?? ''} className={inputClass} placeholder="https://..." /></label>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Personas vinculadas · {personas.length} de {MAX_CONTACTOS_PROVEEDOR}</h2><button type="button" disabled={personas.length >= MAX_CONTACTOS_PROVEEDOR} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50" onClick={() => setPersonas(actual => [...actual, { dni: '', fullName: '', relationship: '', source: '', notes: '' }])}>Añadir persona</button></div>
    <p className="text-xs text-muted-foreground">Indica la relación que registras: familiar, cónyuge, socio, representante u otra. El DNI identifica a la persona; por sí solo no confirma un parentesco.</p>
    {personas.map((persona, i) => <fieldset key={i} className="rounded-lg border border-border p-4"><legend className="px-2 text-sm font-medium">Persona {i + 1}</legend><div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">DNI<input required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} value={persona.dni} onChange={e => cambiar(i, 'dni', e.target.value)} className={inputClass} /></label>
      <label className="flex flex-col gap-1 text-sm">Nombres y apellidos<input required minLength={2} maxLength={200} value={persona.fullName} onChange={e => cambiar(i, 'fullName', e.target.value)} className={inputClass} /></label>
      <label className="flex flex-col gap-1 text-sm">Tipo de vínculo<input required minLength={2} maxLength={100} placeholder="Madre, hermano, socio, representante…" value={persona.relationship} onChange={e => cambiar(i, 'relationship', e.target.value)} className={inputClass} /></label>
      <label className="flex flex-col gap-1 text-sm">Fuente o referencia<input maxLength={500} value={persona.source ?? ''} onChange={e => cambiar(i, 'source', e.target.value)} className={inputClass} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Notas del vínculo<textarea maxLength={1000} value={persona.notes ?? ''} onChange={e => cambiar(i, 'notes', e.target.value)} rows={2} className={inputClass} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Nota pública del vínculo<textarea maxLength={1000} value={persona.publicNote ?? ''} onChange={e => cambiar(i, 'publicNote', e.target.value)} rows={2} className={inputClass} /></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={persona.isPublic ?? false} onChange={e => cambiar(i, 'isPublic', e.target.checked)} />Publicar vínculo: he contrastado esta relación con la fuente pública enlazada arriba. No se publica el DNI ni la nota privada.</label>
    </div><button type="button" className="mt-3 text-sm text-destructive underline" onClick={() => setPersonas(actual => actual.filter((_, index) => index !== i))}>Quitar persona {i + 1}</button></fieldset>)}
  </FormularioAccion>;
}
