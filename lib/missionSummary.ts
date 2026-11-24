import { prisma } from "@/lib/db";
import {
  buildPlayerProgress,
  loadClubPlayDays,
  PROGRESS_SIGNUP_SELECT,
  type ProgressSignUp,
} from "@/lib/playerProgress";
import { loadSeasonLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { inSeason, seasonById, type SeasonId } from "@/lib/seasons";

/**
 * The มิชชั่นโคตรตึง Season 1 summary: the EXP top five, then top three per
 * category, over Season 1's play history only — so it stops changing once
 * Season 2 begins (bar an admin editing an old result).
 *
 * Computed on every read like the leaderboard: results can be edited, so a
 * stored summary would drift. Only win rate is limited to players with at least
 * MIN_GAMES games, so one lucky evening cannot top it; every other category
 * counts everyone.
 */
export const MIN_GAMES = 70;
export const TOP_PLACES = 3;
/** Places shown in the EXP section — more than the categories' three. */
export const EXP_TOP = 5;
/** The season this page is the record of. */
export const SUMMARY_SEASON: SeasonId = 1;

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
  id: "exp" | "games" | "days" | "winRate" | "wins" | "losses" | "draws" | "coins";
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

/**
 * The EXP section: everyone placed EXP_TOP or better. Places come from the
 * leaderboard's own ranking (shared places, then a gap: 1, 2, 2, 4) rather
 * than this page's dense ranks, so every number matches what the leaderboard
 * showed when the season ended.
 */
export function expTopRows(entries: LeaderboardEntry[]): SummaryRow[] {
  return entries
    .filter((e) => e.rank <= EXP_TOP)
    .map((e) => ({
      rank: e.rank,
      athleteId: e.athleteId,
      name: e.name,
      photoUrl: e.hasPhoto ? `/api/athletes/${e.athleteId}/photo?v=${e.photoVersion}` : null,
      value: e.exp,
      detail: `Lv.${e.level}`,
    }));
}

/** Every linked athlete's totals for one season, in one pass over the sign-ups. */
export async function loadPlayerTotals(seasonId: SeasonId = SUMMARY_SEASON): Promise<PlayerTotals[]> {
  const season = seasonById(seasonId);
  const [signUps, clubDays, athletes, withPhoto] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true, ...PROGRESS_SIGNUP_SELECT },
    }),
    loadClubPlayDays().then((days) => days.filter((d) => inSeason(d, season))),
    prisma.athlete.findMany({ select: { id: true, name: true, updatedAt: true } }),
    // Only which athletes have a photo — the data-URL blobs stay in the DB and
    // are served, cached, by /api/athletes/[id]/photo.
    prisma.athlete.findMany({ where: { photoUrl: { not: null } }, select: { id: true } }),
  ]);
  const hasPhoto = new Set(withPhoto.map((a) => a.id));

  const byAthlete = new Map<string, ProgressSignUp[]>();
  for (const s of signUps) {
    if (!inSeason(s.session.date, season)) continue;
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
    // A later season's first days are not the club's first: no founding coin.
    const progress = buildPlayerProgress(a.id, rows, clubDays, 0, season.start ? { foundingWindow: 0 } : {});
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

export interface MissionSummary {
  exp: SummaryCategory;
  categories: SummaryCategory[];
}

export async function loadMissionSummary(): Promise<MissionSummary> {
  const [totals, table] = await Promise.all([
    loadPlayerTotals(SUMMARY_SEASON),
    loadSeasonLeaderboard(SUMMARY_SEASON, EXP_TOP),
  ]);
  return {
    exp: { id: "exp", title: "EXP Season 1", icon: "⚡", unit: "EXP", rows: expTopRows(table) },
    categories: summarize(totals),
  };
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
