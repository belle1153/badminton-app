"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { balanceTeams, SKILL_LABELS, type Player, type SkillLevel } from "@/lib/matching";

type Lite = { id: string; name: string; skillLevel: SkillLevel; fixedPartnerId?: string | null };

/**
 * Admin preview of the next games the queue will produce — the SAME foursomes
 * fillCourt picks (closest skill, then queue). Admin can swap any player for a
 * benched queue member before it runs, then book the foursome onto a court
 * (matches/add: current if the court is free, else pre-queued). Lets admin fix
 * a line-up that looks off before it hits the court.
 */
export default function UpcomingPlanner({
  sessionId,
  initialMatchups,
  pool,
  openCourts,
  freeCourts,
}: {
  sessionId: string;
  initialMatchups: Lite[][];
  pool: Lite[]; // every queue player, for swapping
  openCourts: number[];
  freeCourts: number[]; // open courts with no current game (booked as a live game)
}) {
  const router = useRouter();
  const [matchups, setMatchups] = useState<Lite[][]>(initialMatchups);
  const [courts, setCourts] = useState<number[]>(() =>
    initialMatchups.map((_, i) => freeCourts[i] ?? openCourts[i] ?? openCourts[0] ?? 1)
  );
  const [editing, setEditing] = useState<{ m: number; slot: number } | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Swap a slot with any queue player: bench members drop the old player back
  // to the bench; a player already in another matchup does a true exchange.
  function replace(m: number, slot: number, playerId: string) {
    const incoming = pool.find((x) => x.id === playerId);
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
      next[m][slot] = incoming;
      return next;
    });
  }

  async function book(m: number) {
    const { team1, team2 } = balanceTeams(matchups[m]);
    setError(null);
    setLoading(m);
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

  if (matchups.length === 0) return null;

  const chip = (p: Lite, m: number, slot: number) => {
    if (editing && editing.m === m && editing.slot === slot) {
      return (
        <select
          key={p.id}
          autoFocus
          defaultValue=""
          onChange={(e) => replace(m, slot, e.target.value)}
          onBlur={() => setEditing(null)}
          className="text-gray-900 text-xs rounded border border-gray-300 max-w-[9rem] py-1"
        >
          <option value="" disabled>
            แทน {p.name} ด้วย…
          </option>
          {pool
            .filter((b) => !matchups[m].some((x) => x.id === b.id))
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({SKILL_LABELS[b.skillLevel]})
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
        className="bg-white text-gray-900 text-xs font-medium rounded-full px-2.5 py-1 border border-gray-200 inline-flex items-center gap-1"
      >
        {p.name}
        <span className="text-gray-400">{SKILL_LABELS[p.skillLevel]}</span>
        <span className="text-brand-500">✎</span>
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🔮 คู่เตรียม (ล่วงหน้า)</h2>
        <span className="text-xs text-gray-500">แก้ตัวผู้เล่นก่อนลงได้</span>
      </div>
      <p className="text-xs text-gray-400">
        คู่ที่ระบบจะจัดลงถัดไป (มือใกล้กันก่อน แล้วคิว) กด ✎ เพื่อสลับกับคนในคิว แล้ว &quot;จองลงสนาม&quot;
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ol className="flex flex-col gap-2">
        {matchups.map((four, m) => {
          const { team1, team2 } = balanceTeams(four);
          const slotOf = (p: Lite) => four.findIndex((q) => q.id === p.id);
          return (
            <li key={m} className="rounded-lg border border-gray-200 p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 shrink-0 w-8">คู่ {m + 1}</span>
                <div className="flex-1 flex items-center justify-around gap-1 flex-wrap">
                  <div className="flex flex-col gap-1">{team1.map((p) => chip(p, m, slotOf(p)))}</div>
                  <span className="text-xs font-bold text-gray-400 shrink-0">VS</span>
                  <div className="flex flex-col gap-1">{team2.map((p) => chip(p, m, slotOf(p)))}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <label className="text-xs text-gray-500">ลงสนาม</label>
                <select
                  value={courts[m]}
                  onChange={(e) =>
                    setCourts((prev) => prev.map((c, i) => (i === m ? Number(e.target.value) : c)))
                  }
                  className="text-sm rounded border border-gray-300 py-1 px-2 text-gray-900"
                >
                  {openCourts.map((c) => (
                    <option key={c} value={c}>
                      สนาม {c}
                      {freeCourts.includes(c) ? " (ว่าง)" : " (ต่อคิว)"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => book(m)}
                  disabled={loading === m || openCourts.length === 0}
                  className="rounded-md bg-brand-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading === m ? "กำลังจอง…" : "จองลงสนาม"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
