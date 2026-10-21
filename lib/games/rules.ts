import type { RubberOutcome, SetScore, Side, Stage } from "./types";

/**
 * Scoring rules agreed with the organisers (spec §3):
 * - Qualifier rubber: 2 sets. 2–0 wins (2 pts), 1–1 draws (1 each), 0–2 loses.
 * - Knockout rubber: best of 3; a set goes to 21, at 20–20 someone must lead by
 *   2, capped at 30. A rubber win is 1 point; the first team to 3 takes the tie.
 * Times are informational only, so nothing here looks at the clock.
 */

export interface SetColumns {
  set1A: number | null;
  set1B: number | null;
  set2A: number | null;
  set2B: number | null;
  set3A: number | null;
  set3B: number | null;
}

export function setsFromColumns(r: SetColumns): SetScore[] {
  const pairs: [number | null, number | null][] = [
    [r.set1A, r.set1B],
    [r.set2A, r.set2B],
    [r.set3A, r.set3B],
  ];
  const sets: SetScore[] = [];
  for (const [a, b] of pairs) {
    if (a == null || b == null) break;
    sets.push([a, b]);
  }
  return sets;
}

/** Sets won by each side; a level set counts for nobody. */
export function setsWon(sets: SetScore[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of sets) {
    if (x > y) a++;
    else if (y > x) b++;
  }
  return [a, b];
}

export const isKnockout = (stage: Stage) => stage !== "QUALIFIER";

export function rubberOutcome(stage: Stage, sets: SetScore[], finished: boolean): RubberOutcome {
  if (!finished) return null;
  const [a, b] = setsWon(sets);
  if (isKnockout(stage)) {
    if (a >= 2) return "A";
    if (b >= 2) return "B";
    return null;
  }
  if (sets.length < 2) return null;
  if (a > b) return "A";
  if (b > a) return "B";
  return "DRAW";
}

export function rubberPoints(stage: Stage, outcome: RubberOutcome): [number, number] {
  if (outcome == null) return [0, 0];
  if (isKnockout(stage)) return outcome === "A" ? [1, 0] : outcome === "B" ? [0, 1] : [0, 0];
  if (outcome === "DRAW") return [1, 1];
  return outcome === "A" ? [2, 0] : [0, 2];
}

/** Live counting: has the current knockout set just ended? */
export function knockoutSetOver(a: number, b: number): boolean {
  if (a >= 30 || b >= 30) return true;
  return (a >= 21 || b >= 21) && Math.abs(a - b) >= 2;
}

/** Both pairs of a rubber are keyed from the paper lineups — scores can only be entered then. */
export function lineupKeyed(r: { a1Id: string | null; a2Id: string | null; b1Id: string | null; b2Id: string | null }): boolean {
  return !!(r.a1Id && r.a2Id && r.b1Id && r.b2Id);
}

/** A finished qualifier set: 21 points, no deuce — so exactly 21 against 0–20. */
export function isValidQualifierSet(a: number, b: number): boolean {
  return Math.max(a, b) === 21 && Math.min(a, b) <= 20;
}

/** Is this a score a finished knockout set can actually end on? */
export function isValidKnockoutSet(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 21) return lo <= 19;
  if (hi > 21 && hi < 30) return lo === hi - 2;
  if (hi === 30) return lo === 28 || lo === 29;
  return false;
}

export function validateResult(
  stage: Stage,
  sets: SetScore[]
): { ok: true; warnings: string[] } | { ok: false; error: string } {
  if (sets.some(([a, b]) => !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)) {
    return { ok: false, error: "แต้มต้องเป็นตัวเลขไม่ติดลบ" };
  }
  if (!isKnockout(stage)) {
    if (sets.length < 2) return { ok: false, error: "รอบคัดเลือกต้องใส่แต้มครบ 2 เซต" };
    if (sets.length > 2) return { ok: false, error: "รอบคัดเลือกมีแค่ 2 เซต" };
    const warnings = sets.flatMap(([x, y], i) =>
      x === y
        ? [`เซต ${i + 1} (${x}–${y}) แต้มเท่ากัน ไม่นับให้ฝั่งไหน`]
        : isValidQualifierSet(x, y)
          ? []
          : [`เซต ${i + 1} (${x}–${y}) ไม่ตรงกติกา 21 แต้มไม่มีดิวส์`]
    );
    return { ok: true, warnings };
  }

  const [a2, b2] = setsWon(sets.slice(0, 2));
  if (sets.length === 3 && (a2 === 2 || b2 === 2)) {
    return { ok: false, error: "จบ 2 เซตแล้ว ไม่ต้องมีเซต 3" };
  }
  const [a, b] = setsWon(sets);
  if (a < 2 && b < 2) return { ok: false, error: "รอบน็อกเอาต์ต้องมีฝั่งที่ชนะ 2 เซต" };

  const warnings = sets.flatMap(([x, y], i) =>
    isValidKnockoutSet(x, y) ? [] : [`เซต ${i + 1} (${x}–${y}) ไม่ตรงกติกา 21 แต้ม`]
  );
  return { ok: true, warnings };
}

export function tieScore(
  stage: Stage,
  outcomes: RubberOutcome[]
): { pointsA: number; pointsB: number; winner: Side | null; decidedAt: number | null } {
  let pointsA = 0;
  let pointsB = 0;
  let winner: Side | null = null;
  let decidedAt: number | null = null;

  outcomes.forEach((outcome, i) => {
    const [pa, pb] = rubberPoints(stage, outcome);
    pointsA += pa;
    pointsB += pb;
    if (isKnockout(stage) && winner == null && (pointsA >= 3 || pointsB >= 3)) {
      winner = pointsA >= 3 ? "A" : "B";
      decidedAt = i + 1;
    }
  });

  return { pointsA, pointsB, winner, decidedAt };
}
