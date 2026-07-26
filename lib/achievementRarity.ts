/**
 * Coin tiers for the profile's achievement grid: how hard a badge is decides
 * how precious its coin looks. Derived from the badge's own target rather than
 * hand-assigned, so adding a badge never means remembering to tier it.
 */
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface RarityPalette {
  /** Highlight, mid and shadow bands of the coin's ring shading. */
  r1: string;
  r2: string;
  r3: string;
  /** Outer glow. */
  glow: string;
  /** Second glow — only legendary has one, which is what makes it shift. */
  glow2?: string;
  label: string;
}

export const RARITY_PALETTE: Record<Rarity, RarityPalette> = {
  common: { r1: "#33465c", r2: "#182330", r3: "#05070b", glow: "#3b5a7a", label: "ทั่วไป" },
  rare: { r1: "#6fb3ff", r2: "#2f6690", r3: "#0d1f30", glow: "#4f9fe6", label: "หายาก" },
  epic: { r1: "#ffc27a", r2: "#e8822e", r3: "#4a260f", glow: "#ff9d4d", label: "เอปิก" },
  legendary: {
    r1: "#ffc27a",
    r2: "#2f6690",
    r3: "#05070b",
    glow: "#4f9fe6",
    glow2: "#ff9d4d",
    label: "ตำนาน",
  },
};

/**
 * `target` is the badge's goal (games, wins, days…). A one-off badge with no
 * numeric goal — being here in the club's first days — is legendary: it can
 * never be earned again once that window has passed.
 */
export function rarityFor(target: number | null): Rarity {
  if (target == null) return "legendary";
  if (target <= 3) return "common";
  if (target <= 10) return "rare";
  if (target <= 100) return "epic";
  return "legendary";
}

/**
 * EXP awarded for earning a badge.
 *
 * Kept small on purpose. Badges are a by-product of playing, which already
 * earns EXP — paying generously for them counts the same effort twice. At these
 * rates the whole set is worth ~950, less than a third of what level 5 costs,
 * so collecting is a bonus rather than a shortcut past the level curve. Rates
 * five times higher were modelled first and moved 35 of 37 real players up a
 * level on the day it shipped, with badge EXP exceeding what they had earned by
 * turning up.
 */
export const RARITY_EXP: Record<Rarity, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

export function expForBadge(target: number | null): number {
  return RARITY_EXP[rarityFor(target)];
}
