import { createHash } from 'node:crypto';
import { ipClienteConfiable } from '@/lib/client-ip';

type Clase = 'export' | 'search' | 'image';
type Contador = { inicio: number; peticiones: number; activas: number; ultimoUso: number };
type EstadoLimites = { global: Record<Clase, Contador>; clientes: Map<string, Contador> };
const nuevo = (): Contador => ({ inicio: 0, peticiones: 0, activas: 0, ultimoUso: 0 });
const proceso = globalThis as typeof globalThis & { fiscalizadorPublicLimitsV2?: EstadoLimites };
const estado = proceso.fiscalizadorPublicLimitsV2 ??= { global: { image: nuevo(), export: nuevo(), search: nuevo() }, clientes: new Map() };
function clavePrivada(request: Request, clase: Clase) { const ip = ipClienteConfiable(request); const señal = ip ?? `${request.headers.get('user-agent') ?? 'sin-ua'}|${request.headers.get('accept-language') ?? 'sin-idioma'}`; return `${clase}:${createHash('sha256').update(señal).digest('hex').slice(0, 24)}`; }
function actualizar(contador: Contador, ahora: number) { if (ahora - contador.inicio >= 60_000) { contador.inicio = ahora; contador.peticiones = 0; } contador.ultimoUso = ahora; }
function rechazo(contador: Contador, ahora: number) { return Response.json({ error: 'Demasiadas consultas desde este cliente. Intenta nuevamente en un momento.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((60_000 - (ahora - contador.inicio)) / 1000))), 'Cache-Control': 'no-store' } }); }
/** Límite por cliente y fusible global sin almacenar IP ni depender de Redis. */
export async function peticionPublicaLimitada(clase: Clase, request: Request, ejecutar: () => Promise<Response>): Promise<Response> {
  const ahora = Date.now(); const global = estado.global[clase]; actualizar(global, ahora);
  const key = clavePrivada(request, clase); const cliente = estado.clientes.get(key) ?? nuevo(); actualizar(cliente, ahora); estado.clientes.set(key, cliente);
  const maxGlobal = clase === 'image' ? 120 : clase === 'export' ? 40 : 600; const maxCliente = clase === 'image' ? 20 : clase === 'export' ? 8 : 90;
  const activasGlobal = clase === 'search' ? 8 : clase === 'image' ? 3 : 2; const activasCliente = clase === 'search' ? 2 : 1;
  if (global.peticiones >= maxGlobal || global.activas >= activasGlobal) return rechazo(global, ahora);
  if (cliente.peticiones >= maxCliente || cliente.activas >= activasCliente) return rechazo(cliente, ahora);
  global.peticiones++; global.activas++; cliente.peticiones++; cliente.activas++;
  if (estado.clientes.size > 2_000) for (const [id, valor] of estado.clientes) if (ahora - valor.ultimoUso > 120_000 && valor.activas === 0) estado.clientes.delete(id);
  try { return await ejecutar(); } finally { global.activas--; cliente.activas--; }
}
