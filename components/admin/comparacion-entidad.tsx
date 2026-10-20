'use client';

import { useState } from 'react';

import { GrupoCampo, Selector } from '@/components/ui/form';
import { CATEGORIAS_ENTIDAD_PUBLICA } from '@/lib/entidad-publica';

export function ComparacionEntidad({
  id,
  categoriaInicial,
  modoInicial,
}: {
  id: string;
  categoriaInicial: string;
  modoInicial: 'MANAGEMENT' | 'ROLLING_YEARS';
}) {
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [modo, setModo] = useState(modoInicial);
  const [modoEditado, setModoEditado] = useState(false);

  return <>
    <GrupoCampo etiqueta="Categoría" htmlFor={`categoria-${id}`} obligatorio>
      <Selector id={`categoria-${id}`} name="categoria" value={categoria} required onChange={(evento) => {
        const nuevaCategoria = evento.target.value;
        setCategoria(nuevaCategoria);
        if (!modoEditado) setModo(nuevaCategoria === 'MUNICIPALIDAD' ? 'MANAGEMENT' : 'ROLLING_YEARS');
      }}>
        {CATEGORIAS_ENTIDAD_PUBLICA.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
      </Selector>
    </GrupoCampo>
    <GrupoCampo etiqueta="Comparación de estadísticas" htmlFor={`comparisonMode-${id}`} obligatorio ayuda="Municipalidades comparan gestiones; las demás entidades usan años calendario recientes por defecto.">
      <Selector id={`comparisonMode-${id}`} name="comparisonMode" value={modo} required onChange={(evento) => {
        setModoEditado(true);
        setModo(evento.target.value as 'MANAGEMENT' | 'ROLLING_YEARS');
      }}>
        <option value="MANAGEMENT">Por gestión de gobierno</option>
        <option value="ROLLING_YEARS">Por años calendario recientes</option>
      </Selector>
    </GrupoCampo>
  </>;
}
