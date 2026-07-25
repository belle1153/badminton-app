export interface HistoryRow {
  id: string;
  seq: number;
  court: number;
  winnerTeam: number | null; // null = draw
  team1: string[];
  team2: string[];
  /** Only set where the rows span several days (a player's profile); a single
   *  day's log leaves it out and just shows เกม/สนาม instead. */
  dateLabel?: string;
  /** Highlights this person's own name — used on a player profile. */
  highlightName?: string;
  /**
   * Which side the profile's own player was on. When set, the ผล column
   * reads "ชนะ"/"แพ้"/"เสมอ" for that person directly, instead of "A"/"B" —
   * on a one-person profile the visitor shouldn't have to check which side
   * their own name was listed under to find out whether they won.
   */
  myTeam?: number;
}

/** The player profile is the one dark screen in the app, so the same table has
 *  to render on both grounds rather than being forked into a second copy. */
export type HistoryTableVariant = "light" | "dark";

const SKIN = {
  light: {
    frame: "border border-gray-200 rounded-md",
    head: "bg-slate-800 text-white",
    row: "border-t border-gray-100",
    divider: "border-l border-gray-200",
    muted: "text-gray-500",
    team: "text-gray-700",
    won: "text-green-600 font-semibold",
    draw: "bg-amber-500 text-white",
    winA: "bg-green-500 text-white",
    winB: "bg-green-500 text-white",
    lose: "bg-gray-200 text-gray-600",
  },
  dark: {
    frame: "border border-[#384a63] rounded",
    head: "bg-[#1a2433] text-[#e2e8f2]",
    row: "border-t border-[#384a63]",
    divider: "border-l border-[#384a63]",
    muted: "text-[#54687e]",
    team: "text-[#a8b7c8]",
    won: "text-[#6fdc9a] font-semibold",
    draw: "bg-[#e8b93a] text-[#241d05]",
    winA: "bg-[#6fdc9a] text-[#052313]",
    winB: "bg-[#6fdc9a] text-[#052313]",
    lose: "bg-[#384a63] text-[#a8b7c8]",
  },
} as const;

/**
 * Read-only game log (วันที่/เกม/สนาม | ทีม A | ทีม B | ผล) with the winning
 * team highlighted — the same information the admin sees, shared by the
 * players' courts tab and each player's profile.
 *
 * `table-layout: fixed` with explicit column widths, and no `whitespace-nowrap`
 * on player names: some real names run past 20 characters
 * ("Noah แค่ฟันเหลืองเคืองหรอ"), and nowrap on those forced the whole table
 * wider than its container, which is what put a horizontal scrollbar under it
 * on every screen size. Long names now wrap onto a second line instead.
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
    <div className={`flex flex-col gap-0.5 ${won ? s.won : s.team}`}>
      {names.map((n, i) => (
        <span key={i} className={n === me ? "underline decoration-dotted" : ""}>
          {n}
        </span>
      ))}
    </div>
  );

  return (
    <div className={`overflow-hidden ${s.frame}`}>
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[33%]" />
          <col className="w-[33%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className={`text-[11px] sm:text-xs ${s.head}`}>
            <th className="px-1.5 py-2 font-medium text-left sm:px-2">เกม</th>
            <th className="px-1.5 py-2 font-medium text-left sm:px-2">ทีม A</th>
            <th className={`px-1.5 py-2 font-medium text-left sm:px-2 ${s.divider}`}>ทีม B</th>
            <th className="px-1 py-2 font-medium text-center sm:px-2">ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className={`align-top ${s.row}`}>
              <td className={`px-1.5 py-2 sm:px-2 ${s.muted}`}>
                {g.dateLabel && <div className="whitespace-nowrap">{g.dateLabel}</div>}
                <div className="whitespace-nowrap">
                  เกม {g.seq} · สนาม {g.court}
                </div>
              </td>
              <td className="px-1.5 py-2 sm:px-2">
                {teamCell(g.team1, g.winnerTeam === 1, g.highlightName)}
              </td>
              <td className={`px-1.5 py-2 sm:px-2 ${s.divider}`}>
                {teamCell(g.team2, g.winnerTeam === 2, g.highlightName)}
              </td>
              <td className="px-1 py-2 text-center sm:px-2">
                {g.winnerTeam == null ? (
                  <span className={`inline-block rounded px-1.5 py-1 text-[10px] font-medium sm:text-xs ${s.draw}`}>
                    เสมอ
                  </span>
                ) : g.myTeam != null ? (
                  <span
                    className={`inline-block rounded px-1.5 py-1 text-[10px] font-bold sm:text-xs ${
                      g.winnerTeam === g.myTeam ? s.winA : s.lose
                    }`}
                  >
                    {g.winnerTeam === g.myTeam ? "ชนะ" : "แพ้"}
                  </span>
                ) : (
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-bold sm:text-sm ${
                      g.winnerTeam === 1 ? s.winA : s.winB
                    }`}
                  >
                    {g.winnerTeam === 1 ? "A" : "B"}
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
