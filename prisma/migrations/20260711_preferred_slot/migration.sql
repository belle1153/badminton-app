-- AlterTable
ALTER TABLE "SignUp" ADD COLUMN "preferredSlot" "TimeSlot" NOT NULL DEFAULT 'EARLY';

-- Backfill: existing sign-ups' preference equals wherever they were placed.
UPDATE "SignUp" SET "preferredSlot" = "timeSlot";
