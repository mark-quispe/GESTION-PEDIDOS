import type { NextConfig } from "next";

/** RNF-18: la app no se puede meter dentro de otra web ni cargar scripts de otros sitios. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Google Picker y la API de Drive (RF-22).
      "script-src 'self' 'unsafe-inline' https://apis.google.com" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://drive.google.com https://*.google.com",
      "font-src 'self' data:",
      "connect-src 'self' https://www.googleapis.com https://*.googleapis.com",
      "frame-src https://docs.google.com https://drive.google.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
    ].join("; "),
  },
];

// cacheComponents queda desactivado a propósito: la app es interna, casi todo
// depende de la sesión y así evitamos envolver cada lectura de sesión en <Suspense>.
const nextConfig: NextConfig = {
  // PGlite (base local de desarrollo) trae su propio WebAssembly: no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
