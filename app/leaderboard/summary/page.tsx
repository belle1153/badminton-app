import Link from "next/link";
import { isAdmin } from "@/lib/adminAuth";
import { loadMissionSummary, missionSummaryOpen, MIN_GAMES } from "@/lib/missionSummary";
import SummaryBoard from "./SummaryBoard";

export const dynamic = "force-dynamic";

/** มิชชั่นโคตรตึง summary: top three in seven categories. Hidden until the admin opens it. */
export default async function MissionSummaryPage() {
  const [open, admin] = await Promise.all([missionSummaryOpen(), isAdmin()]);
  const visible = open || admin;
  const categories = visible ? await loadMissionSummary() : [];

  return (
    <div
      className="min-h-full font-[family-name:var(--font-pixel-body)]"
      style={{ background: "radial-gradient(ellipse at 50% -10%, #6b4f1655, #1c2536 55%), #1c2536" }}
    >
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3.5 pb-10 pt-4">
        <Link
          href="/leaderboard"
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#8fa3bd] hover:text-white"
        >
          <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&lt;</span>
          อันดับโคตรตึง
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-[#f2f5fa]">🏆 สรุปมิชชั่นโคตรตึง</h1>
          <p className="text-[12.5px] text-[#8095ad]">
            3 อันดับแรกของแต่ละหมวด นับจากทุกเกมที่เล่นจบ · Win rate / แพ้ / เสมอ นับเฉพาะคนที่เล่น {MIN_GAMES} เกมขึ้นไป ·
            คะแนนเท่ากันได้อันดับเท่ากัน
          </p>
        </div>

        {!visible ? (
          <div className="flex flex-col items-center gap-2 rounded border-2 border-dashed border-[#384a63] p-8 text-center">
            <span className="text-4xl">🔒</span>
            <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold text-[#0b1c30]">Coming soon</span>
          </div>
        ) : (
          <>
            {!open && (
              <p className="rounded bg-amber-300/15 px-3 py-2 text-[12px] text-amber-200">
                แอดมินเห็นหน้านี้คนเดียว · ผู้เล่นยังเห็น &quot;Coming soon&quot; จนกว่าจะเปิดที่หน้าเควสของแอดมิน
              </p>
            )}
            <SummaryBoard categories={categories} />
          </>
        )}
      </main>
    </div>
  );
}
