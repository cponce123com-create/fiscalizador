import { expect, it } from 'vitest';
import { authConfig } from './auth.config';

it('propaga la versión solo desde el usuario autenticado, sin aceptar actualizaciones del cliente', () => {
  const token = { id: 'cuenta', role: 'ADMIN' as const, sessionVersion: 4 };
  const user = { id: 'cuenta', role: 'ADMIN' as const, sessionVersion: 5 };
  // Los callbacks reales reciben más campos; estos son los que usa la configuración.
  type JwtArgs = Parameters<typeof authConfig.callbacks.jwt>[0];
  const emitido = authConfig.callbacks.jwt({ token, user } as JwtArgs);
  expect(emitido.sessionVersion).toBe(5);
  const actualizado = authConfig.callbacks.jwt({ token: emitido, trigger: 'update', session: { sessionVersion: 99 } } as unknown as JwtArgs);
  expect(actualizado.sessionVersion).toBe(5);
  type SessionArgs = Parameters<typeof authConfig.callbacks.session>[0];
  const sesion = authConfig.callbacks.session({
    session: { user: { id: 'cuenta', role: 'ADMIN' }, expires: '' }, token: actualizado,
  } as SessionArgs);
  expect(sesion.user.sessionVersion).toBe(5);
});
