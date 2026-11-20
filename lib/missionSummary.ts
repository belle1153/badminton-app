import { prisma } from "@/lib/db";
import {
  buildPlayerProgress,
  loadClubPlayDays,
  PROGRESS_SIGNUP_SELECT,
  type ProgressSignUp,
} from "@/lib/playerProgress";

/**
 * The มิชชั่นโคตรตึง season summary: top three per category, over all play history.
 *
 * Computed on every read like the leaderboard: results can be edited, so a
 * stored summary would drift. Only win rate is limited to players with at least
 * MIN_GAMES games, so one lucky evening cannot top it; every other category
 * counts everyone.
 */
export const MIN_GAMES = 70;
export const TOP_PLACES = 3;

export interface PlayerTotals {
  athleteId: string;
  name: string;
  games: number;
  days: number;
  wins: number;
  losses: number;
  draws: number;
  coins: number;
  /** Versioned photo URL, or null when the athlete has no photo. */
  photoUrl?: string | null;
}

export interface SummaryRow {
  rank: number;
  athleteId: string;
  name: string;
  photoUrl: string | null;
  /** The number the category ranks by (win rate as 0–100, one decimal). */
  value: number;
  /** Extra context, e.g. "45 ชนะ / 80 เกม". */
  detail?: string;
}

export interface SummaryCategory {
  id: "games" | "days" | "winRate" | "wins" | "losses" | "draws" | "coins";
  title: string;
  icon: string;
  unit: string;
  /** Shown under the title when only players with MIN_GAMES+ count. */
  note?: string;
  rows: SummaryRow[];
}

/**
 * Highest first. Ties share a place and the next score takes the very next place
 * (1, 2, 2, 3), so a shared second still leaves a third on the podium — the
 * organisers' call for the award night (2026-11-20).
 */
function topPlaces<T extends { name: string }>(
  items: T[],
  score: (t: T) => number,
  toRow: (t: T, rank: number) => SummaryRow
): SummaryRow[] {
  const sorted = items
    .filter((t) => score(t) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "th"));
  const out: SummaryRow[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((t) => {
    const s = score(t);
    const rank = lastScore != null && s === lastScore ? lastRank : lastRank + 1;
    lastScore = s;
    lastRank = rank;
    if (rank <= TOP_PLACES) out.push(toRow(t, rank));
  });
  return out;
}

/** Pure ranking — no DB, so the rules are unit-testable. */
export function summarize(players: PlayerTotals[]): SummaryCategory[] {
  const row = (p: PlayerTotals, rank: number, value: number, detail?: string): SummaryRow => ({
    rank,
    athleteId: p.athleteId,
    name: p.name,
    photoUrl: p.photoUrl ?? null,
    value,
    detail,
  });
  const regulars = players.filter((p) => p.games >= MIN_GAMES);
  const note = `เฉพาะคนที่เล่น ${MIN_GAMES} เกมขึ้นไป`;
  const winRate = (p: PlayerTotals) => (p.wins + p.losses > 0 ? p.wins / (p.wins + p.losses) : 0);

  return [
    {
      id: "games", title: "เล่นมากสุด", icon: "🏸", unit: "เกม",
      rows: topPlaces(players, (p) => p.games, (p, r) => row(p, r, p.games)),
    },
    {
      id: "days", title: "มาเล่นมากสุด", icon: "📅", unit: "วัน",
      rows: topPlaces(players, (p) => p.days, (p, r) => row(p, r, p.days)),
    },
    {
      id: "winRate", title: "Win Rate สูงสุด", icon: "🌟", unit: "%", note,
      rows: topPlaces(regulars, winRate, (p, r) =>
        row(p, r, Math.round(winRate(p) * 1000) / 10, `ชนะ ${p.wins} แพ้ ${p.losses} เสมอ ${p.draws} (เสมอไม่นับ)`)
      ),
    },
    {
      id: "wins", title: "ชนะมากสุด", icon: "🔥", unit: "เกม",
      rows: topPlaces(players, (p) => p.wins, (p, r) => row(p, r, p.wins)),
    },
    {
      id: "losses", title: "แพ้มากสุด", icon: "💀", unit: "เกม",
      rows: topPlaces(players, (p) => p.losses, (p, r) => row(p, r, p.losses)),
    },
    {
      id: "draws", title: "เสมอมากสุด", icon: "🤝", unit: "เกม",
      rows: topPlaces(players, (p) => p.draws, (p, r) => row(p, r, p.draws)),
    },
    {
      id: "coins", title: "เก็บเหรียญมากสุด", icon: "🏅", unit: "เหรียญ",
      rows: topPlaces(players, (p) => p.coins, (p, r) => row(p, r, p.coins)),
    },
  ];
}

/** Every linked athlete's totals in one pass over the sign-ups. */
export async function loadPlayerTotals(): Promise<PlayerTotals[]> {
  const [signUps, clubDays, athletes, withPhoto] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true, ...PROGRESS_SIGNUP_SELECT },
    }),
    loadClubPlayDays(),
    prisma.athlete.findMany({ select: { id: true, name: true, updatedAt: true } }),
    // Only which athletes have a photo — the data-URL blobs stay in the DB and
    // are served, cached, by /api/athletes/[id]/photo.
    prisma.athlete.findMany({ where: { photoUrl: { not: null } }, select: { id: true } }),
  ]);
  const hasPhoto = new Set(withPhoto.map((a) => a.id));

  const byAthlete = new Map<string, ProgressSignUp[]>();
  for (const s of signUps) {
    const list = byAthlete.get(s.athleteId!);
    if (list) list.push(s);
    else byAthlete.set(s.athleteId!, [s]);
  }

  return athletes.map((a) => {
    const rows = byAthlete.get(a.id) ?? [];
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const s of rows) {
      for (const slot of s.matchSlots) {
        if (!slot.match.finishedAt) continue;
        if (slot.match.winnerTeam == null) draws++;
        else if (slot.match.winnerTeam === slot.team) wins++;
        else losses++;
      }
    }
    const progress = buildPlayerProgress(a.id, rows, clubDays);
    return {
      athleteId: a.id,
      name: a.name,
      games: progress.gamesPlayed,
      days: progress.daysPlayed,
      wins,
      losses,
      draws,
      coins: progress.achievements.filter((x) => x.earned).length,
      photoUrl: hasPhoto.has(a.id) ? `/api/athletes/${a.id}/photo?v=${a.updatedAt.getTime()}` : null,
    };
  });
}

export async function loadMissionSummary(): Promise<SummaryCategory[]> {
  return summarize(await loadPlayerTotals());
}

/** Whether players can see the summary page (admins always can). */
export async function missionSummaryOpen(): Promise<boolean> {
  // The home page calls this: a database without the column yet (deployed
  // before `migrate deploy`) must read as "closed", not take the page down.
  try {
    const s = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
      select: { missionSummaryOpen: true },
    });
    return s?.missionSummaryOpen ?? false;
  } catch {
    return false;
  }
}
