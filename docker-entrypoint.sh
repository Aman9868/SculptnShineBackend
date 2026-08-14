#!/bin/sh
set -e

echo "🚀 Starting SculptnShine Backend..."

# Push prisma schema to PostgreSQL if DATABASE_URL is available
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Syncing database schema with Prisma..."
  npx prisma db push --skip-generate || true

  # Optional auto-seed
  if [ "$ENABLE_SEED" = "true" ]; then
    echo "🌱 Seeding initial database data..."
    npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' prisma/seed.ts || node -r ts-node/register prisma/seed.ts || echo "⚠️ Seeding skipped or already applied."
  fi
fi

echo "✨ Starting Express server..."
exec "$@"
