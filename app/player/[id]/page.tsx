import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import { computePlayerStats, loadPlayerGames, loadPlayerMatchHistory } from "@/lib/playerStats";
import { loadPlayerProgress } from "@/lib/playerProgress";
import { loadQuestProgress, questExp, loadQuests } from "@/lib/questProgress";
import { upcomingQuests, thaiQuestRange } from "@/lib/quests";
import GameHistoryTable, { type HistoryRow } from "../../session/GameHistoryTable";
import AchievementCoin from "./AchievementCoin";
import RememberMe from "./RememberMe";

export const dynamic = "force-dynamic";

/**
 * The one screen in the app with a retro-game treatment: chamfered panels, hard
 * shadows, a pixel display face for numerals, and coins for achievements. It's
 * the reward screen, so it's allowed to look unlike the utilitarian pages that
 * get work done.
 *
 * Colour comes from the player's rank, so the page itself changes as they climb.
 */

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

/** "จ. 20 ก.ค." — compact, for the match log. */
function shortDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const PANEL = "border-2 border-[#384a63] bg-[#232f42] shadow-[5px_5px_0_rgba(0,0,0,0.35)]";
const LIST_FRAME = "rounded border border-[#384a63] bg-[#232f42]";

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded border border-[#384a63] bg-[#232f42] px-1 py-2.5">
      <span
        className="font-[family-name:var(--font-pixel-display)] text-[15px]"
        style={{ color: color ?? "#e2e8f2" }}
      >
        {value}
      </span>
      <span className="text-[10.5px] text-[#8ba0b8]">{label}</span>
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

  const quests = await loadQuestProgress(id);
  // Quests that haven't started yet: shown as a locked preview so a member sees
  // what's coming (the in-window `quests` above hides them until they open).
  const upcoming = upcomingQuests(await loadQuests(true), new Date());
  const [stats, recent, progress] = await Promise.all([
    loadPlayerGames(id).then((games) => computePlayerStats(games)),
    loadPlayerMatchHistory(id, 10),
    loadPlayerProgress(id, questExp(quests)),
  ]);

  const theme = progress.level.theme;
  const earnedCount = progress.achievements.filter((a) => a.earned).length;

  const historyRows: HistoryRow[] = recent.map((m) => ({
    id: m.id,
    seq: m.seq,
    court: m.court,
    winnerTeam: m.winnerTeam,
    myTeam: m.myTeam,
    team1: m.team1,
    team2: m.team2,
    dateLabel: shortDate(m.date),
    highlightName: athlete.name,
  }));

  // Rising motes, on the higher ranks only.
  const particles = Array.from({ length: theme.particles }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    size: 3 + (i % 3),
    delay: `${(i * 0.53) % 3.2}s`,
    duration: `${2.6 + (i % 3) * 0.4}s`,
  }));

  return (
    <div
      className="min-h-full font-[family-name:var(--font-pixel-body)]"
      style={{
        background: `radial-gradient(ellipse at 50% -10%, ${theme.accentDim}55, #1c2536 55%), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0px, rgba(255,255,255,.02) 1px, transparent 1px, transparent 3px), #1c2536`,
      }}
    >
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-3.5 pb-10 pt-4">
        <Link
          href="/player"
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#8fa3bd] hover:text-white"
        >
          <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&lt;</span>
          กลับ
        </Link>

        <section className={`pixel-frame p-4 ${PANEL}`}>
          <div className="flex items-center gap-3.5">
            <div
              className="box-border h-[76px] w-[76px] shrink-0 rounded-full p-0.5"
              style={{ border: `3px solid ${theme.accent}`, boxShadow: `0 0 10px ${theme.accent}77` }}
            >
              {athlete.photoUrl ? (
                // Plain <img>: the photo API is versioned with a query string,
                // which next/image rejects for local sources unless
                // images.localPatterns is configured.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/athletes/${athlete.id}/photo?v=${athlete.updatedAt.getTime()}`}
                  alt={athlete.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center rounded-full bg-[#1a2433] text-2xl">
                  🏸
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="text-[19px] font-bold break-words text-[#f2f5fa]">{athlete.name}</h1>
              <span className="self-start rounded border border-[#2c3c50] bg-[#1a2433] px-2.5 py-0.5 text-[11px] text-[#9fb4c9]">
                มือ {SKILL_LABELS[athlete.skillLevel as SkillLevel] ?? athlete.skillLevel}
              </span>
            </div>
          </div>
        </section>

        {stats.games === 0 ? (
          <p className={`pixel-frame p-4 text-[13px] text-[#8095ad] ${PANEL}`}>
            ยังไม่มีสถิติ — สถิติจะขึ้นหลังลงเล่นจบเกมแรกครับ
          </p>
        ) : (
          <>
            <section
              className="pixel-frame relative px-4 py-[18px]"
              style={{
                background: theme.bg,
                border: `2px solid ${theme.border}`,
                boxShadow: "5px 5px 0 rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.03)",
              }}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {particles.map((p, i) => (
                  <span
                    key={i}
                    className="pixel-anim absolute -bottom-2.5"
                    style={{
                      left: p.left,
                      width: p.size,
                      height: p.size,
                      background: theme.accent,
                      boxShadow: `0 0 6px ${theme.accent}`,
                      animation: `sparkle ${p.duration} ${p.delay} linear infinite`,
                    }}
                  />
                ))}
              </div>

              <div className="relative flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="font-[family-name:var(--font-pixel-display)] text-[22px] leading-none"
                    style={{
                      color: theme.accent,
                      textShadow: `0 0 10px ${theme.accent}99, 2px 2px 0 rgba(0,0,0,.5)`,
                    }}
                  >
                    Lv.{progress.level.level}
                  </span>
                  <span
                    className="rounded-sm px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: "rgba(0,0,0,.3)",
                      color: theme.accent,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {theme.icon} {progress.level.rank}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-[#9fb4c9]">
                    {progress.exp.total.toLocaleString()} EXP
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-3.5 overflow-hidden rounded-sm bg-[#0a1119]"
                    style={{ border: `2px solid ${theme.border}` }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.round(progress.level.progress * 100)}%`,
                        backgroundImage: `repeating-linear-gradient(90deg, ${theme.accent} 0 6px, ${theme.accentDim} 6px 8px)`,
                        boxShadow: `0 0 8px ${theme.accent}aa`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] tabular-nums text-[#8095ad]">
                    อีก {progress.level.toNextLevel.toLocaleString()} EXP ถึง Lv.
                    {progress.level.level + 1}
                  </p>
                </div>

                <p className="text-[10.5px] text-[#5d7086]">
                  เลเวลนับจากการมาเล่นและลงสนาม — คนละเรื่องกับระดับมือ
                </p>
              </div>
            </section>

            <Link
              href={`/player/${id}/history`}
              className="flex items-center justify-between rounded border border-[#384a63] bg-[#232f42] px-3.5 py-2.5 text-[13px] font-semibold text-[#9fb4c9] hover:border-[#4f9fe6] hover:text-white"
            >
              <span>📜 ประวัติการเก็บแต้ม</span>
              <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&gt;</span>
            </Link>

            <section className="grid grid-cols-3 gap-2">
              <Stat value={String(stats.days)} label="วันที่มาเล่น" />
              <Stat value={String(stats.games)} label="เกมที่เล่น" />
              <Stat
                value={stats.winRate != null ? `${stats.winRate}%` : "—"}
                label="อัตราชนะ"
                color={theme.accent}
              />
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-[#e2e8f2]">ผลการเล่น</h2>
              <div className="grid grid-cols-3 gap-2">
                <Stat value={String(stats.wins)} label="ชนะ" color="#6fdc9a" />
                <Stat value={String(stats.losses)} label="แพ้" />
                <Stat value={String(stats.draws)} label="เสมอ" color="#e8b93a" />
              </div>
            </section>

            {stats.topPartners.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-[#e2e8f2]">คู่ที่เล่นด้วย</h2>
                <p className="text-[12.5px] text-[#8095ad]">เคยจับคู่กับ {stats.partners} คน</p>
                <ul className={`flex flex-col ${LIST_FRAME}`}>
                  {stats.topPartners.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 border-b border-[#384a63] px-3 py-2.5 text-[13px] text-[#c7d2e0] last:border-b-0"
                    >
                      <span className="w-[18px] shrink-0 font-[family-name:var(--font-pixel-display)] text-[9px] text-[#54687e]">
                        #{i + 1}
                      </span>
                      <Link
                        href={`/player/${p.id}`}
                        className="font-semibold text-[#8fc4ff] hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="ml-auto text-[#8095ad]">{p.games} เกม</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(quests.length > 0 || upcoming.length > 0) && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-[#e2e8f2]">🎯 เควส</h2>
                <div className="flex flex-col gap-2">
                  {quests.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 rounded border px-3 py-2.5"
                      style={{
                        borderColor: q.progress.completed ? "#6fdc9a" : "#384a63",
                        background: q.progress.completed ? "rgba(111,220,154,.08)" : "#232f42",
                      }}
                    >
                      <span className="text-xl leading-none">{q.icon}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-semibold text-[#e2e8f2]">{q.title}</span>
                        {q.progress.progressLabel && (
                          <span className="text-[11px] tabular-nums text-[#8095ad]">
                            {q.progress.progressLabel}
                          </span>
                        )}
                      </div>
                      <span
                        className="ml-auto shrink-0 text-[12px] font-bold tabular-nums"
                        style={{ color: q.progress.completed ? "#6fdc9a" : "#54687e" }}
                      >
                        {q.progress.completed ? "สำเร็จ " : ""}+{q.expReward}
                      </span>
                    </div>
                  ))}

                  {upcoming.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 rounded border border-dashed px-3 py-2.5"
                      style={{ borderColor: "#384a63", background: "#1e2839" }}
                    >
                      <span className="text-xl leading-none opacity-70">{q.icon}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-semibold text-[#c3ccda]">{q.title}</span>
                        <span className="text-[11px] text-[#8095ad]">
                          เริ่ม {thaiQuestRange(q.startDate, q.endDate)}
                        </span>
                      </div>
                      <span className="ml-auto shrink-0 text-[12px] font-bold tabular-nums text-[#54687e]">
                        +{q.expReward}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-[#e2e8f2]">เหรียญสะสม</h2>
                <span className="text-[11px] tabular-nums text-[#5d7086]">
                  {earnedCount}/{progress.achievements.length}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {progress.achievements.map((a, i) => (
                  <AchievementCoin key={a.id} achievement={a} index={i} />
                ))}
              </div>
            </section>

            {recent.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#e2e8f2]">ประวัติแมตซ์</h2>
                  <span className="text-[11px] text-[#5d7086]">ล่าสุด {recent.length} เกม</span>
                </div>
                <GameHistoryTable rows={historyRows} variant="dark" />
              </section>
            )}

            <p className="text-[11px] text-[#4a5b70]">
              มาเล่นครั้งแรก {stats.firstPlayed ? thaiDate(stats.firstPlayed) : "—"} · ครั้งล่าสุด{" "}
              {stats.lastPlayed ? thaiDate(stats.lastPlayed) : "—"}
            </p>
          </>
        )}

        <RememberMe athleteId={athlete.id} name={athlete.name} />

        <p className="text-[11px] text-[#3c4b5e]">
          นับจากเกมที่เล่นจบแล้วเท่านั้น · &quot;วันที่มาเล่น&quot; นับวันที่ลงสนามจริง
        </p>
      </main>
    </div>
  );
}
