import { parseHHMM } from "./schedule";
import type { Stage } from "./types";

export interface TvTieLike {
  id: string;
  stage: Stage;
  round: number | null;
  slot: number;
  startsAt: string;
  status: "upcoming" | "live" | "done";
  rubbers: { finishedAt: string | null }[];
}

/** How long a finished round (or knockout tie) stays up so the hall can read the results. */
export const TV_HOLD_MS = 5 * 60_000;

/** When a done tie's last pair finished, in ms; null while it is still being played. */
function doneAt(tie: TvTieLike): number | null {
  if (tie.status !== "done") return null;
  const times = tie.rubbers.flatMap((r) => (r.finishedAt ? [Date.parse(r.finishedAt)] : []));
  return times.length ? Math.max(...times) : null;
}

/**
 * The ties the big screen's "matches" view shows. In the qualifier: the round in
 * play, or between rounds the next one. Once it is over: the knockout ties in
 * play plus the next ones, up to three — and after the final, the last three.
 * A round, or a knockout tie, that has just finished stays up for TV_HOLD_MS first.
 */
export function tvTies<T extends TvTieLike>(ties: T[], now: Date): T[] {
  const held = (at: number | null) => at != null && now.getTime() - at < TV_HOLD_MS;
  const qualifier = ties.filter((t) => t.stage === "QUALIFIER");

  // The qualifier round that finished last, if that was under five minutes ago.
  const rounds = [...new Set(qualifier.map((t) => t.round))];
  const finished = rounds
    .map((round) => qualifier.filter((t) => t.round === round))
    .filter((r) => r.every((t) => t.status === "done"))
    .map((r) => ({ ties: r, at: Math.max(...r.map((t) => doneAt(t) ?? -Infinity)) }))
    .sort((x, y) => y.at - x.at);
  if (finished.length && held(finished[0].at)) return [...finished[0].ties].sort((a, b) => a.slot - b.slot);

  const live = qualifier.filter((t) => t.status === "live");
  const open = qualifier.filter((t) => t.status !== "done");
  const round = live.length ? Math.min(...live.map((t) => t.round ?? 0)) : open.length ? Math.min(...open.map((t) => t.round ?? 0)) : null;
  if (round != null) return qualifier.filter((t) => t.round === round).sort((a, b) => a.slot - b.slot);

  const knockout = ties.filter((t) => t.stage !== "QUALIFIER").sort((a, b) => parseHHMM(a.startsAt) - parseHHMM(b.startsAt));
  const shown = knockout.filter((t) => t.status !== "done" || held(doneAt(t)));
  return shown.length ? shown.slice(0, 3) : knockout.slice(-3);
}
