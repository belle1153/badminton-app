/**
 * Achievements, all derived from match history — nothing here is a stored
 * counter, so an admin editing or deleting a finished game is reflected
 * immediately rather than leaving a badge earned from data that no longer
 * exists. Kept deliberately separate from `SkillLevel`: these celebrate
 * showing up and playing, never how good someone is.
 */
export interface AchievementContext {
  gamesPlayed: number;
  wins: number;
  draws: number;
  daysPlayed: number;
  /** Best-ever consecutive-club-day run (see lib/streaks.ts). */
  longestStreakDays: number;
  distinctPartners: number;
  /** Most games played in a single day. */
  bestDayGames: number;
  /** Games played alongside the single most-frequent partner. */
  bestPartnerGames: number;
  /** Longest single day on court, in hours (block start → last game finished). */
  bestDayHours: number;
  /** How many days lasted at least 3 hours. */
  longDays: number;
  /** Most different partners in a single day. */
  bestDayPartners: number;
  /** Longest run of consecutive wins within one day. */
  bestDayWinStreak: number;
  /** Played within the club's first FOUNDING_WINDOW recorded play-days. */
  isFoundingMember: boolean;
}

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
  /** "7/10" while locked and numerically trackable; omitted for one-off badges. */
  progressLabel?: string;
  /** The goal, or null for a one-off badge. Drives the coin's rarity tier. */
  target: number | null;
  /** How far along, for the ring under a locked coin. Null when not countable. */
  current: number | null;
}

interface Def {
  id: string;
  icon: string;
  label: string;
  target: number;
  metric: (ctx: AchievementContext) => number;
}

