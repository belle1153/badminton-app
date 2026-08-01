/**
 * Admin-created, time-boxed challenges.
 *
 * A quest stores only its definition — which rule, over which dates, for how
 * much EXP. Who has completed it is recomputed from play history every time,
 * the same as EXP and achievements: the admin can edit or delete a finished
 * game at any point, and a stored winner list would go on rewarding someone for
 * a game that no longer exists.
 *
 * Rules are a fixed set rather than free-form, so every one of them can be
 * derived from data the app already records.
 */

export type QuestKind =
  | "perfect-attendance"
  | "days-played"
  | "checkin-days"
  | "games-played"
  | "fastest-signup"
  | "fastest-signup-daily";

export interface QuestKindSpec {
  kind: QuestKind;
  label: string;
  /** How the admin should read the target field, or null when it takes none. */
  targetLabel: string | null;
  hint: string;
  /** `expReward` is paid once per qualifying day, not once per quest. */
  perDay?: boolean;
}

export const QUEST_KINDS: QuestKindSpec[] = [
  {
    kind: "perfect-attendance",
    label: "มาครบทุกวันที่ก๊วนจัด",
    targetLabel: null,
    hint: "ต้องลงเล่นจบเกมทุกวันที่ก๊วนจัดในช่วงนี้",
  },
  {
    kind: "days-played",
    label: "มาเล่นครบ N วัน",
    targetLabel: "จำนวนวัน",
    hint: "นับเฉพาะวันที่มีเกมเล่นจบ",
  },
  {
    kind: "checkin-days",
    label: "เช็คอินครบ N วัน",
    targetLabel: "จำนวนวัน",
    hint: "นับวันที่เช็คอิน (มาถึงสนาม) ไม่ต้องเล่นจบเกมก็ได้",
  },
  {
    kind: "games-played",
    label: "เล่นครบ N เกม",
    targetLabel: "จำนวนเกม",
    hint: "นับเกมที่เล่นจบในช่วงนี้",
  },
  {
    kind: "fastest-signup",
    label: "ลงชื่อไวสุด N อันดับแรก (ครั้งเดียวจบ)",
    targetLabel: "กี่อันดับ",
    hint: "ติดอันดับแค่วันเดียวก็จบเควส ได้ EXP ก้อนเดียว",
  },
  {
    kind: "fastest-signup-daily",
    label: "ลงชื่อไวสุด N อันดับแรก — นับทุกวัน",
    targetLabel: "กี่อันดับ",
    hint: "ติดอันดับวันไหนได้ EXP วันนั้น ทำซ้ำได้ทุกวันที่ก๊วนจัดในช่วงนี้ (EXP ที่กรอกคือต่อ 1 วัน)",
    perDay: true,
  },
];

/** Kinds whose EXP is paid per qualifying day — `expReward` reads "per day",
 *  and a player's total is a multiple of it. */
export const isPerDayKind = (kind: string): boolean =>
  QUEST_KINDS.some((k) => k.kind === kind && k.perDay);

export interface QuestDef {
  id: string;
  title: string;
  kind: string;
  icon: string;
  /** Inclusive. */
  startDate: Date;
  /** Exclusive, so consecutive months tile without overlapping. */
  endDate: Date;
  target: number | null;
  expReward: number;
  active: boolean;
}

/** What one player did, already scoped to the quest's date range. */
export interface QuestPlayerFacts {
  /** Session dates (UTC midnight) where they finished at least one game. */
  daysPlayed: Date[];
  /** Finished games in the range. */
  gamesPlayed: number;
  /** Distinct days in range they checked in (attended), games or not. */
  checkinDays: number;
  /** Best sign-up placing they achieved on any day in range (1 = first). */
  bestSignupPlace: number | null;
  /** Their placing on every day in range they signed themselves up, one entry
   *  per day — what a per-day rule counts over. */
  signupPlaces: number[];
}

export interface QuestProgress {
  completed: boolean;
  /** "3/8" style progress while incomplete; null when the rule isn't countable. */
  progressLabel: string | null;
  current: number | null;
  target: number | null;
  /**
   * EXP this player has actually earned from the quest — normally the full
   * reward once complete, but a per-day rule pays a multiple of it. Summing
   * this rather than `expReward` is what lets one quest definition pay out on
   * many days.
   */
  earnedExp: number;
}

const key = (d: Date) => d.toISOString().slice(0, 10);

export function inRange(date: Date, quest: { startDate: Date; endDate: Date }): boolean {
  const t = date.getTime();
  return t >= quest.startDate.getTime() && t < quest.endDate.getTime();
}

/**
 * `clubDaysInRange` is every date the club actually played within the quest
 * window — perfect attendance is measured against that, never against the
 * calendar, so a week the club skipped can't cost anyone the quest.
 */
export function evaluateQuest(
  quest: QuestDef,
  facts: QuestPlayerFacts,
  clubDaysInRange: Date[]
): QuestProgress {
  const p = scoreRule(quest, facts, clubDaysInRange);
  return {
    ...p,
    // A per-day rule reports how many days it earned on; everything else is a
    // single payout. Either way the reward is derived here, never stored.
    earnedExp: p.payDays != null ? p.payDays * quest.expReward : p.completed ? quest.expReward : 0,
  };
}

