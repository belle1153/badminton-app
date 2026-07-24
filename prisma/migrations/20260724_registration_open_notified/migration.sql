-- Idempotency marker for the one-time "registration open" LINE announcement.
ALTER TABLE "Session" ADD COLUMN "registrationOpenNotifiedAt" TIMESTAMP(3);
