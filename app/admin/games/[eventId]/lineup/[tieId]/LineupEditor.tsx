"use client";

import { useState } from "react";
import type { GamesState, TieView } from "@/lib/games/state";
import { CARD_KINDS, CARD_LABELS, type CardKind } from "@/lib/games/cards";
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
          {tie.stage === "QUALIFIER" && (
            <CardPicker
              key={side}
              state={state}
              tie={tie}
              side={side}
              teamName={team.name}
              onSwapped={(x, y) =>
                // The server swapped the saved pairs; mirror it here so a later save keeps the swap.
                setDrafts((d) => ({
                  ...d,
                  [side]: d[side].map((p, i) => (i === x - 1 ? d[side][y - 1] : i === y - 1 ? d[side][x - 1] : p)),
                }))
              }
              refresh={refresh}
            />
          )}
        </>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </>
  );
}

/**
 * The side's SECRET CARD for this tie: the one in play (with "ลบการ์ด"), or a pick
 * of the cards the team still has plus the pair(s) it goes on.
 */
function CardPicker({
  state,
  tie,
  side,
  teamName,
  onSwapped,
  refresh,
}: {
  state: GamesState;
  tie: TieView;
  side: Side;
  teamName: string;
  onSwapped: (x: number, y: number) => void;
  refresh: () => Promise<void>;
}) {
  const teamId = side === "A" ? tie.teamAId : tie.teamBId;
  const current = tie.cards.find((c) => c.side === side);
  // Cards this team already played in other rounds (admins see every card).
  const usedIn = new Map<CardKind, string>();
  for (const t of state.ties) {
    if (t.id === tie.id) continue;
    for (const c of t.cards) if ((c.side === "A" ? t.teamAId : t.teamBId) === teamId) usedIn.set(c.kind, `รอบ ${t.round}`);
  }
  const [kind, setKind] = useState<CardKind | null>(null);
  const [order, setOrder] = useState(1);
  const [swapWith, setSwapWith] = useState(2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const url = `/api/admin/games/ties/${tie.id}/card`;

  async function play() {
    if (!kind) return;
    setBusy(true);
    const res = await adminApi(url, "PUT", { side, kind, order, swapWith: kind === "SUBSTITUTION" ? swapWith : null });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    if (kind === "SUBSTITUTION") onSwapped(order, swapWith);
    setMsg({ ok: true, text: kind === "SUBSTITUTION" ? `ใช้การ์ดแล้ว · สลับคู่ ${order} กับคู่ ${swapWith} แล้ว` : "ใช้การ์ดแล้ว" });
    setKind(null);
    await refresh();
  }

  async function remove() {
    if (!current) return;
    setBusy(true);
    const res = await adminApi(url, "DELETE", { side });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    if (current.kind === "SUBSTITUTION" && current.swapWith != null) onSwapped(current.order, current.swapWith);
    setMsg({ ok: true, text: current.kind === "SUBSTITUTION" ? "ลบการ์ดแล้ว · สลับคู่กลับที่เดิมแล้ว" : "ลบการ์ดแล้ว" });
    await refresh();
  }

  const pairSelect = (value: number, onChange: (n: number) => void, label: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="min-h-10 rounded-lg border border-gray-300 bg-white px-2"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          คู่ {n}
        </option>
      ))}
    </select>
  );

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold">🃏 SECRET CARD · {teamName}</h2>
        <p className="text-xs text-gray-500">1 ใบต่อรอบ แต่ละใบใช้ได้ครั้งเดียว · ผู้เล่นเห็นการ์ดหลังคู่นั้นแข่งจบ</p>
      </div>

      {current ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">
            🃏 {CARD_LABELS[current.kind].name} ·{" "}
            {current.kind === "SUBSTITUTION" ? `สลับคู่ ${current.order} ↔ คู่ ${current.swapWith}` : `คู่ ${current.order}`}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="ml-auto min-h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            ลบการ์ด
          </button>
          {current.kind === "SUBSTITUTION" && <p className="w-full text-xs text-gray-500">ลบการ์ดนี้ = สลับคู่กลับที่เดิม</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {CARD_KINDS.map((k) => {
              const used = usedIn.get(k);
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!used}
                  onClick={() => setKind(on ? null : k)}
                  className="flex min-h-14 flex-col items-center justify-center rounded-lg border-2 px-1 text-xs font-bold disabled:opacity-40"
                  style={{ borderColor: on ? "#1d4d73" : "#dbe6f0", background: on ? "#eef3f8" : "#ffffff" }}
                >
                  {CARD_LABELS[k].name}
                  <span className="font-normal text-gray-500">{used ? `ใช้แล้ว ${used}` : CARD_LABELS[k].th}</span>
                </button>
              );
            })}
          </div>
          {kind && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {kind === "SUBSTITUTION" ? "สลับ" : "ใช้กับ"}
              {pairSelect(order, setOrder, "คู่ที่ใช้การ์ด")}
              {kind === "SUBSTITUTION" && (
                <>
                  กับ
                  {pairSelect(swapWith, setSwapWith, "คู่ที่สลับด้วย")}
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={play}
                className="ml-auto min-h-10 rounded-lg bg-brand-600 px-4 font-semibold text-white disabled:opacity-50"
              >
                ใช้การ์ด
              </button>
            </div>
          )}
        </>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </section>
  );
}
