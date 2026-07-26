import Link from "next/link";
import { loadLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/**
 * Top 5 by EXP, with the first three on a podium.
 *
 * Only five places on purpose: with a roster this small, a full table mostly
 * tells the other thirty-odd people how far down they are, which is the
 * opposite of what this is for.
 *
 * Shares the player profile's retro treatment — it's the same reward world.
 */

/** Podium metals, tallest block first. Deliberately not the rank colours: a
 *  podium reads as gold/silver/bronze regardless of anyone's level. */
const PLACE = [
  { h: "h-28", metal: "#ffcf4d", dim: "#6b4f16", label: "1" },
  { h: "h-20", metal: "#cfd8e3", dim: "#4a5563", label: "2" },
  { h: "h-16", metal: "#e0955a", dim: "#5c3a1c", label: "3" },
] as const;

function Avatar({
  entry,
  size,
  ring,
}: {
  entry: LeaderboardEntry;
  size: number;
  ring: string;
}) {
  return (
    <div
      className="box-border shrink-0 rounded-full p-0.5"
      style={{ width: size, height: size, border: `3px solid ${ring}`, boxShadow: `0 0 12px ${ring}88` }}
    >
      {entry.hasPhoto ? (
        // Plain <img>: the photo API is versioned with a query string, which
        // next/image rejects for local sources unless localPatterns is set.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/athletes/${entry.athleteId}/photo?v=${entry.photoVersion}`}
          alt={entry.name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center rounded-full bg-[#1a2433] text-xl">
          🏸
        </div>
      )}
    </div>
  );
}

export default async function LeaderboardPage() {
  const top = await loadLeaderboard(5);
  // Podium order: 2nd, 1st, 3rd — so first place stands in the middle.
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  const rest = top.slice(3);
  // Equal EXP shares a place, so a player below the podium can hold the same
  // number as someone standing on it. Mark those "=3" rather than repeating a
  // bare "3", which reads like a mistake.
  const sharedRanks = new Set(
    top.map((e) => e.rank).filter((r, _, all) => all.filter((x) => x === r).length > 1)
  );

  return (
    <div
      className="min-h-full font-[family-name:var(--font-pixel-body)]"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, #6b4f1655, #1c2536 55%), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0px, rgba(255,255,255,.02) 1px, transparent 1px, transparent 3px), #1c2536",
      }}
    >
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-3.5 pb-10 pt-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#8fa3bd] hover:text-white"
        >
          <span className="font-[family-name:var(--font-pixel-display)] text-[10px]">&lt;</span>
          หน้าแรก
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-[#f2f5fa]">🏆 อันดับโคตรตึง</h1>
          <p className="text-[12.5px] text-[#8095ad]">5 อันดับแรกของก๊วน — วัดจาก EXP</p>
        </div>

        {top.length === 0 ? (
          <p className="rounded border-2 border-[#384a63] bg-[#232f42] p-4 text-[13px] text-[#8095ad]">
            ยังไม่มีใครมีสถิติ — อันดับจะขึ้นหลังมีเกมที่เล่นจบครับ
          </p>
        ) : (
          <>
            {/* Podium */}
            <section className="flex items-end justify-center gap-2 pt-2">
              {podium.map((entry) => {
                const place = PLACE[entry.rank - 1] ?? PLACE[2];
                const isFirst = entry.rank === 1;
                return (
                  <Link
                    key={entry.athleteId}
                    href={`/player/${entry.athleteId}`}
                    className="flex w-1/3 flex-col items-center gap-1.5"
                  >
                    {isFirst && <span className="text-xl leading-none">👑</span>}
                    <Avatar entry={entry} size={isFirst ? 64 : 52} ring={place.metal} />
                    <span className="max-w-full truncate text-[12px] font-semibold text-[#e2e8f2]">
                      {entry.name}
                    </span>
                    <span
                      className="font-[family-name:var(--font-pixel-display)] text-[10px]"
                      style={{ color: place.metal }}
                    >
                      {entry.exp.toLocaleString()}
                    </span>

                    <div
                      className={`pixel-frame flex w-full items-start justify-center pt-2 ${place.h}`}
                      style={{
                        background: `linear-gradient(180deg, ${place.metal}, ${place.dim})`,
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,.35), 0 4px 0 rgba(0,0,0,.4)",
                      }}
                    >
                      <span
                        className="font-[family-name:var(--font-pixel-display)] text-[20px]"
                        style={{ color: "#1c2536", textShadow: "0 1px 0 rgba(255,255,255,.4)" }}
                      >
                        {place.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>

            {/* 4th and 5th */}
            {rest.length > 0 && (
              <section className="flex flex-col rounded border border-[#384a63] bg-[#232f42]">
                {rest.map((entry) => (
                  <Link
                    key={entry.athleteId}
                    href={`/player/${entry.athleteId}`}
                    className="flex items-center gap-3 border-b border-[#384a63] px-3 py-2.5 last:border-b-0 hover:bg-[#2a3950]"
                  >
                    <span className="w-7 shrink-0 font-[family-name:var(--font-pixel-display)] text-[11px] text-[#54687e]">
                      {sharedRanks.has(entry.rank) ? "=" : ""}
                      {entry.rank}
                    </span>
                    <Avatar entry={entry} size={36} ring={entry.theme.accent} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-semibold text-[#e2e8f2]">
                        {entry.name}
                      </span>
                      <span className="text-[11px] text-[#8095ad]">
                        Lv.{entry.level} {entry.rankTitle}
                      </span>
                    </div>
                    <span className="ml-auto shrink-0 text-[12px] tabular-nums text-[#9fb4c9]">
                      {entry.exp.toLocaleString()} EXP
                    </span>
                  </Link>
                ))}
              </section>
            )}

            <p className="text-[11px] text-[#4a5b70]">
              EXP มาจากการมาเล่นและลงสนามจริง — คนละเรื่องกับระดับมือ · คะแนนเท่ากันได้อันดับเท่ากัน
            </p>
          </>
        )}
      </main>
    </div>
  );
}
