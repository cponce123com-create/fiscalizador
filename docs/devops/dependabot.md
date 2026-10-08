# Dependabot

Dependabot revisa semanalmente dependencias npm, GitHub Actions y Python.

## Cómo revisar PRs

1. Esperar que el CI termine en verde.
2. Leer el changelog cuando la dependencia sea crítica: Next.js, Prisma,
   NextAuth, SheetJS, Sharp o librerías de seguridad.
3. Probar localmente si toca importación, autenticación, imágenes o base de
   datos.
4. Unir cambios pequeños de parche con CI verde; dejar cambios mayores para una
   revisión manual.

El objetivo es no olvidar parches de seguridad sin convertir cada actualización
en un cambio manual grande.
