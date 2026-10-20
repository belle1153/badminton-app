/** Shared vocabulary for TUA TUENG GAMES. A "tie" is one team-vs-team match
 *  (แมตซ์); a "rubber" is one pair-vs-pair game inside it (คู่ย่อย). */

export type Stage = "QUALIFIER" | "SEMI" | "FIFTH" | "THIRD" | "FINAL";

/** One set's points, side A first. */
export type SetScore = [number, number];

export type Side = "A" | "B";

/** null = no result yet (unfinished, or a knockout rubber without a 2-set side). */
export type RubberOutcome = Side | "DRAW" | null;
