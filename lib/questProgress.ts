import { prisma } from "@/lib/db";
import {
  evaluateQuest,
  activeQuests,
  type QuestDef,
  type QuestPlayerFacts,
  type QuestProgress,
} from "@/lib/quests";

export interface QuestWithProgress extends QuestDef {
  progress: QuestProgress;
}

/** Quest EXP a player has earned — completed quests only. */
export function questExp(quests: QuestWithProgress[]): number {
  return quests.filter((q) => q.progress.completed).reduce((n, q) => n + q.expReward, 0);
}

export async function loadQuests(activeOnly = true): Promise<QuestDef[]> {
  const rows = await prisma.quest.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    icon: r.icon,
    startDate: r.startDate,
    endDate: r.endDate,
    target: r.target,
    expReward: r.expReward,
    active: r.active,
  }));
}

/**
 * Quest EXP for every player at once, so the profile and the leaderboard can
 * never disagree about someone's total — the same trap badge EXP fell into when
 * each page computed its own.
 */
export async function loadQuestExpByAthlete(
  now: Date = new Date()
): Promise<Map<string, number>> {
  const quests = activeQuests(await loadQuests(true), now);
  const out = new Map<string, number>();
  if (quests.length === 0) return out;

  const athleteIds = await prisma.signUp
    .findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true },
      distinct: ["athleteId"],
    })
    .then((rows) => rows.map((r) => r.athleteId!).filter(Boolean));

  for (const athleteId of athleteIds) {
    const progress = await loadQuestProgress(athleteId, now);
    const exp = questExp(progress);
    if (exp > 0) out.set(athleteId, exp);
  }
  return out;
}

/**
 * One player's standing on every quest whose window is currently open.
 *
 * Sign-up placings are worked out per session across ALL players, because
 * "fastest to sign up" is inherently a comparison — a single player's own rows
 * can't tell you where they came.
 */
export async function loadQuestProgress(
  athleteId: string,
  now: Date = new Date()
): Promise<QuestWithProgress[]> {
  const quests = activeQuests(await loadQuests(true), now);
  if (quests.length === 0) return [];

  // Widest window any open quest needs, so one query covers them all.
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
            // Who signed themselves up (false) vs an admin quick-add (true) —
            // "fastest to sign up" only ranks genuine user-side sign-ups.
            addedByAdmin: true,
            checkedInAt: true,
            matchSlots: {
              select: { match: { select: { finishedAt: true } } },
            },
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

  return quests.map((q) => {
    const inWindow = sessions.filter(
      (s) => s.date.getTime() >= q.startDate.getTime() && s.date.getTime() < q.endDate.getTime()
    );

    const daysPlayed: Date[] = [];
    let gamesPlayed = 0;
    let checkinDays = 0;
    let bestSignupPlace: number | null = null;

    for (const s of inWindow) {
      // Sign-up order counts only genuine user-side sign-ups — an admin
      // quick-add neither takes a placing itself nor shifts the people who did
      // sign themselves up. Placing 2nd only means something relative to the
      // rest of that day's self-sign-ups.
      const userSignups = s.signUps.filter((su) => !su.addedByAdmin);
      const place = userSignups.findIndex((su) => su.athleteId === athleteId);
      if (place >= 0 && (bestSignupPlace == null || place + 1 < bestSignupPlace)) {
        bestSignupPlace = place + 1;
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

    const facts: QuestPlayerFacts = { daysPlayed, gamesPlayed, checkinDays, bestSignupPlace };
    const clubDaysInRange = clubDays.filter(
      (d) => d.getTime() >= q.startDate.getTime() && d.getTime() < q.endDate.getTime()
    );

    return { ...q, progress: evaluateQuest(q, facts, clubDaysInRange) };
  });
}
