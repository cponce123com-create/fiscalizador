'use client';

import { useSyncExternalStore } from 'react';

/**
 * Indica si el componente ya se está ejecutando en el navegador.
 *
 * Sirve para las librerías que miden el DOM —como `recharts`— y que no pueden
 * renderizarse en el servidor: hasta que no hay navegador, se dibuja un marcador
 * de carga y así se evitan las diferencias de hidratación.
 *
 * Se implementa con `useSyncExternalStore` y no con
 * `useEffect(() => setMontado(true), [])` porque ese patrón provoca un render en
 * cascada y la regla `react-hooks/set-state-in-effect` lo rechaza con razón.
 */

const suscribir = () => () => {};

/** Instantánea en el cliente: siempre montado. */
const enCliente = () => true;

/** Instantánea en el servidor: nunca montado. */
const enServidor = () => false;

export function useMontado(): boolean {
  return useSyncExternalStore(suscribir, enCliente, enServidor);
}
