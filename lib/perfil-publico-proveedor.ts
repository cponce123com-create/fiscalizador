import { dniDesdeRuc, datoProveedorPublicado, camposPublicacionProveedor, esquemaPublicacionProveedor } from './supplier-profile';

export function datosPublicosProveedor(ruc: string, perfil: { isPublic?: boolean; publication?: unknown; birthplace: string | null; publicDistrict: string | null; birthDate: string | null; photoKey: string | null; updatedAt: Date } | null, id: string, hoy = new Date()) {
  const dni = dniDesdeRuc(ruc);
  let edad: number | null = null;
  if (dni && perfil?.birthDate && datoProveedorPublicado(perfil, 'edad')) {
    const nacimiento = new Date(`${perfil.birthDate}T00:00:00Z`);
    edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
    if (hoy.getUTCMonth() < nacimiento.getUTCMonth() || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate())) edad--;
    if (!Number.isFinite(edad) || edad < 0 || edad > 130) edad = null;
  }
  return {
    dni: dni && datoProveedorPublicado(perfil, 'dni') ? dni : null,
    edad,
    nacimiento: datoProveedorPublicado(perfil, 'nacimiento') ? perfil?.birthplace ?? null : null,
    distrito: datoProveedorPublicado(perfil, 'distrito') ? perfil?.publicDistrict ?? null : null,
    foto: perfil?.photoKey && datoProveedorPublicado(perfil, 'foto') ? `/api/public/proveedores/${encodeURIComponent(id)}/foto?v=${perfil.updatedAt.getTime()}` : null,
  };
}

export function fuentesPublicasProveedor(perfil: { isPublic?: boolean; publication?: unknown } | null) {
  const parsed = esquemaPublicacionProveedor.safeParse(perfil?.publication);
  if (!parsed.success) return [];
  return camposPublicacionProveedor.filter(c => datoProveedorPublicado(perfil, c)).map(c => ({ campo: c, url: parsed.data[c]!.sourceUrl!, revisado: parsed.data[c]!.verifiedAt! }));
}
