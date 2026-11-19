import Link from "next/link";
import type { SummaryCategory, SummaryRow } from "@/lib/missionSummary";
import { AwardAvatar } from "./AwardAvatar";
import { MEDAL } from "./medal";


function Value({ row, unit, big }: { row: SummaryRow; unit: string; big?: boolean }) {
  return (
    <span className="shrink-0 whitespace-nowrap font-bold tabular-nums text-[#ffcf4d]">
      <span className={big ? "text-3xl xl:text-4xl" : "text-base"}>{row.value.toLocaleString()}</span>
      <span className={big ? "ml-1 text-sm text-[#e8c766]" : "ml-1 text-xs text-[#e8c766]"}>{unit}</span>
    </span>
  );
}

/** One category: the winner(s) up front and large, then second and third. */
function CategoryCard({ c }: { c: SummaryCategory }) {
  const first = c.rows.filter((r) => r.rank === 1);
  const rest = c.rows.filter((r) => r.rank > 1);
  return (
    <section
      className="relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border p-4 md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.667rem)] xl:p-5"
      style={{
        borderColor: "#ffcf4d40",
        background: "linear-gradient(165deg, #2a3650 0%, #18223a 55%, #121a2c 100%)",
        boxShadow: "0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      {/* Soft gold light behind the champion */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, #ffcf4d33, transparent 70%)" }}
      />

      <header className="relative flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl"
          style={{ background: "radial-gradient(circle at 35% 30%, #3d4c6b, #1a2335)", boxShadow: "0 0 0 2px #ffcf4d55, 0 0 14px #ffcf4d44" }}
        >
          {c.icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-lg font-bold leading-tight text-[#f7f9fc] xl:text-xl">{c.title}</h2>
          {c.note && <span className="text-[11px] text-[#8fa3bd]">{c.note}</span>}
        </div>
      </header>

      {c.rows.length === 0 ? (
        <p className="relative text-sm text-[#8fa3bd]">ยังไม่มีใครเข้าเกณฑ์</p>
      ) : (
        <>
          <div className="relative flex flex-wrap justify-center gap-x-6 gap-y-3">
            {first.map((r) => (
              <Link key={r.athleteId} href={`/player/${r.athleteId}`} className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-2xl leading-none" aria-hidden="true">
                  👑
                </span>
                <AwardAvatar row={r} rank={1} size={first.length > 1 ? 72 : 96} />
                <span className="max-w-[160px] break-words text-lg font-bold leading-tight text-white">{r.name}</span>
                <Value row={r} unit={c.unit} big />
                {r.detail && <span className="text-[11px] text-[#8fa3bd]">{r.detail}</span>}
              </Link>
            ))}
          </div>

          {rest.length > 0 && (
            <ol className="relative flex flex-col gap-2 border-t border-white/10 pt-3">
              {rest.map((r) => (
                <li key={r.athleteId}>
                  <Link href={`/player/${r.athleteId}`} className="flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-white/5">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-[#1c2536]"
                      style={{ background: MEDAL[r.rank - 1].mid }}
                    >
                      {r.rank}
                    </span>
                    <AwardAvatar row={r} rank={r.rank} size={38} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold text-[#e8eef6]">{r.name}</span>
                      {r.detail && <span className="truncate text-[11px] text-[#8fa3bd]">{r.detail}</span>}
                    </span>
                    <span className="ml-auto">
                      <Value row={r} unit={c.unit} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

/** The seven categories; an odd last card sits centred rather than hanging left. */
export default function SummaryBoard({ categories }: { categories: SummaryCategory[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {categories.map((c) => (
        <CategoryCard key={c.id} c={c} />
      ))}
    </div>
  );
}
