import type { NextConfig } from "next";

/**
 * Le navigateur appelle toujours /api/v1/… sur le même domaine que le site ;
 * Next.js relaie ces requêtes vers FastAPI. Avantages : pas de CORS, et le cookie
 * httpOnly du refresh token fonctionne sans réglage particulier.
 *
 * API_INTERNAL_URL : adresse de l'API vue depuis le serveur Next.js
 * (http://api:8000 dans Docker, http://127.0.0.1:8000 en développement : IPv4
 * explicite, car Node 24 essaie d'abord « localhost » en IPv6).
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_INTERNAL_URL}/api/v1/:path*` },
      { source: "/docs", destination: `${API_INTERNAL_URL}/docs` },
    ];
  },
};

export default nextConfig;
