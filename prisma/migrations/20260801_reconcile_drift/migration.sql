-- Reconcile schema drift: production was changed directly, the files were not.
--
-- 20260720_fee_per_person created this column with DEFAULT 5, but production has
-- had DEFAULT 0 for some time (the singleton row itself holds the club's real
-- 8 baht, so nothing visible changed and the drift went unnoticed). A database
-- rebuilt from these migrations would have come up with 5 — a fee the club never
-- set. Match production.
ALTER TABLE "AppSettings" ALTER COLUMN "feePerPerson" SET DEFAULT 0;

-- Note: "Quest_active_startDate_idx" needed no statement here. It has existed in
-- production since 20260726_quests; what was missing was the @@index in
-- schema.prisma, which is fixed in that file — without it the next `migrate dev`
-- would have generated a DROP INDEX for it.
