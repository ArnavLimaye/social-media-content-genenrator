import "@testing-library/jest-dom/vitest";

// Tests run against an isolated SQLite database, never the operator's dev.db.
// Set before any @prisma/client import so the singleton picks it up.
process.env.DATABASE_URL = "file:./test.db";
process.env.NODE_ENV = "test";