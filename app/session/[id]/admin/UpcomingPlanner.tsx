"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { balanceTeams, SKILL_LABELS, type SkillLevel } from "@/lib/matching";

type Lite = { id: string; name: string; skillLevel: SkillLevel; fixedPartnerId?: string | null };

/** Anyone checked in, whether free right now or mid-game on a court. */
export interface Candidate {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  busyCourt: number | null; // court number if currently mid-game, else null (free / queued)
}

export interface PersistedPending {
  id: string;
  team1: Lite[];
  team2: Lite[];
}

/**
 * คู่เตรียม panel — three related things live here:
 *
 * 1. ระบบจัดให้ (initialMatchups): preview of the next games the queue will
 *    produce — same foursomes fillCourt picks. Admin can swap any slot for
 *    another checked-in person (even someone currently playing, earmarking
 *    them) before booking it onto a free court.
 * 2. คู่เตรียมที่จัดเอง (pendingPairs): foursomes the admin hand-picked and
 *    saved via "จัดคู่เตรียมเอง" below. Persisted in the DB so they survive
 *    refreshes and other people's games finishing — needed because a pick
 *    may include someone still mid-game, who can only actually play once
 *    they finish and leave the court.
 * 3. จัดคู่เตรียมเอง: hand-pick any four checked-in people (including players
 *    currently on a court). If everyone's free and a court is open, it books
 *    immediately; otherwise it's saved as a pending pair above.
 */
