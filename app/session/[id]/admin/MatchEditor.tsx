"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: string;
  waitlist?: boolean;
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
  emptyCourts: number[];
}

function playerLabel(p: PlayerInfo) {
  return `${p.name} (${SKILL_LABELS[p.skillLevel as SkillLevel]})${p.waitlist ? " — สำรอง" : ""}`;
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

  const [addingRound, setAddingRound] = useState<number | null>(null);
  const [addCourt, setAddCourt] = useState("");
  const [addPlayers, setAddPlayers] = useState<string[]>(["", "", "", ""]);

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

  function startAdd(round: number, defaultCourt: number | undefined) {
    setAddingRound(round);
    setAddCourt(defaultCourt != null ? String(defaultCourt) : "");
    setAddPlayers(["", "", "", ""]);
    setError(null);
  }

  async function handleAddMatch(round: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          court: Number(addCourt),
          team1: [addPlayers[0], addPlayers[1]],
          team2: [addPlayers[2], addPlayers[3]],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เพิ่มแมทช์ไม่สำเร็จ");
      setAddingRound(null);
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
              className="input py-0.5 text-xs w-36"
              autoFocus
            >
              <option value="">แทนด้วย...</option>
              {substitutes.map((s) => (
                <option key={s.id} value={s.id}>
                  {playerLabel(s)}
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

  function renderAddForm(r: RoundInfo) {
    const chosen = new Set(addPlayers.filter(Boolean));
    const ready =
      addCourt !== "" && addPlayers.every(Boolean) && chosen.size === 4;
    return (
      <div className="rounded-md border border-dashed border-brand-300 p-3 text-sm flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">สนาม</span>
          <select value={addCourt} onChange={(e) => setAddCourt(e.target.value)} className="input py-1 w-24">
            {r.emptyCourts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">{i < 2 ? `ทีม 1 คนที่ ${i + 1}` : `ทีม 2 คนที่ ${i - 1}`}</span>
            <select
              value={addPlayers[i]}
              onChange={(e) => {
                const next = [...addPlayers];
                next[i] = e.target.value;
                setAddPlayers(next);
              }}
              className="input py-1 flex-1"
            >
              <option value="">เลือกผู้เล่น...</option>
              {r.substitutes
                .filter((s) => s.id === addPlayers[i] || !addPlayers.includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {playerLabel(s)}
                  </option>
                ))}
            </select>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => handleAddMatch(r.round)}
            disabled={!ready || loading}
            className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "กำลังเพิ่ม..." : "เพิ่มแมทช์"}
          </button>
          <button
            onClick={() => setAddingRound(null)}
            className="rounded-md border border-gray-300 text-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">แก้ไขการจับคู่</h2>
      {neverPlayed.length > 0 ? (
        <p className="text-sm text-amber-600">
          ยังไม่ได้ลงเล่น ({neverPlayed.length} คน): {neverPlayed.map(playerLabel).join(", ")}
        </p>
      ) : (
        <p className="text-sm text-gray-400">ทุกคนได้ลงเล่นครบแล้ว</p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex flex-col gap-4">
        {rounds.map((r) => (
          <div key={r.round}>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-sm font-medium text-gray-600">รอบที่ {r.round}</h3>
              {r.emptyCourts.length > 0 && r.substitutes.length >= 4 && addingRound !== r.round && (
                <button
                  onClick={() => startAdd(r.round, r.emptyCourts[0])}
                  className="text-xs text-brand-700 hover:underline"
                >
                  + เพิ่มแมทช์ (สนามว่าง: {r.emptyCourts.join(", ")})
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {r.matches.map((m) => (
                <div key={m.id} className="rounded-md border border-gray-200 p-2 text-sm flex flex-col gap-1">
                  <div className="text-xs text-gray-400 mb-1">สนาม {m.court}</div>
                  {m.team1.map((p) => renderPlayer(m.id, p, r.substitutes))}
                  <div className="text-gray-400 text-xs my-0.5 text-center">vs</div>
                  {m.team2.map((p) => renderPlayer(m.id, p, r.substitutes))}
                </div>
              ))}
              {addingRound === r.round && renderAddForm(r)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
