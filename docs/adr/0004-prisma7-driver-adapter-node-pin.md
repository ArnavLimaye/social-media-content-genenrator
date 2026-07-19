# Prisma 7 with a driver adapter, pinned to Node 22

**Status:** accepted

The data layer runs **Prisma 7.8.0** with the `@prisma/adapter-better-sqlite3`
driver adapter. Prisma 7 removed the built-in database drivers, so a driver
adapter is now **mandatory** — `lib/db.ts` constructs
`new PrismaClient({ adapter })` with `PrismaBetterSqlite3` (note the casing)
reading `process.env.DATABASE_URL`.

Consequent changes from the Prisma 6 starter:

- `datasource.url` removed from `prisma/schema.prisma`; the connection URL now
  lives in `prisma.config.ts` (`datasource: { url: env("DATABASE_URL") }`, with
  `import "dotenv/config"`).
- Generator switched `prisma-client-js` → `prisma-client` with
  `output = "../generated/prisma"`. `PrismaClient` is imported from
  `@/generated/prisma/client`, **not** `@prisma/client`. `generated/` is
  gitignored and rebuilt by `prisma generate` (which `migrate dev` no longer
  runs automatically).
- `package.json` sets `"type": "module"` — Prisma 7 is ESM-only. Next 16 +
  Turbopack handles this.

**Node pin:** Prisma 7's engine requires `^20.19 || ^22.12 || >=24`. The
machine's default Node was 20.13.1, which Prisma 7 rejects at both install and
runtime. The project is therefore pinned to **Node 22** via `.nvmrc`; every
`npm` / `next` / `prisma` command must run under `nvm use 22` (or
`nvm alias default 22`).

**Why Prisma 7 over 6.x:** latest line, and SQLite `Json` support (needed for
ADR-0001's `slides`/`hashtags`/`reviewFlags`, which migrate as `JSONB`) is
available in both, but 7 is the maintained major. The accepted cost is the
native `better-sqlite3` build (node-gyp) and the Node-version constraint.

**Reconsider if:** the native `better-sqlite3` build becomes a problem on a new
platform — switch to `@prisma/adapter-libsql` (pure-JS, no node-gyp), which still
needs `prisma.config.ts` and the generator/output changes but drops the native
dependency.