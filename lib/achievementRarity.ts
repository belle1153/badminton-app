/**
 * Coin tiers for the profile's achievement grid: how hard a badge is decides
 * how precious its coin looks. Derived from the badge's own target rather than
 * hand-assigned, so adding a badge never means remembering to tier it.
 */
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface RarityPalette {
  /** Rim: the milled edge's light and dark metal. */
  r1: string;
  r2: string;
  /** Face: the struck centre, light then dark. */
  f1: string;
  f2: string;
  /** Darkest shade, for outlines. */
  r3: string;
  /** Outer glow. */
  glow: string;
  /** Second glow — only legendary has one, which is what makes it shift. */
  glow2?: string;
  /** Tier band under the coin. */
  tag: "COMMON" | "RARE" | "EPIC" | "LEGEND";
  label: string;
}

/**
 * Metals spread far apart so tiers read at a glance: dull silver, blue,
 * orange-gold, and gold around a purple face.
 */
export const RARITY_PALETTE: Record<Rarity, RarityPalette> = {
  common: {
    r1: "#9fb3c8", r2: "#5b7088", f1: "#3a4d63", f2: "#18222f", r3: "#0b1018",
    glow: "#3b5a7a", tag: "COMMON", label: "ทั่วไป",
  },
  rare: {
    r1: "#9fd0ff", r2: "#3b82c4", f1: "#2b5a85", f2: "#10263b", r3: "#081521",
    glow: "#4f9fe6", tag: "RARE", label: "หายาก",
  },
  epic: {
    r1: "#ffe1a8", r2: "#e8952e", f1: "#8a4b17", f2: "#3a1d08", r3: "#1f0f04",
    glow: "#ff9d4d", tag: "EPIC", label: "เอปิก",
  },
  legendary: {
    r1: "#fff2b8", r2: "#d9a520", f1: "#6b3fa0", f2: "#241238", r3: "#120820",
    glow: "#ffcf4d", glow2: "#b07cff", tag: "LEGEND", label: "ตำนาน",
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
 * rates the whole 32-badge set is worth 1,170, under a third of what level 5
 * costs, so collecting is a bonus rather than a shortcut past the level curve.
 * Rates five times higher were modelled first and moved 35 of 37 real players
 * up a level on the day it shipped, with badge EXP exceeding what they had
 * earned by turning up.
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