export default function UpcomingPlanner({
  sessionId,
  initialMatchups,
  candidates,
  pendingPairs,
  freeCourts,
}: {
  sessionId: string;
  initialMatchups: Lite[][];
  candidates: Candidate[]; // everyone checked in, for swapping and for hand-picking
  pendingPairs: PersistedPending[];
  freeCourts: number[]; // open courts with no current game (booked as a live game)
}) {
  const router = useRouter();
  const [matchups, setMatchups] = useState<Lite[][]>(initialMatchups);
  const [courts, setCourts] = useState<number[]>(() =>
    initialMatchups.map((_, i) => freeCourts[i] ?? freeCourts[0] ?? 0)
  );
  const [editing, setEditing] = useState<{ m: number; slot: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const noFreeCourt = freeCourts.length === 0;

  // --- ระบบจัดให้: swap a slot with any checked-in person -----------------
  function replace(m: number, slot: number, playerId: string) {
    const incoming = candidates.find((x) => x.id === playerId);
    setEditing(null);
    if (!incoming) return;
    setMatchups((prev) => {
      const next = prev.map((four) => [...four]);
      const outgoing = next[m][slot];
      for (let mi = 0; mi < next.length; mi++) {
        const si = next[mi].findIndex((p) => p.id === playerId);
        if (si >= 0) {
          next[mi][si] = outgoing; // exchange with the other matchup
          break;
        }
      }
      next[m][slot] = { id: incoming.id, name: incoming.name, skillLevel: incoming.skillLevel };
      return next;
    });
  }

  async function book(m: number) {
    const { team1, team2 } = balanceTeams(matchups[m]);
    setError(null);
    setLoading(`auto-${m}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court: courts[m],
          team1: team1.map((p) => p.id),
          team2: team2.map((p) => p.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "จองไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  const chip = (p: Lite, m: number, slot: number) => {
    const busyCourt = byId.get(p.id)?.busyCourt ?? null;
    if (editing && editing.m === m && editing.slot === slot) {
      return (
        <select
          key={p.id}
          autoFocus
          defaultValue=""
          onChange={(e) => replace(m, slot, e.target.value)}
          onBlur={() => setEditing(null)}
          className="text-gray-900 text-xs rounded border border-gray-300 max-w-[11rem] py-1"
        >
          <option value="" disabled>
            แทน {p.name} ด้วย…
          </option>
          {candidates
            .filter((b) => !matchups[m].some((x) => x.id === b.id))
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({SKILL_LABELS[b.skillLevel]})
                {b.busyCourt ? ` — เล่นอยู่ สนาม ${b.busyCourt}` : ""}
              </option>
            ))}
        </select>
      );
    }
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => setEditing({ m, slot })}
        className={`text-gray-900 text-xs font-medium rounded-full px-2.5 py-1 border inline-flex items-center gap-1 ${
          busyCourt ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200"
        }`}
      >
        {p.name}
        <span className="text-gray-400">{SKILL_LABELS[p.skillLevel]}</span>
        {busyCourt && <span className="text-amber-600">⏳ สนาม {busyCourt}</span>}
        <span className="text-brand-500">✎</span>
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-orange-800">🔶 คู่เตรียม</h2>
        <span className="text-xs text-orange-600">แก้ตัวผู้เล่นก่อนลงได้</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {matchups.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-orange-700/70">
            คิวถัดไป (มือใกล้กันก่อน แล้วคิว) กด ✎ เพื่อสลับกับใครก็ได้ที่เช็คอินไว้ — รวมถึงคนที่
            กำลังเล่นอยู่ (จองไว้รอ)
            {noFreeCourt ? " · รอสนามว่างก่อนถึงจะลงได้" : ' · เลือกสนามว่างแล้ว "ลงสนาม"'}
          </p>
          <ol className="flex flex-col gap-2">
            {matchups.map((four, m) => {
              const { team1, team2 } = balanceTeams(four);
              const slotOf = (p: Lite) => four.findIndex((q) => q.id === p.id);
              const anyBusy = four.some((p) => byId.get(p.id)?.busyCourt);
              return (
                <li key={m} className="rounded-lg border border-gray-200 bg-white/60 p-2.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 shrink-0 w-8">คู่ {m + 1}</span>
                    <div className="flex-1 flex items-center justify-around gap-1 flex-wrap">
                      <div className="flex flex-col gap-1">{team1.map((p) => chip(p, m, slotOf(p)))}</div>
                      <span className="text-xs font-bold text-gray-400 shrink-0">VS</span>
                      <div className="flex flex-col gap-1">{team2.map((p) => chip(p, m, slotOf(p)))}</div>
                    </div>
                  </div>
                  {anyBusy ? (
                    <p className="text-xs text-amber-700 text-right">⏳ ต้องรอคนที่กำลังเล่นจบเกมก่อนถึงจะลงสนามได้</p>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <label className="text-xs text-gray-500">ลงสนามว่าง</label>
                      <select
                        value={courts[m]}
                        disabled={noFreeCourt}
                        onChange={(e) =>
                          setCourts((prev) => prev.map((c, i) => (i === m ? Number(e.target.value) : c)))
                        }
                        className="text-sm rounded border border-gray-300 py-1 px-2 text-gray-900 disabled:opacity-50"
                      >
                        {noFreeCourt ? (
                          <option value={0}>ไม่มีสนามว่าง</option>
                        ) : (
                          freeCourts.map((c) => (
                            <option key={c} value={c}>
                              สนาม {c}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        onClick={() => book(m)}
                        disabled={loading === `auto-${m}` || noFreeCourt}
                        className="rounded-md bg-orange-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50"
                      >
                        {loading === `auto-${m}` ? "กำลังลง…" : "ลงสนาม"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <PendingPairsList sessionId={sessionId} pendingPairs={pendingPairs} candidates={candidates} />

      <ManualPendingPairForm sessionId={sessionId} candidates={candidates} />
    </section>
  );
}

/** Persisted, hand-picked or earmarked pending pairs — survive refreshes. */
function PendingPairsList({
  sessionId,
  pendingPairs,
  candidates,
}: {
  sessionId: string;
  pendingPairs: PersistedPending[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(candidates.map((c) => [c.id, c]));

  async function bookPending(id: string) {
    setError(null);
    setLoading(`book-${id}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/${id}/book`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ลงสนามไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function cancelPending(id: string) {
    setError(null);
    setLoading(`cancel-${id}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "ยกเลิกไม่สำเร็จ");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  if (pendingPairs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-orange-200 pt-3">
      <h3 className="text-sm font-semibold text-orange-800">คู่เตรียมที่จัดเอง</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ol className="flex flex-col gap-2">
        {pendingPairs.map((p) => {
          const four = [...p.team1, ...p.team2];
          const busyOnes = four
            .map((pl) => ({ pl, court: byId.get(pl.id)?.busyCourt ?? null }))
            .filter((x) => x.court != null);
          return (
            <li key={p.id} className="rounded-lg border border-gray-200 bg-white/60 p-2.5 flex flex-col gap-2">
              <div className="flex-1 flex items-center justify-around gap-1 flex-wrap">
                <div className="flex flex-col gap-1">
                  {p.team1.map((pl) => (
                    <span
                      key={pl.id}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border inline-flex items-center gap-1 ${
                        byId.get(pl.id)?.busyCourt ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200"
                      }`}
                    >
                      {pl.name} <span className="text-gray-400">{SKILL_LABELS[pl.skillLevel]}</span>
                    </span>
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-400 shrink-0">VS</span>
                <div className="flex flex-col gap-1">
                  {p.team2.map((pl) => (
                    <span
                      key={pl.id}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border inline-flex items-center gap-1 ${
                        byId.get(pl.id)?.busyCourt ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200"
                      }`}
                    >
                      {pl.name} <span className="text-gray-400">{SKILL_LABELS[pl.skillLevel]}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                {busyOnes.length > 0 ? (
                  <p className="text-xs text-amber-700">
                    ⏳ รอ {busyOnes.map((x) => `${x.pl.name} (สนาม ${x.court})`).join(", ")} จบเกมก่อน
                  </p>
                ) : (
                  <span className="text-xs text-gray-400">ทุกคนพร้อมแล้ว</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => cancelPending(p.id)}
                    disabled={loading === `cancel-${p.id}`}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => bookPending(p.id)}
                    disabled={busyOnes.length > 0 || loading === `book-${p.id}`}
                    className="rounded-md bg-orange-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50"
                  >
                    {loading === `book-${p.id}` ? "กำลังลง…" : "ลงสนาม"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Hand-pick any four checked-in people (including those currently playing)
 *  and save them as a คู่เตรียม. */
function ManualPendingPairForm({ sessionId, candidates }: { sessionId: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const chosen = new Set(picks.filter(Boolean));
  const ready = picks.every(Boolean) && chosen.size === 4;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team1: [picks[0], picks[1]], team2: [picks[2], picks[3]] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "จัดคู่เตรียมไม่สำเร็จ", ok: false });
        return;
      }
      setMessage({
        text: data.booked ? `จัดลงสนาม ${data.court} แล้ว` : "เพิ่มเข้าคู่เตรียมแล้ว",
        ok: true,
      });
      setPicks(["", "", "", ""]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function playerSelect(i: number, label: string) {
    return (
      <label className="flex flex-col gap-1 text-xs text-gray-600">
        {label}
        <select
          value={picks[i]}
          onChange={(e) => {
            const next = [...picks];
            next[i] = e.target.value;
            setPicks(next);
          }}
          className="input py-1.5 text-sm"
        >
          <option value="">เลือกผู้เล่น...</option>
          {candidates
            .filter((p) => p.id === picks[i] || !picks.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.busyCourt ? ` — เล่นอยู่ สนาม ${p.busyCourt}` : ""}
              </option>
            ))}
        </select>
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-orange-200 pt-3">
      <h3 className="text-sm font-semibold text-orange-800">จัดคู่เตรียมเอง</h3>
      <p className="text-xs text-orange-700/70">
        เลือกได้ 4 คนจากทุกคนที่เช็คอินไว้ รวมถึงคนที่กำลังเล่นอยู่ (จะลงสนามได้ก็ต่อเมื่อจบเกมออกมาก่อน)
        ถ้าทุกคนว่างและมีสนามว่าง ระบบจะจัดลงสนามให้ทันที ไม่งั้นจะไปรออยู่ในคู่เตรียมด้านบน
      </p>
      {candidates.length < 4 ? (
        <p className="text-sm text-gray-400">ต้องมีคนเช็คอินอย่างน้อย 4 คนก่อนครับ</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white/60 p-2">
              <span className="text-xs font-medium text-gray-500">ทีมซ้าย</span>
              {playerSelect(0, "คนที่ 1")}
              {playerSelect(1, "คนที่ 2")}
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white/60 p-2">
              <span className="text-xs font-medium text-gray-500">ทีมขวา</span>
              {playerSelect(2, "คนที่ 1")}
              {playerSelect(3, "คนที่ 2")}
            </div>
          </div>
          <button
            type="submit"
            disabled={!ready || loading}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังจัด..." : "จัดคู่"}
          </button>
          {message && (
            <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
          )}
        </>
      )}
    </form>
  );
}
