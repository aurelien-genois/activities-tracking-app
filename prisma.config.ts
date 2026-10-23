import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads `.env` automatically. Load it with Node's built-in
// loader when present; variables already set in the environment win.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
    seed: "tsx src/prisma/seed.ts",
  },
  datasource: {
    // Not `env()`: it throws when unset, which would break `prisma generate`
    // in environments without a database (CI build, Docker build stage).
    url: process.env.DATABASE_URL,
  },
});
