"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: string;
}

interface MatchInfo {
  id: string;
  court: number;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

interface RoundInfo {
  round: number;
  matches: MatchInfo[];
  substitutes: PlayerInfo[];
}

export default function MatchEditor({
  sessionId,
  rounds,
  neverPlayed,
}: {
  sessionId: string;
  rounds: RoundInfo[];
  neverPlayed: PlayerInfo[];
}) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function startEdit(matchId: string, playerId: string) {
    setEditingKey(`${matchId}:${playerId}`);
    setReplacement("");
    setError(null);
  }

  async function handleSwap(matchId: string, outSignUpId: string) {
    if (!replacement) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${matchId}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outSignUpId, inSignUpId: replacement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สลับไม่สำเร็จ");
      setEditingKey(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  function renderPlayer(matchId: string, p: PlayerInfo, substitutes: PlayerInfo[]) {
    const isEditing = editingKey === `${matchId}:${p.id}`;
    return (
      <div key={p.id} className="flex items-center justify-between gap-2">
        <span>
          {p.name} <span className="text-xs text-gray-400">{SKILL_LABELS[p.skillLevel as SkillLevel]}</span>
        </span>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <select
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              className="input py-0.5 text-xs w-32"
              autoFocus
            >
              <option value="">แทนด้วย...</option>
              {substitutes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                </option>
              ))}
            </select>
            <button
              onClick={() => handleSwap(matchId, p.id)}
              disabled={!replacement || loading}
              className="text-xs text-brand-700 hover:underline disabled:opacity-50"
            >
              ยืนยัน
            </button>
            <button onClick={() => setEditingKey(null)} className="text-xs text-gray-400 hover:underline">
              ยกเลิก
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEdit(matchId, p.id)}
            className="text-xs text-gray-400 hover:text-brand-700"
          >
            🔁 เปลี่ยน
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">แก้ไขการจับคู่</h2>
      {neverPlayed.length > 0 ? (
        <p className="text-sm text-amber-600">
          ยังไม่ได้ลงเล่น ({neverPlayed.length} คน):{" "}
          {neverPlayed
            .map((p) => `${p.name} (${SKILL_LABELS[p.skillLevel as SkillLevel]})`)
            .join(", ")}
        </p>
      ) : (
        <p className="text-sm text-gray-400">ทุกคนได้ลงเล่นครบแล้ว</p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex flex-col gap-4">
        {rounds.map(({ round, matches, substitutes }) => (
          <div key={round}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">รอบที่ {round}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {matches.map((m) => (
                <div key={m.id} className="rounded-md border border-gray-200 p-2 text-sm flex flex-col gap-1">
                  <div className="text-xs text-gray-400 mb-1">สนาม {m.court}</div>
                  {m.team1.map((p) => renderPlayer(m.id, p, substitutes))}
                  <div className="text-gray-400 text-xs my-0.5 text-center">vs</div>
                  {m.team2.map((p) => renderPlayer(m.id, p, substitutes))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
