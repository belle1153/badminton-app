/* Small pieces shared by the control page and the lineups page. */

import type { TeamView, TieView } from "@/lib/games/state";

/** Team name on its colour, or a dash while the team isn't known yet. */
export function Chip({ team }: { team: TeamView | undefined }) {
  if (!team) return <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[13px] font-bold text-gray-500">—</span>;
  return (
    <span className="rounded-md px-2 py-0.5 text-[13px] font-bold" style={{ background: team.color, color: team.textColor }}>
      {team.name}
    </span>
  );
}

/** How many of the 5 pairs one side has keyed in. */
export const lineupFilled = (tie: TieView, side: "a" | "b") => tie.rubbers.filter((r) => r[side][0] && r[side][1]).length;

/** "ส่งแล้ว" / "3/5 คู่" / "ยังไม่ส่ง" for one side's paper lineup. */
export function LineupStatus({ tie, side }: { tie: TieView; side: "a" | "b" }) {
  const filled = lineupFilled(tie, side);
  const [bg, fg, text] =
    filled === 5 ? ["#e2f3e7", "#15803d", "ส่งแล้ว"] : filled === 0 ? ["#fde7e4", "#b42318", "ยังไม่ส่ง"] : ["#fbf0d5", "#8a5a00", `${filled}/5 คู่`];
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}
