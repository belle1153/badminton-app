# TUA TUENG GAMES Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-day team badminton event (6 teams, round robin + knockout) with admin entry of lineups and results, live counting for important rounds, and polling player/TV pages.

**Architecture:** New Prisma tables prefixed `Games*` hold only raw data (teams, ties, rubbers, set scores). Pure functions in `lib/games/` derive everything else (rubber outcome, tie score, standings, knockout participants, who is on which court, the slot clock) into one JSON snapshot. Player and TV pages poll a CDN-cached public endpoint every 2 s; admin pages use an uncached admin endpoint and write through `/api/admin/games/*`.

**Tech Stack:** Next.js 16.2 App Router, React 19, Prisma 7 + Neon Postgres, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-tua-tueng-games-design.md`. Mockups: https://claude.ai/artifact/DzSRk1bzVsy98S2MgSQyJa (page "แข่งแบบทีม (ล่าสุด)").

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (`AGENTS.md`). Route handler and page `params` are Promises (`{ params }: { params: Promise<{ id: string }> }`).
- Additive schema only. Never edit existing models or run `prisma migrate dev`/`deploy` against `DATABASE_URL` (it is the live Neon DB) unless the user says so. Generate the SQL with `prisma migrate diff`.
- Do not touch these untracked files: `app/api/admin/court-rates/`, `app/api/admin/shuttlecocks/`, `app/api/sessions/[id]/court-hours/`, `app/session/[id]/admin/CostExcelExport.tsx`, `app/session/[id]/admin/CourtHourCostEditor.tsx`, `backfill-athlete-links.mjs`.
- Do not commit unless the user asks. `npx tsc --noEmit` has one pre-existing error in `CostExcelExport.tsx`; ignore it, add no new ones.
- UI copy is Thai. Player, TV and live-count pages use the dark navy theme (`#0b1c30` ground, `#102843` panels, `#2f6690` borders, gold `#ffcf4d`, live orange `#ff8a3d`). Admin pages are light like the existing admin pages.
- Rules (verbatim from spec 3): qualifier rubber = 2 sets, 2–0 → 2 pts, 1–1 → 1 each, 0–2 → 0; knockout rubber = best of 3, set to 21, at 20–20 lead by 2, cap 30; knockout rubber win = 1 pt, first to 3 wins the tie, the rest "ไม่ต้องแข่ง". Minutes per rubber default 20 (qualifier) / 30 (knockout), informational only.
- Standings order: points → rubbers won → head-to-head rubbers won (within the tied group) → set-point difference → `rankOverride` → seed.
- Images never go inside the polled JSON: athlete photos via `/api/athletes/[id]/photo?v=<updatedAt ms>`, team logos via `/api/games/teams/[id]/logo?v=<updatedAt ms>`.

## Review Focus

- A result keyed for a rubber that has no lineup yet: shows "คู่ N", still counts in tie score and standings (test in Task 4).
- A qualifier result edited after knockout lineups exist: knockout participants recompute and the tie reports `lineupMismatch` instead of silently showing the wrong team's players (test in Task 3/4).
- A knockout tie decided 3–0 or 3–1: the remaining rubbers become `cancelled` and never appear as "on court" or "next" (test in Task 4).
- Three or more teams level on points and rubbers won: head-to-head counts only ties among that group (test in Task 3).
- A knockout result with no side on 2 sets is refused with a Thai error; invalid set scores (e.g. 21–20) save with a warning (test in Task 2).

---

### Task 1: Schema and migration file

**Files:**
- Modify: `prisma/schema.prisma` (append after `Quest`)
- Create: `prisma/migrations/20261020_games/migration.sql`

**Interfaces:**
- Produces: Prisma models `GamesEvent`, `GamesTeam`, `GamesTeamMember`, `GamesTie`, `GamesRubber`, enum `GamesStage`, exactly as in spec §5, plus `GamesRubber.liveSet Int?` (the set number 1–3 currently being live-counted; null when not live counting).

