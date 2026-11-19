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
 * stored summary would drift. Win rate, losses and draws only count players with
 * at least MIN_GAMES games, so one lucky evening cannot top the table.
 */
export const MIN_GAMES = 70;
export const TOP_PLACES = 3;
/** Athletes left out of ถอนชื่อมากสุด only: the organisers' own accounts, whose
 *  withdrawals were testing the sign-up flow. Matched on Athlete.name (unique). */
export const WITHDRAWAL_EXCLUDED = ["NK", "NW"];

export interface PlayerTotals {
  athleteId: string;
  name: string;
  games: number;
  days: number;
  wins: number;
  losses: number;
  draws: number;
  withdrawals: number;
  coins: number;
}

export interface SummaryRow {
  rank: number;
  athleteId: string;
  name: string;
  /** The number the category ranks by (win rate as 0–100, one decimal). */
  value: number;
  /** Extra context, e.g. "45 ชนะ / 80 เกม". */
  detail?: string;
}

export interface SummaryCategory {
  id: "games" | "days" | "winRate" | "losses" | "draws" | "withdrawals" | "coins";
  title: string;
  icon: string;
  unit: string;
  /** Shown under the title when only players with MIN_GAMES+ count. */
  note?: string;
  rows: SummaryRow[];
}

/** Highest first; ties share a place, and everyone placed TOP_PLACES or better is kept. */
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
  sorted.forEach((t, i) => {
    const s = score(t);
    const rank = lastScore != null && s === lastScore ? lastRank : i + 1;
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
      id: "winRate", title: "Win rate สูงสุด", icon: "🔥", unit: "%", note,
      rows: topPlaces(regulars, winRate, (p, r) =>
        row(p, r, Math.round(winRate(p) * 1000) / 10, `ชนะ ${p.wins} แพ้ ${p.losses} เสมอ ${p.draws} (เสมอไม่นับ)`)
      ),
    },
    {
      id: "losses", title: "แพ้มากสุด", icon: "💀", unit: "เกม", note,
      rows: topPlaces(regulars, (p) => p.losses, (p, r) => row(p, r, p.losses, `จาก ${p.games} เกม`)),
    },
    {
      id: "draws", title: "เสมอมากสุด", icon: "🤝", unit: "เกม", note,
      rows: topPlaces(regulars, (p) => p.draws, (p, r) => row(p, r, p.draws, `จาก ${p.games} เกม`)),
    },
    {
      id: "withdrawals", title: "ถอนชื่อมากสุด", icon: "🏃", unit: "ครั้ง",
      rows: topPlaces(
        players.filter((p) => !WITHDRAWAL_EXCLUDED.includes(p.name)),
        (p) => p.withdrawals,
        (p, r) => row(p, r, p.withdrawals)
      ),
    },
    {
      id: "coins", title: "เก็บเหรียญมากสุด", icon: "🏅", unit: "เหรียญ",
      rows: topPlaces(players, (p) => p.coins, (p, r) => row(p, r, p.coins)),
    },
  ];
}

/** Every linked athlete's totals in one pass over the sign-ups. */
export async function loadPlayerTotals(): Promise<PlayerTotals[]> {
  const [signUps, withdrawn, clubDays, athletes] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true, ...PROGRESS_SIGNUP_SELECT },
    }),
    prisma.signUp.groupBy({
      by: ["athleteId"],
      where: { athleteId: { not: null }, status: "WITHDRAWN" },
      _count: { _all: true },
    }),
    loadClubPlayDays(),
    prisma.athlete.findMany({ select: { id: true, name: true } }),
  ]);

  const byAthlete = new Map<string, ProgressSignUp[]>();
  for (const s of signUps) {
    const list = byAthlete.get(s.athleteId!);
    if (list) list.push(s);
    else byAthlete.set(s.athleteId!, [s]);
  }
  const withdrawals = new Map(withdrawn.map((w) => [w.athleteId!, w._count._all]));

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
      withdrawals: withdrawals.get(a.id) ?? 0,
      coins: progress.achievements.filter((x) => x.earned).length,
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
