"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GamesState } from "@/lib/games/state";
import type { SetScore, Side } from "@/lib/games/types";
import { applyTap, closeSet } from "@/lib/games/live";
import { isKnockout, rubberOutcome, setsWon } from "@/lib/games/rules";
import { pairName, setsLine, setsResultText } from "@/lib/games/format";
import { useGamesState } from "@/app/games/useGamesState";
import { PairAvatars } from "@/app/games/ui";
import { adminApi } from "../../../api";

interface Snapshot {
  sets: SetScore[];
  liveSet: number;
  last: Side;
}

export default function LiveScorer({ initial, rubberId }: { initial: GamesState; rubberId: string }) {
  const router = useRouter();
  const { state, refresh } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 5000 });
  const tie = state.ties.find((t) => t.rubbers.some((r) => r.id === rubberId))!;
  const rubber = tie.rubbers.find((r) => r.id === rubberId)!;
  const a = state.teams.find((t) => t.id === tie.teamAId);
  const b = state.teams.find((t) => t.id === tie.teamBId);
  const ko = isKnockout(tie.stage);
  const eventId = state.event.id;

  const start = initial.ties.flatMap((t) => t.rubbers).find((r) => r.id === rubberId)!;
  const [sets, setSets] = useState<SetScore[]>(start.sets.length ? start.sets : [[0, 0]]);
  const [liveSet, setLiveSet] = useState(start.liveSet ?? Math.max(1, start.sets.length));
  const [last, setLast] = useState<Side>("A");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [over, setOver] = useState(() => ko && rubberOutcome(tie.stage, start.sets, true) != null);
  const [mode, setMode] = useState<"count" | "summary" | "saved">(start.finished ? "saved" : "count");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Last write wins: only the newest score is sent; a failed send is retried on the next tap.
  const pending = useRef<object | null>(null);
  const inflight = useRef(false);
  async function send(payload: object) {
    pending.current = payload;
    if (inflight.current) return;
    inflight.current = true;
    setSyncing(true);
    while (pending.current) {
      const body = pending.current;
      pending.current = null;
      const res = await adminApi(`/api/admin/games/rubbers/${rubberId}`, "PATCH", body);
      if (!res.ok) {
        setError(`${res.error} · แต้มยังไม่ส่ง`);
        if (!pending.current) pending.current = body;
        break;
      }
      setError(null);
    }
    inflight.current = false;
    setSyncing(false);
  }

  function tap(side: Side, delta: 1 | -1) {
    if (over || mode !== "count") return;
    const next = applyTap(tie.stage, sets, liveSet, side, delta);
    setHistory((h) => [...h, { sets, liveSet, last }]);
    setSets(next.sets);
    setLiveSet(next.liveSet);
    setOver(next.rubberOver);
    if (delta === 1) setLast(side);
    void send({ sets: next.sets, liveSet: next.liveSet });
  }

  function endSet() {
    const next = closeSet(sets, liveSet);
    setHistory((h) => [...h, { sets, liveSet, last }]);
    setSets(next.sets);
    setLiveSet(next.liveSet);
    setOver(next.rubberOver);
    void send({ sets: next.sets, liveSet: next.liveSet });
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setSets(prev.sets);
    setLiveSet(prev.liveSet);
    setLast(prev.last);
    setOver(false);
    void send({ sets: prev.sets, liveSet: prev.liveSet });
  }

  async function saveResult(final: SetScore[]) {
    const res = await adminApi<{ warnings?: string[] }>(`/api/admin/games/rubbers/${rubberId}`, "PATCH", { sets: final, finish: true });
    if (!res.ok) return setError(res.error);
    setSets(final);
    setError(res.data.warnings?.length ? res.data.warnings.join(" · ") : null);
    setMode("saved");
    await refresh();
  }

  const cur = sets[liveSet - 1] ?? [0, 0];
  const [wa, wb] = setsWon(sets.slice(0, over ? sets.length : liveSet - 1));
  // No counting or result until both teams' lineups name this pair (the server refuses too).
  const blocked = !(rubber.a.every(Boolean) && rubber.b.every(Boolean)) && mode !== "saved";
  const resultLine = setsResultText(sets, rubberOutcome(tie.stage, sets, true), a?.name ?? "", b?.name ?? "");

  // After saving, the court's next rubber (derived from the fresh snapshot).
  const courtNow = state.courts.find((c) => c.court === rubber.court);
  const nextId = courtNow?.nowRubberId && courtNow.nowRubberId !== rubberId ? courtNow.nowRubberId : null;
  const others = state.ties.flatMap((t) =>
    t.rubbers.filter((r) => !r.finished && r.status !== "cancelled").map((r) => ({ id: r.id, label: `${t.stage === "QUALIFIER" ? `รอบ ${t.round} แมตซ์ ${t.slot}` : t.label} · คู่ ${r.order} · ส.${r.court}` }))
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1c30] font-[family-name:var(--font-pixel-body)] text-[#f2f5fa]">
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-2.5">
        <Link href={`/admin/games/${eventId}`} className="flex min-h-10 items-center px-1.5 text-sm font-semibold">
          ‹ ออก
        </Link>
        <select
          aria-label="สนาม"
          value={rubber.court}
          onChange={(e) => {
            const c = state.courts.find((x) => x.court === Number(e.target.value));
            if (c?.nowRubberId) router.push(`/admin/games/${eventId}/live/${c.nowRubberId}`);
          }}
          className="min-h-10 rounded-full border border-[#4f83ac] bg-[#102843] px-3 text-sm font-bold"
        >
          {state.courts.map((c) => (
            <option key={c.court} value={c.court}>
              สนาม {c.court}
            </option>
          ))}
        </select>
        <span className="hidden truncate text-[13px] text-[#a9bdd3] sm:inline">
          นับสด · {tie.label} · คู่ {rubber.order}
        </span>
        <span className="ml-auto" />
        <select
          aria-label="เปลี่ยนคู่"
          value=""
          onChange={(e) => e.target.value && router.push(`/admin/games/${eventId}/live/${e.target.value}`)}
          className="min-h-10 max-w-[130px] rounded-full border border-[#4f83ac] bg-transparent px-3 text-[13px] font-semibold"
        >
          <option value="">เปลี่ยนคู่</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setMode("summary")} className="min-h-10 rounded-full border border-[#4f83ac] px-3 text-[13px] font-semibold">
          กรอกผลสรุป
        </button>
        <button type="button" onClick={undo} disabled={!history.length} className="min-h-10 rounded-full border border-[#4f83ac] px-3 text-[13px] font-semibold disabled:opacity-40">
          ย้อนแต้ม
        </button>
      </div>

      {error && <p className="bg-red-900/60 px-3 py-1 text-center text-sm">{error}</p>}

      {blocked && (
        <Center>
          <span className="text-2xl font-bold">ยังไม่ได้คีย์ใบส่งตัวคู่นี้ครบ</span>
          <span className="text-[#a9bdd3]">นับสดและกรอกคะแนนได้หลังคีย์ชื่อทั้ง 2 ทีม</span>
          <Link
            href={`/admin/games/${eventId}/lineup/${tie.id}?side=${rubber.a.every(Boolean) ? "B" : "A"}`}
            className="flex min-h-12 items-center rounded-xl bg-[#ffcf4d] px-5 font-bold text-[#0b1c30]"
          >
            คีย์ใบส่งตัว
          </Link>
        </Center>
      )}

      {!blocked && mode === "count" && !over && (
        <>
          <div className="flex h-[46px] shrink-0 items-center gap-3 bg-[#102843] px-3.5">
            <span className="font-bold">เซต {liveSet}</span>
            {sets.slice(0, liveSet - 1).map((s, i) => (
              <span key={i} className="rounded-full border border-[#2f6690] bg-[#0b1c30] px-2.5 text-[13px] tabular-nums">
                เซต {i + 1}: {s[0]}–{s[1]}
              </span>
            ))}
            {!ko && (
              <button type="button" onClick={endSet} className="min-h-8 rounded-full bg-[#1d4d73] px-3 text-[13px] font-semibold">
                จบเซต {liveSet}
              </button>
            )}
            <span className="ml-auto text-xs text-[#a9bdd3]">{syncing ? "กำลังส่ง…" : "ส่งแล้ว"}</span>
            <Clock minutes={ko ? state.event.knockoutMinutes : state.event.qualifierMinutes} startedAt={rubber.liveStartedAt} rubberId={rubberId} onChange={refresh} />
          </div>
          <div className="grid flex-1 grid-cols-2">
            <Half team={a} players={rubber.a} order={rubber.order} score={cur[0]} setsWon={wa} serving={last === "A"} onPlus={() => tap("A", 1)} onMinus={() => tap("A", -1)} minusSide="left" />
            <Half team={b} players={rubber.b} order={rubber.order} score={cur[1]} setsWon={wb} serving={last === "B"} onPlus={() => tap("B", 1)} onMinus={() => tap("B", -1)} minusSide="right" />
          </div>
        </>
      )}

      {!blocked && mode === "count" && over && (
        <Center>
          <span className="text-[17px] text-[#a9bdd3]">จบคู่แล้ว · {setsLine(sets)}</span>
          <span className="text-4xl font-bold text-[#ffcf4d]">{resultLine}</span>
          <span className="text-sm text-[#c3cedd]">{ko ? "ทีมที่ชนะคู่นี้ได้ 1 คะแนน · ทีมแรกที่ได้ 3 คะแนนชนะแมตซ์" : "ชนะ 2 คะแนน · เสมอ 1"}</span>
          <div className="flex gap-3">
            <button type="button" onClick={() => setMode("summary")} className="min-h-[50px] rounded-xl border border-[#4f83ac] px-5 font-semibold">
              แก้ผลก่อน
            </button>
            <button type="button" onClick={() => saveResult(sets)} className="min-h-[50px] rounded-xl bg-[#ffcf4d] px-5 font-bold text-[#0b1c30]">
              บันทึกผล
            </button>
          </div>
        </Center>
      )}

      {!blocked && mode === "summary" && (
        <Summary
          ko={ko}
          initial={sets}
          aName={a?.name ?? "ทีม A"}
          bName={b?.name ?? "ทีม B"}
          onCancel={() => setMode("count")}
          onSave={saveResult}
        />
      )}

      {mode === "saved" && (
        <Center>
          <span className="text-2xl font-bold">บันทึกแล้ว · {resultLine || setsLine(sets)}</span>
          {nextId ? (
            <>
              <span className="text-[#a9bdd3]">ถัดไปบนสนาม {rubber.court}: {describe(state, nextId)}</span>
              <div className="flex gap-3">
                <Link href={`/admin/games/${eventId}`} className="flex min-h-12 items-center rounded-xl border border-[#4f83ac] px-5 font-semibold">
                  กลับหน้าคุมรอบ
                </Link>
                <Link href={`/admin/games/${eventId}/live/${nextId}`} className="flex min-h-12 items-center rounded-xl bg-[#ffcf4d] px-5 font-bold text-[#0b1c30]">
                  เริ่มคู่ถัดไป
                </Link>
              </div>
            </>
          ) : (
            <Link href={`/admin/games/${eventId}`} className="flex min-h-12 items-center rounded-xl border border-[#4f83ac] px-5 font-semibold">
              กลับหน้าคุมรอบ
            </Link>
          )}
        </Center>
      )}
    </div>
  );
}

