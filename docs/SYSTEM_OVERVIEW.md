# TUATUENG GO! — System Overview

Paste this as context when starting a new AI session on this codebase. It
describes what the app is, the club rules it encodes, and the constraints that
are easy to break by accident.

---

## What it is

A web app for a Thai badminton club ("ก๊วนตัวตึงแหลมฉบัง") that runs a play day
end to end: members sign up for a date, the admin checks them in, the system
matches balanced 2v2 games across the available courts, and at the end it splits
the court and shuttlecock cost per person based on what they actually played.

There are **no player accounts and no player login**. Anything a member does is
public or device-bound. Only the admin authenticates (a PIN).

## Stack

- Next.js 16 App Router (Turbopack), React server components. Pages that read
  the DB use `export const dynamic = "force-dynamic"`.
- Prisma 7.8 + Neon Postgres. Client generated to `app/generated/prisma`.
- Tailwind CSS v4.
- Vitest for pure-function tests in `lib/*.test.ts` (`npm test`).
- Deployed on Vercel. **Migrations do NOT run automatically** — run
  `npx prisma migrate deploy` manually, and run it BEFORE deploying code that
  uses a new column, or the live site breaks.

## Timezone rule (source of many bugs)

Thailand is ICT, UTC+7, no DST. **`Session.date` is stored at UTC midnight of
the intended local date.** So a session on Monday 27 July is
`2026-07-27T00:00:00Z`. Format such dates with `timeZone: "UTC"` to get the
right calendar date. Clock times within a day are derived by adding hours:
19:00 ICT = date + 12h UTC, 20:00 ICT = date + 13h.

## Data model

- **Session** — one play day. `date`, `venue`, `startTime`, `maxPlayers`,
  `courtsEarly`/`courtsLate`, `status` (OPEN/CLOSED), `registrationClosedAt`,
  `openCourts` (comma-separated court numbers; null = auto by clock), frozen
  cost snapshot (`courtCost`, `shuttlecockCost`, `totalCost`, `feePerPerson`),
  `registrationOpenNotifiedAt`.
- **SignUp** — one person on one day. `name`, `skillLevel`, `status`
  (CONFIRMED/WAITLIST/WITHDRAWN), `timeSlot` (where they actually play) vs
  `preferredSlot` (what they asked for), `slotNumber`, `checkedInAt`,
  `checkedOutAt`, `withdrawnAt`, `addedByAdmin`, `fixedPartnerId`, `athleteId`.
- **Athlete** — the durable person across days. `name` is **`@unique`**,
  `skillLevel`, `photoUrl` (data URL), `updatedAt` (cache-busts the photo API).
- **Match** / **MatchPlayer** — a game on a court. `round`, `court`,
  `finishedAt`, `winnerTeam` (1 or 2, null = draw). MatchPlayer has `team`.
- **PendingPair** — the persisted FIFO "คู่เตรียม" queue: `team1Ids[2]`,
  `team2Ids[2]`, ordered by `createdAt`.
- **Announcement** — doubles as both announcements and club rules, split by
  `kind` ("announcement" | "rule").
- **CourtRate**, **ShuttlecockType**, **AppSettings** — master data (prices,
  per-person fee, PromptPay QR).

`SkillLevel` enum, weakest to strongest: `RK, BG, BG_PLUS, N_MINUS, N, N_PLUS,
S, S_PLUS, P`.

## Club rules the code enforces

**Registration window.** Sign-ups for a day open on the **Friday before it at
11:00 ICT** (a Friday session opens that morning). Enforced server-side in the
signup route, not just hidden in the UI. See `lib/registration.ts`.

**Capacity.** Two blocks per day: 1 ทุ่ม (EARLY, 19:00) and 2 ทุ่ม (LATE,
20:00). Courts map to capacity: 2→14, 3→22, 4→28, 5→36, 6→42 players.
`earlyCapacity = min(capacityFor(courtsEarly), maxPlayers)`; the rest is LATE.
Beyond capacity people go to a waitlist capped at `WAITLIST_LIMIT = 5`.
Signing up again with a different block = a request to move; it asks to confirm,
then re-seats everyone.

**Self-withdrawal.** Two independent limits:
1. Time — allowed only until **noon ICT on the play date** (`lib/withdrawPolicy.ts`);
   after that the admin must do it (the club charges 100฿ unless someone fills in).
2. Device — the browser may only withdraw sign-ups it created, tracked in
   `localStorage` by `lib/mySignups.ts`. This is deliberate: the roster is
   public, so without it anyone could withdraw anyone. **Do not replace this
   with a name picker.** Storage writes there are wrapped in try/catch because
   some in-app browsers (LINE on iOS) throw on `setItem`, which used to surface
   as a failed sign-up even though the POST had succeeded.

