-- Se conserva la descripción original; PostgreSQL mantiene la proyección al importar/editar.
ALTER TABLE "Order" ADD COLUMN "descriptionSearch" TEXT GENERATED ALWAYS AS (
  ' ' || trim(regexp_replace(translate(lower(coalesce("description", '')), 'áàäâéèëêíìïîóòöôúùüûñ', 'aaaaeeeeiiiioooouuuun'), '[^a-z0-9]+', ' ', 'g')) || ' '
) STORED;
