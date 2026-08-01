import { prisma } from "@/lib/db";
import {
  evaluateQuest,
  startedQuests,
  questStatus,
  type QuestDef,
  type QuestPlayerFacts,
  type QuestProgress,
  type QuestStatus,
} from "@/lib/quests";

export interface QuestWithProgress extends QuestDef {
  progress: QuestProgress;
  /** Whether the window is still open — a finished quest still counts. */
  status: QuestStatus;
}

/**
 * Quest EXP a player has earned. Sums `earnedExp`, not `expReward`, because a
 * per-day quest pays a multiple of its reward — one definition, many payouts.
 */
export function questExp(quests: QuestWithProgress[]): number {
  return quests.reduce((n, q) => n + q.progress.earnedExp, 0);
}

type QuestRow = {
  id: string;
  title: string;
  kind: string;
  icon: string;
  startDate: Date;
  endDate: Date;
  target: number | null;
  expReward: number;
  active: boolean;
};

const toQuestDef = (r: QuestRow): QuestDef => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  icon: r.icon,
  startDate: r.startDate,
  endDate: r.endDate,
  target: r.target,
  expReward: r.expReward,
  active: r.active,
});

export async function loadQuests(activeOnly = true): Promise<QuestDef[]> {
  const rows = await prisma.quest.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toQuestDef);
}

/** One session, in the shape the quest maths needs. */
interface QuestSession {
  date: Date;
  signUps: {
    athleteId: string | null;
    name: string;
    addedByAdmin: boolean;
    checkedInAt: Date | null;
    matchSlots: { match: { finishedAt: Date | null } }[];
  }[];
}

/**
 * Load, in exactly two queries, everything the open quests need to score any or
 * every player over their combined window. Shared by the single-player profile
 * and the whole-roster leaderboard so neither pays a per-player round trip.
 */
async function loadQuestData(
  quests: QuestDef[]
): Promise<{ sessions: QuestSession[]; clubDays: Date[] }> {
  const from = new Date(Math.min(...quests.map((q) => q.startDate.getTime())));
  const to = new Date(Math.max(...quests.map((q) => q.endDate.getTime())));

  const [sessions, clubDays] = await Promise.all([
    prisma.session.findMany({
      where: { date: { gte: from, lt: to } },
      select: {
        date: true,
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          orderBy: { createdAt: "asc" },
          select: {
            athleteId: true,
            // The roster view names people without a second query; the same
            // rows already carry it.
            name: true,
            // Who signed themselves up (false) vs an admin quick-add (true) —
            // "fastest to sign up" only ranks genuine user-side sign-ups.
            addedByAdmin: true,
            checkedInAt: true,
            matchSlots: { select: { match: { select: { finishedAt: true } } } },
          },
        },
      },
    }),
    prisma.session
      .findMany({
        where: { date: { gte: from, lt: to }, matches: { some: { finishedAt: { not: null } } } },
        select: { date: true },
        orderBy: { date: "asc" },
      })
      .then((rows) => rows.map((r) => r.date)),
  ]);

  return { sessions, clubDays };
}

/**
 * Score one athlete against the open quests from already-loaded data — pure, no
 * queries, so the leaderboard can score the whole roster from one fetch.
 *
 * Sign-up placings are worked out per session across ALL players, because
 * "fastest to sign up" is inherently a comparison — a single player's own rows
 * can't tell you where they came.
 */
function evaluateAthlete(
  athleteId: string,
  quests: QuestDef[],
  sessions: QuestSession[],
  clubDays: Date[],
  now: Date = new Date()
): QuestWithProgress[] {
  return quests.map((q) => {
    const inWindow = sessions.filter(
      (s) => s.date.getTime() >= q.startDate.getTime() && s.date.getTime() < q.endDate.getTime()
    );

    const daysPlayed: Date[] = [];
    let gamesPlayed = 0;
    let checkinDays = 0;
    let bestSignupPlace: number | null = null;
    const signupPlaces: number[] = [];

    for (const s of inWindow) {
      // Sign-up order counts only genuine user-side sign-ups — an admin
      // quick-add neither takes a placing itself nor shifts the people who did
      // sign themselves up.
      const userSignups = s.signUps.filter((su) => !su.addedByAdmin);
      const place = userSignups.findIndex((su) => su.athleteId === athleteId);
      if (place >= 0) {
        signupPlaces.push(place + 1);
        if (bestSignupPlace == null || place + 1 < bestSignupPlace) bestSignupPlace = place + 1;
      }

      const mine = s.signUps.find((su) => su.athleteId === athleteId);
      if (!mine) continue;
      // Attendance = checked in that day, whether or not a game finished.
      if (mine.checkedInAt != null) checkinDays++;
      const finished = mine.matchSlots.filter((ms) => ms.match.finishedAt != null).length;
      if (finished > 0) {
        gamesPlayed += finished;
        daysPlayed.push(s.date);
      }
    }

    const facts: QuestPlayerFacts = {
      daysPlayed,
      gamesPlayed,
      checkinDays,
      bestSignupPlace,
      signupPlaces,
    };
    const clubDaysInRange = clubDays.filter(
      (d) => d.getTime() >= q.startDate.getTime() && d.getTime() < q.endDate.getTime()
    );
    return {
      ...q,
      progress: evaluateQuest(q, facts, clubDaysInRange),
      status: questStatus(q, now),
    };
  });
}

