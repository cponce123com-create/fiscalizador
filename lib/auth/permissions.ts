/**
 * Permisos por rol.
 *
 * Se define como una tabla explícita en lugar de comprobar el rol en cada sitio:
 * así una ruta nueva hereda la política por defecto (denegar) en vez de quedar
 * abierta por olvido, y se puede auditar de un vistazo quién puede hacer qué
 * (docs/prompt.md sección 17).
 */

export type Role = 'SUPERADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type Permission =
  | 'orders:read'
  | 'orders:write'
  | 'suppliers:read'
  | 'suppliers:write'
  | 'imports:read'
  | 'imports:write'
  | 'persons:read'
  | 'persons:write'
  | 'users:manage'
  | 'settings:manage'
  | 'audit:read';

/** Orden de mayor a menor privilegio, para comparaciones y para la interfaz. */
export const ROLES: readonly Role[] = ['SUPERADMIN', 'ADMIN', 'EDITOR', 'VIEWER'];

const PERMISOS_POR_ROL: Record<Role, readonly Permission[]> = {
  // Acceso total, incluida la gestión de usuarios y la configuración del sistema.
  SUPERADMIN: [
    'orders:read',
    'orders:write',
    'suppliers:read',
    'suppliers:write',
    'imports:read',
    'imports:write',
    'persons:read',
    'persons:write',
    'users:manage',
    'settings:manage',
    'audit:read',
  ],

  // Gestión completa de datos, pero no puede crear administradores ni cambiar
  // la configuración global: eso queda reservado al SUPERADMIN.
  ADMIN: [
    'orders:read',
    'orders:write',
    'suppliers:read',
    'suppliers:write',
    'imports:read',
    'imports:write',
    'persons:read',
    'persons:write',
    'audit:read',
  ],

  // Mantiene el contenido ya importado, pero NO importa: cargar un libro nuevo
  // cambia las cifras públicas, así que requiere rol ADMIN o superior.
  //
  // Puede LEER el registro de personas (lo necesita para revisar los vínculos),
  // pero no escribirlo: publicar una acusación sobre una persona real no puede
  // estar al alcance de cualquiera que mantenga datos.
  EDITOR: [
    'orders:read',
    'orders:write',
    'suppliers:read',
    'suppliers:write',
    'imports:read',
    'persons:read',
  ],

  // Solo lectura. Es el rol por defecto de una cuenta nueva, así que NO entra en
  // el registro de personas: contiene DNIs, que son datos personales (Ley 29733),
  // y un rol que se asigna por defecto no debe verlos.
  VIEWER: ['orders:read', 'suppliers:read'],
};

export function permisosDe(rol: Role): readonly Permission[] {
  return PERMISOS_POR_ROL[rol] ?? [];
}

export function puede(rol: Role | undefined | null, permiso: Permission): boolean {
  if (!rol) return false;
  return permisosDe(rol).includes(permiso);
}

/** ¿El rol es al menos tan privilegiado como el de referencia? */
export function esAlMenos(rol: Role, referencia: Role): boolean {
  return ROLES.indexOf(rol) <= ROLES.indexOf(referencia);
}
