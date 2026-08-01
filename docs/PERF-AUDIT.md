# Code audit + performance pass — 2026-07-28

Goal: find unused code and make the app faster. Everything checked, changed,
and deliberately left alone is recorded here.

## TL;DR

| Area | Change | Effect |
|---|---|---|
| DB indexes | Added 8 indexes on foreign-key / filter columns | Queries stop full-scanning as the season's data grows |
| Leaderboard quest EXP | Killed an N+1 (`loadQuestExpByAthlete`) | While a quest is open: `1 + 2·N` queries → **2** total |
| Dead code | Removed 2 files + 1 unused function | Smaller surface |

Verify: `npx tsc --noEmit` clean · `npx vitest run` 203/204 (the 1 failure,
`queue.test.ts › planPendingAdditions`, pre-dates this pass and is unrelated).

---

## 1. Performance

### 1.1 Database indexes (biggest long-term win)

Postgres does **not** auto-index foreign keys, and the schema had **no indexes
at all** beyond primary keys and the `@unique` fields. Every "a day's roster",
"this athlete's history", "matches in this session" read was a sequential scan.
Fine at today's size, quietly worse every week.

Added (in `prisma/schema.prisma` as `@@index`, applied live with
`CREATE INDEX IF NOT EXISTS`, and captured in
`prisma/migrations/20260728_indexes/migration.sql`):

- `Session (status, date)` and `Session (date)` — home / `/live` / roster filters
- `SignUp (sessionId)` and `SignUp (athleteId)` — the two ways sign-ups are read everywhere
- `Match (sessionId)`
- `MatchPlayer (matchId)` and `MatchPlayer (signUpId)` — the join both directions
- `PendingPair (sessionId)`

(`Athlete.name`, `SignUp.fixedPartnerId`, and `Quest (active, startDate)` were
already indexed via `@unique` / an earlier migration.)

### 1.2 Leaderboard quest EXP — N+1 removed

`lib/questProgress.ts › loadQuestExpByAthlete` (called on every leaderboard load)
looped over every athlete and called `loadQuestProgress` per person — and each
of those ran 2 queries. So with an open quest it was `1 + 2·N` round trips
(~80 for the current roster). On serverless Postgres every query is its own
network hop, so that was **seconds** of leaderboard latency.

Rewritten to load the window's data **once** (2 queries) and score every athlete
in memory:

- extracted `loadQuestData()` (the two shared queries) and `evaluateAthlete()`
  (pure, no DB) — `loadQuestProgress` and `loadQuestExpByAthlete` now share both;
- athlete ids come from the already-loaded sign-ups, so the extra "distinct
  athlete" query is gone too.

Behaviour is identical (same per-athlete maths); the tests that cover the scoring
rules (`lib/quests.test.ts`) still pass.

### 1.3 Checked and already fine (no change)

- **`loadLeaderboard`** already scores the whole roster in one pass from a single
  `signUp.findMany` — it explicitly avoids per-athlete queries. Only its call to
  the quest helper above was slow; now fixed.
- **Announcement / athlete images** are served from
  `/api/announcements/[id]/image` and `/api/athletes/[id]/photo` with cache
  versions, not inlined as base64 — a prior pass already fixed the megabyte pages.
- **`buildCourtBoard`** is shared by `/live` and the day's courts tab (no dup work).
- The `for … await` loops in `LiveCourts` (fill-all), `queue.ts`, `seating.ts`,
  `MatchControls`, `lineRoster`, `lineWithdraw`, `playerStats`,
  `pending-pairs/route` are sequential **by intent** (ordered fills, dependent
  writes) or run over a single session's handful of rows — not N+1 hot paths.

## 2. Unused code

### Removed

- `app/session/[id]/admin/ManualMatchForm.tsx` — superseded by
  `UpcomingPlanner.tsx`; `CLAUDE.md` already noted it as deletable. Not imported
  anywhere.
- `app/session/RoundTabs.tsx` — orphan component, imported nowhere.
- `lib/quests.ts › questStatus` (+ its `QuestStatus` type) — added earlier but
  never referenced.

### Left in place (exported but only used inside their own file)

Harmless — they're real, used helpers, just exported wider than needed. Not worth
churning: `adminPin` (adminCookie), `activeCourtCount` (billing),
`resolveWithdrawName` (lineWithdraw), `SKILL_TIER` (matching), `thaiDay`
(registrationAnnounce), `withdrawDeadline` (withdrawPolicy), `buildXlsxBytes`
(xlsx). If we ever want them private, just drop the `export` keyword.

## 3. Deploy notes

- Indexes are **already on the live DB** (applied via `IF NOT EXISTS`), so the
  deploy needs nothing special. `npx prisma generate` was re-run.
- The new migration file only matters for spinning up a fresh database.

## 4. Follow-ups (not done — flag if wanted)

- `MultiSignUpForm.tsx` and `SignUpForm.tsx` share a debounced athlete-search
  block; could become one hook. Left alone — they're the forms players use daily.
- ~~Migration files in `prisma/migrations` have drifted from the live schema~~
  **Done (2026-08-01).** Two differences found and reconciled in
  `20260801_reconcile_drift` — `AppSettings.feePerPerson` defaulted to 5 in the
  files and 0 in production, and `Quest_active_startDate_idx` existed in the
  database but not in `schema.prisma`. `20260728_indexes` also had to be
  registered with `migrate resolve --applied`: its SQL was run by hand (see
  Deploy notes above), so production never recorded it. `migrate diff` between
  `schema.prisma` and the live database is now empty.
