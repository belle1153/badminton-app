/**
 * The gamification level — entirely separate from `SkillLevel` (RK/BG/N-/N/N+
 * /S/S+/P), which the admin assesses and which drives matchmaking. This level
 * only measures how much someone has shown up and played. It must never be
 * read as, or feed, a skill signal — see docs/SYSTEM_OVERVIEW.md.
 *
 * Level 2 costs more than anyone can earn in a single day. That's deliberate:
 * reaching it requires coming back for a second day, not just playing a lot in
 * one sitting — the club's real problem is players who never return for a
 * second visit, not players who don't play enough on their first.
 *
 * 540 sits in the gap the real data shows between the two groups: across every
 * player, a single day tops out at 515 EXP while everyone who came twice has at
 * least 565. Both sides keep a margin, so a heavy first day still can't reach
 * level 2 and a light second day still can.
 *
 * That gap moved once badges started paying EXP — at the old 400 threshold,
 * eight one-visit players crossed into level 2 on badge rewards alone. Any
 * change to badge EXP has to be re-checked against this number.
 *
 * Past that the curve is steep so the top ranks stay rare. At the measured rate
 * (236 EXP per visit, twice a week) that puts ตัวตึง about 6 months in and
 * ตำนาน about two years away — the increment, not the base, is what controls
 * this, which is why the base stays where the second-visit gap needs it.
 */
const LEVEL_STEP_BASE = 540;
const LEVEL_STEP_INCREMENT = 250;

/** EXP needed to advance from `level` to `level + 1`. */
export function expForStep(level: number): number {
  return LEVEL_STEP_BASE + LEVEL_STEP_INCREMENT * (level - 1);
}

/**
 * Each rank looks different, so climbing is visible at a glance rather than
 * being a number that only changes size. Class names are written out in full
 * because Tailwind only keeps classes it can see as literal strings.
 *
 * The palette is deliberately unlike the skill-level styling elsewhere in the
 * app — these two must never read as the same scale.
 */
export interface RankTheme {
  key: string;
  title: string;
  icon: string;
  /** Bright colour: level number, bar fill, avatar ring, glow. */
  accent: string;
  /** Muted partner to `accent`, for gradients and the page wash. */
  accentDim: string;
  /** The rank panel's background gradient. */
  bg: string;
  /** The rank panel's border. */
  border: string;
  /** Rising motes on the panel; higher ranks get more, 0 = none. */
  particles: number;
}

const RANKS: { maxLevel: number; theme: RankTheme }[] = [
  {
    maxLevel: 3,
    theme: {
      key: "novice",
      title: "น้องใหม่",
      icon: "🌱",
      accent: "#6ee7a0",
      accentDim: "#2f5a41",
      bg: "linear-gradient(155deg,#182a20,#0c1712)",
      border: "#2c4636",
      particles: 0,
    },
  },
  {
    maxLevel: 9,
    theme: {
      key: "regular",
      title: "ขาประจำ",
      icon: "🔷",
      accent: "#5aa9f0",
      accentDim: "#274a6b",
      bg: "linear-gradient(155deg,#122236,#0a1626)",
      border: "#254058",
      particles: 0,
    },
  },
  {
    maxLevel: 19,
    theme: {
      key: "ace",
      title: "ตัวตึง",
      icon: "🔥",
      accent: "#ffcf4d",
      accentDim: "#6b4f16",
      bg: "linear-gradient(155deg,#332208,#1c1305)",
      border: "#5c410f",
      particles: 6,
    },
  },
  {
    maxLevel: Infinity,
    theme: {
      key: "legend",
      title: "ตำนานแหลมฉบัง",
      icon: "👑",
      accent: "#d9a8ff",
      accentDim: "#5b2f8f",
      bg: "linear-gradient(155deg,#28123f,#150a22)",
      border: "#4a2668",
      particles: 10,
    },
  },
];

export function rankThemeForLevel(level: number): RankTheme {
  return RANKS.find((r) => level <= r.maxLevel)!.theme;
}

export function rankForLevel(level: number): string {
  return rankThemeForLevel(level).title;
}

export interface LevelProgress {
  level: number;
  rank: string;
  theme: RankTheme;
  /** EXP already banked toward the level currently in progress. */
  intoLevel: number;
  /** EXP required to clear the current level. */
  levelSpan: number;
  /** intoLevel / levelSpan, 0–1. */
  progress: number;
  /** EXP still needed to reach the next level. */
  toNextLevel: number;
}

export function levelProgress(exp: number): LevelProgress {
  let level = 1;
  let acc = 0;
  for (;;) {
    const step = expForStep(level);
    if (acc + step > exp) {
      const intoLevel = exp - acc;
      return {
        level,
        rank: rankForLevel(level),
        theme: rankThemeForLevel(level),
        intoLevel,
        levelSpan: step,
        progress: intoLevel / step,
        toNextLevel: step - intoLevel,
      };
    }
    acc += step;
    level++;
  }
}
