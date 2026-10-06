import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'lib/generated/**'],
    /**
     * Holgado a propósito: varias pruebas son de integración contra Neon y la
     * primera consulta paga el coste de establecer la conexión. El valor por
     * defecto de 5 s provoca fallos falsos en la primera prueba del archivo.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,

    /**
     * Cobertura.
     *
     * Se miden solo los ficheros que las pruebas cargan (comportamiento por defecto de
     * v8): incluir `app/**` y `components/**` haría que la cifra la dominaran los
     * componentes de React, que hoy no tienen pruebas y no son el objeto de esta
     * auditoría. Los umbrales están fijados sobre la línea base real medida, no sobre un
     * número deseado; ver `docs/progreso-auditoria.md` para la brecha y el plan.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'lib/generated/**',
        'prisma/**',
        'scripts/**',
        '**/*.config.*',
        'instrumentation.ts',
        '**/*.d.ts',
      ],
      /**
       * Umbrales.
       *
       * Están fijados ~4 puntos por debajo de la línea base medida en local
       * (78,84 % statements / 73,26 % branches / 79,65 % functions / 81,65 % lines):
       * varias pruebas de integración se saltan cuando la base no tiene datos del portal
       * (p. ej. `personsService`), así que la cifra cambia entre entornos y un umbral
       * pegado al valor medido haría fallar el CI por ruido.
       *
       * El objetivo del 80 % NO se cumple todavía en statements, functions y branches.
       * La brecha y el plan para cerrarla están en `docs/progreso-auditoria.md`.
       */
      thresholds: {
        statements: 75,
        functions: 75,
        branches: 69,
        lines: 77,
      },
    },
  },
  resolve: {
    // Debe coincidir con `paths` de tsconfig.json ("@/*" -> "./*").
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
});