**Matchmaking** (`lib/matching.ts`, `lib/queue.ts`) — the heart of the app:
- Players are grouped into 4 tiers (`SKILL_TIER`): 1 = RK, 2 = BG/BG+,
  3 = N-/N/N+, 4 = S/S+/P.
- `GROUP_PAIR_COST[a][b]` scores how badly two tiers mix; `courtSkillCost` sums
  it over all six pairings in a foursome, `worstPairCost` takes the worst single
  pairing. Gates use the worst pair, because a sum can hide one terrible pairing.
- `MAX_MIX_PAIR_COST = 30` is the hard gate that keeps RK away from S/P.
- `balanceTeams` splits a foursome into the two most even teams, preferring
  mirrored line-ups over merely equal sums, and never breaks a fixed pair.
- Fixed pairs ("คู่ซ้อมแข่ง", `fixedPartnerId`, mutual) always play together;
  splitting one costs `SPLIT_FIXED_PAIR = 1_000_000`.
- Repeats are penalised on a curve (`REPEAT_PENALTY` by how many of the four
  already met), and `planPendingAdditions` holds an exact rerun back for the
  next batch unless the queue is empty or the admin forces it.
- `PENDING_QUEUE_CAP = 3` — how many คู่เตรียม are queued ahead. Small on
  purpose: a bigger waiting pool gives the matcher more to work with.

**Billing** (`lib/billing.ts`, `lib/costing.ts`):
- The clock starts at the block the player booked (19:00 or 20:00 ICT), not
  when they checked in.
- Minimum 2 hours, then **half-hour steps with a 15-minute grace**: leaving
  21:00–21:15 bills to 21:00, 21:16–21:30 bills to 21:30.
- Court cost is split per half-hour among whoever was present in that half-hour,
  so leaving early genuinely costs less.
- Shuttlecock cost = games played ÷ 4 people × price per shuttle.
- The per-person fee is folded into the court cost, not shown as a line item.
- Prices and the fee are **frozen onto the Session when it closes**, so a later
  price change never rewrites what people were charged.

## Admin

- PIN login → HMAC-SHA256 signed cookie (`lib/adminCookie.ts`, Edge-safe via
  WebCrypto), valid `ADMIN_SESSION_DAYS = 30`. Login is rate limited to 5 tries
  per 15 minutes per IP.
- `proxy.ts` returns **404** (not 401/403) for admin paths without a valid
  cookie, so the admin surface is invisible to players.
- Admin can: create days, edit courts, check people in, withdraw anyone, run the
  live court board (fill courts from คู่เตรียม, finish games, swap players
  mid-game, close a court), edit or delete finished games, manage announcements
  and rules, set master prices, and close the day to freeze the bill.
- Admins get a header switch between the player view and the admin view; the top
  bar turns orange on admin routes as an unmissable "you are in admin mode" cue.

## LINE integration

- **Reply is free and unlimited; push is capped by a monthly quota** on the free
  LINE Official Account tier. This distinction drives the whole design.
- Webhook (`/api/line/webhook`) uses **reply** — members type `รายชื่อ` /
  `เช็คชื่อ` / `list` to get a roster, or `<name> ถอนชื่อ <day>` to withdraw.
- The only **push** is the once-per-Friday "sign-ups are open" announcement,
  triggered by an admin button or a Vercel cron (`vercel.json`,
  `0 4 * * 5` = 11:00 ICT Friday) and made idempotent by
  `Session.registrationOpenNotifiedAt`. Sign-ups and withdrawals deliberately do
  **not** push — doing so once burned the whole monthly quota.
- `/api/line/test` is a read-only diagnostic (quota, consumption, bot info);
  add `?send=1` to actually send.
- Env: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID`, `LINE_SIGNUP_URL`.

## Conventions and traps

- Images are served from `/api/athletes/[id]/photo?v=<updatedAt>` and
  `/api/announcements/[id]/image?v=<updatedAt>` with immutable caching. Do not
  inline the base64 data URLs into pages — that used to make a page ~580 KB.
- Compute derived stats from match history rather than incrementing a stored
  counter: the admin can edit, delete, and swap players in finished games, so an
  incremental total drifts permanently.
- UI text is Thai; code, comments, and commit messages are English.
- Two people sharing a nickname currently merge into one `Athlete`, because the
  signup route reuses any case-insensitively matching name. Fine today (no
  collisions), but it silently merges their history — worth solving before
  building anything that shows per-person stats.
