# Mission โคตรตึง! — EXP, levels, badges and quests

The player-facing progression layer: `/player` (mission rules + name search),
`/player/<athleteId>` (profile), `/leaderboard`, and `/admin/quests`.

Read `SYSTEM_OVERVIEW.md` first for the club rules and data model this sits on.

---

## The one rule that must never be broken

**The gamification level is not the skill level.** `SkillLevel` (RK / BG / BG+ /
N- / N / N+ / S / S+ / P) is assessed by the admin and drives matchmaking. The
gamification level measures showing up and playing, nothing else.

If the two are ever connected — level feeding skill, or skill feeding level —
matchmaking breaks and members start pressuring the admin for a skill bump to
raise their level. The palettes are deliberately different, and rank titles
deliberately avoid those letters. A test in `levels.test.ts` asserts no rank
title is ever a skill letter.

## Nothing is stored, everything is recomputed

EXP, badges and quest completion are all derived from match history on every
read. The admin can edit a result, delete a game, or swap a player out of a
finished game at any time — a stored counter or a saved winner list would drift
from the truth permanently and keep rewarding someone for a game that no longer
exists.

The cost is recomputation on each page load. The roster is under a hundred
people, so this is cheap; `loadLeaderboard` does one pass over every sign-up
rather than calling `loadPlayerProgress` per athlete (that would be ~160 round
trips).

`buildPlayerProgress` in `lib/playerProgress.ts` is the single calculation both
the profile and the leaderboard use. They must never compute EXP separately —
that is exactly how the two pages fell out of sync when badges started paying
EXP.

---

## EXP

Rates live in `EXP_RATES` (`lib/exp.ts`) and are exported so the rules shown to
players are generated from the same constants that score them. A hand-written
rules list drifts the moment any of these move.

| Action | EXP |
| --- | --- |
| A day played (a session with at least one finished game) | +100 |
| Each finished game | +20 |
| Each win | +10 |
| Consecutive club days, per extra day (capped at 4) | +25 |
| Each first-time partner (max 3/day, 6/week) | +15 |
| Each earned badge | +10 – 100 by tier |
| Each completed quest | set by the admin |

**Attendance is a day with a finished game, not `SignUp.checkedInAt`.** The club
does not use the check-in button — it is null on every row in the database — so
scoring it would pay nobody.

**Checking out pays nothing.** The endpoint is admin-only with no player-facing
control, so rewarding it would hand out EXP for someone else's action and
penalise players on days the admin didn't get round to it. The same reasoning
removed the badge that counted checkouts.

**"First-time partner" means ever, not per day.** The set of partners carries
across every day a player has ever played. Monday with A, B, C pays +45;
Wednesday with A, X, Y pays only +30. Partners met past a cap still count as
met, so the caps limit the reward rather than deferring it.

**Weeks run Monday to Sunday.** The club plays Monday and Wednesday; a
Sunday-based week would split those two into different weeks.

**Wins are worth little on purpose.** Matchmaking deliberately balances teams
toward 50/50, so paying heavily for wins would fight the matchmaker and push
players to want weaker opponents.

## Levels

`expForStep(n) = 540 + 250 × (n − 1)` — `lib/levels.ts`.

| Level | Cumulative EXP | Roughly (2 visits/week, ~236 EXP each) |
| --- | --- | --- |
| 2 | 540 | under a week |
| 3 | 1,330 | ~2 weeks |
| 5 | 3,660 | ~2 months |
| 10 | 13,860 | ~7 months |
| 20 | 53,010 | ~2 years |

**The 540 threshold is measured, not chosen.** It sits in the gap real data
shows between players who came once (top out at 485 EXP) and players who came
twice (start at 565). Reaching level 2 therefore requires coming back for a
second day — the club's actual problem is players who never return, not players
who don't play enough on their first visit.

**Any change to badge or quest EXP has to be re-checked against this number.**
When badges first started paying, eight one-visit players crossed into level 2
on badge rewards alone and the threshold had to move from 400 to 540. The check
is: recompute every player, confirm no one-day player reaches level 2 and no
two-day player is stuck at level 1.

Ranks, from `RANKS` in `lib/levels.ts`:

| Level | Rank | Theme |
| --- | --- | --- |
| 1–3 | น้องใหม่ | 🌱 green |
| 4–9 | ขาประจำ | 🔷 blue |
| 10–19 | ตัวตึง | 🔥 amber, 6 particles |
| 20+ | ตำนานแหลมฉบัง | 👑 violet, 10 particles |

Each rank carries its own palette (accent, gradient, border, particle count),
which drives the profile's page background, avatar ring, level number and EXP
bar — so climbing visibly changes the screen.

## Badges

32 badges in `lib/achievements.ts`, all derived from play history. Tier comes
from the badge's own target via `rarityFor`, so adding a badge never means
remembering to tier it.

| Tier | Count | EXP | Targets |
| --- | --- | --- | --- |
| ทั่วไป (common) | 7 | 10 | ≤ 3 |
| หายาก (rare) | 12 | 25 | ≤ 10 |
| เอปิก (epic) | 10 | 50 | ≤ 100 |
| ตำนาน (legendary) | 3 | 100 | > 100, or one-off |

The whole set is worth **1,170 EXP** — under a third of level 5, so collecting
is a bonus rather than a shortcut past the curve. Rates five times higher were
modelled first and moved 35 of 37 real players up a level immediately.

**Icons must be single-codepoint emoji.** ZWJ sequences (🧑‍🤝‍🧑, ❤️‍🔥) split into
their component glyphs on devices without the combined form, which made the coin
grid look uneven. A test asserts none contain ZWJ.

**Nothing may reward an admin-only action** — a test asserts no badge depends on
checking out.

