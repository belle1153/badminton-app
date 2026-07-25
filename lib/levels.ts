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
 * 400 sits in the gap the real data shows between the two groups: across every
 * player, a single day topped out at 305 EXP while everyone who came twice had
 * at least 475. Both sides keep a margin, so a heavy first day still can't
 * reach level 2 and a light second day still can.
 */
const LEVEL_STEP_BASE = 400;
const LEVEL_STEP_INCREMENT = 100;

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
  /** Gradient for the level card. */
  card: string;
  /** Rank pill on the card. */
  chip: string;
  /** Filled part of the progress bar. */
  bar: string;
  /** The card's own border. */
  ring: string;
}

const RANKS: { maxLevel: number; theme: RankTheme }[] = [
  {
    maxLevel: 3,
    theme: {
      key: "novice",
      title: "มือใหม่",
      icon: "🌱",
      card: "bg-gradient-to-br from-emerald-800 to-emerald-950",
      chip: "bg-emerald-500/90 text-emerald-50",
      bar: "bg-emerald-400",
      ring: "border-emerald-700",
    },
  },
  {
    maxLevel: 9,
    theme: {
      key: "regular",
      title: "ขาประจำ",
      icon: "🔷",
      card: "bg-gradient-to-br from-sky-800 to-slate-950",
      chip: "bg-sky-500/90 text-sky-50",
      bar: "bg-sky-400",
      ring: "border-sky-700",
    },
  },
  {
    maxLevel: 19,
    theme: {
      key: "ace",
      title: "ตัวตึง",
      icon: "🔥",
      card: "bg-gradient-to-br from-amber-700 to-orange-950",
      chip: "bg-amber-400/90 text-amber-950",
      bar: "bg-amber-300",
      ring: "border-amber-600",
    },
  },
  {
    maxLevel: Infinity,
    theme: {
      key: "legend",
      title: "ตำนานแหลมฉบัง",
      icon: "👑",
      card: "bg-gradient-to-br from-violet-800 to-fuchsia-950",
      chip: "bg-violet-400/90 text-violet-950",
      bar: "bg-violet-300",
      ring: "border-violet-600",
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
