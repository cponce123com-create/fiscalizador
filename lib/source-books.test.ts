import { describe, expect, it } from 'vitest';
import { coberturaLibros, estadoLibro, libroImportado } from './source-books';
const libro = { status: 'COMPLETED', isCurrent: true, requiresReview: false };
describe('estados públicos de libros', () => {
  it('no considera un análisis previo como cobertura importada', () => {
    expect(coberturaLibros([]).etiqueta).toBe('Sin libro importado');
    expect(coberturaLibros([{ ...libro, status: 'UPLOADED', isCurrent: false }]).etiqueta).toBe('Sin libro importado');
    expect(libroImportado({ status: 'UPLOADED' })).toBe(false);
  });
  it('muestra importado sin exigir una declaración adicional de cobertura', () => {
    expect(coberturaLibros([libro]).etiqueta).toBe('Importado');
    expect(estadoLibro(libro).etiqueta).toBe('Vigente');
  });
  it('separa observaciones, versiones anteriores y fallos', () => {
    expect(estadoLibro({ ...libro, status: 'COMPLETED_WITH_WARNINGS' }).etiqueta).toContain('observaciones');
    expect(estadoLibro({ ...libro, isCurrent: false }).etiqueta).toBe('Versión anterior');
    expect(coberturaLibros([{ ...libro, status: 'FAILED', isCurrent: false }]).etiqueta).toBe('Sin libro importado');
  });
  it('no presenta una versión no contabilizada como vigente ni pide aprobarla', () => {
    const anterior = { ...libro, requiresReview: true };
    expect(estadoLibro(anterior).etiqueta).toBe('Importado · no incluido en totales');
    expect(coberturaLibros([anterior]).etiqueta).toBe('Libros importados sin versión vigente');
    expect(coberturaLibros([anterior, libro]).etiqueta).toBe('Importado');
  });
});
