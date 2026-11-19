import Link from "next/link";
import type { SummaryCategory } from "@/lib/missionSummary";

/** Place colours, matching the leaderboard podium. */
const METAL = ["#ffcf4d", "#cfd8e3", "#e0955a"];

/** The seven top-3 cards; shared by the player page and the admin preview. */
export default function SummaryBoard({ categories, dark = true }: { categories: SummaryCategory[]; dark?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {categories.map((c) => (
        <section
          key={c.id}
          className={
            dark
              ? "flex flex-col gap-2 rounded border-2 border-[#384a63] bg-[#232f42] p-3"
              : "flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
          }
        >
          <div className="flex flex-col">
            <h2 className={`text-[15px] font-bold ${dark ? "text-[#f2f5fa]" : "text-gray-900"}`}>
              {c.icon} {c.title}
            </h2>
            {c.note && <span className={`text-[11px] ${dark ? "text-[#8095ad]" : "text-gray-500"}`}>{c.note}</span>}
          </div>
          {c.rows.length === 0 ? (
            <p className={`text-[12px] ${dark ? "text-[#8095ad]" : "text-gray-500"}`}>ยังไม่มีใครเข้าเกณฑ์</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {c.rows.map((r) => (
                <li key={r.athleteId} className="flex items-center gap-2.5">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-[#1c2536]"
                    style={{ background: METAL[r.rank - 1] }}
                  >
                    {r.rank}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`/player/${r.athleteId}`}
                      className={`truncate text-[13.5px] font-semibold hover:underline ${dark ? "text-[#e2e8f2]" : "text-gray-900"}`}
                    >
                      {r.name}
                    </Link>
                    {r.detail && <span className={`text-[11px] ${dark ? "text-[#8095ad]" : "text-gray-500"}`}>{r.detail}</span>}
                  </div>
                  <span
                    className={`ml-auto shrink-0 text-[13px] font-bold tabular-nums ${dark ? "text-[#ffcf4d]" : "text-brand-700"}`}
                  >
                    {r.value.toLocaleString()} {c.unit}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
