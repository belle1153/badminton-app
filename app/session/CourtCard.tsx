"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: string;
  waitlist?: boolean;
  photoUrl?: string | null;
}

interface TeamMatch {
  id: string;
  round?: number;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

export default function CourtCard({
  sessionId,
  court,
  match,
  upcoming = [],
  substitutes,
  isSelf,
  editable,
}: {
  sessionId: string;
  court: number;
  match: TeamMatch | null;
  upcoming?: TeamMatch[];
  substitutes?: PlayerInfo[];
  isSelf?: boolean;
  editable?: boolean;
}) {
  const router = useRouter();
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which game the card is showing: 0 = playing now, 1-2 = pre-queued next games.
  const [viewIdx, setViewIdx] = useState(0);

  const slots: (TeamMatch | null)[] = [match, ...upcoming.slice(0, 2)];
  const shown = slots[Math.min(viewIdx, slots.length - 1)] ?? match;

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
      // User view: photo above name so the board doubles as a face board.
      return (
        <div key={p.id} className="flex flex-col items-center gap-1 w-20">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photoUrl}
              alt={p.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
            />
          ) : (
            <span className="w-14 h-14 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center text-white/70 text-xl">
              👤
            </span>
          )}
          <span className="bg-white text-gray-900 text-xs font-medium rounded-full px-2.5 py-1 shadow-sm max-w-full truncate">
            {p.name}
          </span>
        </div>
      );
    }
    if (editingPlayerId === p.id) {
      return (
        <span
          key={p.id}
          className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm"
        >
          <select
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="text-black text-sm rounded max-w-[8rem]"
            autoFocus
          >
            <option value="">แทนด้วย...</option>
            {substitutes?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]}){s.waitlist ? " — สำรอง" : ""}
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
        className="bg-white text-gray-900 text-sm font-medium rounded-full px-4 py-1.5 shadow-sm whitespace-nowrap inline-flex items-center gap-1.5"
      >
        {p.name} <span className="text-gray-400 text-xs">: {SKILL_LABELS[p.skillLevel as SkillLevel]}</span>
        <span className="text-brand-500 text-xs">✎</span>
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col h-full rounded-xl overflow-hidden border-2 shadow-sm ${
        isSelf ? "border-brand-500 ring-2 ring-brand-300" : "border-gray-200"
      }`}
    >
      <div className="bg-slate-800 text-white text-center text-sm font-semibold py-2">
        สนาม {court}
        {!editable && shown?.round != null && (
          <span className="text-white/60 font-normal"> — เกมที่ {shown.round}</span>
        )}
      </div>
      {!editable && match && upcoming.length > 0 && (
        <div className="bg-slate-700 flex">
          {slots.map((s, i) =>
            s ? (
              <button
                key={s.id}
                onClick={() => setViewIdx(i)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  Math.min(viewIdx, slots.length - 1) === i
                    ? "bg-brand-600 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {i === 0 ? `▶ เกม ${s.round ?? "-"}` : `ถัดไป: เกม ${s.round ?? "-"}`}
              </button>
            ) : null
          )}
        </div>
      )}
      <div
        className={`bg-gradient-to-b from-slate-600 to-slate-800 p-4 flex flex-col flex-1 ${
          editable ? "min-h-[200px]" : "min-h-[280px]"
        }`}
      >
        {error && <p className="text-red-300 text-xs text-center mb-1">{error}</p>}
        {!(editable ? match : shown) ? (
          <div className="flex-1 rounded-lg border-2 border-white/20 flex items-center justify-center">
            <p className="text-white/50 text-sm font-medium">ว่าง</p>
          </div>
        ) : (
          <div className="flex-1 rounded-lg border-2 border-white/25 px-3 py-4 flex flex-col justify-around gap-3">
            <div
              className={
                editable
                  ? "flex flex-col items-center gap-1.5"
                  : "flex justify-center items-start gap-4"
              }
            >
              {(editable ? match! : shown!).team1.map(renderPlayer)}
            </div>
            <div className="border-t-2 border-dashed border-white/60" />
            <div
              className={
                editable
                  ? "flex flex-col items-center gap-1.5"
                  : "flex justify-center items-start gap-4"
              }
            >
              {(editable ? match! : shown!).team2.map(renderPlayer)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
