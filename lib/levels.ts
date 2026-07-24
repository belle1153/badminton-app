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

const RANKS: { maxLevel: number; title: string }[] = [
  { maxLevel: 3, title: "มือใหม่" },
  { maxLevel: 9, title: "ขาประจำ" },
  { maxLevel: 19, title: "ตัวตึง" },
  { maxLevel: Infinity, title: "ตำนานแหลมฉบัง" },
];

export function rankForLevel(level: number): string {
  return RANKS.find((r) => level <= r.maxLevel)!.title;
}

export interface LevelProgress {
  level: number;
  rank: string;
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