- [ ] **Step 1:** Append the models from spec §5 (including `GamesTeam.logoUrl`, `GamesTeam.updatedAt`) and `liveSet` to `prisma/schema.prisma`. Athlete references stay plain `String` ids (no relation).
- [ ] **Step 2:** `git show HEAD:prisma/schema.prisma > %TEMP%/schema.before.prisma`, then `npx prisma migrate diff --from-schema <that file> --to-schema prisma/schema.prisma --script > prisma/migrations/20261020_games/migration.sql`. Expected: only `CREATE TYPE "GamesStage"`, five `CREATE TABLE`, indexes, unique indexes and foreign keys; no `ALTER`/`DROP` of existing tables.
- [ ] **Step 3:** `npx prisma generate`. Expected: client regenerated, `prisma.gamesEvent` etc. exist (`npx tsc --noEmit` shows only the pre-existing error).

### Task 2: Schedule, rules, colours

**Files:**
- Create: `lib/games/types.ts`, `lib/games/schedule.ts`, `lib/games/rules.ts`, `lib/games/color.ts`
- Test: `lib/games/schedule.test.ts`, `lib/games/rules.test.ts`

**Interfaces:**
- Produces (`types.ts`): `type Stage = "QUALIFIER" | "SEMI" | "FIFTH" | "THIRD" | "FINAL"`, `type SetScore = [number, number]`, `type Side = "A" | "B"`, `type RubberOutcome = Side | "DRAW" | null`.
- Produces (`schedule.ts`):
  - `QUALIFIER_ROUNDS: [number, number][][]` = `[[[1,6],[2,5],[3,4]], [[1,5],[6,4],[2,3]], [[1,4],[5,3],[6,2]], [[1,3],[4,2],[5,6]], [[1,2],[3,6],[4,5]]]` (seed pairs; slot s uses courts 2s−1 and 2s; round r starts at `14:00 + (r−1)h`).
  - `KNOCKOUT_TIES` = SEMI slot 1 19:30 courts 1–2 · SEMI slot 2 20:00 courts 3–4 · FIFTH 20:30 courts 5–6 · THIRD 21:00 courts 1–2 · FINAL 21:30 courts 3–4.
  - `DEFAULT_TEAMS` = seeds 1–6: แดง `#dc2626`, ชมพู `#f472b6`, ม่วง `#7e22ce`, เขียว `#15803d`, น้ำเงิน `#1d4ed8`, เหลือง `#facc15`. `TEAM_SWATCHES` = those six plus ส้ม `#ea580c`, ฟ้า `#0ea5e9`, น้ำตาล `#92400e`, เทา `#64748b`, ดำ `#111827`, ขาว `#f8fafc`.
  - `rubberCourt(order: number, courtA: number, courtB: number): number` (odd → A, even → B).
  - `rubberOffsetMinutes(order: number, minutesPerRubber: number): number` (1,2 → 0; 3,4 → m; 5 → 2m).
  - `parseHHMM(s: string): number` (minutes since midnight).
  - `buildSchedule(teams: { id: string; seed: number }[]): TieSpec[]` where `TieSpec = { stage: Stage; round: number | null; slot: number; startsAt: string; courtA: number; courtB: number; teamAId: string | null; teamBId: string | null; rubbers: { order: number; court: number }[] }`. 15 qualifier + 5 knockout ties, each with 5 rubbers.
  - `tieLabel(stage: Stage, round: number | null, slot: number): string`: `รอบ 2 · แมตซ์ 1`, `รองชนะเลิศ 1`, `ชิงอันดับ 5`, `ชิงอันดับ 3`, `ชิงชนะเลิศ`.
- Produces (`rules.ts`):
  - `setsFromColumns(r: { set1A: number|null; set1B: number|null; set2A: …; set3B: number|null }): SetScore[]` (consecutive pairs where both are non-null).
  - `rubberOutcome(stage: Stage, sets: SetScore[], finished: boolean): RubberOutcome`.
  - `rubberPoints(stage: Stage, outcome: RubberOutcome): [number, number]`.
  - `knockoutSetOver(a: number, b: number): boolean` and `isValidKnockoutSet(a: number, b: number): boolean`.
  - `validateResult(stage: Stage, sets: SetScore[]): { ok: true; warnings: string[] } | { ok: false; error: string }`.
  - `tieScore(stage: Stage, outcomes: RubberOutcome[] /* by order 1–5 */): { pointsA: number; pointsB: number; winner: Side | null; decidedAt: number | null }` (`decidedAt` = order of the rubber that gave a knockout side its 3rd point).
