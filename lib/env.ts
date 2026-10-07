import { z } from 'zod';

/**
 * Validación de variables de entorno del servidor.
 *
 * Se valida en el borde del proceso: si falta un secreto o está mal formado, la
 * aplicación falla al arrancar con un mensaje claro en lugar de romper más tarde
 * en mitad de una importación (docs/prompt.md sección 25).
 *
 * Este módulo es solo para servidor. Nunca debe importarse desde un componente
 * de cliente, porque expondría los secretos al navegador.
 */

/** Salto de línea. Se construye así para no depender de secuencias de escape. */
const SALTO_DE_LINEA = String.fromCharCode(10);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Base de datos. DATABASE_URL usa el host con pooling (runtime);
  // DIRECT_URL el host directo y solo lo consume la CLI de Prisma.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DIRECT_URL: z.string().min(1).optional(),

  // Auth.js. Debe tener entropía suficiente para firmar sesiones.
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET debe tener al menos 32 caracteres'),

  // Seed del primer SUPERADMIN. Opcionales: solo los usa prisma/seed.ts.
  SEED_SUPERADMIN_EMAIL: z.string().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().optional(),

  // Almacenamiento de archivos originales.
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage/uploads'),

  // Fotos privadas de proveedores: obligatorias al subir/leer fotos de Cloudinary.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join(SALTO_DE_LINEA);

  throw new Error(
    `Configuración de entorno inválida. Revisa tu archivo .env (ver .env.example):${SALTO_DE_LINEA}${detalle}`,
  );
}

export const env = parsed.data;

/** Verdadero cuando están presentes las credenciales de Cloudinary. */
export const cloudinaryConfigured =
  Boolean(env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(env.CLOUDINARY_API_KEY) &&
  Boolean(env.CLOUDINARY_API_SECRET);
