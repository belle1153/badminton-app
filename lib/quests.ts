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
  | "games-played"
  | "fastest-signup";

export interface QuestKindSpec {
  kind: QuestKind;
  label: string;
  /** How the admin should read the target field, or null when it takes none. */
  targetLabel: string | null;
  hint: string;
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
    kind: "games-played",
    label: "เล่นครบ N เกม",
    targetLabel: "จำนวนเกม",
    hint: "นับเกมที่เล่นจบในช่วงนี้",
  },
  {
    kind: "fastest-signup",
    label: "ลงชื่อไวสุด N อันดับแรก",
    targetLabel: "กี่อันดับ",
    hint: "นับจากเวลาที่กดลงชื่อ ต้องติดอันดับอย่างน้อย 1 รอบในช่วงนี้",
  },
];

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
  /** Best sign-up placing they achieved on any day in range (1 = first). */
  bestSignupPlace: number | null;
}

export interface QuestProgress {
  completed: boolean;
  /** "3/8" style progress while incomplete; null when the rule isn't countable. */
  progressLabel: string | null;
  current: number | null;
  target: number | null;
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

    default:
      // An unknown kind (e.g. a rule removed after quests were created) must
      // never silently mark everyone complete.
      return { completed: false, progressLabel: null, current: null, target: null };
  }
}

/** Quests whose window includes `now` — what a player is currently chasing. */
export function activeQuests<T extends QuestDef>(quests: T[], now: Date): T[] {
  return quests.filter((q) => q.active && inRange(now, q));
}
