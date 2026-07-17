-- Freeze the per-head fee onto the session when the day is closed, so changing
-- the club's current fee later can't rewrite what past days charged.
-- Nullable: open days have no frozen fee yet and read the live setting.
ALTER TABLE "Session" ADD COLUMN "feePerPerson" INTEGER;
