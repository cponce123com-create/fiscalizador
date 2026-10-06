import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), con `node:crypto`.
 *
 * Se implementa aquí, en vez de con una dependencia, porque es un algoritmo estándar y
 * corto, y porque `otplib` arrastra un paquete ESM que rompe `require` en este proyecto.
 * La corrección no se da por supuesta: las pruebas comprueban los **vectores de prueba
 * del RFC 6238**, que son la referencia oficial.
 *
 * Este módulo es puro: no toca la base de datos ni el entorno.
 */

const DIGITOS_POR_DEFECTO = 6;
const PERIODO_POR_DEFECTO = 30;
/** Tolerancia de reloj: un periodo antes y otro después (±30 s de desfase). */
const VENTANA_POR_DEFECTO = 1;

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodifica base32 (RFC 4648).
 *
 * Se toleran los separadores, los espacios y el relleno `=` porque así es como la gente
 * pega las claves. Cualquier **otro** carácter se rechaza: descartarlo en silencio
 * convertiría una errata al copiar la clave en un secreto distinto, y el usuario se
 * quedaría con códigos que no cuadran sin saber por qué.
 */
export function base32ADatos(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[\s\-=]/g, '');

  let bits = 0;
  let valor = 0;
  const salida: number[] = [];

  for (const caracter of limpio) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice === -1) throw new Error(`Carácter base32 inválido: ${caracter}`);

    valor = (valor << 5) | indice;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      salida.push((valor >>> bits) & 0xff);
    }
  }

  return Buffer.from(salida);
}

/** Codifica en base32 sin relleno. */
export function datosABase32(datos: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';

  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      salida += ALFABETO_BASE32[(valor >>> bits) & 31];
    }
  }

  if (bits > 0) salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];

  return salida;
}

/** Código HOTP para un contador concreto. */
export function codigoHotp(
  secreto: Buffer,
  contador: number,
  digitos = DIGITOS_POR_DEFECTO,
): string {
  const contadorEnBytes = Buffer.alloc(8);
  contadorEnBytes.writeBigUInt64BE(BigInt(contador));

  const hmac = createHmac('sha1', secreto).update(contadorEnBytes).digest();

  // Truncamiento dinámico: los cuatro bits bajos del último byte eligen el desplazamiento.
  const desplazamiento = hmac[hmac.length - 1]! & 0x0f;
  const binario =
    ((hmac[desplazamiento]! & 0x7f) << 24) |
    (hmac[desplazamiento + 1]! << 16) |
    (hmac[desplazamiento + 2]! << 8) |
    hmac[desplazamiento + 3]!;

  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

/** Paso de tiempo (contador) al que corresponde un instante. */
export function pasoDe(instanteMs: number, periodo = PERIODO_POR_DEFECTO): number {
  return Math.floor(instanteMs / 1000 / periodo);
}

export type OpcionesTotp = {
  digitos?: number;
  periodo?: number;
  ventana?: number;
};

/** Código TOTP de un instante. */
export function generarCodigo(
  secretoBase32: string,
  instanteMs = Date.now(),
  opciones: OpcionesTotp = {},
): string {
  const digitos = opciones.digitos ?? DIGITOS_POR_DEFECTO;
  const periodo = opciones.periodo ?? PERIODO_POR_DEFECTO;

  return codigoHotp(base32ADatos(secretoBase32), pasoDe(instanteMs, periodo), digitos);
}

/**
 * ¿El código es válido en ese instante?
 *
 * Se aceptan los pasos de la ventana (por defecto, el anterior y el siguiente) para
 * tolerar el desfase de reloj del teléfono. Se comparan **todos** los candidatos con
 * `timingSafeEqual` en lugar de salir al primero que acierte: salir antes filtraría, por
 * el tiempo de respuesta, en qué paso se ha acertado.
 */
export function verificarCodigo(
  secretoBase32: string,
  codigo: string,
  instanteMs = Date.now(),
  opciones: OpcionesTotp = {},
): boolean {
  const digitos = opciones.digitos ?? DIGITOS_POR_DEFECTO;
  const periodo = opciones.periodo ?? PERIODO_POR_DEFECTO;
  const ventana = opciones.ventana ?? VENTANA_POR_DEFECTO;

  const limpio = codigo.replace(/\D/g, '');
  if (limpio.length !== digitos) return false;

  const secreto = base32ADatos(secretoBase32);
  const paso = pasoDe(instanteMs, periodo);
  const recibido = Buffer.from(limpio);

  let valido = false;

  for (let desfase = -ventana; desfase <= ventana; desfase++) {
    const esperado = Buffer.from(codigoHotp(secreto, paso + desfase, digitos));
    if (esperado.length === recibido.length && timingSafeEqual(esperado, recibido)) {
      valido = true;
    }
  }

  return valido;
}

/** Secreto nuevo en base32. 160 bits, como recomienda el RFC 4226. */
export function generarSecreto(bytes = 20): string {
  return datosABase32(randomBytes(bytes));
}

/** URL `otpauth://` que entienden las aplicaciones de autenticación. */
export function urlOtpAuth({
  secreto,
  cuenta,
  emisor,
  digitos = DIGITOS_POR_DEFECTO,
  periodo = PERIODO_POR_DEFECTO,
}: {
  secreto: string;
  cuenta: string;
  emisor: string;
  digitos?: number;
  periodo?: number;
}): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const parametros = new URLSearchParams({
    secret: secreto,
    issuer: emisor,
    algorithm: 'SHA1',
    digits: String(digitos),
    period: String(periodo),
  });

  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}
