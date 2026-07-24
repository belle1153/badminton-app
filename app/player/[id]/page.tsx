import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import { computePlayerStats, loadPlayerGames } from "@/lib/playerStats";
import BackLink from "../../BackLink";
import RememberMe from "./RememberMe";

export const dynamic = "force-dynamic";

/** Session dates are stored at UTC midnight of the intended local date, so read
 *  them back in UTC to keep that calendar date. */
function thaiDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 py-3">
      <span className={`text-2xl font-bold ${tone ?? "text-gray-900"}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({
    where: { id },
    select: { id: true, name: true, skillLevel: true, photoUrl: true, updatedAt: true },
  });
  if (!athlete) notFound();

  const stats = computePlayerStats(await loadPlayerGames(id));

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <BackLink href="/" label="หน้าแรก" exact />

      <section className="flex items-center gap-4">
        {athlete.photoUrl ? (
          // Plain <img>, like the admin roster: the photo API is versioned with a
          // query string, which next/image rejects for local sources unless
          // images.localPatterns is configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/athletes/${athlete.id}/photo?v=${athlete.updatedAt.getTime()}`}
            alt={athlete.name}
            className="h-[72px] w-[72px] shrink-0 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="h-[72px] w-[72px] rounded-full bg-brand-100 text-brand-700 grid place-items-center text-2xl shrink-0">
            🏸
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-bold break-words">{athlete.name}</h1>
          <span className="self-start text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
            มือ {SKILL_LABELS[athlete.skillLevel as SkillLevel] ?? athlete.skillLevel}
          </span>
        </div>
      </section>

      {stats.games === 0 ? (
        <p className="text-sm text-gray-500 rounded-lg border border-gray-200 p-4">
          ยังไม่มีสถิติ — สถิติจะขึ้นหลังลงเล่นจบเกมแรกครับ
        </p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2">
            <Stat value={String(stats.days)} label="วันที่มาเล่น" />
            <Stat value={String(stats.games)} label="เกมที่เล่น" />
            <Stat
              value={stats.winRate != null ? `${stats.winRate}%` : "—"}
              label="อัตราชนะ"
              tone="text-brand-700"
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">ผลการเล่น</h2>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={String(stats.wins)} label="ชนะ" tone="text-green-600" />
              <Stat value={String(stats.losses)} label="แพ้" tone="text-gray-500" />
              <Stat value={String(stats.draws)} label="เสมอ" tone="text-amber-500" />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">คู่ที่เล่นด้วย</h2>
            <p className="text-sm text-gray-500">
              เคยจับคู่กับ {stats.partners} คน
            </p>
            <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
              {stats.topPartners.map((p, i) => (
                <li key={p.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-5 shrink-0">{i + 1}</span>
                  <a href={`/player/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.name}
                  </a>
                  <span className="ml-auto text-gray-500">{p.games} เกม</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-gray-400">
            มาเล่นครั้งแรก {stats.firstPlayed ? thaiDate(stats.firstPlayed) : "—"} · ครั้งล่าสุด{" "}
            {stats.lastPlayed ? thaiDate(stats.lastPlayed) : "—"}
          </p>
        </>
      )}

      <RememberMe athleteId={athlete.id} name={athlete.name} />

      <p className="text-xs text-gray-400">
        นับจากเกมที่เล่นจบแล้วเท่านั้น · &quot;วันที่มาเล่น&quot; นับวันที่ลงสนามจริง
      </p>
    </main>
  );
}
