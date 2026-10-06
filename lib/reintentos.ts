/**
 * Reintentos con espera creciente.
 *
 * Existe por un caso concreto: la base de datos (Neon) suspende el cómputo por
 * inactividad, así que la primera conexión tras un arranque en frío puede fallar o
 * tardar. Reintentar unas pocas veces, separando cada vez más los intentos, convierte
 * ese fallo transitorio en una espera corta.
 */

export type OpcionesReintento = {
  /** Número total de intentos, incluido el primero. Por defecto, 3. */
  intentos?: number;
  /** Espera base entre intentos, en milisegundos. Crece con cada intento. Por defecto, 500. */
  esperaMs?: number;
  /** Se llama tras cada fallo, antes de esperar al siguiente intento. */
  alFallar?: (error: unknown, intento: number) => void;
};

/** Espera `ms` milisegundos. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Ejecuta `operacion` y, si falla, la reintenta hasta agotar los intentos.
 *
 * Devuelve el primer resultado correcto. Si todos los intentos fallan, relanza el
 * último error tal cual: envolverlo escondería la causa, que es lo único útil para
 * diagnosticar.
 */
export async function reintentar<T>(
  operacion: () => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const intentos = Math.max(1, opciones.intentos ?? 3);
  const esperaMs = opciones.esperaMs ?? 500;

  for (let intento = 1; ; intento++) {
    try {
      return await operacion();
    } catch (error) {
      // En el último intento no se espera ni se avisa: se relanza.
      if (intento >= intentos) throw error;

      opciones.alFallar?.(error, intento);
      await esperar(esperaMs * intento);
    }
  }
}
