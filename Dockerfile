# ==========================================
# 1. Base Stage
# ==========================================
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install native dependencies and shared libraries required by Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# ==========================================
# 2. Dependencies Stage
# ==========================================
FROM base AS dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# ==========================================
# 3. Builder Stage
# ==========================================
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ==========================================
# 4. Production Runner Stage
# ==========================================
FROM base AS runner
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
WORKDIR /app

# Copy production node_modules, puppeteer cache, and built assets
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/.cache /app/.cache
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY docker-entrypoint.sh ./

# Create uploads and invoices directories with permissions
RUN mkdir -p uploads public/invoices && chmod -R 777 uploads public && chmod +x docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]


