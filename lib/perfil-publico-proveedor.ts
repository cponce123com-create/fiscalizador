import { dniDesdeRuc } from './supplier-profile';

export function datosPublicosProveedor(ruc: string, perfil: { birthplace: string | null; publicDistrict: string | null; birthDate: string | null; photoKey: string | null; updatedAt: Date } | null, id: string, hoy = new Date()) {
  const dni = dniDesdeRuc(ruc);
  let edad: number | null = null;
  if (dni && perfil?.birthDate) {
    const nacimiento = new Date(`${perfil.birthDate}T00:00:00Z`);
    edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
    if (hoy.getUTCMonth() < nacimiento.getUTCMonth() || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate())) edad--;
    if (!Number.isFinite(edad) || edad < 0 || edad > 130) edad = null;
  }
  return {
    dni: dni ? `******${dni.slice(-2)}` : null,
    edad,
    nacimiento: perfil?.birthplace ?? null,
    distrito: perfil?.publicDistrict ?? null,
    foto: perfil?.photoKey ? `/api/public/proveedores/${encodeURIComponent(id)}/foto?v=${perfil.updatedAt.getTime()}` : null,
  };
}
