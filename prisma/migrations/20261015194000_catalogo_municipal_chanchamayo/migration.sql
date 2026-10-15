-- Catálogo inicial de los seis gobiernos locales de la provincia de Chanchamayo.
-- San Ramón ya existe desde la migración base; ON CONFLICT mantiene cualquier
-- personalización realizada posteriormente desde el panel.
INSERT INTO "Municipality" ("id", "name", "shortName", "slug", "ruc", "province", "department", "entityType", "isDefault", "isActive", "primaryColor", "createdAt", "updatedAt")
VALUES
  ('mun-chanchamayo', 'Municipalidad Provincial de Chanchamayo', 'Chanchamayo', 'chanchamayo', '20146663461', 'Chanchamayo', 'Junín', 'PROVINCIAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-perene', 'Municipalidad Distrital de Perené', 'Perené', 'perene', '20195238961', 'Chanchamayo', 'Junín', 'DISTRITAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-pichanaqui', 'Municipalidad Distrital de Pichanaqui', 'Pichanaqui', 'pichanaqui', '20146640843', 'Chanchamayo', 'Junín', 'DISTRITAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-san-luis-de-shuaro', 'Municipalidad Distrital de San Luis de Shuaro', 'San Luis de Shuaro', 'san-luis-de-shuaro', '20204460648', 'Chanchamayo', 'Junín', 'DISTRITAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-san-ramon', 'Municipalidad Distrital de San Ramón', 'San Ramón', 'san-ramon', '20146657142', 'Chanchamayo', 'Junín', 'DISTRITAL', true, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mun-vitoc', 'Municipalidad Distrital de Vitoc', 'Vitoc', 'vitoc', '20201191280', 'Chanchamayo', 'Junín', 'DISTRITAL', false, true, '#006b3f', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
