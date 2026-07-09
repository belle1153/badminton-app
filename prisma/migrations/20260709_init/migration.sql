-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('RK', 'N_MINUS', 'N', 'N_PLUS', 'S', 'S_PLUS', 'BG', 'BG_PLUS', 'P');

-- CreateEnum
CREATE TYPE "SignUpStatus" AS ENUM ('CONFIRMED', 'WAITLIST', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "courtConfigNote" TEXT,
    "remark" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "registrationClosedAt" TIMESTAMP(3),
    "courtRateId" TEXT,
    "courtHours" DOUBLE PRECISION,
    "shuttlecockTypeId" TEXT,
    "shuttlecockQty" INTEGER,
    "courtCost" INTEGER,
    "shuttlecockCost" INTEGER,
    "totalCost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignUp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "status" "SignUpStatus" NOT NULL DEFAULT 'CONFIRMED',
    "slotNumber" INTEGER,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedPartnerId" TEXT,
    "athleteId" TEXT,

    CONSTRAINT "SignUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerHour" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttlecockType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerPiece" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttlecockType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "qrImageDataUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "court" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "signUpId" TEXT NOT NULL,
    "team" INTEGER NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignUp_fixedPartnerId_key" ON "SignUp"("fixedPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_name_key" ON "Athlete"("name");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_courtRateId_fkey" FOREIGN KEY ("courtRateId") REFERENCES "CourtRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_shuttlecockTypeId_fkey" FOREIGN KEY ("shuttlecockTypeId") REFERENCES "ShuttlecockType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_fixedPartnerId_fkey" FOREIGN KEY ("fixedPartnerId") REFERENCES "SignUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_signUpId_fkey" FOREIGN KEY ("signUpId") REFERENCES "SignUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
