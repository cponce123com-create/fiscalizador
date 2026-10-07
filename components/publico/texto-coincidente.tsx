export function TextoCoincidente({ texto, consulta }: { texto: string; consulta?: string }) {
  const q = consulta?.trim();
  if (!q) return <>{texto}</>;
  const indice = texto.toLocaleLowerCase('es').indexOf(q.toLocaleLowerCase('es'));
  if (indice < 0) return <>{texto}</>;
  // Acercar la coincidencia al comienzo del extracto para que sea visible en móvil.
  const inicio = Math.max(0, indice - 70);
  const fin = Math.min(texto.length, indice + q.length + 180);
  return <>{inicio ? '…' : ''}{texto.slice(inicio, indice)}<mark className="rounded bg-amber-100 px-0.5 text-amber-950">{texto.slice(indice, indice + q.length)}</mark>{texto.slice(indice + q.length, fin)}{fin < texto.length ? '…' : ''}</>;
}
