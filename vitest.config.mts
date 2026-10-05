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
  },
  resolve: {
    // Debe coincidir con `paths` de tsconfig.json ("@/*" -> "./*").
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
});
