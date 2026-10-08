import { describe, expect, it } from 'vitest';
import { esAlimentacion } from './alimentacion';

describe('clasificación de alimentación por descripción', () => {
  it('agrupa términos equivalentes como una sola orden', () => {
    for (const texto of ['SERVICIO DE ALIMENTACIÓN', 'Refrigerios y almuerzos', 'Cena', 'DESAYUNOS', 'Bocaditos', 'Comidas', 'Lonches', 'Catering', 'Buffet', 'Banquete', 'Ración de alimentos']) expect(esAlimentacion(texto), texto).toBe(true);
  });
  it('evita palabras parecidas y conceptos ajenos a alimentación humana', () => {
    for (const texto of [null, '', 'Sentencia judicial', 'Refrigerador', 'Mantenimiento de comedor', 'Fuente de alimentación', 'Alimentación eléctrica', 'Alimento balanceado para animales', 'Alimentos para mascotas']) expect(esAlimentacion(texto), String(texto)).toBe(false);
  });
});
