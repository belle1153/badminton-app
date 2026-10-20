import { parseHHMM } from "./schedule";
import type { Stage } from "./types";

/** Minutes since midnight in Thailand (ICT, UTC+7, no DST), with seconds as a fraction. */
export function ictNowMinute(now: Date): number {
  return ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
}

/** The Thai calendar date as YYYY-MM-DD. */
export function ictDateKey(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const SLOT_NAMES = ["ช่วงคู่ 1–2", "ช่วงคู่ 3–4", "ช่วงคู่ 5"];

/**
 * The big-screen clock. Purely informational — results never depend on it.
 * Inside a qualifier round it names the pair slot and counts down to its end;
 * otherwise it counts down to the next tie on the timetable; after the last
 * tie has started it returns null.
 */
export function slotClock(
  ties: { stage: Stage; round: number | null; label: string; startsAt: string }[],
  minutes: { qualifier: number; knockout: number },
  nowMinute: number
): { label: string; remainingSec: number } | null {
  const m = minutes.qualifier;
  const rounds = new Map<number, number>();
  for (const t of ties) if (t.stage === "QUALIFIER" && t.round != null) rounds.set(t.round, parseHHMM(t.startsAt));

  for (const [round, start] of rounds) {
    if (nowMinute >= start && nowMinute < start + 3 * m) {
      const idx = Math.floor((nowMinute - start) / m);
      return {
        label: `รอบ ${round} · ${SLOT_NAMES[idx]}`,
        remainingSec: Math.max(0, Math.round((start + (idx + 1) * m - nowMinute) * 60)),
      };
    }
  }

  const upcoming = ties
    .map((t) => ({ t, start: parseHHMM(t.startsAt) }))
    .filter((x) => x.start > nowMinute)
    .sort((a, b) => a.start - b.start)[0];
  if (!upcoming) return null;
  const name = upcoming.t.stage === "QUALIFIER" ? `รอบ ${upcoming.t.round}` : upcoming.t.label;
  return {
    label: `ถัดไป: ${name} ${upcoming.t.startsAt}`,
    remainingSec: Math.max(0, Math.round((upcoming.start - nowMinute) * 60)),
  };
}
