"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface P {
  id: string;
  name: string;
  skillLevel?: string;
}

export interface Substitute {
  id: string;
  name: string;
  skillLevel: string;
  waitlist?: boolean;
}

export interface LiveMatch {
  id: string;
  court: number;
  round: number;
  team1: P[];
  team2: P[];
}

export interface FinishedGame {
  id: string;
  court: number;
  winnerNames: string[];
  loserNames: string[];
  draw?: boolean;
}

/**
 * Live court board: each court shows its current game with a จบเกม button that
 * opens a "who won?" dialog. Finishing rotates all four out and pulls the next
 * four from the waiting queue onto that court. Empty courts can be filled from
 * the queue on demand (ดึงคิวลงสนาม).
 */
export default function LiveCourts({
  sessionId,
  courts,
  activeMatches,
  upcomingMatches = [],
  queue,
  recentFinished,
  substitutes = [],
}: {
  sessionId: string;
  courts: number;
  activeMatches: LiveMatch[];
  upcomingMatches?: LiveMatch[];
  queue: P[];
  recentFinished: FinishedGame[];
  substitutes?: Substitute[];
}) {
  const router = useRouter();
  const [finishing, setFinishing] = useState<LiveMatch | null>(null);
  // 1 | 2 = winning team, 0 = draw (เสมอ), null = not picked yet.
  const [winner, setWinner] = useState<0 | 1 | 2 | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Player being swapped out of a live game (edit-in-place on the court card).
  const [swapping, setSwapping] = useState<{ matchId: string; playerId: string } | null>(null);
  const [replacement, setReplacement] = useState("");

  async function confirmSwap() {
    if (!swapping || !replacement) return;
    setError(null);
    setLoading("swap");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${swapping.matchId}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outSignUpId: swapping.playerId, inSignUpId: replacement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สลับไม่สำเร็จ");
      setSwapping(null);
      setReplacement("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  const byCourt = new Map(activeMatches.map((m) => [m.court, m]));
  const upcomingByCourt = new Map<number, LiveMatch[]>();
  for (const m of [...upcomingMatches].sort((a, b) => a.round - b.round)) {
    const list = upcomingByCourt.get(m.court) ?? [];
    list.push(m);
    upcomingByCourt.set(m.court, list);
  }
  const courtList = Array.from({ length: courts }, (_, i) => i + 1);
  const emptyCourts = courtList.filter((c) => !byCourt.has(c));
  const canFill = queue.length >= 4;

  async function handleFill(court: number) {
    setError(null);
    setLoading(`fill-${court}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/courts/${court}/fill`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ดึงคิวไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  // Start a game on every empty court, in order, until the queue runs dry.
  async function handleFillAll() {
    setError(null);
    setLoading("fill-all");
    try {
      for (const c of emptyCourts) {
        const res = await fetch(`/api/sessions/${sessionId}/courts/${c}/fill`, { method: "POST" });
        if (!res.ok) break; // queue exhausted
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function handleClearQueue() {
    if (!confirm(`เอาคนที่รอคิว ${queue.length} คนออกทั้งหมด? (คนที่กำลังเล่นอยู่ไม่โดน — เช็คอินกลับได้ทีหลัง)`)) {
      return;
    }
    setError(null);
    setLoading("clearQueue");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/queue/clear`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "เคลียร์คิวไม่สำเร็จ");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  function openFinish(m: LiveMatch) {
    setWinner(null);
    setError(null);
    setFinishing(m);
  }

  async function confirmFinish() {
    if (!finishing || winner == null) return;
    setError(null);
    setLoading("finish");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${finishing.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeam: winner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "จบเกมไม่สำเร็จ");
      setFinishing(null);
      setWinner(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  function teamRow(m: LiveMatch, players: P[]) {
    return (
      <div className="flex flex-col items-center gap-1">
        {players.map((p) => {
          if (swapping && swapping.matchId === m.id && swapping.playerId === p.id) {
            return (
              <span key={p.id} className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-1 shadow-sm">
                <select
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  className="text-gray-900 text-xs rounded max-w-[8.5rem]"
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
                  className="text-brand-700 text-sm disabled:opacity-50"
                >
                  ✓
                </button>
                <button onClick={() => setSwapping(null)} className="text-gray-400 text-sm">
                  ✕
                </button>
              </span>
            );
          }
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSwapping({ matchId: m.id, playerId: p.id });
                setReplacement("");
                setError(null);
              }}
              className="bg-white text-gray-900 text-sm font-medium rounded-full px-3 py-1 shadow-sm whitespace-nowrap inline-flex items-center gap-1"
            >
              {p.name}
              {p.skillLevel && (
                <span className="text-gray-400 text-[11px]">
                  {SKILL_LABELS[p.skillLevel as SkillLevel] ?? p.skillLevel}
                </span>
              )}
              <span className="text-brand-500 text-[11px]">✎</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🏸 สนามสด — จบเกม / ดึงคิว</h2>
        <span className="text-xs text-gray-500">คิว {queue.length} คน</span>
      </div>

      {emptyCourts.length > 0 && (
        <button
          onClick={handleFillAll}
          disabled={!canFill || loading === "fill-all"}
          className="rounded-md bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-50"
        >
          {loading === "fill-all"
            ? "กำลังเริ่ม..."
            : `▶ เริ่มเกมในสนามว่าง (${emptyCourts.length} สนาม)`}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {courtList.map((court) => {
          const m = byCourt.get(court);
          const nexts = upcomingByCourt.get(court) ?? [];
          return (
            <div key={court} className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
              <div className="bg-slate-800 text-white text-center text-sm font-semibold py-1.5">
                สนาม {court}
                {m && <span className="text-white/60 font-normal"> — เกมที่ {m.round}</span>}
              </div>
              <div className="bg-gradient-to-b from-blue-500 to-blue-700 p-3 flex flex-col gap-2 min-h-[150px]">
                {m ? (
                  <>
                    <div className="flex-1 flex flex-col justify-center gap-2">
                      {teamRow(m, m.team1)}
                      <div className="border-t-2 border-dashed border-white/50" />
                      {teamRow(m, m.team2)}
                    </div>
                    <button
                      onClick={() => openFinish(m)}
                      className="rounded-md bg-brand-500 text-white text-sm font-medium py-1.5 hover:bg-brand-400"
                    >
                      จบเกม
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <p className="text-white/50 text-sm">ว่าง</p>
                    <button
                      onClick={() => handleFill(court)}
                      disabled={!canFill || loading === `fill-${court}`}
                      className="rounded-md bg-white/90 text-slate-800 text-sm font-medium px-3 py-1.5 hover:bg-white disabled:opacity-40"
                    >
                      {loading === `fill-${court}` ? "กำลังดึง..." : "ดึงคิวลงสนาม"}
                    </button>
                  </div>
                )}
                {nexts.slice(0, 2).map((n) => (
                  <p key={n.id} className="text-[11px] text-white/70 text-center truncate">
                    ⏭ เกมที่ {n.round}: {[...n.team1, ...n.team2].map((p) => p.name).join(", ")}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-gray-600">คิวรอลงสนาม (พักนานสุดอยู่หน้า)</p>
          {queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              disabled={loading === "clearQueue"}
              className="text-xs text-red-600 hover:underline disabled:opacity-50 shrink-0"
            >
              {loading === "clearQueue" ? "กำลังเคลียร์..." : `เคลียร์คิว (${queue.length})`}
            </button>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีคนรอคิว</p>
        ) : (
          <ol className="flex flex-wrap gap-1.5">
            {queue.map((p, i) => (
              <li
                key={p.id}
                className={`text-sm rounded-full px-3 py-1 border ${
                  i < 4
                    ? "bg-amber-400 border-amber-400 text-white font-medium"
                    : "bg-amber-50 border-amber-300 text-amber-800"
                }`}
              >
                <span className={`mr-1 ${i < 4 ? "text-white/70" : "text-amber-400"}`}>{i + 1}.</span>
                {p.name}
              </li>
            ))}
          </ol>
        )}
        {queue.length > 0 && queue.length < 4 && (
          <p className="text-xs text-amber-600 mt-1">คิวไม่ถึง 4 คน — ยังเริ่มเกมใหม่ไม่ได้</p>
        )}
      </div>

      {recentFinished.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">เกมที่จบล่าสุด (ทีมชนะ ✓)</p>
          <ul className="flex flex-col gap-1">
            {recentFinished.map((g) => (
              <li key={g.id} className="text-sm border-b border-gray-100 py-1 flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">สนาม {g.court}</span>
                {g.draw ? (
                  <>
                    <span className="text-gray-700">{g.winnerNames.join(" + ")}</span>
                    <span className="text-amber-600 text-xs font-medium">🤝 เสมอ</span>
                    <span className="text-gray-700">{g.loserNames.join(" + ")}</span>
                  </>
                ) : (
                  <>
                    <span className="text-brand-700 font-medium">✓ {g.winnerNames.join(" + ")}</span>
                    <span className="text-gray-400 text-xs">ชนะ</span>
                    <span className="text-gray-500">{g.loserNames.join(" + ")}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {finishing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4 flex flex-col gap-3 shadow-xl">
            <h3 className="font-semibold text-center">สนาม {finishing.court} — ใครชนะ?</h3>
            <div className="grid grid-cols-1 gap-2">
              {([1, 2] as const).map((t) => {
                const team = t === 1 ? finishing.team1 : finishing.team2;
                return (
                  <button
                    key={t}
                    onClick={() => setWinner(t)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${
                      winner === t
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-brand-400"
                    }`}
                  >
                    {team.map((p) => p.name).join(" + ")}
                  </button>
                );
              })}
              <button
                onClick={() => setWinner(0)}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${
                  winner === 0
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-700 border-gray-300 hover:border-amber-400"
                }`}
              >
                🤝 เสมอ
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 mt-1">
              <button
                onClick={confirmFinish}
                disabled={winner == null || loading === "finish"}
                className="flex-1 rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {loading === "finish" ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
              <button
                onClick={() => setFinishing(null)}
                className="rounded-md border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
