import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadPlayerProgress } from "@/lib/playerProgress";
import { loadQuestProgress, questExp } from "@/lib/questProgress";
import { expForBadge } from "@/lib/achievementRarity";
import { EXP_RATES } from "@/lib/exp";

export const dynamic = "force-dynamic";

/**
 * "ประวัติการเก็บแต้ม" — where a player's EXP came from: a per-day timeline
 * plus the running total split by source (play, streaks, new partners, medals,
 * quests). Recomputed on every read from the same engine the profile uses, so
 * the numbers here always match the profile total.
 */

const PANEL = "border-2 border-[#384a63] bg-[#232f42] shadow-[5px_5px_0_rgba(0,0,0,0.35)]";

/** Session dates are stored at UTC midnight of the intended local date. */
function thaiDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PointsHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!athlete) notFound();

  const quests = await loadQuestProgress(id);
  const qExp = questExp(quests);
  const progress = await loadPlayerProgress(id, qExp);

  const badgeExp = progress.achievements
    .filter((a) => a.earned)
    .reduce((n, a) => n + expForBadge(a.target), 0);
  const completedQuests = quests.filter((q) => q.progress.completed);
  const { exp } = progress;

  // Every EXP source, so the list adds up to the profile total exactly.
  const sources = [
    { label: `มาเล่น (วันละ ${EXP_RATES.perDay})`, value: exp.attendance },
    { label: `เล่นเกม (เกมละ ${EXP_RATES.perGame})`, value: exp.games },
    { label: `ชนะ (เกมละ ${EXP_RATES.perWin})`, value: exp.wins },
    { label: "มาต่อเนื่อง", value: exp.streakBonus },
    { label: "จับคู่คนใหม่", value: exp.newPartnerBonus },
    { label: "เหรียญที่ปลดล็อก", value: badgeExp },
    { label: "เควสสำเร็จ", value: qExp },
  ].filter((s) => s.value > 0);

  // Newest day first.
  const days = [...progress.expDays].reverse();

  return (
    <div
      className="min-h-full font-[family-name:var(--font-pixel-body)]"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, #23324755, #1c2536 55%), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0px, rgba(255,255,255,.02) 1px, transparent 1px, transparent 3px), #1c2536",
      }}
    >
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-3.5 pb-10 pt-4">
        <Link
          href={`/player/${id}`}
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#8fa3bd] hover:text-white"
        >
          <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&lt;</span>
          กลับโปรไฟล์
        </Link>

        <section className={`pixel-frame flex flex-col gap-1 p-4 ${PANEL}`}>
          <h1 className="text-[17px] font-bold text-[#f2f5fa]">📜 ประวัติการเก็บแต้ม</h1>
          <p className="text-[12.5px] text-[#8095ad]">{athlete.name}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-pixel-display)] text-[22px] text-[#6fdc9a]">
              {exp.total.toLocaleString()}
            </span>
            <span className="text-[12px] text-[#8095ad]">EXP รวม</span>
          </div>
        </section>

        {exp.total === 0 ? (
          <p className={`pixel-frame p-4 text-[13px] text-[#8095ad] ${PANEL}`}>
            ยังไม่มีแต้ม — เริ่มเก็บได้หลังลงเล่นจบเกมแรกครับ
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-[#e2e8f2]">ที่มาของ EXP</h2>
              <ul className="flex flex-col rounded border border-[#384a63] bg-[#232f42]">
                {sources.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center gap-2 border-b border-[#384a63] px-3 py-2 text-[13px] text-[#c7d2e0] last:border-b-0"
                  >
                    <span>{s.label}</span>
                    <span className="ml-auto tabular-nums font-semibold text-[#6fdc9a]">
                      +{s.value.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {completedQuests.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-[#e2e8f2]">🎯 เควสที่ทำสำเร็จ</h2>
                <ul className="flex flex-col rounded border border-[#384a63] bg-[#232f42]">
                  {completedQuests.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-2.5 border-b border-[#384a63] px-3 py-2.5 text-[13px] text-[#c7d2e0] last:border-b-0"
                    >
                      <span className="text-lg leading-none">{q.icon}</span>
                      <span className="min-w-0 truncate">{q.title}</span>
                      <span className="ml-auto tabular-nums font-semibold text-[#6fdc9a]">
                        +{q.expReward.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-[#e2e8f2]">รายวัน</h2>
              <p className="-mt-1 text-[11px] text-[#8095ad]">
                แต้มที่ได้แต่ละวันที่มาเล่น · ใหม่สุดอยู่บน
              </p>
              <ul className="flex flex-col gap-2">
                {days.map((d) => {
                  const parts = [
                    { label: "มาเล่น", v: d.attendance },
                    { label: `${d.games} เกม`, v: d.gamesExp },
                    { label: `ชนะ ${d.wins}`, v: d.winsExp },
                    { label: "ต่อเนื่อง", v: d.streakBonus },
                    { label: "คู่ใหม่", v: d.newPartnerBonus },
                  ].filter((p) => p.v > 0);
                  return (
                    <li
                      key={d.date.toISOString()}
                      className="flex flex-col gap-1.5 rounded border border-[#384a63] bg-[#232f42] px-3 py-2.5"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-semibold text-[#e2e8f2]">
                          {thaiDate(d.date)}
                        </span>
                        <span className="ml-auto font-[family-name:var(--font-pixel-display)] text-[13px] text-[#6fdc9a]">
                          +{d.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parts.map((p) => (
                          <span
                            key={p.label}
                            className="rounded-full bg-[#1a2433] px-2 py-0.5 text-[10.5px] text-[#9fb4c9]"
                          >
                            {p.label} <span className="tabular-nums text-[#6fdc9a]">+{p.v}</span>
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <p className="text-[11px] text-[#4a5b70]">
              คิดใหม่ทุกครั้งจากประวัติจริง — ถ้าแอดมินแก้ผลเกมย้อนหลัง แต้มตรงนี้จะอัปเดตตาม
            </p>
          </>
        )}
      </main>
    </div>
  );
}
