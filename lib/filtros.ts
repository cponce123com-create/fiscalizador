import { z } from 'zod';

/**
 * Filtros del portal público.
 *
 * Los filtros viven en la URL (`?anio=2023&tipoRuc=20`), no en el estado del
 * navegador. Eso permite que la página siga siendo un Server Component —la consulta
 * se hace en PostgreSQL con los filtros aplicados y al navegador solo llega la
 * página de resultados— y que una búsqueda concreta se pueda compartir por enlace.
 *
 * Este módulo es puro: no toca la base de datos ni Prisma. Solo lee, valida y
 * escribe parámetros. La traducción a consultas vive en `statisticsService`.
 *
 * Regla: **los parámetros de la URL no se confían**. Un `?pagina=abc` o un
 * `?tipoRuc=99` se descartan y se usa el valor por defecto, en lugar de propagarse
 * hasta la consulta.
 */

/** Cuántas filas por página. Acotado para que nadie pida 100.000 desde la URL. */
export const POR_PAGINA = 20;
export const POR_PAGINA_MAXIMO = 100;

const texto = z
  .string()
  .trim()
  .min(1)
  .max(120)
  // Se bloquean solo los caracteres de control. Cualquier símbolo que alguien
  // escriba en el buscador debe poder usarse: descartar la búsqueda en silencio
  // sería peor que buscar y no encontrar nada.
  .regex(/^[^\p{C}]+$/u);

const identificador = z.string().trim().min(1).max(60);

const entero = (minimo: number, maximo: number) =>
  z.coerce.number().int().min(minimo).max(maximo);

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'Fecha inválida');

/**
 * Valida un parámetro suelto.
 *
 * Se valida campo a campo y no el objeto entero a propósito: con una validación
 * conjunta, un solo valor inválido descartaría también los correctos, y
 * `?anio=2023&pagina=abc` perdería el año sin decir nada.
 */
function validar<T>(esquema: z.ZodType<T>, valor: string | undefined): T | null {
  if (valor === undefined || valor === '') return null;

  const resultado = esquema.safeParse(valor);
  return resultado.success ? resultado.data : null;
}

export type Filtros = {
  anio: number | null;
  mes: number | null;
  gestionId: string | null;
  tipoOrdenId: string | null;
  estadoId: string | null;
  proveedorId: string | null;
  tipoRuc: '10' | '20' | null;
  /** Número mínimo de gestiones en las que aparece un proveedor (historial). */
  minimoGestiones: number | null;
  desde: string | null;
  hasta: string | null;
  texto: string | null;
  orden: 'fecha' | 'monto' | 'proveedor';
  direccion: 'asc' | 'desc';
  pagina: number;
  porPagina: number;
};

/** Entrada cruda de `searchParams` en Next.js. */
export type ParametrosCrudos = Record<string, string | string[] | undefined>;

/** Toma el primer valor si el parámetro viene repetido en la URL. */
function primerValor(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor ?? undefined;
}

/**
 * Lee y valida los filtros.
 *
 * Nunca lanza: cualquier valor inválido se descarta y se usa el de por defecto. Un
 * filtro mal escrito no debe provocar un error en un portal público.
 */
export function leerFiltros(parametros: ParametrosCrudos): Filtros {
  const crudo = (clave: string): string | undefined => primerValor(parametros[clave]);

  const desde = validar(fechaIso, crudo('desde'));
  const hasta = validar(fechaIso, crudo('hasta'));

  // Si el rango viene invertido, se ignora: casi siempre es un error de tecleo, y
  // devolver cero resultados sin explicación confunde más que ayudar.
  const rangoInvalido = Boolean(desde && hasta && desde > hasta);

  return {
    anio: validar(entero(2000, 2100), crudo('anio')),
    mes: validar(entero(1, 12), crudo('mes')),
    gestionId: validar(identificador, crudo('gestion')),
    tipoOrdenId: validar(identificador, crudo('tipoOrden')),
    estadoId: validar(identificador, crudo('estado')),
    proveedorId: validar(identificador, crudo('proveedor')),
    tipoRuc: validar(z.enum(['10', '20']), crudo('tipoRuc')),
    minimoGestiones: validar(entero(1, 10), crudo('minimo')),
    desde: rangoInvalido ? null : desde,
    hasta: rangoInvalido ? null : hasta,
    texto: validar(texto, crudo('texto')),
    orden: validar(z.enum(['fecha', 'monto', 'proveedor']), crudo('orden')) ?? 'fecha',
    direccion: validar(z.enum(['asc', 'desc']), crudo('direccion')) ?? 'desc',
    pagina: validar(entero(1, 10_000), crudo('pagina')) ?? 1,
    porPagina: validar(entero(1, POR_PAGINA_MAXIMO), crudo('porPagina')) ?? POR_PAGINA,
  };
}

