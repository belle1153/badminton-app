-- CreateEnum
CREATE TYPE "GamesCardKind" AS ENUM ('DOUBLE_DOWN', 'STEAL', 'SUBSTITUTION');

-- CreateTable
CREATE TABLE "GamesCard" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tieId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "kind" "GamesCardKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "swapWith" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamesCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamesCard_eventId_idx" ON "GamesCard"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GamesCard_tieId_teamId_key" ON "GamesCard"("tieId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GamesCard_eventId_teamId_kind_key" ON "GamesCard"("eventId", "teamId", "kind");

-- AddForeignKey
ALTER TABLE "GamesCard" ADD CONSTRAINT "GamesCard_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GamesEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamesCard" ADD CONSTRAINT "GamesCard_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "GamesTie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamesCard" ADD CONSTRAINT "GamesCard_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "GamesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

