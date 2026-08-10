import Link from "next/link";
import { loadLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import QuestBoard from "./QuestBoard";

export const dynamic = "force-dynamic";

/**
 * Top 10 by EXP, with the first three on a podium.
 *
 * Ten places, not the whole club: a full table mostly tells the other twenty-odd
 * people how far down they are, which is the opposite of what this is for.
 *
 * Shares the player profile's retro treatment — it's the same reward world.
 */
const TOP_PLACES = 10;

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
  const top = await loadLeaderboard(TOP_PLACES);

  // Everyone who holds each of the top three places — a tie puts two or more
  // people on the same block rather than pushing one of them off it.
  const holdersOf = (place: number) => top.filter((e) => e.rank === place);
  // Rendered 2nd, 1st, 3rd so first place stands in the middle.
  const podium = [
    { place: 2, holders: holdersOf(2) },
    { place: 1, holders: holdersOf(1) },
    { place: 3, holders: holdersOf(3) },
  ].filter((p) => p.holders.length > 0);
  const rest = top.filter((e) => e.rank > 3);
  // Below the podium a place can still be shared. Mark those "=4" so a repeated
  // number reads as a genuine tie rather than a mistake.
  const sharedRanks = new Set(
    rest.map((e) => e.rank).filter((r, _, all) => all.filter((x) => x === r).length > 1)
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
          <h1 className="text-xl font-bold text-[#f2f5fa]">🏆 อันดับโคตรตึง!</h1>
          <p className="text-[12.5px] text-[#8095ad]">{TOP_PLACES} อันดับแรกของก๊วน — วัดจาก EXP</p>
        </div>

        {top.length === 0 ? (
          <p className="rounded border-2 border-[#384a63] bg-[#232f42] p-4 text-[13px] text-[#8095ad]">
            ยังไม่มีใครมีสถิติ — อันดับจะขึ้นหลังมีเกมที่เล่นจบครับ
          </p>
        ) : (
          <>
            {/* Podium — one block per place, everyone tied stands on it */}
            <section className="flex items-end justify-center gap-2 pt-2">
              {podium.map(({ place, holders }) => {
                const style = PLACE[place - 1];
                const isFirst = place === 1;
                // Avatars shrink as a block gets crowded so the column keeps
                // its width and the three blocks stay aligned.
                const size = holders.length > 2 ? 34 : holders.length > 1 ? 42 : isFirst ? 64 : 52;
                return (
                  <div key={place} className="flex w-1/3 flex-col items-center gap-1.5">
                    {isFirst && <span className="text-xl leading-none">👑</span>}

                    <div className="flex flex-wrap items-end justify-center gap-1.5">
                      {holders.map((entry) => (
                        <Link
                          key={entry.athleteId}
                          href={`/player/${entry.athleteId}`}
                          className="flex max-w-full flex-col items-center gap-1"
                        >
                          <Avatar entry={entry} size={size} ring={style.metal} />
                          <span className="max-w-[72px] truncate text-[11px] font-semibold text-[#e2e8f2]">
                            {entry.name}
                          </span>
                        </Link>
                      ))}
                    </div>

                    <span
                      className="font-[family-name:var(--font-pixel-display)] text-[10px]"
                      style={{ color: style.metal }}
                    >
                      {holders[0].exp.toLocaleString()}
                    </span>

                    <div
                      className={`pixel-frame flex w-full items-start justify-center pt-2 ${style.h}`}
                      style={{
                        background: `linear-gradient(180deg, ${style.metal}, ${style.dim})`,
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,.35), 0 4px 0 rgba(0,0,0,.4)",
                      }}
                    >
                      <span
                        className="font-[family-name:var(--font-pixel-display)] text-[20px]"
                        style={{ color: "#1c2536", textShadow: "0 1px 0 rgba(255,255,255,.4)" }}
                      >
                        {style.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* 4th place down to TOP_PLACES */}
            {rest.length > 0 && (
              <section className="flex flex-col rounded border border-[#384a63] bg-[#232f42]">
                {rest.map((entry) => (
                  <Link
                    key={entry.athleteId}
                    href={`/player/${entry.athleteId}`}
                    className="flex items-center gap-3 border-b border-[#384a63] px-3 py-2.5 last:border-b-0 hover:bg-[#2a3950]"
                  >
                    {/* Wide enough for "=10" — two digits plus the tie marker. */}
                    <span className="w-9 shrink-0 font-[family-name:var(--font-pixel-display)] text-[11px] text-[#54687e]">
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

        <QuestBoard />
      </main>
    </div>
  );
}
