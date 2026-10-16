import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';

type Informe = {
  ok: boolean;
  creadoEn: string;
  archivo: { nombre: string; bytes: number; checksum: string };
  comprobaciones: Record<string, boolean>;
  eliminado: boolean;
  error?: string;
};

/**
 * Prueba de integración destructiva únicamente sobre el recurso temporal que
 * ella misma crea. No enumera, lee ni elimina libros existentes.
 */
async function main() {
  const credenciales = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .every(nombre => Boolean(process.env[nombre]?.trim()));
  if (!credenciales) throw new Error('Faltan las tres credenciales de Cloudinary; no se ejecutó ninguna operación.');

  const { crearAlmacenamientoCloudinary } = await import('../services/storageService');
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
    ['PRUEBA CONTROLADA', 'NO ES UN LIBRO MUNICIPAL'],
    ['fecha', new Date().toISOString()],
  ]), 'Verificacion');
  const buffer = Buffer.from(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const nombre = `verificacion-cloudinary-${Date.now()}.xlsx`;
  const driver = crearAlmacenamientoCloudinary({
    cloud: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    apiKey: process.env.CLOUDINARY_API_KEY!.trim(),
    secret: process.env.CLOUDINARY_API_SECRET!.trim(),
  });
  const informe: Informe = {
    ok: false,
    creadoEn: new Date().toISOString(),
    archivo: { nombre, bytes: buffer.byteLength, checksum },
    comprobaciones: {},
    eliminado: false,
  };
  let key: string | null = null;
  try {
    const guardado = await driver.save({ buffer, filename: nombre, checksum });
    key = guardado.key;
    informe.comprobaciones.subidaRawAutenticada = key.startsWith('cloudinary-raw:v1:');
    informe.comprobaciones.tamanoConfirmado = guardado.bytes === buffer.byteLength;
    informe.comprobaciones.checksumRegistrado = guardado.checksum === checksum;
    informe.comprobaciones.existe = await driver.exists(key);
    const descargado = await driver.read(key);
    informe.comprobaciones.descargaIntegra = descargado.byteLength === buffer.byteLength;
    informe.comprobaciones.sha256Coincide = createHash('sha256').update(descargado).digest('hex') === checksum;
    informe.comprobaciones.verificacionDriver = await driver.verify(key, checksum);
    informe.ok = Object.values(informe.comprobaciones).every(Boolean);
  } catch (error) {
    informe.error = error instanceof Error ? error.message : 'Fallo desconocido';
  } finally {
    if (key) {
      try {
        await driver.remove(key);
        informe.eliminado = !(await driver.exists(key));
      } catch (error) {
        informe.error = `${informe.error ? `${informe.error} ` : ''}No se pudo confirmar la limpieza: ${error instanceof Error ? error.message : 'fallo desconocido'}`;
      }
    }
  }
  informe.ok = informe.ok && informe.eliminado;
  process.stdout.write(`${JSON.stringify(informe, null, 2)}\n`);
  if (!informe.ok) process.exitCode = 1;
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo ejecutar la verificación'}\n`);
  process.exitCode = 1;
});
