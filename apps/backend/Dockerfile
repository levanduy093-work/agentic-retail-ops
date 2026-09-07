# ------------------------------------------------------------------------------
# Stage 1: Build & Prepare
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.11.1

WORKDIR /app

# Copy monorepo configuration and patches
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches/ ./patches/
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

# Install full dependencies for building
RUN pnpm install --frozen-lockfile --filter=@synapse/backend...

# Copy backend source code and config
COPY apps/backend/ ./apps/backend/

WORKDIR /app/apps/backend

# Build Medusa application (admin dashboard and server artifacts)
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.11.1

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9000

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches/ ./patches/
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

# Copy installed node_modules from builder to ensure all runtime dependencies & tools match
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy built artifacts, config and source files
COPY --from=builder /app/apps/backend/.medusa ./apps/backend/.medusa
COPY --from=builder /app/apps/backend/medusa-config.ts ./apps/backend/
COPY --from=builder /app/apps/backend/src ./apps/backend/src
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/apps/backend

EXPOSE 9000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "exec", "medusa", "start", "-H", "0.0.0.0", "-p", "9000"]
