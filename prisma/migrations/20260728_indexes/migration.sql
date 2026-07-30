-- Foreign-key / filter-column indexes. Postgres does not create these
-- automatically, so every read filtering by session/athlete/match previously
-- scanned the whole table. Already applied to the live DB via IF NOT EXISTS;
-- this file makes a fresh `prisma migrate deploy` reproduce them.

CREATE INDEX IF NOT EXISTS "Session_status_date_idx" ON "Session" ("status", "date");
CREATE INDEX IF NOT EXISTS "Session_date_idx" ON "Session" ("date");
CREATE INDEX IF NOT EXISTS "SignUp_sessionId_idx" ON "SignUp" ("sessionId");
CREATE INDEX IF NOT EXISTS "SignUp_athleteId_idx" ON "SignUp" ("athleteId");
CREATE INDEX IF NOT EXISTS "Match_sessionId_idx" ON "Match" ("sessionId");
CREATE INDEX IF NOT EXISTS "MatchPlayer_matchId_idx" ON "MatchPlayer" ("matchId");
CREATE INDEX IF NOT EXISTS "MatchPlayer_signUpId_idx" ON "MatchPlayer" ("signUpId");
CREATE INDEX IF NOT EXISTS "PendingPair_sessionId_idx" ON "PendingPair" ("sessionId");
