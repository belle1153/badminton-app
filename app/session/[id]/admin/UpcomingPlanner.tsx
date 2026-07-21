"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PENDING_QUEUE_CAP, SKILL_LABELS, type SkillLevel } from "@/lib/matching";

type Lite = {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  busyCourt: number | null;
  present: boolean; // checked in (มาแล้ว) — a ยังไม่มา member blocks booking
};

/** Anyone checked in, whether free right now or mid-game on a court. */
export interface Candidate {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  busyCourt: number | null; // court number if currently mid-game, else null
}

export interface PersistedPending {
  id: string;
  team1: Lite[];
  team2: Lite[];
  /** Most players this foursome shares with a single finished game (0–4) — a
   *  rematch warning when 3 or 4. */
  repeat?: number;
  /** Names of the players who already played together (the shared ones). */
  repeatNames?: string[];
}

/**
 * คู่เตรียม — a persisted, ordered FIFO queue (PendingPair rows), not a preview
 * that reshuffles. It is filled ON DEMAND, not automatically: the admin presses
 * "จัดคู่เตรียมจากคิว" when they're ready, so late arrivals (who might balance a
 * foursome better) can still be included instead of the queue locking people in
 * the moment they check in. The admin can then:
 *   - ✎ swap any player for another checked-in person — saved straight away.
 *   - ลงสนาม: drop a คู่เตรียม onto a free court now (the rest keep their order
 *     and slide up).
 *   - ยกเลิก: remove a คู่เตรียม.
 *   - จัดคู่เตรียมเอง: hand-pick four (incl. players mid-game) and append them.
 * A game finishing also offers to drop the front คู่เตรียม (handled on the live
 * court board), so คู่ 1 → court, คู่ 2 becomes คู่ 1, and so on.
 */