/** One rule's raw standing. `payDays` is set only by per-day rules. */
function scoreRule(
  quest: QuestDef,
  facts: QuestPlayerFacts,
  clubDaysInRange: Date[]
): Omit<QuestProgress, "earnedExp"> & { payDays?: number } {
  switch (quest.kind as QuestKind) {
    case "perfect-attendance": {
      const played = new Set(facts.daysPlayed.map(key));
      const need = clubDaysInRange.length;
      const have = clubDaysInRange.filter((d) => played.has(key(d))).length;
      // A window with no play days yet is not "complete" — nobody has done
      // anything, and showing everyone as a winner would be nonsense.
      return {
        completed: need > 0 && have === need,
        progressLabel: need > 0 ? `${have}/${need}` : null,
        current: have,
        target: need,
      };
    }

    case "days-played": {
      const target = quest.target ?? 0;
      const have = facts.daysPlayed.length;
      return {
        completed: target > 0 && have >= target,
        progressLabel: `${have}/${target}`,
        current: have,
        target,
      };
    }

    case "checkin-days": {
      const target = quest.target ?? 0;
      const have = facts.checkinDays;
      return {
        completed: target > 0 && have >= target,
        progressLabel: `${have}/${target}`,
        current: have,
        target,
      };
    }

    case "games-played": {
      const target = quest.target ?? 0;
      const have = facts.gamesPlayed;
      return {
        completed: target > 0 && have >= target,
        progressLabel: `${have}/${target}`,
        current: have,
        target,
      };
    }

    case "fastest-signup": {
      const target = quest.target ?? 0;
      const place = facts.bestSignupPlace;
      const completed = target > 0 && place != null && place <= target;
      return {
        completed,
        progressLabel: place != null ? `อันดับดีสุด #${place}` : "ยังไม่ติดอันดับ",
        current: place,
        target,
      };
    }

    case "fastest-signup-daily": {
      // Paid per day, so one definition covers every day the club plays in the
      // window instead of the admin creating a quest per night.
      const target = quest.target ?? 0;
      const days = target > 0 ? facts.signupPlaces.filter((p) => p <= target).length : 0;
      return {
        completed: days > 0,
        progressLabel: days > 0 ? `ติดอันดับ ${days} วัน` : "ยังไม่ติดอันดับ",
        current: days,
        // No goal to fill — the count is open-ended, so there is no bar to draw.
        target: null,
        payDays: days,
      };
    }

    default:
      // An unknown kind (e.g. a rule removed after quests were created) must
      // never silently mark everyone complete.
      return { completed: false, progressLabel: null, current: null, target: null, payDays: 0 };
  }
}

/** Quests whose window includes `now` — what a player is currently chasing.
 *  Honours `active`, because this is a display list. */
export function activeQuests<T extends QuestDef>(quests: T[], now: Date): T[] {
  return quests.filter((q) => q.active && inRange(now, q));
}

/**
 * The subset of a scored list a member should actually see. EXP is summed over
 * everything started (`startedQuests`), so a switched-off quest still pays out
 * — it just stops being shown.
 */
export function visibleQuests<T extends { active: boolean }>(quests: T[]): T[] {
  return quests.filter((q) => q.active);
}

/**
 * Every quest that has already begun — finished ones AND switched-off ones
 * included.
 *
 * This — not `activeQuests` — is what EXP must be counted from. A completed
 * quest is a thing the player did, and nothing an admin does to the listing
 * afterwards can un-do it. Two separate bugs came from scoring a narrower set:
 * counting only the currently-open ones wiped a reward the moment its window
 * closed, and honouring `active` here meant switching an old quest off to tidy
 * the admin list clawed EXP back off the whole club.
 *
 * `active` is a visibility flag — see `activeQuests` / `upcomingQuests`, which
 * do honour it. To actually take a quest's EXP back, delete the quest.
 */
export function startedQuests<T extends QuestDef>(quests: T[], now: Date): T[] {
  return quests.filter((q) => now.getTime() >= q.startDate.getTime());
}

export type QuestStatus = "upcoming" | "active" | "ended";

export function questStatus(quest: { startDate: Date; endDate: Date }, now: Date): QuestStatus {
  if (now.getTime() < quest.startDate.getTime()) return "upcoming";
  if (now.getTime() >= quest.endDate.getTime()) return "ended";
  return "active";
}

/** Quests that haven't started yet — worth showing so members can prepare. */
export function upcomingQuests<T extends QuestDef>(quests: T[], now: Date): T[] {
  return quests
    .filter((q) => q.active && now.getTime() < q.startDate.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/** "1 ส.ค. 2569 – 30 ส.ค. 2569" — endDate is exclusive, so the label shows the
 *  last day people can actually play (endDate − 1 day), like the admin list. */
export function thaiQuestRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${fmt(start)} – ${fmt(lastDay)}`;
}
