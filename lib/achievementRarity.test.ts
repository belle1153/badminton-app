import { describe, it, expect } from "vitest";
import { rarityFor, RARITY_PALETTE, type Rarity } from "./achievementRarity";
import { computeAchievements } from "./achievements";

const ALL = computeAchievements({
  gamesPlayed: 0,
  wins: 0,
  draws: 0,
  daysPlayed: 0,
  longestStreakDays: 0,
  distinctPartners: 0,
  nightGames: 0,
  bestDayGames: 0,
  bestPartnerGames: 0,
  distinctCourts: 0,
  isFoundingMember: false,
});

describe("rarityFor", () => {
  it("scales with how demanding the target is", () => {
    expect(rarityFor(1)).toBe("common");
    expect(rarityFor(3)).toBe("common");
    expect(rarityFor(5)).toBe("rare");
    expect(rarityFor(10)).toBe("rare");
    expect(rarityFor(25)).toBe("epic");
    expect(rarityFor(100)).toBe("epic");
    expect(rarityFor(250)).toBe("legendary");
  });

  it("treats a badge with no numeric target as legendary", () => {
    // Founding member: the window has closed, so it can never be earned again.
    expect(rarityFor(null)).toBe("legendary");
  });
});

describe("RARITY_PALETTE", () => {
  it("defines every tier rarityFor can return", () => {
    const tiers: Rarity[] = ["common", "rare", "epic", "legendary"];
    for (const t of tiers) expect(RARITY_PALETTE[t]).toBeDefined();
  });

  it("only legendary gets a second glow, which is what animates it", () => {
    expect(RARITY_PALETTE.legendary.glow2).toBeDefined();
    expect(RARITY_PALETTE.common.glow2).toBeUndefined();
    expect(RARITY_PALETTE.rare.glow2).toBeUndefined();
    expect(RARITY_PALETTE.epic.glow2).toBeUndefined();
  });
});

describe("every real achievement gets a tier", () => {
  it("maps the whole set without gaps", () => {
    for (const a of ALL) {
      const tier = rarityFor(a.target);
      expect(RARITY_PALETTE[tier]).toBeDefined();
    }
  });

  it("spreads across more than one tier", () => {
    const tiers = new Set(ALL.map((a) => rarityFor(a.target)));
    expect(tiers.size).toBeGreaterThan(1);
  });
});