/**
 * One player's standing on every quest that has started — finished AND
 * switched-off ones included, so neither the window closing nor an admin
 * tidying the list takes back EXP already earned.
 *
 * The caller renders `visibleQuests(…)` of this and sums `questExp(…)` over all
 * of it: hidden quests still pay, they just aren't shown.
 */
export async function loadQuestProgress(
  athleteId: string,
  now: Date = new Date()
): Promise<QuestWithProgress[]> {
  const quests = startedQuests(await loadQuests(false), now);
  if (quests.length === 0) return [];
  const { sessions, clubDays } = await loadQuestData(quests);
  return evaluateAthlete(athleteId, quests, sessions, clubDays, now);
}

/**
 * Quest EXP for every player at once, so the profile and the leaderboard can
 * never disagree about someone's total. Two queries total — the whole roster is
 * scored in memory rather than re-querying per athlete (which cost ~2 round
 * trips each, and on serverless Postgres that is seconds on a full leaderboard).
 */
export async function loadQuestExpByAthlete(now: Date = new Date()): Promise<Map<string, number>> {
  const quests = startedQuests(await loadQuests(false), now);
  const out = new Map<string, number>();
  if (quests.length === 0) return out;

  const { sessions, clubDays } = await loadQuestData(quests);

  // Everyone who appears in the window — derived from the data already loaded,
  // so there is no extra "distinct athlete" query either.
  const athleteIds = new Set<string>();
  for (const s of sessions) for (const su of s.signUps) if (su.athleteId) athleteIds.add(su.athleteId);

  for (const athleteId of athleteIds) {
    const exp = questExp(evaluateAthlete(athleteId, quests, sessions, clubDays, now));
    if (exp > 0) out.set(athleteId, exp);
  }
  return out;
}

export interface QuestRosterEntry {
  athleteId: string;
  name: string;
  progress: QuestProgress;
}

export interface QuestRoster {
  quest: QuestDef;
  status: QuestStatus;
  /** Everyone who appeared on a roster inside the window, best progress first. */
  entries: QuestRosterEntry[];
  /** Days the club actually played inside the window — what a perfect-attendance
   *  quest is measured against, and useful context for the admin. */
  clubDaysInWindow: number;
}

/**
 * Who has finished one quest — the admin's "กดดูรายละเอียด" view.
 *
 * Scored the same way as everywhere else (recomputed from play history, never
 * stored), so this list and the EXP a player is credited can never disagree.
 * Works on switched-off and finished quests too: the admin needs to inspect
 * exactly those.
 *
 * Only people who appeared in the window are listed. Someone who never turned
 * up has no rows to score and would just be a wall of 0/N.
 */
export async function loadQuestRoster(
  questId: string,
  now: Date = new Date()
): Promise<QuestRoster | null> {
  const row = await prisma.quest.findUnique({ where: { id: questId } });
  if (!row) return null;
  const quest = toQuestDef(row);

  const { sessions, clubDays } = await loadQuestData([quest]);

  // Sign-ups carry a name of their own, but the athlete record is the identity
  // quests are scored on — take the most recent spelling for each.
  const names = new Map<string, string>();
  for (const s of sessions) {
    for (const su of s.signUps) if (su.athleteId) names.set(su.athleteId, su.name);
  }

  const entries: QuestRosterEntry[] = [...names].map(([athleteId, name]) => ({
    athleteId,
    name,
    progress: evaluateAthlete(athleteId, [quest], sessions, clubDays, now)[0].progress,
  }));

  // "fastest-signup" counts a placing, where 1 is the best — every other rule
  // counts upwards. Ranking it the same way would stand the list on its head.
  const lowerIsBetter = quest.kind === "fastest-signup";
  const rank = (p: QuestProgress) =>
    p.current == null ? Number.POSITIVE_INFINITY : lowerIsBetter ? p.current : -p.current;

  entries.sort(
    (a, b) =>
      Number(b.progress.completed) - Number(a.progress.completed) ||
      rank(a.progress) - rank(b.progress) ||
      a.name.localeCompare(b.name, "th")
  );

  return {
    quest,
    status: questStatus(quest, now),
    entries,
    clubDaysInWindow: clubDays.filter(
      (d) => d.getTime() >= quest.startDate.getTime() && d.getTime() < quest.endDate.getTime()
    ).length,
  };
}
