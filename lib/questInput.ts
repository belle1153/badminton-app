import { QUEST_KINDS } from "@/lib/quests";

/**
 * Validation for the quest form, shared by create and edit so the two can never
 * drift — an edit that skipped a check could put a quest into a state the
 * create form would have rejected (a target of 0, an end before its start),
 * and every one of those silently changes who gets EXP.
 */

const VALID_KINDS: Set<string> = new Set(QUEST_KINDS.map((k) => k.kind));

export interface QuestFields {
  title: string;
  kind: string;
  icon: string;
  startDate: Date;
  endDate: Date;
  target: number | null;
  expReward: number;
}

export type QuestParse = { ok: true; data: QuestFields } | { ok: false; error: string };

/** Dates arrive as yyyy-mm-dd and are stored at UTC midnight, matching
 *  Session.date, so range comparisons line up with how play days are recorded. */
const parseDate = (v: unknown): Date => new Date(`${String(v)}T00:00:00.000Z`);

export function parseQuestInput(body: Record<string, unknown>): QuestParse {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, error: "ใส่ชื่อเควสด้วยครับ" };

  const kind = String(body.kind ?? "");
  if (!VALID_KINDS.has(kind)) return { ok: false, error: "ประเภทเควสไม่ถูกต้อง" };

  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return { ok: false, error: "วันสิ้นสุดต้องหลังวันเริ่ม" };
  }

  const reward = Number(body.expReward);
  if (!Number.isFinite(reward) || reward <= 0) {
    return { ok: false, error: "EXP ต้องมากกว่า 0" };
  }

  const spec = QUEST_KINDS.find((k) => k.kind === kind)!;
  let target: number | null = null;
  if (spec.targetLabel != null) {
    target = Number(body.target);
    if (!Number.isFinite(target) || target <= 0) {
      return { ok: false, error: `ใส่${spec.targetLabel}ด้วยครับ` };
    }
  }

  const iconRaw = typeof body.icon === "string" ? body.icon.trim() : "";

  return {
    ok: true,
    data: {
      title,
      kind,
      icon: iconRaw || "🎯",
      startDate,
      endDate,
      target,
      expReward: Math.round(reward),
    },
  };
}
