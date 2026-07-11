"use client";

import { useMemo, useState } from "react";

interface MatchPlayerInfo {
  id: string;
  name: string;
}

interface MatchInfo {
  round: number;
  court: number;
  active?: boolean;
  team1: MatchPlayerInfo[];
  team2: MatchPlayerInfo[];
}

export default function SelfCourtBanner({ matches }: { matches: MatchInfo[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const players = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      for (const p of [...m.team1, ...m.team2]) map.set(p.id, p.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [matches]);

  const suggestions =
    query.trim() && !selectedId
      ? players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : [];

  // Only a currently-on-court (active) game counts — if the player just
  // finished and is waiting in the queue, they're not "on a court" now.
  const mine = useMemo(
    () =>
      selectedId
        ? matches.filter(
            (m) => m.team1.some((p) => p.id === selectedId) || m.team2.some((p) => p.id === selectedId)
          )
        : [],
    [matches, selectedId]
  );

  // Only a currently-on-court (active) game counts — if the player just
  // finished and is waiting in the queue, they're not "on a court" now.
  const match = useMemo(() => {
    const active = mine.filter((m) => m.active);
    if (active.length === 0) return null;
    return active.reduce((latest, m) => (m.round > latest.round ? m : latest));
  }, [mine]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          placeholder="ค้นหาชื่อคุณ เพื่อดูว่าอยู่คอร์ทไหน..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          className="input"
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-sm mt-1 max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => {
                    setSelectedId(s.id);
                    setQuery(s.name);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && !match && (
        <p className="text-sm text-gray-400">
          {mine.length > 0 ? "ตอนนี้คุณกำลังรอคิวลงสนามครับ" : "ยังไม่มีการจับคู่สำหรับคุณครับ"}
        </p>
      )}

      {match &&
        (() => {
          const onTeam1 = match.team1.some((p) => p.id === selectedId);
          const myTeam = onTeam1 ? match.team1 : match.team2;
          const oppTeam = onTeam1 ? match.team2 : match.team1;
          return (
            <div className="rounded-md bg-brand-50 border border-brand-200 p-3 text-sm">
              <p className="font-semibold text-brand-800">
                คุณอยู่คอร์ท {match.court} (รอบที่ {match.round})
              </p>
              <p className="text-brand-700">
                ทีมคุณ: {myTeam.map((p) => p.name).join(" + ")} · คู่แข่ง: {oppTeam.map((p) => p.name).join(" + ")}
              </p>
            </div>
          );
        })()}
    </div>
  );
}
