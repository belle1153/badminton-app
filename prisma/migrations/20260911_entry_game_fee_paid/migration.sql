-- Per-person pricing switched to a flat entry fee + per-game fee, plus a
-- "collected" flag on each sign-up. Additive and idempotent.

-- Current pricing on the singleton settings row.
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "entryFee" INTEGER NOT NULL DEFAULT 95;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "gameFee"  INTEGER NOT NULL DEFAULT 25;

-- Pricing frozen onto a session when it closes (null on open days).
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "entryFee" INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "gameFee"  INTEGER;

-- When the admin marked a person's bill collected (null = ยอดค้าง / outstanding).
ALTER TABLE "SignUp" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
