import type { NextConfig } from "next";

/**
 * Configuración de Next.js: imágenes y cabeceras de seguridad.
 *
 * Las cabeceras se aplican a todas las rutas. Van aquí, y no en el middleware,
 * porque son estáticas y no dependen de la petición; el middleware (`proxy.ts`) se
 * ocupa solo de decidir si hay sesión.
 */

const esDesarrollo = process.env.NODE_ENV === "development";

/**
 * Política de seguridad de contenido.
 *
 * Decisiones que conviene entender antes de tocarla:
 *
 *  - `script-src` y `style-src` llevan `'unsafe-inline'` porque Next.js inyecta
 *    scripts y estilos en línea para arrancar la aplicación y recharts pinta
 *    estilos en línea sobre el SVG. Sin un `nonce` por petición —que obligaría a
 *    ampliar el middleware a TODAS las rutas— no hay otra forma de permitirlos.
 *  - `img-src` incluye `res.cloudinary.com`: `next/image` sirve las fotografías
 *    optimizadas desde el propio dominio, pero una imagen servida sin optimizar se
 *    carga directa desde Cloudinary.
 *  - `font-src 'self'`: `next/font` descarga las fuentes al compilar y las sirve
 *    desde el propio dominio, así que no hace falta abrir `fonts.gstatic.com`.
 *  - En desarrollo se añade `'unsafe-eval'` (lo necesita Turbopack) y se permite
 *    el WebSocket del recargado en caliente; en producción, no.
 *  - No se envía `upgrade-insecure-requests`: en producción HSTS ya fuerza HTTPS y
 *    la directiva rompería la prueba local del build de producción sobre HTTP.
 */
const CSP = [
  "default-src 'self'",
  esDesarrollo
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  esDesarrollo ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Permisos del navegador que el portal no usa: se cierran todos. */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  "browsing-topics=()",
].join(", ");

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/descargas-seace/extension": ["./browser-extension/seace/**/*", "./node_modules/xlsx/dist/xlsx.full.min.js", "./node_modules/xlsx/LICENSE"],
  },
  images: {
    /**
     * Las fotografías de proveedores se alojan en Cloudinary (fase prevista en el
     * pliego). Sin declarar el dominio, `next/image` se negaría a servirlas.
     */
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // `frame-ancestors` de la CSP ya lo impide; `X-Frame-Options` cubre a los
          // navegadores antiguos que no entienden la directiva.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
