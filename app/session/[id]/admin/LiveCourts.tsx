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
  busyCourt?: number | null; // court they're mid-game on, else free
}

export interface LiveMatch {
  id: string;
  court: number;
  round: number;
  gameNo?: number; // running game number across the day (not per court)
  team1: P[];
  team2: P[];
  startedAt?: string; // ISO — when the game started, for the elapsed clock
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
  openCourts,
  maxCourts,
  courtsLimit,
  isAuto,
  activeMatches,
  queue,
  readyPendingCount,
  recentFinished,
  substitutes = [],
}: {
  sessionId: string;
  /** Court numbers open to fill right now (a subset of 1..maxCourts). */
  openCourts: number[];
  /** How many court chips to show (venue max, e.g. 6). */
  maxCourts: number;
  /** Most courts that may be open at once this session (the day's set count). */
  courtsLimit: number;
  /** true = open set is the clock default (openCourts field not overridden). */
  isAuto: boolean;
  activeMatches: LiveMatch[];
  queue: P[];
  /** คู่เตรียม that can go down right now — the fill buttons draw from these. */
  readyPendingCount: number;
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
  // Show each court's game start time (when the four went on), so the admin can
  // see which court started first — that one is likely to finish first and its
  // คู่เตรียม should be ready.
  const startClock = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Bangkok",
        })
      : null;
  const earliestCourt = activeMatches.reduce(
    (best, m) => {
      const t = m.startedAt ? new Date(m.startedAt).getTime() : Infinity;
      return t < best.t ? { court: m.court, t } : best;
    },
    { court: -1, t: Infinity }
  ).court;

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
  const openSet = new Set(openCourts);
  // A court with a game running counts as open no matter what: its card shows,
  // so its toggle must show open too (and it can't be closed mid-game). This
  // keeps the toggle and the courts on screen in sync.
  const playing = new Set(activeMatches.map((m) => m.court));
  const courtList = [...new Set([...openCourts, ...playing])].sort((a, b) => a - b);
  const emptyCourts = courtList.filter((c) => !byCourt.has(c) && openSet.has(c));
  // Courts are filled from คู่เตรียม, not from raw queue names — so what enables
  // the fill buttons is "is a คู่เตรียม ready to go", not "are 4 people waiting".
  const canFill = readyPendingCount > 0;

  async function setOpenCourts(nums: number[] | null) {
    setError(null);
    setLoading("courts-open");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/courts-open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openCourts: nums }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "ตั้งค่าคอร์ทไม่สำเร็จ");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  function toggleCourt(court: number) {
    if (playing.has(court)) {
      setError(`สนาม ${court} กำลังเล่นอยู่ — จบเกมก่อนถึงปิดได้`);
      return;
    }
    const next = new Set(openSet);
    if (next.has(court)) {
      next.delete(court);
    } else {
      if (next.size >= courtsLimit) {
        setError(
          `เปิดได้สูงสุด ${courtsLimit} สนามในวันนี้ — ถ้าจะเพิ่ม ต้องแก้จำนวนสนามด้านบนก่อน`
        );
        return;
      }
      next.add(court);
    }
    setError(null);
    setOpenCourts([...next].sort((a, b) => a - b));
  }

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

  // closeCourt = "จบแล้วปิดคอร์ท": end the game without refilling and close the
  // court, so the four are free to check out (used to wind down at end of day).
  async function confirmFinish(closeCourt = false) {
    if (!finishing || winner == null) return;
    setError(null);
    setLoading(closeCourt ? "finish-close" : "finish");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/${finishing.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeam: winner, closeCourt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "จบเกมไม่สำเร็จ");
      setFinishing(null);
      setWinner(null);
      // The server already dropped the front คู่เตรียม onto this court (or
      // auto-filled, or closed it) — just refresh to show the result.
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
                  <option value="">{p.name} → เลือก...</option>
                  {(() => {
                    // Opposite side of the same court: picking one swaps sides.
                    const opponents = m.team1.some((x) => x.id === p.id) ? m.team2 : m.team1;
                    return (
                      <optgroup label="↔ สลับฝั่ง (ในสนาม)">
                        {opponents.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.skillLevel ? ` (${SKILL_LABELS[o.skillLevel as SkillLevel] ?? o.skillLevel})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
                  {(() => {
                    // Everyone not on THIS court (this court's four are in the
                    // สลับฝั่ง group above): free players first, then people
                    // mid-game on another court (ว่าง A-Z, then เล่นอยู่ A-Z —
                    // already sorted that way). Picking a busy one swaps courts.
                    const here = new Set([...m.team1, ...m.team2].map((x) => x.id));
                    const pool = substitutes.filter((s) => !here.has(s.id));
                    if (pool.length === 0) return null;
                    return (
                      <optgroup label="⇄ เปลี่ยนตัว / ดึงคนในสนาม">
                        {pool.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                            {s.busyCourt ? ` — เล่นอยู่ สนาม ${s.busyCourt}` : s.waitlist ? " — สำรอง" : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
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

      <div className="rounded-lg border border-gray-200 p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">
            เปิด/ปิดสนาม <span className="text-gray-400">(เปิดได้สูงสุด {courtsLimit})</span>
            {isAuto && <span className="text-gray-400"> · อัตโนมัติ</span>}
          </span>
          {!isAuto && (
            <button
              onClick={() => setOpenCourts(null)}
              disabled={loading === "courts-open"}
              className="text-[11px] text-brand-700 hover:underline disabled:opacity-50"
            >
              กลับเป็นอัตโนมัติ
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxCourts }, (_, i) => i + 1).map((c) => {
            const isPlaying = playing.has(c);
            const on = openSet.has(c) || isPlaying;
            return (
              <button
                key={c}
                onClick={() => toggleCourt(c)}
                disabled={loading === "courts-open"}
                title={isPlaying ? "กำลังเล่นอยู่ — จบเกมก่อนถึงปิดได้" : undefined}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                  on
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-400 border-gray-300 line-through"
                }`}
              >
                สนาม {c}
              </button>
            );
          })}
        </div>
      </div>

      {emptyCourts.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={handleFillAll}
            disabled={!canFill || loading === "fill-all"}
            className="rounded-md bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-50"
          >
            {loading === "fill-all"
              ? "กำลังเริ่ม..."
              : `▶ ส่งคู่เตรียมลงสนามว่าง (ว่าง ${emptyCourts.length} · พร้อมลง ${readyPendingCount} คู่)`}
          </button>
          {!canFill && (
            <p className="text-xs text-gray-400">
              ยังไม่มีคู่เตรียมที่พร้อมลง — กด &quot;จัดคู่เตรียมจากคิว&quot; ด้านล่าง หรือรอคนในคู่เตรียมจบเกม
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {courtList.map((court) => {
          const m = byCourt.get(court);
          return (
            <div key={court} className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
              <div className="bg-slate-800 text-white text-center text-sm font-semibold py-1.5">
                สนาม {court}
                {m && <span className="text-white/60 font-normal"> — เกมที่ {m.gameNo ?? m.round}</span>}
                {m && startClock(m.startedAt) && (
                  <span
                    className={`ml-1 font-normal ${
                      court === earliestCourt ? "text-amber-300" : "text-white/60"
                    }`}
                  >
                    · 🕐 {startClock(m.startedAt)}
                    {court === earliestCourt && " (ลงก่อน)"}
                  </span>
                )}
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
                ) : openSet.has(court) ? (
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
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-white/50 text-sm">🔒 ปิดอยู่</p>
                  </div>
                )}
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
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => confirmFinish(false)}
                  disabled={winner == null || loading != null}
                  className="flex-1 rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading === "finish" ? "กำลังบันทึก..." : "จบเกม (รันคู่ต่อไป)"}
                </button>
                <button
                  onClick={() => setFinishing(null)}
                  disabled={loading != null}
                  className="rounded-md border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              </div>
              <button
                onClick={() => confirmFinish(true)}
                disabled={winner == null || loading != null}
                className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {loading === "finish-close" ? "กำลังปิด..." : "🛑 จบแล้วปิดคอร์ท (ไม่รันต่อ)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
