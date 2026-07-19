import { execSync } from "node:child_process";

// Runs once before all tests: apply committed Prisma migrations to the
// isolated test.db. Verifies the migration applies cleanly to SQLite —
// one of issue #2's acceptance criteria. If no migrations exist yet, the
// DB stays empty and data-model tests fail loud (the RED state).
export function setup() {
  // Keep this in sync with vitest.setup.ts — the Prisma CLI is a child
  // process and does not see env vars set later in the test runtime.
  process.env.DATABASE_URL = "file:./test.db";

  execSync("npx prisma generate", { stdio: "inherit" });
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

export function teardown() {
  // nothing — test.db is gitignored and rebuilt each run
}