Hours-on-court badges measure from the block the player signed up for (19:00 or
20:00 ICT) to their last finished game, deliberately not from `checkedOutAt`.

## Quests

Admin-created, time-boxed challenges — `lib/quests.ts`, `/admin/quests`.

Only the definition is stored (`Quest` table): which rule, which dates, how much
EXP. Completion is recomputed on read like everything else, so editing a result
updates quest outcomes too.

Rules available (`QUEST_KINDS`):

| Kind | Target | Notes |
| --- | --- | --- |
| `perfect-attendance` | — | Every day the club actually played in the window |
| `days-played` | days | Days with a finished game |
| `checkin-days` | days | Days checked in, games or not |
| `games-played` | games | Finished games in the window |
| `fastest-signup` | places | Best sign-up placing on any day — pays **once** |
| `fastest-signup-daily` | places | Placed inside the cutoff — pays **per day** |

- `startDate` inclusive, `endDate` exclusive, both at UTC midnight like
  `Session.date`, so consecutive months tile without overlapping.
- Perfect attendance is measured against days the club actually ran, never the
  calendar — a week the club skipped costs nobody. A window with no play days
  yet completes for no one.
- An unknown kind (a rule retired after quests were created) never marks anyone
  complete.
- Quest EXP is computed once for all players (`loadQuestExpByAthlete`) and passed
  into `buildPlayerProgress`, so the profile and leaderboard agree.

**`active` is a visibility flag, not a kill switch.** `startedQuests` — what EXP
is summed over — ignores it, so hiding a quest never claws back a reward and
neither does its window closing. `activeQuests` / `upcomingQuests` /
`visibleQuests` honour it, because those are display lists. Deleting the quest is
the only way to cancel one.

**Per-day rules.** `QuestProgress.earnedExp` is what `questExp` sums, not
`expReward`. For every rule except the per-day ones the two are the same (full
reward once complete, else 0); a rule flagged `perDay` in `QUEST_KINDS` reports
how many days it earned on and multiplies. That is what lets one definition cover
a whole month of club nights instead of the admin creating a quest per night —
and it means `expReward` reads "per day" for those kinds, everywhere it is shown.

**Keep rewards modest.** A visit is worth ~236 EXP and level 2 costs 540; a
single 500-EXP quest would skip a level outright. 100–300 is the sane range.
For a per-day rule that ceiling applies to the **daily** figure — the club plays
twice a week, so 200/day is ~1,600 over a month for someone who never misses.

## Leaderboard

Top 5 **places** by EXP, not top 5 people — cutting at a fixed number of players
would drop someone genuinely tied with the last person shown.

- Tied EXP shares a place and consumes the places below it (1, 1, 3).
- Every holder of a podium place stands on the block; avatars shrink (64/52 →
  42 → 34) as it gets crowded. A place with no holders is omitted.
- Below the podium a shared place is marked "=4" so a repeated number doesn't
  read as a bug.
- Display-order tiebreaks within a shared place: days played, then games, then
  name. These decide layout only, never the place itself.

Only five places on purpose: with a roster this small, a full table mostly tells
the other thirty-odd members how far down they are.

## Identity — there is no player login

A profile is identified by its URL (`/player/<athleteId>`). `lib/myPlayer.ts`
stores a "this is me" shortcut in localStorage purely so Home can link straight
to your own profile.

**localStorage is never the source of truth.** Storage writes genuinely fail in
some in-app browsers — that is how a member once ended up unable to withdraw a
sign-up that had actually succeeded. If the shortcut is missing, the user just
picks their name again.

Profiles are public and read-only. **Never let name-picking become an action
control** — withdrawal stays device-bound for exactly this reason.

## Duplicate names

Sign-up matched by exact name only, so "P'Note" silently became a second player
beside "Note" and split that player's history — which only surfaced once stats
existed. `lib/nameSimilarity.ts` now prompts before creating a second record.

Matching normalises case, spaces and punctuation, then allows containment and
small typos. Short names are excluded from both rules: the club has NK and NW,
and BB and Bus, one edit apart and different people. Against the real roster it
prompts on 10 pairs out of 3,081.

It only ever prompts — two people really can be called Bank, and only they know
which one they are.

Merging existing duplicates is still manual: move the `SignUp` rows to the
surviving athlete, rename them to match, delete the loser — in one transaction,
after checking the two never signed up for the same session.

## Search ranking

`lib/nameSearch.ts` ranks matches before trimming: exact, then prefix, then
contains, alphabetical within each tier.

A plain alphabetical `take(10)` cut the athlete literally named "T" (21 names
contain a t; T sorts 12th) and buried "First"/"Frong" under "Aof Thana". The API
fetches every match and ranks, rather than taking 10 first.

---

## Files

| Path | Role |
| --- | --- |
| `lib/exp.ts` | EXP rates and `computeExp` |
| `lib/levels.ts` | Curve, ranks, per-rank themes |
| `lib/achievements.ts` | The 32 badge definitions |
| `lib/achievementRarity.ts` | Tiers, palettes, badge EXP |
| `lib/dayStats.ts` | Within-a-day rules (win runs, hours on court) |
| `lib/streaks.ts` | Consecutive club days |
| `lib/playerProgress.ts` | `buildPlayerProgress` — the shared calculation |
| `lib/leaderboard.ts` | Ranking and podium data |
| `lib/quests.ts` | Quest rules (pure) |
| `lib/questProgress.ts` | Quest evaluation against the database |
| `lib/nameSimilarity.ts` | Duplicate-name prompting |
| `lib/nameSearch.ts` | Search result ranking |
| `app/player/MissionRules.tsx` | Player-facing rules, generated from the constants |
| `app/player/[id]/` | Profile page and achievement coins |
| `app/leaderboard/` | Podium |
| `app/admin/quests/` | Quest management |
