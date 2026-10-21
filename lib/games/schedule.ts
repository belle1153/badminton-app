import type { Stage } from "./types";

/**
 * The event's printed timetable (TUA TUENG GAMES 2026 poster). Seeds 1–6 are the
 * teams' order on the setup page; each round lists its three ties as
 * [team A seed, team B seed]. Tie s of a round plays on courts 2s−1 and 2s.
 */
export const QUALIFIER_ROUNDS: [number, number][][] = [
  [[1, 6], [2, 5], [3, 4]],
  [[1, 5], [6, 4], [2, 3]],
  [[1, 4], [5, 3], [6, 2]],
  [[1, 3], [4, 2], [5, 6]],
  [[1, 2], [3, 6], [4, 5]],
];

const QUALIFIER_FIRST_HOUR = 14;

export const KNOCKOUT_TIES: { stage: Stage; slot: number; startsAt: string; courtA: number; courtB: number }[] = [
  { stage: "SEMI", slot: 1, startsAt: "19:30", courtA: 1, courtB: 2 },
  { stage: "SEMI", slot: 2, startsAt: "20:00", courtA: 3, courtB: 4 },
  { stage: "FIFTH", slot: 1, startsAt: "20:30", courtA: 5, courtB: 6 },
  { stage: "THIRD", slot: 1, startsAt: "21:00", courtA: 1, courtB: 2 },
  { stage: "FINAL", slot: 1, startsAt: "21:30", courtA: 3, courtB: 4 },
];

export const RUBBERS_PER_TIE = 5;

export const DEFAULT_TEAMS: { seed: number; name: string; color: string }[] = [
  { seed: 1, name: "แดง", color: "#dc2626" },
  { seed: 2, name: "ชมพู", color: "#f472b6" },
  { seed: 3, name: "ม่วง", color: "#7e22ce" },
  { seed: 4, name: "เขียว", color: "#15803d" },
  { seed: 5, name: "น้ำเงิน", color: "#1d4ed8" },
  { seed: 6, name: "เหลือง", color: "#facc15" },
];

export const TEAM_SWATCHES: { name: string; color: string }[] = [
  { name: "แดง", color: "#dc2626" },
  { name: "ส้ม", color: "#ea580c" },
  { name: "เหลือง", color: "#facc15" },
  { name: "เขียว", color: "#15803d" },
  { name: "ฟ้า", color: "#0ea5e9" },
  { name: "น้ำเงิน", color: "#1d4ed8" },
  { name: "ม่วง", color: "#7e22ce" },
  { name: "ชมพู", color: "#f472b6" },
  { name: "น้ำตาล", color: "#92400e" },
  { name: "เทา", color: "#64748b" },
  { name: "ดำ", color: "#111827" },
  { name: "ขาว", color: "#f8fafc" },
];

export interface TieSpec {
  stage: Stage;
  round: number | null;
  slot: number;
  startsAt: string;
  courtA: number;
  courtB: number;
  teamAId: string | null;
  teamBId: string | null;
  rubbers: { order: number; court: number }[];
}

/** Odd rubbers (1, 3, 5) play on the tie's first court, even ones on the second. */
export function rubberCourt(order: number, courtA: number, courtB: number): number {
  return order % 2 === 1 ? courtA : courtB;
}

/** Rubbers 1–2 start with the tie, 3–4 one rubber-length later, 5 two later. */
export function rubberOffsetMinutes(order: number, minutesPerRubber: number): number {
  return Math.floor((order - 1) / 2) * minutesPerRubber;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buildSchedule(teams: { id: string; seed: number }[]): TieSpec[] {
  const bySeed = new Map(teams.map((t) => [t.seed, t.id]));
  const rubbers = (courtA: number, courtB: number) =>
    Array.from({ length: RUBBERS_PER_TIE }, (_, i) => ({ order: i + 1, court: rubberCourt(i + 1, courtA, courtB) }));

  const qualifier: TieSpec[] = QUALIFIER_ROUNDS.flatMap((round, r) =>
    round.map(([a, b], s) => {
      const courtA = 2 * s + 1;
      const courtB = 2 * s + 2;
      return {
        stage: "QUALIFIER" as const,
        round: r + 1,
        slot: s + 1,
        startsAt: `${pad(QUALIFIER_FIRST_HOUR + r)}:00`,
        courtA,
        courtB,
        teamAId: bySeed.get(a) ?? null,
        teamBId: bySeed.get(b) ?? null,
        rubbers: rubbers(courtA, courtB),
      };
    })
  );

  const knockout: TieSpec[] = KNOCKOUT_TIES.map((k) => ({
    ...k,
    round: null,
    teamAId: null,
    teamBId: null,
    rubbers: rubbers(k.courtA, k.courtB),
  }));

  return [...qualifier, ...knockout];
}

/** Qualifier ties are numbered 1–15 straight through the rounds (round 2 starts at 4), as the organisers call them. */
export function matchNo(round: number, slot: number): number {
  return (round - 1) * QUALIFIER_ROUNDS[0].length + slot;
}

export function tieLabel(stage: Stage, round: number | null, slot: number): string {
  switch (stage) {
    case "QUALIFIER":
      return `รอบ ${round} · แมตซ์ ${matchNo(round ?? 1, slot)}`;
    case "SEMI":
      return `รองชนะเลิศ ${slot}`;
    case "FIFTH":
      return "ชิงอันดับ 5";
    case "THIRD":
      return "ชิงอันดับ 3";
    case "FINAL":
      return "ชิงชนะเลิศ";
  }
}
