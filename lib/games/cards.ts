import type { RubberOutcome, Side, Stage } from "./types";

/** SECRET CARD: each team has one of each, qualifier only, at most one per tie. */
export type CardKind = "DOUBLE_DOWN" | "STEAL" | "SUBSTITUTION";

export const CARD_KINDS: CardKind[] = ["DOUBLE_DOWN", "STEAL", "SUBSTITUTION"];

export const CARD_LABELS: Record<CardKind, { name: string; th: string }> = {
  DOUBLE_DOWN: { name: "DOUBLE DOWN", th: "เดิมพันสองเท่า" },
  STEAL: { name: "STEAL", th: "ขโมยคะแนน" },
  SUBSTITUTION: { name: "SUBSTITUTION", th: "สลับตำแหน่งคู่" },
};

/** A card one side played in a tie: on pair `order`; SUBSTITUTION also swapped it with `swapWith`. */
export interface PlayedCard {
  side: Side;
  kind: CardKind;
  order: number;
  swapWith: number | null;
}

/**
 * Bonus team points from the cards in one qualifier tie, on top of 2/1/0 per
 * rubber: DOUBLE DOWN +2 when its pair wins; STEAL +1 to the team and −1 to the
 * opponent when its pair wins. A draw, a loss or an unfinished pair gives
 * nothing, and SUBSTITUTION only reorders pairs.
 */
export function cardBonus(stage: Stage, cards: PlayedCard[], outcomeOf: (order: number) => RubberOutcome): [number, number] {
  if (stage !== "QUALIFIER") return [0, 0];
  let a = 0;
  let b = 0;
  for (const c of cards) {
    if (outcomeOf(c.order) !== c.side) continue;
    const mine = c.kind === "DOUBLE_DOWN" ? 2 : c.kind === "STEAL" ? 1 : 0;
    const theirs = c.kind === "STEAL" ? -1 : 0;
    if (c.side === "A") {
      a += mine;
      b += theirs;
    } else {
      b += mine;
      a += theirs;
    }
  }
  return [a, b];
}

/**
 * Who played a card and what it did, for the badge next to its pair:
 * "แดง +2", "เหลือง +1 · แดง −1", "แดง · ไม่มีผล" — always naming the team.
 */
export function cardEffectText(card: PlayedCard, outcome: RubberOutcome, teamA: string, teamB: string): string {
  const [mine, theirs] = card.side === "A" ? [teamA, teamB] : [teamB, teamA];
  if (card.kind === "SUBSTITUTION") return `${mine} สลับคู่ ${card.order} ↔ คู่ ${card.swapWith}`;
  if (outcome !== card.side) return `${mine} · ไม่มีผล`;
  return card.kind === "DOUBLE_DOWN" ? `${mine} +2` : `${mine} +1 · ${theirs} −1`;
}

/**
 * Why a team can't play this card, or null. One card per tie is kept by the
 * caller (a tie holds one card per team); here: qualifier only, a real pair,
 * two different pairs for SUBSTITUTION, and each kind once per team.
 */
export function cardProblem(input: {
  stage: Stage;
  kind: CardKind;
  order: number;
  swapWith: number | null;
  usedElsewhere: { kind: CardKind; label: string }[];
}): string | null {
  const { stage, kind, order, swapWith, usedElsewhere } = input;
  if (stage !== "QUALIFIER") return "ใช้การ์ดได้เฉพาะรอบคัดเลือก";
  const pair = (n: number | null) => n != null && Number.isInteger(n) && n >= 1 && n <= 5;
  if (!pair(order)) return "เลือกคู่ 1–5";
  if (kind === "SUBSTITUTION" && (!pair(swapWith) || swapWith === order)) return "เลือก 2 คู่ที่จะสลับ (คนละคู่)";
  const used = usedElsewhere.find((u) => u.kind === kind);
  if (used) return `ใช้การ์ด ${CARD_LABELS[kind].name} ไปแล้วใน${used.label}`;
  return null;
}