function describe(state: GamesState, rubberId: string): string {
  const tie = state.ties.find((t) => t.rubbers.some((r) => r.id === rubberId))!;
  const r = tie.rubbers.find((x) => x.id === rubberId)!;
  const a = state.teams.find((t) => t.id === tie.teamAId)?.name ?? "?";
  const b = state.teams.find((t) => t.id === tie.teamBId)?.name ?? "?";
  return `คู่ ${r.order} · ${a} vs ${b}`;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#102843] px-4 text-center">{children}</div>;
}

function Half({
  team,
  players,
  order,
  score,
  setsWon,
  serving,
  onPlus,
  onMinus,
  minusSide,
}: {
  team: GamesState["teams"][number] | undefined;
  players: GamesState["ties"][number]["rubbers"][number]["a"];
  order: number;
  score: number;
  setsWon: number;
  serving: boolean;
  onPlus: () => void;
  onMinus: () => void;
  minusSide: "left" | "right";
}) {
  const bg = team?.color ?? "#1d4d73";
  const fg = team?.textColor ?? "#ffffff";
  return (
    <div className="relative flex" style={{ background: bg, color: fg }}>
      <button type="button" onClick={onPlus} aria-label={`ให้แต้ม ${team?.name ?? ""}`} className="flex flex-1 select-none flex-col items-center justify-center gap-1">
        <span className="rounded-md bg-black/25 px-3 text-sm font-bold text-white">
          {team?.name ?? "ทีม"} · เซตที่ชนะ {setsWon}
        </span>
        <PairAvatars players={players} size={40} ring={bg} />
        <span className="text-lg font-bold">{pairName(players) ?? `คู่ ${order}`}</span>
        <span className="text-[min(28vw,30vh)] font-bold leading-none tabular-nums">{score}</span>
        <span className="text-xs opacity-80">{serving ? "ฝั่งนี้เสิร์ฟ · " : ""}แตะพื้นที่สี = +1</span>
      </button>
      <button
        type="button"
        onClick={onMinus}
        aria-label={`ลบ 1 แต้ม ${team?.name ?? ""}`}
        className={`absolute bottom-3 min-h-11 min-w-[60px] rounded-full border-2 border-white/75 bg-black/25 text-lg font-bold text-white ${minusSide === "left" ? "left-3" : "right-3"}`}
      >
        −1
      </button>
    </div>
  );
}

