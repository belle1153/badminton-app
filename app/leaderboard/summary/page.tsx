import Link from "next/link";
import { isAdmin } from "@/lib/adminAuth";
import { loadMissionSummary, missionSummaryOpen, MIN_GAMES } from "@/lib/missionSummary";
import SummaryBoard from "./SummaryBoard";
import AwardPresenter from "./AwardPresenter";

export const dynamic = "force-dynamic";

/**
 * มิชชั่นโคตรตึง summary: top three in seven categories, hall-of-fame style, plus a
 * full-screen award mode for the ceremony. Hidden until the admin opens it.
 */
export default async function MissionSummaryPage() {
  const [open, admin] = await Promise.all([missionSummaryOpen(), isAdmin()]);
  const visible = open || admin;
  const categories = visible ? await loadMissionSummary() : [];

  return (
    <div
      className="relative min-h-full overflow-hidden font-[family-name:var(--font-pixel-body)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 40% at 50% -5%, #6b4f1688, transparent 70%), radial-gradient(ellipse 60% 40% at 50% 110%, #1f3a6b66, transparent 70%), #111a2b",
      }}
    >
      <main className="relative mx-auto flex w-full max-w-[480px] flex-col gap-6 px-4 pb-12 pt-4 md:max-w-3xl md:px-6 xl:max-w-7xl">
        <Link
          href="/leaderboard"
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#8fa3bd] hover:text-white"
        >
          <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&lt;</span>
          อันดับโคตรตึง
        </Link>

        {/* Hero */}
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="relative text-6xl leading-none md:text-7xl">
            <span className="drop-shadow-[0_0_28px_rgba(255,207,77,.6)]">🏆</span>
            <span aria-hidden="true" className="absolute -left-4 top-1 text-xl" style={{ animation: "twinkle 2.2s ease-in-out infinite" }}>
              ✦
            </span>
            <span aria-hidden="true" className="absolute -right-5 top-6 text-base" style={{ animation: "twinkle 2.8s ease-in-out .7s infinite" }}>
              ✦
            </span>
          </span>
          <span className="text-xs font-bold tracking-[0.35em] text-[#e8c766] md:text-sm">TUATUENG HALL OF FAME</span>
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl xl:text-6xl"
            style={{
              background: "linear-gradient(180deg, #fff6d6, #ffcf4d 55%, #c98f1e)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 16px rgba(255,207,77,.35))",
            }}
          >
            สรุปมิชชั่นโคตรตึง
          </h1>
          <p className="max-w-2xl text-[13px] text-[#a9bdd3] md:text-sm">
            3 อันดับแรกของแต่ละหมวด นับจากทุกเกมที่เล่นจบ · Win Rate นับเฉพาะคนที่เล่น {MIN_GAMES} เกมขึ้นไป ·
            คะแนนเท่ากันได้อันดับเท่ากัน
          </p>
          {visible && <AwardPresenter categories={categories} />}
        </header>

        {!visible ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#384a63] p-8 text-center">
            <span className="text-4xl">🔒</span>
            <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold text-[#0b1c30]">Coming soon</span>
          </div>
        ) : (
          <>
            {!open && (
              <p className="self-center rounded-full bg-amber-300/15 px-4 py-1.5 text-center text-[12px] text-amber-200">
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
