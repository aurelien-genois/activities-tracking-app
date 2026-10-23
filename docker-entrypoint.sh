#!/bin/sh
# Applies pending Prisma migrations, then starts the Next.js server.
# `set -e`: if the migration fails, the container exits with a non-zero code.
set -e

echo "Applying database migrations..."
(cd /app/prisma-cli && ./node_modules/.bin/prisma migrate deploy)

echo "Starting the application..."
exec "$@"
