# ============================================
# Stage 1: Relayer
# ============================================
FROM node:20-slim AS relayer

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/ packages/sdk/
COPY apps/relayer/ apps/relayer/

RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @veil/sdk run build 2>/dev/null || true
RUN pnpm --filter @veil/relayer run build 2>/dev/null || true

EXPOSE 8787
ENV NODE_ENV=production
ENV PORT=8787

CMD ["pnpm", "--filter", "@veil/relayer", "run", "start"]

# ============================================
# Stage 2: Indexer
# ============================================
FROM node:20-slim AS indexer

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/ packages/sdk/
COPY apps/indexer/ apps/indexer/

RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @veil/sdk run build 2>/dev/null || true
RUN pnpm --filter @veil/indexer run build 2>/dev/null || true

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@veil/indexer", "run", "start"]

# ============================================
# Stage 3: Web (Next.js)
# ============================================
FROM node:20-slim AS web

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/ packages/sdk/
COPY apps/web/ apps/web/

RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @veil/sdk run build 2>/dev/null || true
RUN pnpm --filter @veil/web run build 2>/dev/null || true

EXPOSE 3000
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@veil/web", "run", "start"]
