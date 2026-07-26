import { describe, it, expect } from "vitest";
import { expForStep, levelProgress, rankForLevel, rankThemeForLevel } from "./levels";

describe("expForStep — the curve", () => {
  it("costs 540 to leave level 1, then +250 per level", () => {
    expect(expForStep(1)).toBe(540);
    expect(expForStep(2)).toBe(790);
    expect(expForStep(3)).toBe(1040);
    expect(expForStep(9)).toBe(2540);
  });
});

describe("levelProgress — thresholds", () => {
  const cumulative = (level: number) => {
    let acc = 0;
    for (let l = 1; l < level; l++) acc += expForStep(l);
    return acc;
  };

  it("starts at level 1 with zero EXP", () => {
    expect(levelProgress(0)).toMatchObject({ level: 1, intoLevel: 0, toNextLevel: 540 });
  });

  it("holds level 1 right up to the threshold", () => {
    expect(levelProgress(539).level).toBe(1);
    expect(levelProgress(540).level).toBe(2);
  });

  it("matches the designed cumulative table", () => {
    expect(cumulative(2)).toBe(540);
    expect(cumulative(3)).toBe(1330);
    expect(cumulative(4)).toBe(2370);
    expect(cumulative(10)).toBe(13860);
    expect(cumulative(20)).toBe(53010);
    expect(levelProgress(cumulative(10)).level).toBe(10);
    expect(levelProgress(cumulative(20)).level).toBe(20);
  });

  it("keeps the top ranks rare — ตัวตึง and ตำนาน stay far apart", () => {
    // At the measured 236 EXP/visit, twice a week: ~7 months and ~2 years.
    const perWeek = 236 * 2;
    expect(cumulative(10) / perWeek).toBeGreaterThan(25); // weeks
    expect(cumulative(20) / perWeek).toBeGreaterThan(100);
  });

  it("separates the real one-day and two-day groups, badge EXP included", () => {
    // Measured across every player with badge rewards counted: one day tops out
    // at 515, two days bottom out at 565. Badges pushed both groups up, which is
    // why this threshold had to move with them.
    expect(levelProgress(515).level).toBe(1);
    expect(levelProgress(565).level).toBe(2);
  });

  it("reports progress within the current level", () => {
    // 540 clears level 1; 395 more is halfway through level 2's 790-point span.
    const p = levelProgress(935);
    expect(p).toMatchObject({ level: 2, intoLevel: 395, levelSpan: 790, toNextLevel: 395 });
    expect(p.progress).toBeCloseTo(0.5);
  });

  it("progress stays within 0–1 across a wide range", () => {
    for (const exp of [0, 1, 399, 400, 901, 5000, 24700, 99999]) {
      const p = levelProgress(exp);
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThan(1);
      expect(p.toNextLevel).toBeGreaterThan(0);
    }
  });
});

describe("rankForLevel", () => {
  it("maps the four club ranks", () => {
    expect(rankForLevel(1)).toBe("น้องใหม่");
    expect(rankForLevel(3)).toBe("น้องใหม่");
    expect(rankForLevel(4)).toBe("ขาประจำ");
    expect(rankForLevel(9)).toBe("ขาประจำ");
    expect(rankForLevel(10)).toBe("ตัวตึง");
    expect(rankForLevel(19)).toBe("ตัวตึง");
    expect(rankForLevel(20)).toBe("ตำนานแหลมฉบัง");
    expect(rankForLevel(99)).toBe("ตำนานแหลมฉบัง");
  });

  it("never uses a skill-level letter as a rank name", () => {
    const skillLetters = ["RK", "BG", "N-", "N+", "S+", "P"];
    for (const level of [1, 4, 10, 20, 50]) {
      expect(skillLetters).not.toContain(rankForLevel(level));
    }
  });
});

describe("rankThemeForLevel", () => {
  it("gives each rank its own look", () => {
    const themes = [1, 4, 10, 20].map(rankThemeForLevel);
    expect(themes.map((t) => t.key)).toEqual(["novice", "regular", "ace", "legend"]);
    expect(new Set(themes.map((t) => t.icon)).size).toBe(4);
    expect(new Set(themes.map((t) => t.accent)).size).toBe(4);
    expect(new Set(themes.map((t) => t.bg)).size).toBe(4);
  });

  it("adds particles only at the top ranks, so climbing is visible", () => {
    const [novice, regular, ace, legend] = [1, 4, 10, 20].map(rankThemeForLevel);
    expect(novice.particles).toBe(0);
    expect(regular.particles).toBe(0);
    expect(ace.particles).toBeGreaterThan(0);
    expect(legend.particles).toBeGreaterThan(ace.particles);
  });

  it("changes at the same boundaries as the rank title", () => {
    expect(rankThemeForLevel(3).key).toBe(rankThemeForLevel(1).key);
    expect(rankThemeForLevel(4).key).not.toBe(rankThemeForLevel(3).key);
    expect(rankThemeForLevel(20).key).toBe(rankThemeForLevel(99).key);
  });

  it("titles agree with rankForLevel", () => {
    for (const level of [1, 4, 10, 20, 50]) {
      expect(rankThemeForLevel(level).title).toBe(rankForLevel(level));
    }
  });

  it("is carried on levelProgress so the UI needs no second lookup", () => {
    expect(levelProgress(0).theme.key).toBe("novice");
  });
});
