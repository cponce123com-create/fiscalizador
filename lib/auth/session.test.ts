import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, findUnique } = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock('@/auth', () => ({ auth }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique } } }));
vi.mock('@/services/twoFactorService', () => ({
  exigeSegundoFactor: (role: string) => ['ADMIN', 'SUPERADMIN'].includes(role),
}));
import { NoAutenticado, SinPermiso, requierePermiso, usuarioActual } from './session';

const cuenta = {
  id: 'cuenta', email: 'admin@example.org', name: null, role: 'ADMIN',
  isActive: true, mustChangePassword: false, twoFactorEnabled: true, sessionVersion: 2,
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: cuenta.id, sessionVersion: 2 } });
  findUnique.mockResolvedValue({ ...cuenta });
});

describe('revocación de JWT y requisitos del panel', () => {
  it('acepta la versión actual y revalida permisos', async () => {
    expect(await requierePermiso('imports:write')).toMatchObject({ id: cuenta.id });
  });
  it.each([undefined, 0, 1, 3])('rechaza JWT sin versión o con versión obsoleta: %s', async (sessionVersion) => {
    auth.mockResolvedValue({ user: { id: cuenta.id, sessionVersion } });
    expect(await usuarioActual()).toBeNull();
    await expect(requierePermiso('imports:write')).rejects.toBeInstanceOf(NoAutenticado);
  });
  it('rechaza una cuenta desactivada', async () => {
    findUnique.mockResolvedValue({ ...cuenta, isActive: false });
    expect(await usuarioActual()).toBeNull();
  });
  it('bloquea llamadas directas con contraseña pendiente', async () => {
    findUnique.mockResolvedValue({ ...cuenta, mustChangePassword: true });
    await expect(requierePermiso('imports:write')).rejects.toThrow('cambiar la contraseña');
    // La excepción de onboarding sigue disponible sin conceder permisos del panel.
    expect(await usuarioActual()).toMatchObject({ mustChangePassword: true });
  });
  it.each(['ADMIN', 'SUPERADMIN'])('bloquea llamadas directas de %s sin 2FA', async (role) => {
    findUnique.mockResolvedValue({ ...cuenta, role, twoFactorEnabled: false });
    await expect(requierePermiso('imports:write')).rejects.toThrow('verificación en dos pasos');
  });
  it('permite a un EDITOR sin 2FA ejercer sus permisos, pero no importar', async () => {
    findUnique.mockResolvedValue({ ...cuenta, role: 'EDITOR', twoFactorEnabled: false });
    await expect(requierePermiso('orders:write')).resolves.toMatchObject({ role: 'EDITOR' });
    await expect(requierePermiso('imports:write')).rejects.toBeInstanceOf(SinPermiso);
  });
});
