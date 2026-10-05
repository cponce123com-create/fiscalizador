import { describe, expect, it } from 'vitest';

import { esAlMenos, permisosDe, puede, ROLES } from '@/lib/auth/permissions';

describe('permisos por rol', () => {
  it('da acceso total al SUPERADMIN', () => {
    expect(puede('SUPERADMIN', 'users:manage')).toBe(true);
    expect(puede('SUPERADMIN', 'settings:manage')).toBe(true);
    expect(puede('SUPERADMIN', 'imports:write')).toBe(true);
    expect(puede('SUPERADMIN', 'audit:read')).toBe(true);
  });

  it('permite al ADMIN importar pero no gestionar usuarios ni configuración', () => {
    expect(puede('ADMIN', 'imports:write')).toBe(true);
    expect(puede('ADMIN', 'orders:write')).toBe(true);
    expect(puede('ADMIN', 'users:manage')).toBe(false);
    expect(puede('ADMIN', 'settings:manage')).toBe(false);
  });

  it('impide al EDITOR importar', () => {
    // Cargar un libro nuevo cambia las cifras públicas: requiere ADMIN o más.
    expect(puede('EDITOR', 'imports:write')).toBe(false);
    expect(puede('EDITOR', 'imports:read')).toBe(true);
    expect(puede('EDITOR', 'orders:write')).toBe(true);
  });

  it('deja al VIEWER solo lectura', () => {
    expect(puede('VIEWER', 'orders:read')).toBe(true);
    expect(puede('VIEWER', 'suppliers:read')).toBe(true);
    expect(puede('VIEWER', 'orders:write')).toBe(false);
    expect(puede('VIEWER', 'imports:read')).toBe(false);
  });

  it('deniega por defecto cuando no hay rol', () => {
    expect(puede(null, 'orders:read')).toBe(false);
    expect(puede(undefined, 'orders:read')).toBe(false);
  });

  it('no concede un permiso inexistente a ningún rol', () => {
    for (const rol of ROLES) {
      expect(permisosDe(rol)).not.toContain('permiso:inventado');
    }
  });

  it('ordena los roles de mayor a menor privilegio', () => {
    expect(esAlMenos('SUPERADMIN', 'ADMIN')).toBe(true);
    expect(esAlMenos('ADMIN', 'ADMIN')).toBe(true);
    expect(esAlMenos('EDITOR', 'ADMIN')).toBe(false);
    expect(esAlMenos('VIEWER', 'EDITOR')).toBe(false);
  });

  it('mantiene la jerarquía de contención entre roles', () => {
    // Todo lo que puede un VIEWER lo puede un EDITOR, y así sucesivamente.
    const viewer = new Set(permisosDe('VIEWER'));
    const editor = new Set(permisosDe('EDITOR'));
    const admin = new Set(permisosDe('ADMIN'));

    for (const p of viewer) expect(editor.has(p)).toBe(true);
    for (const p of editor) expect(admin.has(p)).toBe(true);
    expect(admin.size).toBeGreaterThan(viewer.size);
  });
});
