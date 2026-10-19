export type OeceCatalogRow = {
  ruc: string;
  name: string;
  department: string | null;
  province: string | null;
  district: string | null;
  siafCode: string | null;
  officialCode: string;
  status: string | null;
  sourceUpdatedAt: Date | null;
};

function separarFila(linea: string): string[] {
  const valores: string[] = [];
  let valor = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') { valor += '"'; i += 1; }
      else entreComillas = !entreComillas;
    } else if (caracter === '|' && !entreComillas) {
      valores.push(valor.trim()); valor = '';
    } else valor += caracter;
  }
  valores.push(valor.trim());
  if (entreComillas) throw new Error('El padrón OECE contiene una fila con comillas sin cerrar.');
  return valores;
}

function fechaOrigen(valor: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(valor.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Parser defensivo del CSV separado por | publicado por el OECE. */
export function parsearPadronOece(texto: string): OeceCatalogRow[] {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) throw new Error('El padrón OECE está vacío o incompleto.');
  const encabezados = separarFila(lineas[0]).map((columna) => columna.toUpperCase());
  const columnas = ['RUC', 'NOMBRE_DE_ENTIDAD', 'DEPARTAMENTO', 'PROVINCIA', 'DISTRITO', 'CODIGO_SIAF', 'CODCONSUCODE', 'ESTADO', 'ULTIMAACTUALIZACION'];
  const indices = columnas.map((columna) => encabezados.indexOf(columna));
  if (indices.some((indice) => indice < 0)) throw new Error('El archivo no coincide con el formato esperado del padrón OECE.');

  const filas = lineas.slice(1).map((linea, filaIndex) => {
    const valores = separarFila(linea);
    const valor = (columna: number) => valores[indices[columna]]?.trim() ?? '';
    const ruc = valor(0);
    const name = valor(1);
    const officialCode = valor(6);
    if (!/^\d{11}$/.test(ruc) || !name || !officialCode) throw new Error(`Fila ${filaIndex + 2}: faltan RUC, nombre o código oficial válido.`);
    const sourceDate = valor(8);
    return {
      ruc, name,
      department: valor(2) || null,
      province: valor(3) || null,
      district: valor(4) || null,
      siafCode: valor(5) || null,
      officialCode,
      status: valor(7) || null,
      sourceUpdatedAt: sourceDate ? fechaOrigen(sourceDate) : null,
    } satisfies OeceCatalogRow;
  });

  if (filas.length < 100) throw new Error(`El padrón solo contiene ${filas.length} filas; se cancela para evitar guardar una descarga parcial.`);
  if (new Set(filas.map((fila) => fila.ruc)).size !== filas.length) throw new Error('El padrón contiene RUC duplicados; se cancela la sincronización.');
  if (new Set(filas.map((fila) => fila.officialCode)).size !== filas.length) throw new Error('El padrón contiene códigos oficiales duplicados; se cancela la sincronización.');
  return filas;
}

export function fechaMaximaPadron(filas: OeceCatalogRow[]): Date | null {
  return filas.reduce<Date | null>((maxima, fila) => fila.sourceUpdatedAt && (!maxima || fila.sourceUpdatedAt > maxima) ? fila.sourceUpdatedAt : maxima, null);
}
