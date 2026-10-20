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
