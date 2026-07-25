export interface HistoryRow {
  id: string;
  seq: number;
  court: number;
  winnerTeam: number | null; // null = draw
  team1: string[];
  team2: string[];
  /** Only set where the rows span several days (a player's profile); a single
   *  day's log leaves it out and the วันที่ column disappears. */
  dateLabel?: string;
  /** Highlights this person's own name — used on a player profile. */
  highlightName?: string;
}

/** The player profile is the one dark screen in the app, so the same table has
 *  to render on both grounds rather than being forked into a second copy. */
export type HistoryTableVariant = "light" | "dark";

const SKIN = {
  light: {
    frame: "border border-gray-200 rounded-md",
    head: "bg-slate-800 text-white",
    row: "border-t border-gray-100",
    muted: "text-gray-500",
    team: "text-gray-700",
    won: "text-green-600 font-semibold",
    vs: "text-red-400",
    vsHead: "text-red-300",
    draw: "bg-amber-500 text-white",
    win: "bg-green-500 text-white",
  },
  dark: {
    frame: "border border-[#384a63] rounded",
    head: "bg-[#1a2433] text-[#e2e8f2]",
    row: "border-t border-[#384a63]",
    muted: "text-[#54687e]",
    team: "text-[#a8b7c8]",
    won: "text-[#6fdc9a] font-semibold",
    vs: "text-[#e06a6a]",
    vsHead: "text-[#e08a8a]",
    draw: "bg-[#e8b93a] text-[#241d05]",
    win: "bg-[#6fdc9a] text-[#052313]",
  },
} as const;

/**
 * Read-only game log table (เกม | สนาม | ทีม A | VS | ทีม B | ผล) with the
 * winning team highlighted — the same layout the admin sees, shared by the
 * players' courts tab and each player's profile.
 */
export default function GameHistoryTable({
  rows,
  variant = "light",
}: {
  rows: HistoryRow[];
  variant?: HistoryTableVariant;
}) {
  if (rows.length === 0) return null;
  const s = SKIN[variant];
  const showDate = rows.some((r) => r.dateLabel);

  const teamCell = (names: string[], won: boolean, me?: string) => (
    <div className={`flex flex-col ${won ? s.won : s.team}`}>
      {names.map((n, i) => (
        <span
          key={i}
          className={`whitespace-nowrap ${n === me ? "underline decoration-dotted" : ""}`}
        >
          {n}
        </span>
      ))}
    </div>
  );

  return (
    <div className={`overflow-x-auto ${s.frame}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={`text-xs ${s.head}`}>
            {showDate && <th className="px-2 py-2 font-medium text-left">วันที่</th>}
            <th className="px-2 py-2 font-medium text-center">เกม</th>
            <th className="px-2 py-2 font-medium text-center">สนาม</th>
            <th className="px-2 py-2 font-medium text-left">ทีม A</th>
            <th className={`px-2 py-2 font-medium text-center ${s.vsHead}`}>VS</th>
            <th className="px-2 py-2 font-medium text-left">ทีม B</th>
            <th className="px-2 py-2 font-medium text-center">ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className={`align-top ${s.row}`}>
              {showDate && (
                <td className={`px-2 py-2 whitespace-nowrap ${s.muted}`}>{g.dateLabel}</td>
              )}
              <td className={`px-2 py-2 text-center font-medium ${s.muted}`}>{g.seq}</td>
              <td className={`px-2 py-2 text-center ${s.muted}`}>{g.court}</td>
              <td className="px-2 py-2">{teamCell(g.team1, g.winnerTeam === 1, g.highlightName)}</td>
              <td className={`px-2 py-2 text-center text-xs ${s.vs}`}>vs</td>
              <td className="px-2 py-2">{teamCell(g.team2, g.winnerTeam === 2, g.highlightName)}</td>
              <td className="px-2 py-2 text-center">
                {g.winnerTeam == null ? (
                  <span className={`rounded px-2 py-1 text-xs font-medium ${s.draw}`}>เสมอ</span>
                ) : (
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium whitespace-nowrap ${s.win}`}
                  >
                    ทีม {g.winnerTeam === 1 ? "A" : "B"} ชนะ!
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
