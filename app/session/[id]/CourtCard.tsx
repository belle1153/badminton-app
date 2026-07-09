interface PlayerInfo {
  id: string;
  name: string;
}

interface TeamMatch {
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

export default function CourtCard({
  court,
  current,
  next,
  isSelf,
}: {
  court: number;
  current: TeamMatch | null;
  next?: TeamMatch | null;
  isSelf?: boolean;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden border-2 shadow-sm ${
        isSelf ? "border-brand-500 ring-2 ring-brand-300" : "border-gray-200"
      }`}
    >
      <div className="bg-slate-800 text-white text-center text-sm font-semibold py-1.5">
        สนาม {court}
        {isSelf && <span className="ml-1.5 text-brand-300">(คุณ)</span>}
      </div>
      <div className="bg-gradient-to-b from-slate-600 to-slate-800 p-3 flex flex-col justify-center gap-2 min-h-[140px]">
        {!current ? (
          <p className="text-center text-white/50 text-sm font-medium">ว่าง</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-1.5">
              {current.team1.map((p) => (
                <span
                  key={p.id}
                  className="bg-white/95 text-gray-900 text-xs font-medium rounded-full px-2.5 py-1"
                >
                  {p.name}
                </span>
              ))}
            </div>
            <div className="border-t-2 border-dashed border-white/60" />
            <div className="flex flex-wrap justify-center gap-1.5">
              {current.team2.map((p) => (
                <span
                  key={p.id}
                  className="bg-white/95 text-gray-900 text-xs font-medium rounded-full px-2.5 py-1"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      {next && (
        <div className="bg-slate-900/90 px-3 py-1.5 text-xs text-white/70">
          ถัดไป: {next.team1.map((p) => p.name).join(" + ")} vs {next.team2.map((p) => p.name).join(" + ")}
        </div>
      )}
    </div>
  );
}
