-- Publicar una ficha pasa a ser una decisión explícita.
--
-- Hasta ahora el valor por defecto de `isPublic` era `true`, así que dar de alta a una
-- persona la publicaba en el portal sin querer. Cambiar el valor por defecto NO toca las
-- filas que ya existen: las que estaban publicadas siguen publicadas, y a partir de ahora
-- hay que marcar la casilla a propósito, con su fuente.
ALTER TABLE "Person" ALTER COLUMN "isPublic" SET DEFAULT false;

-- Enlace a la fuente y fecha de verificación.
--
-- Nullable a propósito: no hay dato que inventar para las fichas que ya existen, y una
-- ficha sin enlace sigue siendo válida (no toda fuente está en internet). La fecha la
-- sella el servicio al publicar; no se teclea a mano.
ALTER TABLE "Person" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Person" ADD COLUMN "verifiedAt" TIMESTAMP(3);
