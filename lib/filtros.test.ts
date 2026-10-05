import { describe, expect, it } from 'vitest';

import {
  POR_PAGINA,
  POR_PAGINA_MAXIMO,
  filtrosPorDefecto,
  hayFiltrosActivos,
  leerFiltros,
  rangoDeFechas,
  serializarFiltros,
} from '@/lib/filtros';

/**
 * Pruebas de la lectura de filtros.
 *
 * Lo que se comprueba aquí es, sobre todo, que **los parámetros de la URL no se
 * confían**: cualquier valor inválido se descarta y se usa el de por defecto, sin
 * lanzar errores. Un portal público no puede devolver un error porque alguien
 * escriba `?pagina=abc`.
 */

describe('leerFiltros', () => {
  describe('valores válidos', () => {
    it('lee los filtros completos', () => {
      const f = leerFiltros({
        anio: '2023',
        mes: '6',
        tipoRuc: '20',
        tipoOrden: 'abc123',
        texto: 'urruchi',
        pagina: '3',
        porPagina: '50',
        orden: 'monto',
        direccion: 'asc',
      });

      expect(f.anio).toBe(2023);
      expect(f.mes).toBe(6);
      expect(f.tipoRuc).toBe('20');
      expect(f.tipoOrdenId).toBe('abc123');
      expect(f.texto).toBe('urruchi');
      expect(f.pagina).toBe(3);
      expect(f.porPagina).toBe(50);
      expect(f.orden).toBe('monto');
      expect(f.direccion).toBe('asc');
    });

    it('convierte a número los parámetros numéricos que llegan como texto', () => {
      const f = leerFiltros({ anio: '2023', pagina: '2' });

      expect(typeof f.anio).toBe('number');
      expect(typeof f.pagina).toBe('number');
    });
  });

  describe('valores inválidos: se descartan, nunca lanzan', () => {
    it('ignora una página que no es un número', () => {
      const f = leerFiltros({ pagina: 'abc' });

      expect(f.pagina).toBe(1);
    });

    it('ignora una página negativa o cero', () => {
      expect(leerFiltros({ pagina: '0' }).pagina).toBe(1);
      expect(leerFiltros({ pagina: '-5' }).pagina).toBe(1);
    });

    it('ignora un tipo de RUC que no sea 10 ni 20', () => {
      expect(leerFiltros({ tipoRuc: '99' }).tipoRuc).toBeNull();
      expect(leerFiltros({ tipoRuc: 'abc' }).tipoRuc).toBeNull();
      expect(leerFiltros({ tipoRuc: '10' }).tipoRuc).toBe('10');
    });

    it('ignora un año fuera de rango', () => {
      expect(leerFiltros({ anio: '1800' }).anio).toBeNull();
      expect(leerFiltros({ anio: '3000' }).anio).toBeNull();
    });

    it('ignora un mes fuera de 1 a 12', () => {
      expect(leerFiltros({ mes: '0' }).mes).toBeNull();
      expect(leerFiltros({ mes: '13' }).mes).toBeNull();
    });

    it('ignora una fecha con formato incorrecto', () => {
      expect(leerFiltros({ desde: '26/06/2023' }).desde).toBeNull();
      expect(leerFiltros({ desde: '2023-6-6' }).desde).toBeNull();
      expect(leerFiltros({ desde: 'ayer' }).desde).toBeNull();
    });

    it('ignora un valor de ordenamiento no permitido', () => {
      expect(leerFiltros({ orden: 'password' }).orden).toBe('fecha');
      expect(leerFiltros({ direccion: 'drop table' }).direccion).toBe('desc');
    });

    it('no admite un porPagina por encima del máximo', () => {
      // El tope existe para que nadie pida 100.000 filas desde la URL.
      expect(leerFiltros({ porPagina: '100000' }).porPagina).toBe(POR_PAGINA);
      expect(leerFiltros({ porPagina: String(POR_PAGINA_MAXIMO) }).porPagina).toBe(
        POR_PAGINA_MAXIMO,
      );
    });

    it('no lanza con un parámetro desconocido', () => {
      expect(() => leerFiltros({ loquesea: 'valor' })).not.toThrow();
    });

    it('un valor inválido no arrastra a los válidos', () => {
      // Validar el conjunto de golpe haría perder también el año.
      const f = leerFiltros({ anio: '2023', tipoRuc: '20', pagina: 'abc', mes: '99' });

      expect(f.anio).toBe(2023);
      expect(f.tipoRuc).toBe('20');
      expect(f.pagina).toBe(1);
      expect(f.mes).toBeNull();
    });
  });

  describe('parámetros repetidos en la URL', () => {
    it('toma el primer valor de un array', () => {
      const f = leerFiltros({ anio: ['2023', '2024'], tipoRuc: ['10', '20'] });

      expect(f.anio).toBe(2023);
      expect(f.tipoRuc).toBe('10');
    });

    it('descarta el array si el primer valor no es válido', () => {
      expect(leerFiltros({ pagina: ['abc', '2'] }).pagina).toBe(1);
    });
  });

  describe('rango de fechas invertido', () => {
    it('ignora un rango donde el inicio es posterior al fin', () => {
      const f = leerFiltros({ desde: '2023-12-31', hasta: '2023-01-01' });

      expect(f.desde).toBeNull();
      expect(f.hasta).toBeNull();
    });

    it('conserva un rango correcto', () => {
      const f = leerFiltros({ desde: '2023-01-01', hasta: '2023-12-31' });

      expect(f.desde).toBe('2023-01-01');
      expect(f.hasta).toBe('2023-12-31');
    });
  });

  describe('texto de búsqueda', () => {
    it('admite una razón social con puntos y símbolos', () => {
      const f = leerFiltros({ texto: 'INVERSIONES URRUCHI S.A.C.' });

      expect(f.texto).toBe('INVERSIONES URRUCHI S.A.C.');
    });

    it('admite acentos', () => {
      expect(leerFiltros({ texto: 'CONSTRUCCIÓN' }).texto).toBe('CONSTRUCCIÓN');
    });

    it('recorta los espacios sobrantes', () => {
      expect(leerFiltros({ texto: '  urruchi  ' }).texto).toBe('urruchi');
    });

    it('descarta un texto con caracteres de control', () => {
      expect(leerFiltros({ texto: 'urruchi' + String.fromCharCode(7) }).texto).toBeNull();
    });

    it('descarta un texto desmesuradamente largo', () => {
      expect(leerFiltros({ texto: 'a'.repeat(200) }).texto).toBeNull();
    });
  });

  describe('valores por defecto', () => {
    it('sin parámetros, usa los valores de la primera página', () => {
      const f = filtrosPorDefecto();

      expect(f.pagina).toBe(1);
      expect(f.porPagina).toBe(POR_PAGINA);
      expect(f.orden).toBe('fecha');
      expect(f.direccion).toBe('desc');
      expect(f.anio).toBeNull();
      expect(f.texto).toBeNull();
    });
  });
});

