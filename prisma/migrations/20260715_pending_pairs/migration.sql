-- CreateTable
CREATE TABLE "PendingPair" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "team1Ids" TEXT[],
    "team2Ids" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingPair_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PendingPair" ADD CONSTRAINT "PendingPair_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
