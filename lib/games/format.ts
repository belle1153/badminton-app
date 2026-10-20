import { isKnockout, setsWon } from "./rules";
import type { RubberOutcome, SetScore, Stage } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtMinute(minute: number): string {
  const m = Math.floor(minute);
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

export function setsLine(sets: SetScore[]): string {
  return sets.map(([a, b]) => `${a}–${b}`).join(" · ");
}

export function pairName(players: ({ name: string } | null)[]): string | null {
  const names = players.filter((p): p is { name: string } => p != null).map((p) => p.name);
  return names.length ? names.join(" + ") : null;
}

export function resultText(stage: Stage, outcome: RubberOutcome, teamA: string, teamB: string): string {
  if (outcome == null) return "";
  if (outcome === "DRAW") return "เสมอ +1 ทั้งสองทีม";
  const points = isKnockout(stage) ? 1 : 2;
  return `${outcome === "A" ? teamA : teamB} ชนะ +${points}`;
}

/** "แดง ชนะ 2–0 เซต" / "เสมอ 1–1 เซต" for a finished rubber, counting every set. */
export function setsResultText(sets: SetScore[], outcome: RubberOutcome, teamA: string, teamB: string): string {
  if (outcome == null) return "";
  const [a, b] = setsWon(sets);
  if (outcome === "DRAW") return `เสมอ ${a}–${b} เซต`;
  return `${outcome === "A" ? teamA : teamB} ชนะ ${Math.max(a, b)}–${Math.min(a, b)} เซต`;
}

export function knockoutPlaceholder(stage: Stage, slot: number): string {
  switch (stage) {
    case "SEMI":
      return slot === 1 ? "อันดับ 1 vs อันดับ 4" : "อันดับ 2 vs อันดับ 3";
    case "FIFTH":
      return "อันดับ 5 vs อันดับ 6";
    case "THIRD":
      return "ผู้แพ้รองฯ 1 vs ผู้แพ้รองฯ 2";
    case "FINAL":
      return "ผู้ชนะรองฯ 1 vs ผู้ชนะรองฯ 2";
    default:
      return "";
  }
}