// Icons are single-codepoint emoji on purpose. ZWJ sequences (🧑‍🤝‍🧑, ❤️‍🔥) fall
// apart into their component glyphs on devices that lack the combined form,
// which is what made the grid look inconsistent.
const NUMERIC_DEFS: Def[] = [
  // เริ่มต้น
  { id: "first-day", icon: "🐣", label: "มาเล่นครั้งแรก", target: 1, metric: (c) => c.daysPlayed },
  { id: "first-game", icon: "🏸", label: "เกมแรก", target: 1, metric: (c) => c.gamesPlayed },
  { id: "first-win", icon: "⭐", label: "ชนะครั้งแรก", target: 1, metric: (c) => c.wins },
  { id: "first-partner", icon: "🤝", label: "คู่แรก", target: 1, metric: (c) => c.distinctPartners },

  // ปริมาณเกม
  { id: "games-25", icon: "🥉", label: "เล่นครบ 25 เกม", target: 25, metric: (c) => c.gamesPlayed },
  { id: "games-50", icon: "🎖️", label: "เล่นครบ 50 เกม", target: 50, metric: (c) => c.gamesPlayed },
  { id: "games-100", icon: "🥈", label: "เล่นครบ 100 เกม", target: 100, metric: (c) => c.gamesPlayed },
  { id: "games-250", icon: "🥇", label: "เล่นครบ 250 เกม", target: 250, metric: (c) => c.gamesPlayed },
  { id: "games-500", icon: "🏆", label: "เล่นครบ 500 เกม", target: 500, metric: (c) => c.gamesPlayed },

  // ชัยชนะ
  { id: "wins-10", icon: "💪", label: "ชนะครบ 10 เกม", target: 10, metric: (c) => c.wins },
  { id: "wins-50", icon: "⚔️", label: "ชนะครบ 50 เกม", target: 50, metric: (c) => c.wins },
  { id: "wins-100", icon: "🚀", label: "ชนะครบ 100 เกม", target: 100, metric: (c) => c.wins },

  // มาบ่อยแค่ไหน (สะสม ไม่ต้องติดกัน)
  { id: "days-5", icon: "📅", label: "มาเล่นครบ 5 วัน", target: 5, metric: (c) => c.daysPlayed },
  { id: "days-10", icon: "📆", label: "มาเล่นครบ 10 วัน", target: 10, metric: (c) => c.daysPlayed },
  { id: "days-25", icon: "🗓️", label: "มาเล่นครบ 25 วัน", target: 25, metric: (c) => c.daysPlayed },
  { id: "days-50", icon: "💎", label: "มาเล่นครบ 50 วัน", target: 50, metric: (c) => c.daysPlayed },

  // มาต่อเนื่อง (ติดกันจริง วัดกับปฏิทินของก๊วน)
  { id: "streak-3", icon: "🔗", label: "มาต่อเนื่อง 3 ครั้งติด", target: 3, metric: (c) => c.longestStreakDays },
  { id: "streak-5", icon: "⛓️", label: "มาต่อเนื่อง 5 ครั้งติด", target: 5, metric: (c) => c.longestStreakDays },
  { id: "streak-10", icon: "🏅", label: "มาต่อเนื่อง 10 ครั้งติด", target: 10, metric: (c) => c.longestStreakDays },

  // สังคม
  { id: "partners-10", icon: "👥", label: "จับคู่ครบ 10 คน", target: 10, metric: (c) => c.distinctPartners },
  { id: "partners-20", icon: "🌍", label: "จับคู่ครบ 20 คน", target: 20, metric: (c) => c.distinctPartners },

  // คู่ซี้ — เล่นกับคนเดิมบ่อย
  { id: "duo-10", icon: "💞", label: "คู่ซี้ — จับคู่คนเดิม 10 เกม", target: 10, metric: (c) => c.bestPartnerGames },
  { id: "duo-25", icon: "💖", label: "คู่ขาประจำ — จับคู่คนเดิม 25 เกม", target: 25, metric: (c) => c.bestPartnerGames },

  // ขยันในวันเดียว
  { id: "day-6-games", icon: "⚡", label: "ไฟแรง — เล่น 6 เกมในวันเดียว", target: 6, metric: (c) => c.bestDayGames },
  { id: "day-10-games", icon: "🔋", label: "ไม่มีหมด — เล่น 10 เกมในวันเดียว", target: 10, metric: (c) => c.bestDayGames },
  { id: "star-day", icon: "🌟", label: "ดาวเด่น — คู่ไม่ซ้ำ 5 คนในวันเดียว", target: 5, metric: (c) => c.bestDayPartners },
  { id: "hot-hand", icon: "🎯", label: "ยอดฝีมือ — ชนะ 3 เกมติดในวันเดียว", target: 3, metric: (c) => c.bestDayWinStreak },

  // อึด — อยู่ยาวในวันเดียว
  { id: "long-day-1", icon: "⏳", label: "อึด — เล่น 3 ชม. ในวันเดียว", target: 1, metric: (c) => c.longDays },
  { id: "long-day-5", icon: "⏰", label: "อึดจริง — เล่น 3 ชม. ครบ 5 ครั้ง", target: 5, metric: (c) => c.longDays },
  { id: "long-day-20", icon: "🕰️", label: "ตัวจริง — เล่น 3 ชม. ครบ 20 ครั้ง", target: 20, metric: (c) => c.longDays },

  // ลูกเล่น
  { id: "diplomat", icon: "🎭", label: "นักการทูต — เกมเสมอ 10 ครั้ง", target: 10, metric: (c) => c.draws },
];

// Nothing here rewards checking out: only the admin can do that, so it would be
// an achievement the player has no way to earn on their own.

export function computeAchievements(ctx: AchievementContext): Achievement[] {
  const numeric: Achievement[] = NUMERIC_DEFS.map((d) => {
    const current = d.metric(ctx);
    const earned = current >= d.target;
    return {
      id: d.id,
      icon: d.icon,
      label: d.label,
      earned,
      progressLabel: earned ? undefined : `${current}/${d.target}`,
      target: d.target,
      current,
    };
  });

  const founding: Achievement = {
    id: "founding-member",
    icon: "🌅",
    label: "รุ่นบุกเบิก",
    earned: ctx.isFoundingMember,
    target: null,
    current: null,
  };

  return [...numeric, founding];
}