describe('hayFiltrosActivos', () => {
  it('es falso sin filtros', () => {
    expect(hayFiltrosActivos(filtrosPorDefecto())).toBe(false);
  });

  it('es verdadero con cualquier filtro', () => {
    expect(hayFiltrosActivos(leerFiltros({ anio: '2023' }))).toBe(true);
    expect(hayFiltrosActivos(leerFiltros({ tipoRuc: '20' }))).toBe(true);
    expect(hayFiltrosActivos(leerFiltros({ texto: 'urruchi' }))).toBe(true);
  });

  it('no cuenta la paginación ni el ordenamiento como filtro', () => {
    // Si contaran, el botón «quitar filtros» aparecería en una lista sin filtrar.
    expect(hayFiltrosActivos(leerFiltros({ pagina: '3', orden: 'monto' }))).toBe(false);
  });
});

describe('rangoDeFechas', () => {
  it('sin año ni mes ni rango, no acota', () => {
    expect(rangoDeFechas(filtrosPorDefecto())).toBeNull();
  });

  it('con año, cubre el año completo en UTC', () => {
    const rango = rangoDeFechas(leerFiltros({ anio: '2023' }));

    expect(rango?.gte.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    expect(rango?.lt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('con año y mes, cubre ese mes exacto', () => {
    const rango = rangoDeFechas(leerFiltros({ anio: '2023', mes: '6' }));

    expect(rango?.gte.toISOString()).toBe('2023-06-01T00:00:00.000Z');
    expect(rango?.lt.toISOString()).toBe('2023-07-01T00:00:00.000Z');
  });

  it('el mes manda sobre el año cuando vienen los dos', () => {
    // Quien pide junio de 2023 quiere junio, no todo 2023.
    const rango = rangoDeFechas(leerFiltros({ anio: '2023', mes: '6' }));

    expect(rango?.lt.toISOString()).not.toBe('2024-01-01T00:00:00.000Z');
  });

  it('con un rango explícito, el límite superior es inclusivo', () => {
    const rango = rangoDeFechas(leerFiltros({ desde: '2023-06-01', hasta: '2023-06-30' }));

    expect(rango?.gte.toISOString()).toBe('2023-06-01T00:00:00.000Z');
    // El 30 debe entrar: el límite se amplía un día.
    expect(rango?.lt.toISOString()).toBe('2023-07-01T00:00:00.000Z');
  });

  it('con solo el inicio, no acota por arriba', () => {
    const rango = rangoDeFechas(leerFiltros({ desde: '2023-06-01' }));

    expect(rango?.gte.toISOString()).toBe('2023-06-01T00:00:00.000Z');
    expect(rango?.lt.getUTCFullYear()).toBeGreaterThan(2100);
  });
});

describe('serializarFiltros', () => {
  it('sin filtros, devuelve una cadena vacía', () => {
    expect(serializarFiltros(filtrosPorDefecto())).toBe('');
  });

  it('omite los valores por defecto para no ensuciar la URL', () => {
    const cadena = serializarFiltros(filtrosPorDefecto(), { pagina: 1, orden: 'fecha' });

    expect(cadena).toBe('');
  });

  it('escribe solo lo que se ha cambiado', () => {
    const cadena = serializarFiltros(filtrosPorDefecto(), { anio: 2023 });

    expect(cadena).toBe('?anio=2023');
  });

  it('sobrevive a un viaje de ida y vuelta', () => {
    const original = leerFiltros({
      anio: '2023',
      mes: '6',
      tipoRuc: '20',
      texto: 'urruchi',
      pagina: '2',
      orden: 'monto',
    });

    const reconstruidos = leerFiltros(
      Object.fromEntries(new URLSearchParams(serializarFiltros(original))),
    );

    expect(reconstruidos.anio).toBe(original.anio);
    expect(reconstruidos.mes).toBe(original.mes);
    expect(reconstruidos.tipoRuc).toBe(original.tipoRuc);
    expect(reconstruidos.texto).toBe(original.texto);
    expect(reconstruidos.pagina).toBe(original.pagina);
    expect(reconstruidos.orden).toBe(original.orden);
  });

  it('codifica el texto para que la URL sea válida', () => {
    const cadena = serializarFiltros(filtrosPorDefecto(), { texto: 'S.A.C. & Cía' });

    expect(cadena).toContain('texto=');
    expect(cadena).not.toContain(' ');
    expect(new URLSearchParams(cadena).get('texto')).toBe('S.A.C. & Cía');
  });
});

describe('minimoGestiones (historial)', () => {
  it('sin parámetro, es null', () => {
    expect(filtrosPorDefecto().minimoGestiones).toBeNull();
  });

  it('lee el mínimo desde `?minimo=`', () => {
    expect(leerFiltros({ minimo: '2' }).minimoGestiones).toBe(2);
  });

  it('descarta un mínimo que no es un entero válido', () => {
    expect(leerFiltros({ minimo: 'abc' }).minimoGestiones).toBeNull();
    expect(leerFiltros({ minimo: '0' }).minimoGestiones).toBeNull();
    expect(leerFiltros({ minimo: '99' }).minimoGestiones).toBeNull();
  });

  it('cuenta como filtro activo', () => {
    expect(hayFiltrosActivos(leerFiltros({ minimo: '2' }))).toBe(true);
  });

  it('sobrevive al viaje de ida y vuelta por la URL', () => {
    const original = leerFiltros({ minimo: '3' });
    const reconstruidos = leerFiltros(
      Object.fromEntries(new URLSearchParams(serializarFiltros(original))),
    );

    expect(reconstruidos.minimoGestiones).toBe(3);
  });
});
