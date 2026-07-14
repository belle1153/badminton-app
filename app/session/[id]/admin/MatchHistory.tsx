"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface P {
  id: string;
  name: string;
}

export interface HistoryGame {
  id: string;
  court: number;
  round: number;
  status: "playing" | "upcoming" | "finished";
  winnerTeam: number | null;
  team1: P[];
  team2: P[];
}

/**
 * Per-court game log (ประวัติแมท) — read-only record of every game with
 * winners. Player editing lives on the live board (สนามสด); here the only
 * action is cancelling a still-queued game.
 */
export default function MatchHistory({
  sessionId,
  games,
  readOnly,
}: {
  sessionId: string;
  games: HistoryGame[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courts = [...new Set(games.map((g) => g.court))].sort((a, b) => a - b);

  async function cancelGame(g: HistoryGame) {
    if (!confirm(`ยกเลิก สนาม ${g.court} เกมที่ ${g.round} ใช่ไหมครับ?`)) return;
    setError(null);
    setLoading(`del-${g.id}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "ยกเลิกไม่สำเร็จ");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  function team(g: HistoryGame, players: P[], teamNo: number) {
    const winner = g.status === "finished" && g.winnerTeam === teamNo;
    return (
      <span className={winner ? "font-semibold text-brand-700" : "text-gray-700"}>
        {players.map((p) => p.name).join(" + ")}
        {winner && " ✓"}
      </span>
    );
  }

  if (games.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีแมทช์</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {courts.map((court) => (
        <section key={court} className="flex flex-col gap-1">
          <h2 className="font-semibold">สนาม {court}</h2>
          <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
            {games
              .filter((g) => g.court === court)
              .sort((a, b) => a.round - b.round)
              .map((g) => (
                <li key={g.id} className="px-2.5 py-2 text-sm flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0 w-14">เกมที่ {g.round}</span>
                    {g.status === "playing" && (
                      <span className="text-[10px] rounded-full bg-green-100 text-green-700 px-1.5 py-0.5">
                        กำลังเล่น
                      </span>
                    )}
                    {g.status === "upcoming" && (
                      <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5">
                        รอคิว
                      </span>
                    )}
                    {g.status === "finished" && g.winnerTeam == null && (
                      <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5">
                        🤝 เสมอ
                      </span>
                    )}
                    {!readOnly && g.status === "upcoming" && (
                      <button
                        onClick={() => cancelGame(g)}
                        disabled={loading === `del-${g.id}`}
                        className="ml-auto text-[11px] text-red-500 hover:underline disabled:opacity-50"
                      >
                        ยกเลิกเกม
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {team(g, g.team1, 1)}
                    <span className="text-gray-300">vs</span>
                    {team(g, g.team2, 2)}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
