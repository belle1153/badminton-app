-- TUA TUENG GAMES: team-event tables only. Additive — no existing table is
-- touched. Run `npx prisma migrate deploy` before deploying code that uses it.

-- CreateEnum
CREATE TYPE "GamesStage" AS ENUM ('QUALIFIER', 'SEMI', 'FIFTH', 'THIRD', 'FINAL');

-- CreateTable
CREATE TABLE "GamesEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "qualifierRubberMinutes" INTEGER NOT NULL DEFAULT 20,
    "knockoutRubberMinutes" INTEGER NOT NULL DEFAULT 30,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "rankOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamesEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamesTeam" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamesTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamesTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,

    CONSTRAINT "GamesTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamesTie" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "stage" "GamesStage" NOT NULL,
    "round" INTEGER,
    "slot" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "courtA" INTEGER NOT NULL,
    "courtB" INTEGER NOT NULL,
    "teamAId" TEXT,
    "teamBId" TEXT,

    CONSTRAINT "GamesTie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamesRubber" (
    "id" TEXT NOT NULL,
    "tieId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "court" INTEGER NOT NULL,
    "a1Id" TEXT,
    "a2Id" TEXT,
    "b1Id" TEXT,
    "b2Id" TEXT,
    "set1A" INTEGER,
    "set1B" INTEGER,
    "set2A" INTEGER,
    "set2B" INTEGER,
    "set3A" INTEGER,
    "set3B" INTEGER,
    "finishedAt" TIMESTAMP(3),
    "liveSet" INTEGER,
    "liveStartedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamesRubber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamesTeam_eventId_seed_key" ON "GamesTeam"("eventId", "seed");

-- CreateIndex
CREATE INDEX "GamesTeamMember_athleteId_idx" ON "GamesTeamMember"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "GamesTeamMember_teamId_athleteId_key" ON "GamesTeamMember"("teamId", "athleteId");

-- CreateIndex
CREATE INDEX "GamesTie_eventId_idx" ON "GamesTie"("eventId");

-- CreateIndex
CREATE INDEX "GamesRubber_tieId_idx" ON "GamesRubber"("tieId");

-- AddForeignKey
ALTER TABLE "GamesTeam" ADD CONSTRAINT "GamesTeam_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GamesEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamesTeamMember" ADD CONSTRAINT "GamesTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "GamesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamesTie" ADD CONSTRAINT "GamesTie_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GamesEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamesRubber" ADD CONSTRAINT "GamesRubber_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "GamesTie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