/** Informational countdown; start/reset only, it never ends the rubber. */
function Clock({ minutes, startedAt, rubberId, onChange }: { minutes: number; startedAt: string | null; rubberId: string; onChange: () => Promise<void> }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const total = minutes * 60;
  const left = startedAt && now ? Math.max(0, total - Math.floor((now - new Date(startedAt).getTime()) / 1000)) : total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  async function toggle() {
    await adminApi(`/api/admin/games/rubbers/${rubberId}`, "PATCH", { liveStartedAt: startedAt ? null : new Date().toISOString() });
    await onChange();
  }
  return (
    <>
      <span className="text-[22px] font-bold tabular-nums text-[#ffcf4d]">{left === 0 && startedAt ? "หมดเวลา" : `${mm}:${ss}`}</span>
      <button type="button" onClick={toggle} className="min-h-8 rounded-full bg-[#ffcf4d] px-3 text-[13px] font-bold text-[#0b1c30]">
        {startedAt ? "รีเซ็ตเวลา" : "เริ่มเวลา"}
      </button>
    </>
  );
}

function Summary({
  ko,
  initial,
  aName,
  bName,
  onCancel,
  onSave,
}: {
  ko: boolean;
  initial: SetScore[];
  aName: string;
  bName: string;
  onCancel: () => void;
  onSave: (sets: SetScore[]) => void;
}) {
  const count = ko ? 3 : 2;
  const [rows, setRows] = useState<string[][]>(() => Array.from({ length: count }, (_, i) => initial[i]?.map(String) ?? ["", ""]));
  const set = (i: number, j: number, v: string) =>
    setRows((r) => r.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? v.replace(/[^0-9]/g, "") : c)) : row)));
  const sets = rows.filter(([x, y]) => x !== "" && y !== "").map(([x, y]) => [Number(x), Number(y)] as SetScore);
  return (
    <Center>
      <span className="font-bold">กรอกผลสรุป{ko ? " · เซต 3 เว้นว่างได้ถ้าจบใน 2 เซต" : ""}</span>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-14 text-sm text-[#a9bdd3]">เซต {i + 1}</span>
          {[0, 1].map((j) => (
            <input
              key={j}
              inputMode="numeric"
              aria-label={`เซต ${i + 1} แต้ม ${j === 0 ? aName : bName}`}
              placeholder={j === 0 ? aName : bName}
              value={row[j]}
              onChange={(e) => set(i, j, e.target.value)}
              className="min-h-11 w-24 rounded-lg border-2 border-[#4f83ac] bg-[#0b1c30] text-center text-2xl font-bold"
            />
          ))}
        </div>
      ))}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-[#4f83ac] px-5 font-semibold">
          ยกเลิก
        </button>
        <button type="button" onClick={() => onSave(sets)} className="min-h-11 rounded-xl bg-[#ffcf4d] px-5 font-bold text-[#0b1c30]">
          บันทึกผลนี้
        </button>
      </div>
    </Center>
  );
}