export default function UpcomingPlanner({
  sessionId,
  candidates,
  pendingPairs,
  freeCourts,
  freeUnqueuedSignature,
}: {
  sessionId: string;
  candidates: Candidate[];
  pendingPairs: PersistedPending[];
  freeCourts: number[];
  freeUnqueuedSignature: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ pairId: string; slot: string } | null>(null);
  const [courtByPair, setCourtByPair] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noFreeCourt = freeCourts.length === 0;
  const courtFor = (pairId: string) => courtByPair[pairId] ?? freeCourts[0] ?? 0;
  const waitingCount = freeUnqueuedSignature ? freeUnqueuedSignature.split(",").length : 0;

  // Fill the queue only when the admin asks — this pairs up whoever is free and
  // checked in RIGHT NOW, so they can wait for more/stronger players first.
  async function generateFromQueue() {
    setError(null);
    setLoading("generate");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force: an explicit press must queue people even if the grouping would
        // be a rerun — the auto-sync hold is for the background path only.
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "จัดคู่เตรียมไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function swap(pairId: string, outSignUpId: string, inSignUpId: string) {
    setEditing(null);
    if (!inSignUpId) return;
    setError(null);
    setLoading(`swap-${pairId}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/${pairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outSignUpId, inSignUpId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สลับผู้เล่นไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function book(pairId: string) {
    setError(null);
    setLoading(`book-${pairId}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/${pairId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ court: courtFor(pairId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ลงสนามไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function cancel(pairId: string) {
    setError(null);
    setLoading(`cancel-${pairId}`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pending-pairs/${pairId}`, { method: "DELETE" });
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

  const chip = (p: Lite, pairId: string, inThisPair: Set<string>, pairMembers: Lite[]) => {
    const slot = p.id;
    if (editing && editing.pairId === pairId && editing.slot === slot) {
      return (
        <select
          key={p.id}
          autoFocus
          defaultValue=""
          onChange={(e) => swap(pairId, p.id, e.target.value)}
          onBlur={() => setEditing(null)}
          className="text-gray-900 text-xs rounded border border-gray-300 max-w-[11rem] py-1"
        >
          <option value="" disabled>
            แทน {p.name} ด้วย…
          </option>
          <optgroup label="สลับตำแหน่งในคู่นี้">
            {pairMembers
              .filter((m) => m.id !== p.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  ⇄ {m.name} ({SKILL_LABELS[m.skillLevel]})
                </option>
              ))}
          </optgroup>
          <optgroup label="เอาคนอื่นมาแทน">
            {candidates
              .filter((c) => !inThisPair.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({SKILL_LABELS[c.skillLevel]})
                  {c.busyCourt ? ` — เล่นอยู่ สนาม ${c.busyCourt}` : ""}
                </option>
              ))}
          </optgroup>
        </select>
      );
    }
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => setEditing({ pairId, slot })}
        className={`text-gray-900 text-xs font-medium rounded-full px-2.5 py-1 border inline-flex items-center gap-1 ${
          !p.present
            ? "bg-red-50 border-red-300"
            : p.busyCourt
              ? "bg-amber-50 border-amber-300"
              : "bg-white border-gray-200"
        }`}
      >
        {p.name}
        <span className="text-gray-400">{SKILL_LABELS[p.skillLevel]}</span>
        {!p.present && <span className="text-red-600">⚠️ ยังไม่มา</span>}
        {p.present && p.busyCourt && <span className="text-amber-600">⏳ สนาม {p.busyCourt}</span>}
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
      <p className="text-xs text-orange-700/70">
        คิวถาวร เรียงตามลำดับ (มือใกล้กันก่อน แล้วคิว) — ตอนเริ่ม กด &quot;จัดคู่เตรียมจากคิว&quot; เมื่อพร้อม
        (รอคนมาครบ/มือดีก่อนได้) · พอเกมจบ คู่หน้าสุดลงสนามให้เอง แล้ว
        <span className="font-medium">ระบบเติมคู่เตรียมชุดใหม่จากคนที่เพิ่งว่างให้ดูล่วงหน้า</span> ·
        กด ✎ สลับคนได้ตลอด แก้แล้วบันทึกทันที — ไม่มีใครลงสนามโดยไม่โผล่ตรงนี้ก่อน
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* On-demand generation — never auto-forms คู่เตรียม as people check in.
          Hidden while the queue is at its cap: holding players back is what
          gives the matchmaker enough people to keep the มือ on a court close. */}
      {waitingCount > 0 && pendingPairs.length < PENDING_QUEUE_CAP && (
        <button
          onClick={generateFromQueue}
          disabled={loading === "generate"}
          className="rounded-md bg-orange-600 text-white text-sm font-medium px-3 py-2 hover:bg-orange-700 disabled:opacity-50 self-start"
        >
          {loading === "generate" ? "กำลังจัด…" : `➕ จัดคู่เตรียมจากคิว (รออยู่ ${waitingCount} คน)`}
        </button>
      )}
      {waitingCount > 0 && pendingPairs.length >= PENDING_QUEUE_CAP && (
        <p className="text-xs text-gray-400">
          คู่เตรียมครบ {PENDING_QUEUE_CAP} คู่แล้ว — พอคู่หน้าลงสนาม ระบบจะจัดคู่ใหม่จากคนที่รอ ({waitingCount} คน)
          ให้เอง มือจะได้ใกล้กัน
        </p>
      )}

      {pendingPairs.length === 0 ? (
        <p className="text-sm text-gray-400">
          {waitingCount > 0
            ? "กดปุ่มด้านบนเพื่อจัดคู่เตรียมจากคิว"
            : candidates.length === 0
              ? "ยังไม่มีคนเช็คอิน"
              : "ทุกคนกำลังลงสนามอยู่ — พอมีเกมจบ คนจะว่างแล้วจัดคู่เตรียมได้"}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {pendingPairs.map((pair, i) => {
            const inThisPair = new Set([...pair.team1, ...pair.team2].map((p) => p.id));
            const members = [...pair.team1, ...pair.team2];
            const notHere = members.filter((p) => !p.present);
            const busyOnes = members.filter((p) => p.present && p.busyCourt != null);
            const anyBusy = busyOnes.length > 0;
            const blocked = anyBusy || notHere.length > 0;
            return (
              <li key={pair.id} className="rounded-lg border border-gray-200 bg-white/60 p-2.5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 shrink-0 w-8">คู่ {i + 1}</span>
                  {/* 3-col grid keeps VS dead-centre regardless of chip widths. */}
                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="flex flex-col gap-1 items-end">
                      {pair.team1.map((p) => chip(p, pair.id, inThisPair, members))}
                    </div>
                    <span className="text-xs font-bold text-gray-400 shrink-0">VS</span>
                    <div className="flex flex-col gap-1 items-start">
                      {pair.team2.map((p) => chip(p, pair.id, inThisPair, members))}
                    </div>
                  </div>
                </div>
                {(pair.repeat ?? 0) >= 3 && (
                  <div className="rounded-md bg-red-600 border-2 border-red-700 text-white text-[11px] font-medium px-2 py-1.5">
                    ⚠️ {pair.repeat} คนนี้เคยเล่นด้วยกันแล้ว
                    {pair.repeatNames && pair.repeatNames.length > 0 && (
                      <span className="font-bold"> : {pair.repeatNames.join(", ")}</span>
                    )}{" "}
                    — เปลี่ยนคนไหม? (กด ✎ ที่ชื่อ)
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => cancel(pair.id)}
                    disabled={loading === `cancel-${pair.id}`}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  {blocked ? (
                    <p className="text-xs text-right">
                      {notHere.length > 0 && (
                        <span className="text-red-600">
                          ⚠️ รอ {notHere.map((p) => p.name).join(", ")} เช็คอินก่อน
                        </span>
                      )}
                      {notHere.length > 0 && anyBusy && " · "}
                      {anyBusy && (
                        <span className="text-amber-700">
                          ⏳ รอ {busyOnes.map((p) => `${p.name} (สนาม ${p.busyCourt})`).join(", ")} จบเกม
                        </span>
                      )}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">ลงสนามว่าง</label>
                      <select
                        value={courtFor(pair.id)}
                        disabled={noFreeCourt}
                        onChange={(e) =>
                          setCourtByPair((prev) => ({ ...prev, [pair.id]: Number(e.target.value) }))
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
                        onClick={() => book(pair.id)}
                        disabled={loading === `book-${pair.id}` || noFreeCourt}
                        className="rounded-md bg-orange-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50"
                      >
                        {loading === `book-${pair.id}` ? "กำลังลง…" : "ลงสนาม"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ManualPendingPairForm sessionId={sessionId} candidates={candidates} />
    </section>
  );
}

/** Hand-pick any four checked-in people (including those currently playing) and
 *  append them to the คู่เตรียม queue. */
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
                {p.name} ({SKILL_LABELS[p.skillLevel]})
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
        ถ้าทุกคนว่างและมีสนามว่าง ระบบจะจัดลงสนามให้ทันที ไม่งั้นจะไปต่อท้ายคู่เตรียมด้านบน
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
