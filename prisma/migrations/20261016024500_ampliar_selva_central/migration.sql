-- Primeras entidades fuera de Chanchamayo para ampliar Fiscalizador a la Selva Central.
-- Los RUC provinciales se contrastaron con documentos oficiales; Villa Rica
-- procede del catálogo de entidades públicas entregado para esta ampliación.
INSERT INTO "Municipality" ("id", "name", "shortName", "slug", "ruc", "province", "department", "entityType", "isDefault", "isActive", "primaryColor", "createdAt", "updatedAt")
VALUES
  ('mun-oxapampa', 'Municipalidad Provincial de Oxapampa', 'Oxapampa', 'oxapampa', '20190242961', 'Oxapampa', 'Pasco', 'PROVINCIAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-satipo', 'Municipalidad Provincial de Satipo', 'Satipo', 'satipo', '20146674403', 'Satipo', 'Junín', 'PROVINCIAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-villa-rica', 'Municipalidad Distrital de Villa Rica', 'Villa Rica', 'villa-rica', '20204172855', 'Oxapampa', 'Pasco', 'DISTRITAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
