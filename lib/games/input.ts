import type { SetScore } from "./types";

/** Validation for what the admin pages send. Anything off returns null → 400. */

export type PairInput = [string | null, string | null];

const isScore = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99;

export function parseSets(raw: unknown): SetScore[] | null {
  if (!Array.isArray(raw) || raw.length > 3) return null;
  const out: SetScore[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length !== 2 || !isScore(s[0]) || !isScore(s[1])) return null;
    out.push([s[0], s[1]]);
  }
  return out;
}

const idOrNull = (v: unknown): string | null | undefined =>
  v == null || v === "" ? null : typeof v === "string" ? v : undefined;

export function parsePairs(raw: unknown): PairInput[] | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;
  const out: PairInput[] = [];
  for (const p of raw) {
    if (p == null) {
      out.push([null, null]);
      continue;
    }
    if (!Array.isArray(p) || p.length !== 2) return null;
    const a = idOrNull(p[0]);
    const b = idOrNull(p[1]);
    if (a === undefined || b === undefined) return null;
    out.push([a, b]);
  }
  return out;
}

export function duplicateIds(pairs: PairInput[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of pairs.flat()) {
    if (!id) continue;
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}

/** "name (team)" for every player already on another team of the same event. */
export function memberConflicts(
  memberIds: string[],
  otherTeams: { name: string; memberIds: string[] }[],
  athleteNames: Map<string, string>
): string[] {
  return memberIds.flatMap((id) => {
    const other = otherTeams.find((t) => t.memberIds.includes(id));
    return other ? [`${athleteNames.get(id) ?? id} (${other.name})`] : [];
  });
}

interface LineupTie {
  teamAId: string | null;
  teamBId: string | null;
  rubbers: {
    id: string;
    a: ({ id: string } | null)[];
    b: ({ id: string } | null)[];
    finished: boolean;
    sets: SetScore[];
    liveSet: number | null;
  }[];
}

/**
 * After a team's roster changes: its lineup slots that still name someone no
 * longer on the team, blanked. Without this the old names stay on the slip, and
 * the lineup editor (which lists only the roster) shows those slots as empty, so
 * they can't be taken off. Pairs already played, being counted or scored keep
 * their names as the record of who played.
 */
export function staleLineupSlots(
  ties: LineupTie[],
  teamId: string,
  roster: Set<string>
): { rubberId: string; side: "A" | "B"; ids: [string | null, string | null] }[] {
  const out: { rubberId: string; side: "A" | "B"; ids: [string | null, string | null] }[] = [];
  for (const tie of ties) {
    for (const side of ["A", "B"] as const) {
      if ((side === "A" ? tie.teamAId : tie.teamBId) !== teamId) continue;
      for (const r of tie.rubbers) {
        if (r.finished || r.liveSet != null || r.sets.length > 0) continue;
        const slot = side === "A" ? r.a : r.b;
        const ids = [slot[0]?.id ?? null, slot[1]?.id ?? null] as [string | null, string | null];
        const kept = ids.map((id) => (id && roster.has(id) ? id : null)) as [string | null, string | null];
        if (kept[0] !== ids[0] || kept[1] !== ids[1]) out.push({ rubberId: r.id, side, ids: kept });
      }
    }
  }
  return out;
}

/**
 * The captain to store after a team edit: the one asked for (null = none), who
 * must be on the roster; when not asked, the current one while still on it.
 */
export function nextCaptain(
  current: string | null,
  requested: string | null | undefined,
  roster: Set<string>
): { captainId: string | null } | { error: string } {
  if (requested === undefined) return { captainId: current && roster.has(current) ? current : null };
  if (requested !== null && !roster.has(requested)) return { error: "กัปตันต้องเป็นผู้เล่นในทีม" };
  return { captainId: requested };
}
