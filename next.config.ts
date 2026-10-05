import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Las fotografías de proveedores se alojan en Cloudinary (fase prevista en el
     * pliego). Sin declarar el dominio, `next/image` se negaría a servirlas.
     */
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
