export const EXPLICACIONES = {
  montoConsiderado:
    'Suma de órdenes vigentes según el catálogo de estados. Excluye órdenes anuladas y estados no económicos. No acredita pagos efectivos.',
  ordenesAnuladas:
    'Las órdenes anuladas se conservan como trazabilidad, pero no suman al análisis público y su importe agregado no se publica.',
  ruc10:
    'RUC que empieza con 10: corresponde a una persona natural. Se usa para cruces documentales con cuidado metodológico.',
  ruc20:
    'RUC que empieza con 20: corresponde a una persona jurídica, como empresa, asociación o cooperativa.',
  gestion:
    'Periodo de gobierno municipal. Las órdenes se asignan por fecha de emisión según las fechas oficiales de cada gestión.',
  fuenteOriginal:
    'Archivo de origen conservado para revisar de dónde sale la información. Sirve para contrastar cifras y detectar cambios entre versiones.',
  coincidenciaNombre:
    'Una coincidencia de nombres no acredita identidad ni vínculo. Los cruces fuertes se hacen por documento o fuente verificable.',
} as const;
