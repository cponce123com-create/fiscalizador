/** Combina controles GET sin perder filtros que no aparecen en el formulario. */
export function destinoBusqueda(ruta: string, consulta: string, valores: URLSearchParams, nombres: string[], inmediata = false): string | null {
  const parametros = new URLSearchParams(consulta);
  for (const nombre of nombres) parametros.delete(nombre);
  for (const [nombre, valor] of valores) {
    const texto = valor.trim();
    if (!inmediata && (nombre === 'q' || nombre === 'texto') && texto.length > 0 && texto.length < 3) return null;
    if (texto) parametros.append(nombre, texto);
  }
  parametros.delete('pagina');
  parametros.delete('page');
  const query = parametros.toString();
  return `${ruta}${query ? `?${query}` : ''}`;
}
