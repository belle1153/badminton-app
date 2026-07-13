"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface P {
  id: string;
  name: string;
}

interface Sub {
  id: string;
  name: string;
  skillLevel: string;
  waitlist?: boolean;
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
 * Per-court game log (ประวัติแมท): every game a court has run, in order, with
 * winners. Unfinished games (playing / queued) can still be edited — swap a
 * player out, or cancel a queued game entirely.
 */
export default function MatchHistory({
  sessionId,
  games,
  substitutes,
  readOnly,
}: {
  sessionId: string;
  games: HistoryGame[];
  substitutes: Sub[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [swapTarget, setSwapTarget] = useState<{ matchId: string; playerId: string } | null>(null);
  const [replacement, setReplacement] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courts = [...new Set(games.map((g) => g.court))].sort((a, b) => a - b);

  async function confirmSwap() {
    if (!swapTarget || !replacement) return;
    setError(null);
    setLoading("swap");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${swapTarget.matchId}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outSignUpId: swapTarget.playerId, inSignUpId: replacement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สลับไม่สำเร็จ");
      setSwapTarget(null);
      setReplacement("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

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

  function playerName(g: HistoryGame, p: P, team: number) {
    const editable = !readOnly && g.status !== "finished";
    const isSwapping = swapTarget?.matchId === g.id && swapTarget.playerId === p.id;
    const winner = g.status === "finished" && g.winnerTeam === team;
    if (isSwapping) {
      return (
        <span key={p.id} className="inline-flex items-center gap-1">
          <select
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1 py-0.5 max-w-[9rem]"
            autoFocus
          >
            <option value="">แทน {p.name} ด้วย...</option>
            {substitutes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]}){s.waitlist ? " — สำรอง" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={confirmSwap}
            disabled={!replacement || loading === "swap"}
            className="text-brand-700 text-xs disabled:opacity-50"
          >
            ✓
          </button>
          <button onClick={() => setSwapTarget(null)} className="text-gray-400 text-xs">
            ✕
          </button>
        </span>
      );
    }
    return (
      <button
        key={p.id}
        type="button"
        disabled={!editable}
        onClick={() => {
          setSwapTarget({ matchId: g.id, playerId: p.id });
          setReplacement("");
          setError(null);
        }}
        className={`${winner ? "font-semibold text-brand-700" : ""} ${
          editable ? "hover:underline decoration-dotted" : "cursor-default"
        }`}
      >
        {p.name}
        {editable && <span className="text-brand-400 text-[10px] ml-0.5">✎</span>}
      </button>
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
                      <span className="text-[10px] rounded-full bg-gray-100 text-gray-500 px-1.5 py-0.5">
                        จบแล้ว
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
                    <span className="flex gap-1.5">{g.team1.map((p) => playerName(g, p, 1))}</span>
                    <span className="text-gray-300">vs</span>
                    <span className="flex gap-1.5">{g.team2.map((p) => playerName(g, p, 2))}</span>
                    {g.status === "finished" && g.winnerTeam != null && (
                      <span className="text-[11px] text-brand-700 ml-1">
                        ✓ ทีม{g.winnerTeam === 1 ? "ซ้าย" : "ขวา"}ชนะ
                      </span>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
