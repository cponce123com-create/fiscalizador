import { prisma } from '@/lib/prisma';
import { fechaMaximaPadron, parsearPadronOece } from '@/services/oeceCatalogParser';

const URL_PADRON = process.env.OECE_CATALOG_URL || 'https://tinyurl.com/CONOSCEENTIDADCONTRATANEW';
const MAX_BYTES = 2_000_000;
const TAMANO_LOTE = 100;
const APLICAR_CAMBIOS = process.argv.includes('--apply');

async function main() {
  const respuesta = await fetch(URL_PADRON, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Fiscalizador/1.0 (catalogo de entidades publicas)' } });
  if (!respuesta.ok) throw new Error(`OECE respondió HTTP ${respuesta.status}.`);
  const buffer = await respuesta.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error(`Descarga de ${buffer.byteLength} bytes supera el límite de seguridad.`);
  const csv = new TextDecoder('windows-1252').decode(buffer);
  const filas = parsearPadronOece(csv);
  const fechaMax = fechaMaximaPadron(filas);
  const antiguedadDias = fechaMax ? Math.floor((Date.now() - fechaMax.getTime()) / 86_400_000) : null;

  console.info(JSON.stringify({ modo: APLICAR_CAMBIOS ? 'aplicar' : 'vista previa', fuente: 'OECE', descargadoEn: new Date().toISOString(), registros: filas.length, ultimoDatoDeclarado: fechaMax?.toISOString().slice(0, 10) ?? null, antiguedadDias }, null, 2));
  if (!APLICAR_CAMBIOS) {
    console.info('Vista previa: no se escribió en la base de datos. Repite con --apply para guardar el catálogo candidato.');
    if (antiguedadDias !== null && antiguedadDias > 180) console.warn('ADVERTENCIA: el padrón descargado declara una actualización de más de 180 días. Trata estos registros como candidatos y valida la fuente antes de promoverlos.');
    return;
  }

  // No se activan entidades, no se importan órdenes y no se eliminan registros
  // que hayan desaparecido del archivo: solo se refresca el catálogo de revisión.
  let procesadas = 0;
  for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
    const lote = filas.slice(inicio, inicio + TAMANO_LOTE);
    await prisma.$transaction(lote.map((fila) => prisma.oeceCatalogEntry.upsert({
      where: { ruc: fila.ruc },
      create: fila,
      update: { ...fila, lastSeenAt: new Date() },
    })));
    procesadas += lote.length;
    process.stdout.write(`\rCatálogo preparado: ${procesadas}/${filas.length}`);
  }
  process.stdout.write('\n');
  if (antiguedadDias !== null && antiguedadDias > 180) console.warn('ADVERTENCIA: el padrón descargado declara una actualización de más de 180 días. Trata estos registros como candidatos y valida la fuente antes de promoverlos.');
}

main().catch((error) => { console.error('No se pudo sincronizar el catálogo OECE:', error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
