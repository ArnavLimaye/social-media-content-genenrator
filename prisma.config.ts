import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves the connection URL out of schema.prisma and into this config.
// The Prisma CLI (migrate/generate) reads DATABASE_URL here. dotenv loads .env;
// it does not override vars already in the environment, so the test suite's
// DATABASE_URL=file:./test.db (set in vitest.global-setup.ts) wins for tests.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});