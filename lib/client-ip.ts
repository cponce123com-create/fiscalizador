import { isIP } from 'node:net';
/** Solo usar detrás de una cadena de proxies verificada, sin acceso directo al origen. */
export function ipClienteConfiable(request: Request): string | null {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? '0');
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) return null;
  const cadena = (request.headers.get('x-forwarded-for') ?? '').split(',').map(v => v.trim());
  if (cadena.length < hops) return null;
  const candidato = cadena[cadena.length - hops];
  return candidato && isIP(candidato) ? candidato : null;
}
