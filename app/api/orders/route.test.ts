import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requierePermiso: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({
  requierePermiso: mocks.requierePermiso,
  NoAutenticado: class extends Error {}, SinPermiso: class extends Error {},
}));
vi.mock('@/lib/prisma', () => ({ prisma: { order: {
  findMany: mocks.findMany, count: mocks.count, aggregate: mocks.aggregate,
} } }));
import { GET } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requierePermiso.mockResolvedValue({ id: 'cuenta' });
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.aggregate.mockResolvedValue({ _sum: { amount: null } });
});

it.each([
  ['', {}], ['?soloAnuladas=false', {}], ['?soloAnuladas=true', { isCancelled: true }],
])('aplica el filtro booleano correctamente: %s', async (query, where) => {
  const response = await GET(new Request(`http://localhost/api/orders${query}`));
  expect(response.status).toBe(200);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
});
it('rechaza valores booleanos desconocidos antes de consultar', async () => {
  const response = await GET(new Request('http://localhost/api/orders?soloAnuladas=quizas'));
  expect(response.status).toBe(409);
  expect(mocks.findMany).not.toHaveBeenCalled();
});
