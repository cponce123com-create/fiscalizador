import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('rastreo de imágenes sociales', () => {
  it('permite las piezas públicas y mantiene la exclusión de admin y API', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.allow).toEqual(expect.arrayContaining(['/api/public/portada-social', '/api/public/compartir/']));
    expect(rule.disallow).toEqual(['/admin', '/api']);
  });
});
