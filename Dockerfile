# ==========================================
# 1. Base Stage
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

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
ENV NODE_ENV=production
WORKDIR /app

# Copy production node_modules and built assets
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./

# Create uploads directory with write permissions
RUN mkdir -p uploads && chmod -R 777 uploads && chmod +x docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
