import type { NextConfig } from "next";

// cacheComponents queda desactivado a propósito: la app es interna, casi todo
// depende de la sesión y así evitamos envolver cada lectura de sesión en <Suspense>.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
