"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface P {
  id: string;
  name: string;
}

export interface HistoryGame {
  id: string;
  seq: number; // global game number for the day (1..N)
  court: number;
  status: "playing" | "upcoming" | "finished";
  winnerTeam: number | null;
  team1: P[];
  team2: P[];
}

/**
 * Day game log (ประวัติแมท) — read-only record of every game with winners,
 * numbered 1..N in play order across all courts. Player editing lives on the
 * live board (สนามสด); here the only action is cancelling a still-queued game.
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

  const [editing, setEditing] = useState<string | null>(null);
  const ordered = [...games].sort((a, b) => a.seq - b.seq);

  async function deleteGame(g: HistoryGame) {
    if (!confirm(`ลบ เกม ${g.seq} (สนาม ${g.court}) ออกจากประวัติ? กู้คืนไม่ได้`)) return;
    setError(null);
    setLoading(`del-${g.id}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${g.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "ลบไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function setResult(g: HistoryGame, winnerTeam: 0 | 1 | 2) {
    setError(null);
    setLoading(`edit-${g.id}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeam }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "แก้ผลไม่สำเร็จ");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  function teamCell(g: HistoryGame, players: P[], teamNo: number) {
    const won = g.status === "finished" && g.winnerTeam === teamNo;
    return (
      <div className={`flex flex-col ${won ? "text-green-600 font-semibold" : "text-gray-700"}`}>
        {players.map((p) => (
          <span key={p.id} className="whitespace-nowrap">
            {p.name}
          </span>
        ))}
      </div>
    );
  }

  function resultCell(g: HistoryGame) {
    // Editing the result: pick the new outcome.
    if (editing === g.id) {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            {([1, 2, 0] as const).map((w) => (
              <button
                key={w}
                onClick={() => setResult(g, w)}
                disabled={loading === `edit-${g.id}`}
                className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] hover:bg-gray-50 disabled:opacity-50"
              >
                {w === 0 ? "เสมอ" : `ทีม ${w === 1 ? "A" : "B"}`}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing(null)} className="text-[10px] text-gray-400">
            ยกเลิก
          </button>
        </div>
      );
    }

    const badge =
      g.status === "playing" ? (
        <span className="rounded bg-green-100 text-green-700 px-2 py-0.5 text-xs">กำลังเล่น</span>
      ) : g.status === "upcoming" ? (
        <span className="rounded bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">รอคิว</span>
      ) : g.winnerTeam == null ? (
        <span className="rounded bg-amber-500 text-white px-2 py-1 text-xs font-medium">เสมอ</span>
      ) : (
        <span className="rounded bg-green-500 text-white px-2 py-1 text-xs font-medium whitespace-nowrap">
          ทีม {g.winnerTeam === 1 ? "A" : "B"} ชนะ!
        </span>
      );

    return (
      <div className="flex flex-col items-center gap-1">
        {badge}
        {!readOnly && (
          <div className="flex gap-2">
            {g.status === "finished" && (
              <button onClick={() => setEditing(g.id)} className="text-[11px] text-brand-600 hover:underline">
                แก้ผล
              </button>
            )}
            <button
              onClick={() => deleteGame(g)}
              disabled={loading === `del-${g.id}`}
              className="text-[11px] text-red-500 hover:underline disabled:opacity-50"
            >
              ลบ
            </button>
          </div>
        )}
      </div>
    );
  }

  if (games.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีแมทช์</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto border border-gray-200 rounded-md">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-xs">
              <th className="px-2 py-2 font-medium text-center">เกม</th>
              <th className="px-2 py-2 font-medium text-center">สนาม</th>
              <th className="px-2 py-2 font-medium text-left">ทีม A</th>
              <th className="px-2 py-2 font-medium text-center text-red-300">VS</th>
              <th className="px-2 py-2 font-medium text-left">ทีม B</th>
              <th className="px-2 py-2 font-medium text-center">ผล</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((g) => (
              <tr key={g.id} className="border-t border-gray-100 align-top">
                <td className="px-2 py-2 text-center font-medium text-gray-500">{g.seq}</td>
                <td className="px-2 py-2 text-center text-gray-500">{g.court}</td>
                <td className="px-2 py-2">{teamCell(g, g.team1, 1)}</td>
                <td className="px-2 py-2 text-center text-red-400 text-xs">vs</td>
                <td className="px-2 py-2">{teamCell(g, g.team2, 2)}</td>
                <td className="px-2 py-2 text-center">{resultCell(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
