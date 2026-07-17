"use client";

import { useEffect, useState } from "react";
import { getMySignups } from "@/lib/mySignups";

interface P {
  id: string;
  name: string;
}

export interface QueueMatchup {
  key: string;
  teamA: P[];
  teamB: P[];
}

/**
 * Upcoming matchups (คู่เตรียม) — the next balanced games in queue order shown
 * as "team A VS team B", so players see who's up and who they'll face without
 * opening a court. First one highlighted as up-next; the viewer stands out.
 */
export default function QueuePairs({
  sessionId,
  matchups,
}: {
  sessionId: string;
  matchups: QueueMatchup[];
}) {
  const [myIds, setMyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMyIds(new Set(getMySignups(sessionId)));
  }, [sessionId]);

  if (matchups.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีคู่เตรียม</p>;
  }

  const team = (players: P[], align: "end" | "start") => (
    <div className={`flex flex-col gap-0.5 ${align === "end" ? "items-end text-right" : "items-start text-left"}`}>
      {players.map((p) => (
        <span key={p.id} className={`truncate ${myIds.has(p.id) ? "font-bold text-brand-700" : ""}`}>
          {p.name}
        </span>
      ))}
    </div>
  );

  return (
    <ol className="flex flex-col gap-2 rounded-xl border-2 border-orange-300 bg-orange-50/50 p-2">
      {matchups.map((m, i) => (
        <li
          key={m.key}
          className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
            i === 0 ? "bg-orange-100 border-orange-300" : "bg-white border-orange-200"
          }`}
        >
          <span className="text-[10px] text-orange-400 shrink-0 w-9">คู่ {i + 1}</span>
          {/* 3-col grid keeps VS dead-centre no matter how wide the names are. */}
          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {team(m.teamA, "end")}
            <span className="text-xs font-bold text-orange-400 shrink-0">VS</span>
            {team(m.teamB, "start")}
          </div>
        </li>
      ))}
    </ol>
  );
}
