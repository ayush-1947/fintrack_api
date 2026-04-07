# ─── Stage 1: Install ALL dependencies (prod + dev needed for build) ──────────
FROM node:20-bullseye AS deps

WORKDIR /app

# Install build tools + OpenSSL 1.1 for Prisma
RUN apt-get update && apt-get install -y python3 make g++ libssl1.1 wget ca-certificates bash

COPY package*.json ./ 
COPY prisma ./prisma/

# Install ALL deps (dev needed for tsc, tsc-alias, prisma generate)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# ─── Stage 2: Build TypeScript → JS ──────────────────────────────────────────
FROM node:20-bullseye AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma       ./prisma
COPY tsconfig.build.json ./ 
COPY tsconfig.json       ./ 
COPY src                 ./src

# Compile TS and rewrite path aliases
RUN npx tsc --project tsconfig.build.json && npx tsc-alias --project tsconfig.build.json

# ─── Stage 3: Production-only node_modules ────────────────────────────────────
FROM node:20-bullseye AS prod-deps

WORKDIR /app

# Install runtime dependencies including OpenSSL
RUN apt-get update && apt-get install -y python3 make g++ libssl1.1 wget ca-certificates bash

COPY package*.json ./ 
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# ─── Stage 4: Lean runtime image ─────────────────────────────────────────────
FROM node:20-bullseye AS runner

RUN addgroup --system nodejs && adduser --system --ingroup nodejs fintrack

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder   --chown=fintrack:nodejs /app/dist         ./dist
COPY --from=prod-deps --chown=fintrack:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=fintrack:nodejs /app/prisma       ./prisma
COPY --chown=fintrack:nodejs package.json ./ 

USER fintrack

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]