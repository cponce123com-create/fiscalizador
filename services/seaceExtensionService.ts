import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { empaquetarZip } from '@/lib/zip';

/** Código local y dependencia ya fijada por package-lock, sin descargar código de un CDN. */
export async function paqueteExtensionSeace(): Promise<Buffer> {
  const fuentes = ['manifest.json', 'background.js', 'runner.html', 'runner.css', 'runner.js', 'LEEME.txt'];
  const archivos = await Promise.all(fuentes.map(async nombre => ({
    nombre, datos: await readFile(path.join(process.cwd(), 'browser-extension', 'seace', nombre)),
  })));
  archivos.push({ nombre: 'xlsx.full.min.js', datos: await readFile(path.join(process.cwd(), 'node_modules/xlsx/dist/xlsx.full.min.js')) });
  archivos.push({ nombre: 'SHEETJS-LICENSE.txt', datos: await readFile(path.join(process.cwd(), 'node_modules/xlsx/LICENSE')) });
  return empaquetarZip(archivos);
}