- Produces (`color.ts`): `textOn(hex: string): "#ffffff" | "#0b1c30"` (pick the higher WCAG contrast).

- [ ] **Step 1: Write failing tests**

```ts
// schedule.test.ts
expect(buildSchedule(seeds).filter(t => t.stage === "QUALIFIER")).toHaveLength(15);
// every pair of seeds meets exactly once in the qualifier
// round 2 slot 2 is seed 6 vs seed 4 on courts 3–4 at "15:00"
// knockout: SEMI 1 "19:30" courts 1–2 … FINAL "21:30" courts 3–4, teams null
expect(buildSchedule(seeds)[0].rubbers.map(r => r.court)).toEqual([1, 2, 1, 2, 1]);
expect(rubberOffsetMinutes(3, 20)).toBe(20); expect(rubberOffsetMinutes(5, 30)).toBe(60);
expect(tieLabel("QUALIFIER", 2, 1)).toBe("รอบ 2 · แมตซ์ 1");

// rules.test.ts
expect(rubberOutcome("QUALIFIER", [[21, 15], [18, 21]], true)).toBe("DRAW");
expect(rubberOutcome("QUALIFIER", [[15, 21], [19, 21]], true)).toBe("B");
expect(rubberOutcome("QUALIFIER", [[21, 15]], true)).toBe(null);          // needs both sets
expect(rubberOutcome("QUALIFIER", [[21, 15], [21, 18]], false)).toBe(null); // not finished
expect(rubberOutcome("SEMI", [[21, 17], [18, 21], [21, 19]], true)).toBe("A");
expect(rubberPoints("QUALIFIER", "DRAW")).toEqual([1, 1]);
expect(rubberPoints("FINAL", "B")).toEqual([0, 1]);
expect(knockoutSetOver(21, 19)).toBe(true); expect(knockoutSetOver(21, 20)).toBe(false);
expect(knockoutSetOver(30, 29)).toBe(true);
expect(isValidKnockoutSet(23, 21)).toBe(true); expect(isValidKnockoutSet(21, 20)).toBe(false);
expect(validateResult("SEMI", [[21, 17], [18, 21]])).toEqual({ ok: false, error: "รอบน็อกเอาต์ต้องมีฝั่งที่ชนะ 2 เซต" });
expect(validateResult("SEMI", [[21, 20], [21, 10]])).toMatchObject({ ok: true, warnings: ["เซต 1 (21–20) ไม่ตรงกติกา 21 แต้ม"] });
expect(validateResult("QUALIFIER", [[21, 15]])).toEqual({ ok: false, error: "รอบคัดเลือกต้องใส่แต้มครบ 2 เซต" });
expect(tieScore("SEMI", ["A", "A", "B", "A", null])).toMatchObject({ pointsA: 3, pointsB: 1, winner: "A", decidedAt: 4 });
expect(tieScore("QUALIFIER", ["A", "DRAW", "B", "B", "A"])).toMatchObject({ pointsA: 5, pointsB: 5, winner: null });
expect(textOn("#facc15")).toBe("#0b1c30"); expect(textOn("#1d4ed8")).toBe("#ffffff");
```

- [ ] **Step 2:** `npx vitest run lib/games`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the four modules. In a set with equal points nobody wins that set; a qualifier rubber compares sets won. Qualifier sets accept any non-negative integers.
- [ ] **Step 4:** `npx vitest run lib/games`. Expected: PASS.

### Task 3: Standings and knockout participants

**Files:**
- Create: `lib/games/standings.ts`, `lib/games/knockout.ts`
- Test: `lib/games/standings.test.ts`, `lib/games/knockout.test.ts`

