import { parseHHMM } from "./schedule";
import type { Stage } from "./types";

export interface TvTieLike {
  id: string;
  stage: Stage;
  round: number | null;
  slot: number;
  startsAt: string;
  status: "upcoming" | "live" | "done";
}

/**
 * The ties the big screen's "matches" view shows. In the qualifier: the round in
 * play, or between rounds the next one. Once it is over: the knockout ties in
 * play plus the next ones, up to three — and after the final, the last three.
 */
export function tvTies<T extends TvTieLike>(ties: T[]): T[] {
  const qualifier = ties.filter((t) => t.stage === "QUALIFIER");
  const live = qualifier.filter((t) => t.status === "live");
  const open = qualifier.filter((t) => t.status !== "done");
  const round = live.length ? Math.min(...live.map((t) => t.round ?? 0)) : open.length ? Math.min(...open.map((t) => t.round ?? 0)) : null;
  if (round != null) return qualifier.filter((t) => t.round === round).sort((a, b) => a.slot - b.slot);

  const knockout = ties.filter((t) => t.stage !== "QUALIFIER").sort((a, b) => parseHHMM(a.startsAt) - parseHHMM(b.startsAt));
  const notDone = knockout.filter((t) => t.status !== "done");
  return notDone.length ? notDone.slice(0, 3) : knockout.slice(-3);
}