/** Indica si hay algún filtro activo, sin contar la paginación ni el orden. */
export function hayFiltrosActivos(filtros: Filtros): boolean {
  return Boolean(
    filtros.anio ??
      filtros.mes ??
      filtros.gestionId ??
      filtros.tipoOrdenId ??
      filtros.estadoId ??
      filtros.proveedorId ??
      filtros.tipoRuc ??
      filtros.minimoGestiones ??
      filtros.desde ??
      filtros.hasta ??
      filtros.texto,
  );
}

/**
 * Rango de fechas efectivo, en UTC.
 *
 * Se combinan el año, el mes y el rango explícito. El mes manda sobre el año cuando
 * ambos vienen: quien pide «junio» con «2023» quiere junio, no todo 2023.
 *
 * Las fechas son `@db.Date` a medianoche UTC, así que el rango se construye en UTC
 * para no desplazar un día según la zona horaria del servidor.
 */
export function rangoDeFechas(filtros: Filtros): { gte: Date; lt: Date } | null {
  if (filtros.desde || filtros.hasta) {
    const gte = filtros.desde ? new Date(`${filtros.desde}T00:00:00.000Z`) : new Date(0);
    const lt = filtros.hasta ? new Date(`${filtros.hasta}T00:00:00.000Z`) : new Date(8.64e15);
    // El límite superior es inclusivo: se avanza un día.
    if (filtros.hasta) lt.setUTCDate(lt.getUTCDate() + 1);
    return { gte, lt };
  }

  if (filtros.anio !== null && filtros.mes !== null) {
    const gte = new Date(Date.UTC(filtros.anio, filtros.mes - 1, 1));
    const lt = new Date(Date.UTC(filtros.anio, filtros.mes, 1));
    return { gte, lt };
  }

  if (filtros.anio !== null) {
    return {
      gte: new Date(Date.UTC(filtros.anio, 0, 1)),
      lt: new Date(Date.UTC(filtros.anio + 1, 0, 1)),
    };
  }

  if (filtros.mes !== null) {
    // Sin año, el mes aplica a cualquier año: se acota por mes en la consulta.
    return null;
  }

  return null;
}

/**
 * Reconstruye la cadena de consulta.
 *
 * Se omiten los valores por defecto para que la URL quede limpia: `/ranking` en
 * lugar de `/ranking?pagina=1&orden=fecha&direccion=desc`.
 */
export function serializarFiltros(filtros: Filtros, cambios: Partial<Filtros> = {}): string {
  const combinados: Filtros = { ...filtros, ...cambios };
  const parametros = new URLSearchParams();

  if (combinados.anio !== null) parametros.set('anio', String(combinados.anio));
  if (combinados.mes !== null) parametros.set('mes', String(combinados.mes));
  if (combinados.gestionId) parametros.set('gestion', combinados.gestionId);
  if (combinados.tipoOrdenId) parametros.set('tipoOrden', combinados.tipoOrdenId);
  if (combinados.estadoId) parametros.set('estado', combinados.estadoId);
  if (combinados.proveedorId) parametros.set('proveedor', combinados.proveedorId);
  if (combinados.tipoRuc) parametros.set('tipoRuc', combinados.tipoRuc);
  if (combinados.minimoGestiones !== null) {
    parametros.set('minimo', String(combinados.minimoGestiones));
  }
  if (combinados.desde) parametros.set('desde', combinados.desde);
  if (combinados.hasta) parametros.set('hasta', combinados.hasta);
  if (combinados.texto) parametros.set('texto', combinados.texto);

  if (combinados.orden !== 'fecha') parametros.set('orden', combinados.orden);
  if (combinados.direccion !== 'desc') parametros.set('direccion', combinados.direccion);
  if (combinados.pagina > 1) parametros.set('pagina', String(combinados.pagina));
  if (combinados.porPagina !== POR_PAGINA) {
    parametros.set('porPagina', String(combinados.porPagina));
  }

  const cadena = parametros.toString();
  return cadena ? `?${cadena}` : '';
}

/** Filtros por defecto, para las páginas que aún no reciben parámetros. */
export function filtrosPorDefecto(): Filtros {
  return leerFiltros({});
}
