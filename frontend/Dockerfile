# Image du frontend Orea (Next.js, sortie « standalone » : image légère).

# --- 1. Dépendances -----------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- 2. Build -----------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# Adresse de l'API vue depuis le serveur Next.js (réécriture /api/v1 → FastAPI).
ARG API_INTERNAL_URL=http://api:8000
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- 3. Exécution -------------------------------------------------------------------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S orea && adduser -S orea -G orea
COPY --from=build --chown=orea:orea /app/.next/standalone ./
COPY --from=build --chown=orea:orea /app/.next/static ./.next/static
COPY --from=build --chown=orea:orea /app/public ./public
USER orea
EXPOSE 3000
CMD ["node", "server.js"]