**Interfaces:**
- Consumes: Task 2 `rubberOutcome`, `rubberPoints`, `Stage`, `SetScore`.
- Produces:
  - `type StandingRow = { teamId: string; rank: number; points: number; won: number; drawn: number; lost: number; pointsFor: number; pointsAgainst: number; diff: number; h2h: number }`.
  - `computeStandings(teams: { id: string; seed: number }[], ties: { teamAId: string; teamBId: string; rubbers: { outcome: RubberOutcome; sets: SetScore[] }[] }[], rankOverride: string[] | null): StandingRow[]` (qualifier ties only; only finished rubbers count; `pointsFor/Against` sum every set of finished rubbers).
  - `resolveKnockout(ties: { id: string; stage: Stage; slot: number; winner: Side | null; teamAId: string | null; teamBId: string | null }[], standings: StandingRow[], qualifierDone: boolean): Record<string, { teamAId: string | null; teamBId: string | null; projected: boolean }>`. SEMI 1 = rank 1 vs 4, SEMI 2 = rank 2 vs 3, FIFTH = rank 5 vs 6 (`projected = !qualifierDone`). THIRD = loser of SEMI 1 (A) vs loser of SEMI 2 (B); FINAL = winners, each side null until its semi is decided.

- [ ] **Step 1: Write failing tests**

```ts
// spec mock: red 9 pts/4 wins, blue 8/4, pink 8/4 (blue beat pink 3–2 rubbers head to head) → blue above pink
// three-way: A, B, C all 6 pts and 3 wins; head-to-head among them only; D's results ignored for h2h
// all equal including diff → rankOverride order wins; without override → seed order
// rubbers not finished do not count
expect(resolveKnockout(koTies, standings, false)[semi1.id]).toEqual({ teamAId: rank1, teamBId: rank4, projected: true });
// FINAL sides null until both semis decided; THIRD gets the semi losers
```

- [ ] **Step 2:** Run `npx vitest run lib/games`. Expected: FAIL.
- [ ] **Step 3:** Implement. Sort by points, then won; inside each group equal on both, compute `h2h` = rubbers won in ties between members of that group, then sort by h2h, diff, override index, seed. `rank` is 1-based position after sorting.
- [ ] **Step 4:** Run tests. Expected: PASS.

### Task 4: Courts, clock and the state snapshot

