"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  waitlist?: boolean;
}

interface TeamMatch {
  id: string;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

export default function CourtCard({
  sessionId,
  court,
  match,
  substitutes,
  isSelf,
  editable,
}: {
  sessionId: string;
  court: number;
  match: TeamMatch | null;
  substitutes?: PlayerInfo[];
  isSelf?: boolean;
  editable?: boolean;
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
    if (!match || !replacement) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${match.id}/swap`, {
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

  function renderPlayer(p: PlayerInfo) {
    if (!editable) {
      return (
        <span
          key={p.id}
          className="bg-white/95 text-gray-900 text-xs font-medium rounded-full px-2.5 py-1"
        >
          {p.name} <span className="text-gray-400">: {SKILL_LABELS[p.skillLevel]}</span>
        </span>
      );
    }
    if (editingPlayerId === p.id) {
      return (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-1"
        >
          <select
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="text-black text-xs rounded max-w-[6rem]"
            autoFocus
          >
            <option value="">แทนด้วย...</option>
            {substitutes?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({SKILL_LABELS[s.skillLevel]}){s.waitlist ? " — สำรอง" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleSwap(p.id)}
            disabled={!replacement || loading}
            className="text-brand-700 disabled:opacity-50"
          >
            ✓
          </button>
          <button onClick={() => setEditingPlayerId(null)} className="text-gray-400">
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
        className="bg-white/95 text-gray-900 text-xs font-medium rounded-full px-2.5 py-1 underline decoration-dotted decoration-gray-400"
      >
        {p.name} <span className="text-gray-400">: {SKILL_LABELS[p.skillLevel]}</span>
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
        {isSelf && <span className="ml-1.5 text-brand-300">(คุณ)</span>}
      </div>
      <div className="bg-gradient-to-b from-slate-600 to-slate-800 p-3 flex flex-col justify-center gap-2 flex-1 min-h-[140px]">
        {error && <p className="text-red-300 text-xs text-center">{error}</p>}
        {!match ? (
          <p className="text-center text-white/50 text-sm font-medium">ว่าง</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-1.5">{match.team1.map(renderPlayer)}</div>
            <div className="border-t-2 border-dashed border-white/60" />
            <div className="flex flex-wrap justify-center gap-1.5">{match.team2.map(renderPlayer)}</div>
          </>
        )}
      </div>
    </div>
  );
}
