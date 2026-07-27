-- Admin-created, time-boxed challenges. Only the definition is stored; who
-- completed it is derived from match history on read.
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🎯',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "target" INTEGER,
    "expReward" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quest_active_startDate_idx" ON "Quest"("active", "startDate");
