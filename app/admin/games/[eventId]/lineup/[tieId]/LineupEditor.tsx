"use client";

import { useState } from "react";
import type { GamesState, TieView } from "@/lib/games/state";
import { useGamesState } from "@/app/games/useGamesState";
import { adminApi } from "../../../api";

type Side = "A" | "B";
type Pair = [string, string];

const pairsOf = (tie: TieView, side: Side): Pair[] =>
  tie.rubbers.map((r) => {
    const p = side === "A" ? r.a : r.b;
    return [p[0]?.id ?? "", p[1]?.id ?? ""];
  });

/** Pairs 1–5 laid out like the captain's paper slip; names come from the team's roster. */
export default function LineupEditor({ initial, tieId, initialSide }: { initial: GamesState; tieId: string; initialSide: Side }) {
  const { state, refresh } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 10000 });
  const tie = state.ties.find((t) => t.id === tieId)!;
  const [side, setSide] = useState<Side>(initialSide);
  const [drafts, setDrafts] = useState<Record<Side, Pair[]>>(() => {
    const t = initial.ties.find((x) => x.id === tieId)!;
    return { A: pairsOf(t, "A"), B: pairsOf(t, "B") };
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const teamId = side === "A" ? tie.teamAId : tie.teamBId;
  const team = state.teams.find((t) => t.id === teamId);
  const pairs = drafts[side];
  const used = new Set(pairs.flat().filter(Boolean));
  const left = team?.members.filter((m) => !used.has(m.id)) ?? [];
  const filledPairs = pairs.filter(([x, y]) => x && y).length;

  const set = (i: number, j: 0 | 1, id: string) =>
    setDrafts((d) => ({
      ...d,
      [side]: d[side].map((p, pi) => (pi === i ? ((j === 0 ? [id, p[1]] : [p[0], id]) as Pair) : p)),
    }));

  async function save() {
    const res = await adminApi(`/api/admin/games/ties/${tie.id}/lineup`, "PUT", {
      side,
      pairs: pairs.map(([x, y]) => [x || null, y || null]),
    });
    setMsg(res.ok ? { ok: true, text: `บันทึกใบส่งตัว ${team?.name ?? ""} แล้ว` } : { ok: false, text: res.error });
    await refresh();
  }

  const status = (s: Side) => {
    const n = pairsOf(tie, s).filter(([x, y]) => x && y).length;
    return n === 5 ? ["ส่งแล้ว", "#15803d"] : n === 0 ? ["ยังไม่ส่ง", "#b42318"] : [`${n}/5 คู่`, "#8a5a00"];
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">คีย์ใบส่งตัว</h1>
        <p className="text-sm text-gray-600">
          {tie.label} · สนาม {tie.courtA}–{tie.courtB} · {tie.startsAt}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as Side[]).map((s) => {
          const t = state.teams.find((x) => x.id === (s === "A" ? tie.teamAId : tie.teamBId));
          const [text, color] = status(s);
          const on = s === side;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2"
              style={{ borderColor: on ? t?.color ?? "#1d4d73" : "#dbe6f0", background: on ? "#f8fafc" : "#ffffff" }}
            >
              <span className="rounded-md px-3 text-sm font-bold" style={{ background: t?.color ?? "#e5e7eb", color: t?.textColor ?? "#475569" }}>
                {t?.name ?? "ยังไม่รู้ทีม"}
              </span>
              <span className="text-[11px] font-semibold" style={{ color }}>{text}</span>
            </button>
          );
        })}
      </div>

      {!team ? (
        <p className="text-sm text-gray-500">ยังไม่รู้ว่าฝั่งนี้คือทีมไหน (รอผลรอบก่อนหน้า)</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">เรียงตามกระดาษของกัปตัน คู่ 1 อยู่บนสุด · คนที่ใส่แล้วไม่ขึ้นในช่องอื่น</p>
          <div className="flex flex-col rounded-xl border border-gray-200">
            {pairs.map((p, i) => (
              <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 border-t border-gray-100 px-2.5 py-2 first:border-t-0">
                <span className="text-sm font-bold">คู่ {i + 1}</span>
                {([0, 1] as const).map((j) => (
                  <select
                    key={j}
                    aria-label={`คู่ ${i + 1} คนที่ ${j + 1}`}
                    value={p[j]}
                    onChange={(e) => set(i, j, e.target.value)}
                    className="min-h-11 min-w-0 rounded-lg border bg-white px-2 text-[15px]"
                    style={{ borderColor: p[j] ? "#b3cbe0" : "#fb923c", color: p[j] ? "#0b1c30" : "#8a9db3" }}
                  >
                    <option value="">เลือกผู้เล่น</option>
                    {team.members
                      .filter((m) => m.id === p[j] || !used.has(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-500">ยังไม่ได้ใส่ ({left.length} คน)</span>
            <div className="flex flex-wrap gap-1.5">
              {left.map((m) => (
                <span key={m.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={save} className="min-h-12 rounded-xl bg-brand-600 text-[15px] font-semibold text-white">
            บันทึกใบส่งตัว {team.name}
          </button>
          <p className="text-xs text-gray-500">
            ใส่แล้ว {filledPairs} / 5 คู่ · บันทึกได้แม้ยังไม่ครบ · แก้ได้ตลอด ชื่อขึ้นหน้าผู้เล่นทันที
          </p>
        </>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </>
  );
}
