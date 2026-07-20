-- Issue #11: a Client may hold only one Plan per week.
--
-- `weekStart` is the week's Monday at UTC midnight — the key for the week
-- itself, stripped of any time component so two generations on the same Monday
-- collide regardless of when in the day they ran. Null for period="month"
-- (v2), which has no week; SQLite treats NULLs as distinct under a unique
-- index, so month plans never collide with one another.
ALTER TABLE "Plan" ADD COLUMN "weekStart" DATETIME;

-- Backfill from the human-readable label. `label` has been a pure function of
-- the week start ("Week of YYYY-MM-DD") since the orchestrator's first version,
-- so it is a reliable source here — this is the one and only place that parses
-- it back. Prisma stores SQLite DateTime as ISO-8601 text; match that exactly.
UPDATE "Plan"
SET "weekStart" = substr("label", 9, 10) || 'T00:00:00.000+00:00'
WHERE "period" = 'week'
  AND "label" LIKE 'Week of ____-__-__';

-- Pre-existing duplicates must be resolved before the invariant can be
-- enforced. Keep the oldest Plan per (client, period, week); discard newer ones
-- and the Posts hanging off them. A Post is deleted rather than orphaned
-- because a draft belonging to a discarded duplicate week is not content the
-- operator ever reviewed.
--
-- "Newer" is (createdAt, id) so a millisecond tie still leaves exactly one
-- survivor rather than failing the index below.
DELETE FROM "Post"
WHERE "planId" IN (
  SELECT p."id" FROM "Plan" p
  WHERE p."weekStart" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "Plan" q
      WHERE q."clientId" = p."clientId"
        AND q."period" = p."period"
        AND q."weekStart" = p."weekStart"
        AND (q."createdAt" < p."createdAt"
          OR (q."createdAt" = p."createdAt" AND q."id" < p."id"))
    )
);

DELETE FROM "Plan"
WHERE "weekStart" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Plan" q
    WHERE q."clientId" = "Plan"."clientId"
      AND q."period" = "Plan"."period"
      AND q."weekStart" = "Plan"."weekStart"
      AND (q."createdAt" < "Plan"."createdAt"
        OR (q."createdAt" = "Plan"."createdAt" AND q."id" < "Plan"."id"))
  );

CREATE UNIQUE INDEX "Plan_clientId_period_weekStart_key"
  ON "Plan"("clientId", "period", "weekStart");
