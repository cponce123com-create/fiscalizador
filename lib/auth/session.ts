import { auth } from '@/auth';
import { puede, type Permission, type Role } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

/**
 * Guardián de sesión para los manejadores de ruta.
 *
 * El middleware ya bloquea las rutas de administración, pero eso solo comprueba
 * que el token esté firmado. El token puede contener un rol obsoleto o
 * pertenecer a una cuenta que un administrador acaba de desactivar.
 *
 * Por eso aquí se REVALIDA contra la base de datos en cada petición. Es una
 * consulta extra por petición de administración, y merece la pena: en un panel
 * de transparencia, un permiso revocado debe surtir efecto de inmediato y no
 * cuando caduque el token.
 */

export type UsuarioActual = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Hace falta para exigir el alta de 2FA antes de dejar usar el panel. */
  twoFactorEnabled: boolean;
  /** Hace falta para exigir el cambio de contraseña antes de dejar usar el panel. */
  mustChangePassword: boolean;
};

/** No hay sesión, o la cuenta ya no es válida. */
export class NoAutenticado extends Error {
  constructor(mensaje = 'Sesión no válida o cuenta desactivada.') {
    super(mensaje);
    this.name = 'NoAutenticado';
  }
}

/** Hay sesión, pero el rol no alcanza. */
export class SinPermiso extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'SinPermiso';
  }
}

/**
 * Devuelve el usuario de la sesión actual, o `null`.
 *
 * Relee el usuario desde la base de datos y exige `isActive`: una cuenta
 * desactivada pierde el acceso al instante, sin esperar a que caduque el token.
 */
export async function usuarioActual(): Promise<UsuarioActual | null> {
  const sesion = await auth();
  const id = sesion?.user?.id;
  if (!id) return null;

  const usuario = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      twoFactorEnabled: true,
      mustChangePassword: true,
    },
  });

  if (!usuario || !usuario.isActive) return null;

  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.name,
    role: usuario.role as Role,
    twoFactorEnabled: usuario.twoFactorEnabled,
    mustChangePassword: usuario.mustChangePassword,
  };
}

/** Exige un permiso concreto. Lanza si no hay sesión o si el rol no alcanza. */
export async function requierePermiso(permiso: Permission): Promise<UsuarioActual> {
  const usuario = await usuarioActual();
  if (!usuario) throw new NoAutenticado();

  if (!puede(usuario.role, permiso)) {
    throw new SinPermiso(`El rol ${usuario.role} no tiene el permiso "${permiso}".`);
  }

  return usuario;
}
