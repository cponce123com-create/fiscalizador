/**
 * Canal público para solicitar correcciones o rectificaciones.
 *
 * El correo se lee de `NEXT_PUBLIC_CONTACTO_CORRECCIONES` porque lo consume una
 * página estática del portal ciudadano: Next.js incrusta el valor en el HTML al
 * compilar. No hay valor por defecto a propósito: inventar una dirección sería
 * peor que no ofrecer el canal, así que cuando falta se avisa de que no está
 * configurado en lugar de mostrar un correo falso.
 */

/**
 * Plazo de respuesta comprometido, en días hábiles.
 *
 * Es una decisión de la administración, no del código: cámbiala aquí y la página
 * de metodología mostrará el nuevo plazo.
 */
export const PLAZO_RESPUESTA_DIAS = 15;

/**
 * Devuelve el correo de contacto o `null` si no está configurado.
 *
 * Un valor ausente, vacío o en blanco cuenta como no configurado, para que quien
 * despliegue pueda distinguir «no hay canal» de «hay un correo» sin adivinar.
 */
export function leerContactoCorrecciones(valor: string | undefined): string | null {
  const correo = valor?.trim();
  return correo ? correo : null;
}
