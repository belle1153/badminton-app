import { loadQuests } from "@/lib/questProgress";
import { activeQuests, upcomingQuests, isPerDayKind, thaiQuestRange } from "@/lib/quests";

/**
 * Public quest board for the reward hub — every open quest that is running now
 * or about to start, so members can see what's on offer even before its window
 * opens (until it does, `activeQuests` hides it and it appears nowhere else).
 * Definition-only: personal progress lives on each player's profile.
 */
export default async function QuestBoard() {
  const now = new Date();
  const all = await loadQuests(true);
  const active = activeQuests(all, now);
  const upcoming = upcomingQuests(all, now);
  if (active.length === 0 && upcoming.length === 0) return null;

  const card = (
    q: (typeof all)[number],
    kind: "active" | "upcoming"
  ) => (
    <div
      key={q.id}
      className="flex items-center gap-3 rounded border px-3 py-2.5"
      style={{
        borderColor: kind === "active" ? "#4f9fe6" : "#384a63",
        background: kind === "active" ? "rgba(79,159,230,.08)" : "#232f42",
      }}
    >
      <span className="text-xl leading-none">{q.icon}</span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-[#e2e8f2]">{q.title}</span>
        <span className="text-[11px] text-[#8095ad]">
          {kind === "upcoming" ? "เริ่ม " : ""}
          {thaiQuestRange(q.startDate, q.endDate)}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[12px] font-bold tabular-nums text-[#6fdc9a]">
          +{q.expReward}
          {isPerDayKind(q.kind) && <span className="font-normal">/วัน</span>}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={
            kind === "active"
              ? { background: "rgba(79,159,230,.2)", color: "#8fc4f5" }
              : { background: "#2a3950", color: "#8095ad" }
          }
        >
          {kind === "active" ? "กำลังทำ" : "เร็วๆ นี้"}
        </span>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-[#f2f5fa]">🎯 เควสของก๊วน</h2>
      <p className="-mt-1 text-[11px] text-[#8095ad]">ทำสำเร็จรับ EXP เพิ่ม · ระบบคิดผู้ผ่านให้เอง</p>
      <div className="flex flex-col gap-2">
        {active.map((q) => card(q, "active"))}
        {upcoming.map((q) => card(q, "upcoming"))}
      </div>
    </section>
  );
}
