"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlayerInfo {
  id: string;
  name: string;
}

interface TeamMatch {
  id: string;
  round: number;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

export default function CourtCard({
  sessionId,
  court,
  current,
  next,
  nextSubstitutes,
  isSelf,
  isAdmin,
}: {
  sessionId: string;
  court: number;
  current: TeamMatch | null;
  next?: TeamMatch | null;
  nextSubstitutes?: PlayerInfo[];
  isSelf?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(playerId: string) {
    setEditingPlayerId(playerId);
    setReplacement("");
    setError(null);
  }

  async function handleSwap(outSignUpId: string) {
    if (!next || !replacement) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${next.id}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outSignUpId, inSignUpId: replacement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สลับไม่สำเร็จ");
      setEditingPlayerId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  function renderNextPlayer(p: PlayerInfo) {
    if (!isAdmin) {
      return <span key={p.id}>{p.name}</span>;
    }
    if (editingPlayerId === p.id) {
      return (
        <span key={p.id} className="inline-flex items-center gap-1 bg-white/10 rounded px-1 py-0.5">
          <select
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="text-black text-xs rounded max-w-[6rem]"
            autoFocus
          >
            <option value="">แทนด้วย...</option>
            {nextSubstitutes?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleSwap(p.id)}
            disabled={!replacement || loading}
            className="text-brand-300 disabled:opacity-50"
          >
            ✓
          </button>
          <button onClick={() => setEditingPlayerId(null)} className="text-white/50">
            ✕
          </button>
        </span>
      );
    }
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => startEdit(p.id)}
        className="underline decoration-dotted decoration-white/50 hover:text-white"
      >
        {p.name}
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col h-full rounded-xl overflow-hidden border-2 shadow-sm ${
        isSelf ? "border-brand-500 ring-2 ring-brand-300" : "border-gray-200"
      }`}
    >
      <div className="bg-slate-800 text-white text-center text-sm font-semibold py-1.5">
        สนาม {court}
        {current && <span className="ml-1.5 font-normal text-white/60">(รอบที่ {current.round})</span>}
        {isSelf && <span className="ml-1.5 text-brand-300">(คุณ)</span>}
      </div>
      <div className="bg-gradient-to-b from-slate-600 to-slate-800 p-3 flex flex-col justify-center gap-2 flex-1 min-h-[140px]">
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
        <div className="bg-slate-900/90 px-3 py-1.5 text-xs text-white/70 flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-white/50">ถัดไป (รอบที่ {next.round})</span>
            {error && <span className="text-red-300">{error}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-1">
            {next.team1.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && "+"}
                {renderNextPlayer(p)}
              </span>
            ))}
            <span className="mx-1">vs</span>
            {next.team2.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && "+"}
                {renderNextPlayer(p)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
