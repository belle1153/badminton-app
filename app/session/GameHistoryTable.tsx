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

/**
 * Read-only game log table (เกม | สนาม | ทีม A | VS | ทีม B | ผล) with the
 * winning team in green — the same layout as the admin ประวัติแมตซ์, shared by
 * the players' courts tab and each player's profile.
 */
export default function GameHistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) return null;
  const showDate = rows.some((r) => r.dateLabel);
  const teamCell = (names: string[], won: boolean, me?: string) => (
    <div className={`flex flex-col ${won ? "text-green-600 font-semibold" : "text-gray-700"}`}>
      {names.map((n, i) => (
        <span key={i} className={`whitespace-nowrap ${n === me ? "underline decoration-dotted" : ""}`}>
          {n}
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-md">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white text-xs">
            {showDate && <th className="px-2 py-2 font-medium text-left">วันที่</th>}
            <th className="px-2 py-2 font-medium text-center">เกม</th>
            <th className="px-2 py-2 font-medium text-center">สนาม</th>
            <th className="px-2 py-2 font-medium text-left">ทีม A</th>
            <th className="px-2 py-2 font-medium text-center text-red-300">VS</th>
            <th className="px-2 py-2 font-medium text-left">ทีม B</th>
            <th className="px-2 py-2 font-medium text-center">ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className="border-t border-gray-100 align-top">
              {showDate && (
                <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{g.dateLabel}</td>
              )}
              <td className="px-2 py-2 text-center font-medium text-gray-500">{g.seq}</td>
              <td className="px-2 py-2 text-center text-gray-500">{g.court}</td>
              <td className="px-2 py-2">{teamCell(g.team1, g.winnerTeam === 1, g.highlightName)}</td>
              <td className="px-2 py-2 text-center text-red-400 text-xs">vs</td>
              <td className="px-2 py-2">{teamCell(g.team2, g.winnerTeam === 2, g.highlightName)}</td>
              <td className="px-2 py-2 text-center">
                {g.winnerTeam == null ? (
                  <span className="rounded bg-amber-500 text-white px-2 py-1 text-xs font-medium">เสมอ</span>
                ) : (
                  <span className="rounded bg-green-500 text-white px-2 py-1 text-xs font-medium whitespace-nowrap">
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
