import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadQuestRoster } from "@/lib/questProgress";
import { QUEST_KINDS, thaiQuestRange } from "@/lib/quests";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  upcoming: { text: "ยังไม่เริ่ม", cls: "bg-gray-100 text-gray-600" },
  active: { text: "กำลังทำ", cls: "bg-green-100 text-green-700" },
  ended: { text: "จบแล้ว", cls: "bg-amber-100 text-amber-700" },
} as const;

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
  const { id } = await params;
  const roster = await loadQuestRoster(id);
  if (!roster) notFound();

  const { quest, status, entries, clubDaysInWindow } = roster;
  const done = entries.filter((e) => e.progress.completed);
  const pending = entries.filter((e) => !e.progress.completed);
  const kindLabel = QUEST_KINDS.find((k) => k.kind === quest.kind)?.label ?? quest.kind;
  const badge = STATUS_LABEL[status];

  const row = (e: (typeof entries)[number], completed: boolean) => {
    const { current, target, progressLabel } = e.progress;
    // A bar only means anything when the rule counts up to a target — a sign-up
    // placing has no "how far along" to draw.
    const pct =
      quest.kind !== "fastest-signup" && target && target > 0
        ? Math.min(100, Math.round(((current ?? 0) / target) * 100))
        : null;
    return (
      <li key={e.athleteId} className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm">{completed ? "✅" : "⏳"}</span>
          <Link
            href={`/player/${e.athleteId}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {e.name}
          </Link>
          <span className="shrink-0 text-xs tabular-nums text-gray-500">{progressLabel ?? "—"}</span>
        </div>
        {pct != null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${completed ? "bg-green-500" : "bg-brand-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <Link href="/admin/quests" className="text-sm text-gray-500 hover:underline">
        ← กลับไปหน้าเควส
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{quest.icon}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-xl font-bold">{quest.title}</h1>
            <p className="text-sm text-gray-500">
              {kindLabel}
              {quest.target != null && ` (${quest.target})`} ·{" "}
              {thaiQuestRange(quest.startDate, quest.endDate)} · +{quest.expReward} EXP
            </p>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}
          >
            {badge.text}
          </span>
        </div>
        {!quest.active && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            เควสนี้ปิดอยู่ — ซ่อนจากหน้าผู้เล่น แต่คนที่ทำสำเร็จไปแล้วยัง<b>ได้ EXP อยู่</b>
            <br />
            ถ้าอยากดึง EXP คืนจริงๆ ต้องกด <b>ลบ</b> เท่านั้น
          </p>
        )}
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["ผ่านแล้ว", `${done.length} คน`],
          ["ยังไม่ผ่าน", `${pending.length} คน`],
          ["วันที่ก๊วนจัด", `${clubDaysInWindow} วัน`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 px-2 py-3">
            <div className="text-lg font-bold tabular-nums">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">✅ ผ่านแล้ว ({done.length})</h2>
        {done.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีใครทำสำเร็จครับ</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
            {done.map((e) => row(e, true))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">⏳ ยังไม่ผ่าน ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">
            {entries.length === 0 ? "ยังไม่มีใครมาเล่นในช่วงนี้ครับ" : "ผ่านกันหมดแล้วครับ 🎉"}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
            {pending.map((e) => row(e, false))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">
        รายชื่อนี้คิดสดจากประวัติการเล่นทุกครั้งที่เปิดหน้า — แก้หรือลบผลแมตซ์ย้อนหลัง ผลเควสจะขยับตามเอง
        และจะขึ้นเฉพาะคนที่มีชื่อลงเล่นในช่วงเวลาของเควสเท่านั้น
      </p>
    </main>
  );
}
