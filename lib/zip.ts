import { deflateRawSync } from 'node:zlib';

const tablaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** ZIP de archivos conocidos del repositorio; no extrae ni acepta rutas del cliente. */
export function empaquetarZip(archivos: { nombre: string; datos: Buffer }[]): Buffer {
  const locales: Buffer[] = [];
  const directorio: Buffer[] = [];
  let offset = 0;
  for (const { nombre, datos } of archivos) {
    const nombreBytes = Buffer.from(nombre);
    const comprimido = deflateRawSync(datos);
    let crc = 0xffffffff;
    for (const byte of datos) crc = tablaCrc[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x0021, 12); // 1 de enero de 1980, fecha ZIP válida y reproducible.
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(nombreBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(comprimido.length, 20); central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(nombreBytes.length, 28); central.writeUInt32LE(offset, 42);
    locales.push(local, nombreBytes, comprimido); directorio.push(central, nombreBytes);
    offset += local.length + nombreBytes.length + comprimido.length;
  }
  const indice = Buffer.concat(directorio);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(indice.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, indice, fin]);
}