**Files:**
- Create: `lib/games/courts.ts`, `lib/games/clock.ts`, `lib/games/state.ts`, `lib/games/load.ts`
- Test: `lib/games/courts.test.ts`, `lib/games/clock.test.ts`, `lib/games/state.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `courtsNowNext(rubbers: { id: string; court: number; finished: boolean; cancelled: boolean; startMinute: number; order: number }[], nowMinute: number): { court: number; nowId: string | null; nowStarted: boolean; nextId: string | null }[]` (courts ascending; per court the first not-finished not-cancelled rubber by `startMinute`, then `order`; `nowStarted = startMinute <= nowMinute`).
  - `slotClock(ties: { stage: Stage; round: number | null; label: string; startsAt: string }[], minutes: { qualifier: number; knockout: number }, nowMinute: number): { label: string; remainingSec: number } | null`. Inside a qualifier round window → `รอบ N · ช่วงคู่ 1–2|3–4|5` and seconds left in that 20-min slot. Otherwise → `ถัดไป: <tie label> <HH:MM>` counting down to the next tie start. After the last tie → null.
  - `ictNowMinute(now: Date): number` (minutes since ICT midnight, fractional).
  - `type GamesState` (the public JSON): `{ event: { id; name; date: string; qualifierMinutes; knockoutMinutes; published }, serverNow: string, teams: { id; seed; name; color; textColor; logoUrl: string | null; members: { id; name; photoUrl: string | null }[] }[], ties: TieView[], standings: StandingRow[], qualifierDone: boolean, courts: { court; nowRubberId; nowStarted; nextRubberId }[] }`, `TieView = { id; stage; round; slot; label; startsAt; courtA; courtB; teamAId; teamBId; projected; pointsA; pointsB; winner; status: "upcoming" | "live" | "done"; lineupMismatch: boolean; rubbers: RubberView[] }`, `RubberView = { id; order; court; a: (PlayerRef | null)[]; b: (PlayerRef | null)[]; sets: SetScore[]; finished; outcome; status: "done" | "live" | "next" | "upcoming" | "cancelled"; liveSet: number | null; startMinute }`, `PlayerRef = { id; name; photoUrl: string | null }`.
  - `buildGamesState(rows: GamesRows, now: Date): GamesState` where `GamesRows` is the shape `load.ts` reads (event with teams→members, ties→rubbers, plus `athletes: { id; name; updatedAt: Date; hasPhoto: boolean }[]`).
  - `loadGamesState(eventId: string): Promise<GamesState | null>` and `latestPublishedEvent(): Promise<{ id: string; name: string } | null>`.

- [ ] **Step 1: Write failing tests**

```ts
// courts: court 1 holds rubbers 1,3,5 of a tie; after rubber 1 finishes → now = rubber 3, next = rubber 5
// cancelled rubbers are skipped; a rubber whose startMinute is later than now → nowStarted false
expect(slotClock(ties, { qualifier: 20, knockout: 30 }, parseHHMM("15:25"))).toEqual({ label: "รอบ 2 · ช่วงคู่ 3–4", remainingSec: 900 });
expect(slotClock(ties, m, parseHHMM("19:10"))).toEqual({ label: "ถัดไป: รองชนะเลิศ 1 19:30", remainingSec: 1200 });
// state: a finished rubber with no lineup → a = [null, null], outcome counted in pointsA/pointsB
// state: knockout tie A wins rubbers 1–3 → rubbers 4,5 status "cancelled"
// state: SEMI lineup holds an athlete not in the resolved team → lineupMismatch true
// state: photoUrl is "/api/athletes/<id>/photo?v=<ms>" only when hasPhoto
```

- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `startMinute` = `parseHHMM(tie.startsAt) + rubberOffsetMinutes(order, minutes for stage)`. Tie `status`: done when the tie has a winner (knockout) or all 5 rubbers finished (qualifier); live when any rubber finished or live-counting or `startsAt` has passed; else upcoming. Rubber `status`: done if finished, cancelled per `tieScore.decidedAt`, live if it is some court's `nowId` and `nowStarted`, next if it is a court's `nextId` or a not-started `nowId`, else upcoming. `load.ts` does one `prisma.gamesEvent.findUnique` with nested includes plus one `prisma.athlete.findMany({ where: { id: { in } }, select: { id, name, updatedAt, photoUrl } })` mapped to `hasPhoto`.
- [ ] **Step 4:** Run tests. Expected: PASS.

### Task 5: Public endpoints and the polling hook

**Files:**
- Create: `app/api/games/[eventId]/state/route.ts`, `app/api/games/teams/[teamId]/logo/route.ts`, `app/games/useGamesState.ts`

**Interfaces:**
- Consumes: `loadGamesState`, `parseDataUrl` (`lib/dataUrl.ts`).
- Produces: `GET /api/games/[eventId]/state` → `GamesState` JSON, 404 when missing or not published, header `Cache-Control: public, s-maxage=1, stale-while-revalidate=1`. `GET /api/games/teams/[teamId]/logo` → image bytes, `public, max-age=31536000, immutable` (mirror `app/api/athletes/[id]/photo/route.ts`). Client hook `useGamesState(eventId: string, initial: GamesState, opts?: { admin?: boolean; intervalMs?: number }): { state: GamesState; refresh: () => Promise<void> }` polling every 2000 ms while `document.visibilityState === "visible"`, refetching on `visibilitychange`; admin mode fetches `/api/admin/games/[eventId]/state` with `cache: "no-store"`; failed fetches keep the last state.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. Implement both routes and the hook.
- [ ] **Step 2:** `npx tsc --noEmit`. Expected: only the pre-existing error.

### Task 6: Player pages, home button, header

**Files:**
- Create: `app/games/[eventId]/page.tsx`, `app/games/[eventId]/GamesHome.tsx`, `app/games/[eventId]/tie/[tieId]/page.tsx`, `app/games/[eventId]/tie/[tieId]/GamesTie.tsx`, `app/games/ui.tsx` (shared `TeamChip` with logo or shield fallback, `PairAvatars`, `SetLine`)
- Modify: `app/page.tsx` (card linking to the latest published event), `app/SiteHeader.tsx` (render nothing on `/games/<id>/tv/*` and `/admin/games/<id>/live/*`)

**Interfaces:**
- Consumes: `useGamesState`, `GamesState`, `latestPublishedEvent`.

- [ ] **Step 1:** Build the pages from mockup boards "ผู้เล่น · หน้างานแข่ง" and "ผู้เล่น · แมตซ์ทีมพบทีม" (dark, `max-w-[480px]`, Chakra Petch via `var(--font-pixel-body)`). Requirements from spec 4.1: tie header shows `[team A] pointsA–pointsB [team B]` centred over the court cards ("แมตซ์ N" left, "ดูแมตซ์ ›" right); court cards from `state.courts` grouped by tie, status chip "กำลังแข่ง" (nowStarted) or "รอลง", "ถัดไปบนสนามนี้"; no scores except rubbers with `liveSet` set ("นับสด" chip and the current sets); standings with dashed line after rank 4 and the tiebreak note; schedule grid 5×3; knockout list with "(ตามอันดับตอนนี้)" while `projected`. Tie page: big sets-won number, set points underneath (`15–21 · 19–21`), result line (`น้ำเงิน ชนะ +2`, knockout `+1`, `ไม่ต้องแข่ง` for cancelled).
- [ ] **Step 2:** Pages are server components with `export const dynamic = "force-dynamic"` that call `loadGamesState` (404 via `notFound()` when null or unpublished for non-admins) and pass the snapshot to the client component.
- [ ] **Step 3:** `npx tsc --noEmit` and `npm run lint`. Expected: no new errors.

### Task 7: TV pages

**Files:**
- Create: `app/games/[eventId]/tv/standings/page.tsx`, `app/games/[eventId]/tv/schedule/page.tsx`, `app/games/[eventId]/tv/TvScreens.tsx` (client: `TvStandings`, `TvSchedule`, `SlotClock`)

**Interfaces:**
- Consumes: `useGamesState`, `slotClock`, `ictNowMinute`.

- [ ] **Step 1:** Build from mockup boards "จอใหญ่ · ตารางคะแนน (ตัวใหญ่)" and "จอใหญ่ · ตารางแข่งและผล": full viewport (`h-screen`, sizes in `vw` so a 1920×1080 TV matches the mockup), team logos, dashed cut line after rank 4. `SlotClock` ticks every second locally from `serverNow` offset; shown only when today (ICT) is the event date. A small link in a corner switches between the two screens.
- [ ] **Step 2:** `npx tsc --noEmit`. Expected: no new errors.

### Task 8: Admin API

**Files:**
- Create: `lib/games/input.ts`, `app/api/admin/games/route.ts`, `app/api/admin/games/[eventId]/route.ts`, `app/api/admin/games/[eventId]/state/route.ts`, `app/api/admin/games/[eventId]/schedule/route.ts`, `app/api/admin/games/teams/[teamId]/route.ts`, `app/api/admin/games/ties/[tieId]/lineup/route.ts`, `app/api/admin/games/rubbers/[rubberId]/route.ts`
- Modify: `app/api/athletes/[id]/route.ts` (DELETE: when a survivor exists also move `GamesTeamMember.athleteId` and rubber `a1Id…b2Id`; drop the duplicate membership if the survivor is already in that team)
- Test: `lib/games/input.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (all `isAdmin()`-guarded, JSON errors in Thai, 403 `ต้องเป็นแอดมิน`):
  - `GET /api/admin/games` → events list; `POST` `{ name, date: "YYYY-MM-DD" }` → creates the event with `DEFAULT_TEAMS`.
  - `PATCH /api/admin/games/[eventId]` `{ name?, date?, qualifierRubberMinutes?, knockoutRubberMinutes?, published?, rankOverride?: string[] | null }`; `DELETE` removes the event (cascade).
  - `GET /api/admin/games/[eventId]/state` → `GamesState` (published or not), `Cache-Control: no-store`.
  - `POST /api/admin/games/[eventId]/schedule` → (re)creates all ties and rubbers from `buildSchedule`; 409 `มีผลการแข่งแล้ว สร้างตารางใหม่ไม่ได้` if any rubber has a set score.
  - `PATCH /api/admin/games/teams/[teamId]` `{ name?, color?, logoUrl?: string | null, memberIds?: string[] }`; `memberIds` replaces the roster; 409 listing names already in another team of the event; logo rules as athlete photos (`data:image/`, ≤ 300 000 chars).
  - `PUT /api/admin/games/ties/[tieId]/lineup` `{ side: "A" | "B", pairs: ([string, string] | null)[] /* length 5 */ }` → writes `a1Id/a2Id` or `b1Id/b2Id` per order; 400 if one athlete appears twice.
  - `PATCH /api/admin/games/rubbers/[rubberId]` `{ court?, sets?: SetScore[], finish?: boolean, liveSet?: number | null, liveStartedAt?: string | null }`. `finish: true` runs `validateResult` (400 with its error; warnings returned as `{ warnings }`) and sets `finishedAt`; `finish: false` clears it. Writing `sets` overwrites all six columns (last write wins).
  - `lib/games/input.ts`: `parseSets(raw: unknown): SetScore[] | null` (array of ≤ 3 pairs of integers 0–99), `parsePairs(raw: unknown): ([string, string] | null)[] | null`, `duplicateIds(pairs): string[]`, `memberConflicts(memberIds: string[], otherTeams: { name: string; memberIds: string[] }[], athleteNames: Map<string, string>): string[]`.

- [ ] **Step 1: Write failing tests** for `parseSets` (rejects `-1`, `1.5`, 4 pairs, strings), `parsePairs` (length must be 5), `duplicateIds`, `memberConflicts` (returns `"ต้น (แดง)"`).
- [ ] **Step 2:** Run `npx vitest run lib/games`. Expected: FAIL. Implement `input.ts`. Expected: PASS.
- [ ] **Step 3:** Implement the routes following `app/api/admin/quests/route.ts`. `npx tsc --noEmit`. Expected: no new errors.

### Task 9: Admin pages

**Files:**
- Create: `app/admin/games/page.tsx`, `app/admin/games/GamesEventList.tsx`, `app/admin/games/[eventId]/page.tsx`, `app/admin/games/[eventId]/RoundBoard.tsx`, `app/admin/games/[eventId]/setup/page.tsx`, `app/admin/games/[eventId]/setup/EventSettings.tsx`, `app/admin/games/[eventId]/setup/TeamEditor.tsx`, `app/admin/games/[eventId]/lineup/[tieId]/page.tsx`, `app/admin/games/[eventId]/lineup/[tieId]/LineupEditor.tsx`
- Modify: `app/admin/AdminNav.tsx` (add `{ href: "/admin/games", label: "เกมส์", icon: "🏆" }`)

**Interfaces:**
- Consumes: Task 8 endpoints, `useGamesState(…, { admin: true })`, `PhotoCropModal` from `app/admin/athletes/PhotoCropModal.tsx` for logos, athlete search the same way `AthleteRoster` loads athletes.

- [ ] **Step 1:** Event list: create (name, date), open, publish toggle, delete with an on-page confirm step (no `confirm()`).
- [ ] **Step 2:** Setup page from mockup "แอดมิน · ตั้งค่างานและทีม": name/date/minutes; per team logo (upload via `PhotoCropModal`, remove), name, 12 swatches + "สีอื่น…" hex input, member chips with × and name search add, warning when not 10; button "สร้างตารางแข่ง" (disabled with the 409 message shown when results exist); tie-break override editor shown only when standings have teams level on all four criteria.
- [ ] **Step 3:** Round board from mockup "แอดมิน · คุมรอบและกรอกผล": tabs รอบ 1–5 + น็อกเอาต์ (default: the round of the earliest unfinished tie); per tie: lineup status per side + link, per rubber the names, status, court select, set inputs (2 for qualifier, 3 for knockout), "บันทึกผลคู่ N", saved rows show sets + result + "แก้"; warnings from the API shown under the row; `lineupMismatch` banner; link "เปิดหน้านับสด"; "รอบถัดไป" box listing teams without a lineup; link to print slips.
- [ ] **Step 4:** Lineup editor from mockup "แอดมิน · คีย์ใบส่งตัว": team toggle, pairs 1–5 with two selects each from that team's members, already-used names removed from other selects, "ยังไม่ได้ใส่" chips, save allowed when incomplete.
- [ ] **Step 5:** `npx tsc --noEmit` and `npm run lint`. Expected: no new errors.

### Task 10: Live counting page

**Files:**
- Create: `app/admin/games/[eventId]/live/[rubberId]/page.tsx`, `app/admin/games/[eventId]/live/[rubberId]/LiveScorer.tsx`, `lib/games/live.ts`
- Test: `lib/games/live.test.ts`

**Interfaces:**
- Consumes: `knockoutSetOver`, rubber `PATCH`.
- Produces: `applyTap(stage: Stage, sets: SetScore[], liveSet: number, side: Side, delta: 1 | -1): { sets: SetScore[]; liveSet: number; rubberOver: boolean }`. Knockout: when the current set becomes over, open the next set (`liveSet + 1`) unless a side has 2 sets (`rubberOver`). Qualifier: sets never auto-close; `closeSet(sets, liveSet): { sets; liveSet; rubberOver }` closes the current set (rubber over after set 2). `delta -1` never goes below 0 and never reopens a closed set.

- [ ] **Step 1: Write failing tests:** knockout 20–19 + A → set over, liveSet 2; 29–29 + B → 29–30 over; set 1 A, set 2 A → `rubberOver`; −1 at 0 stays 0; qualifier 21–15 tap does not close; `closeSet` twice → `rubberOver`.
- [ ] **Step 2:** Run tests, FAIL → implement → PASS.
- [ ] **Step 3:** Page from mockup "แอดมิน · นับสด": landscape full screen; halves in team colours (`textOn` for text); tap area +1 and a separate `−1` button per side; set chips, sets-won, serve hint (last scorer); "ย้อนแต้ม" restores the previous snapshot kept in component state; "กรอกผลสรุป" form (3 set rows, set 3 optional); clock start/pause (sets `liveStartedAt`, informational); each change PATCHes `{ sets, liveSet }`; rubber over → confirm screen "บันทึกผล" (`finish: true`) / "แก้ผลก่อน"; after saving show the next rubber on this court (from `state.courts`) with "เริ่มคู่ถัดไป" and "เลือกคู่อื่น"; court select switches to another court's current rubber.
- [ ] **Step 4:** `npx tsc --noEmit`. Expected: no new errors.

### Task 11: Printable result slips

**Files:**
- Create: `app/admin/games/[eventId]/slips/page.tsx`, `app/admin/games/[eventId]/slips/PrintButton.tsx`

- [ ] **Step 1:** Server page listing every rubber (qualifier 75 + knockout 25), 4 slips per A4 page (`@page { size: A4; margin: 10mm }`, `break-inside: avoid`), light theme. Each slip: event name, tie label, team A vs team B names (knockout: "ทีม ____" when not yet known), คู่ที่ N, สนาม N, blank name lines for both pairs, set boxes (2 for qualifier, 3 for knockout), two signature lines. No athlete names. A `PrintButton` client component calls `window.print()`; the button is hidden in print.
- [ ] **Step 2:** `npx tsc --noEmit`. Expected: no new errors.

### Task 12: Verify and document

**Files:**
- Modify: `CLAUDE.md` (changelog entry in Thai: what was added, the deploy note `npx prisma generate` + `npx prisma migrate deploy` before deploying), `docs/superpowers/specs/2026-10-20-tua-tueng-games-design.md` (§5 add `liveSet`; §11 note the regular-day request was done in commits `bcbc083` and `8acc819`)

- [ ] **Step 1:** `npx vitest run`. Expected: all suites pass.
- [ ] **Step 2:** `npx tsc --noEmit` (only the pre-existing error) and `npm run lint` (no new problems).
- [ ] **Step 3:** Browser check needs the new tables. Ask the user before applying the migration to the DB. With approval: `npx prisma migrate deploy`, start the dev server, create an event, generate the schedule, key a lineup and three results, and check the player page, both TV screens, the live page and the slips page at phone width and 1920×1080.
- [ ] **Step 4:** Report what was verified and what was not. Commit only if the user asks.
