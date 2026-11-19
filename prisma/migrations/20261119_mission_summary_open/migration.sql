-- มิชชั่นโคตรตึง summary page on/off switch. Adds one column, off by default.
ALTER TABLE "AppSettings" ADD COLUMN "missionSummaryOpen" BOOLEAN NOT NULL DEFAULT false;
