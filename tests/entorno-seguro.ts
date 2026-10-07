// Nunca cargar la conexión de desarrollo/producción automáticamente desde .env.
const testUrl = process.env.TEST_DATABASE_URL;
const ciUrl = process.env.CI ? process.env.DATABASE_URL : undefined;
if (ciUrl && !['localhost', '127.0.0.1'].includes(new URL(ciUrl).hostname)) throw new Error('CI solo admite su PostgreSQL temporal local.');
if (testUrl && testUrl === process.env.DATABASE_URL && !['localhost', '127.0.0.1'].includes(new URL(testUrl).hostname)) throw new Error('TEST_DATABASE_URL debe ser una base separada de DATABASE_URL.');
process.env.INTEGRATION_TESTS_ENABLED = testUrl || ciUrl ? '1' : '0';
process.env.DATABASE_URL = testUrl ?? ciUrl ?? 'postgresql://test:test@127.0.0.1:1/test_sin_conexion';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.AUTH_SECRET = 'secreto-ficticio-solo-para-pruebas-separadas';
