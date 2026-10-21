"use client";

import Link from "next/link";
import { useState } from "react";
import type { GamesState, PlayerRef, RubberView, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute, knockoutPlaceholder, resultText, setsLine } from "@/lib/games/format";
import { useGamesState } from "@/app/games/useGamesState";
import { adminApi } from "../api";
import { Chip, LineupStatus } from "./LineupBits";

type Tab = number | "KO";

/** Round-by-round control: lineup status per team and result entry per rubber. */
export default function RoundBoard({ initial }: { initial: GamesState }) {
  const { state, refresh } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 3000 });
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const [tab, setTab] = useState<Tab>(() => {
    const first = initial.ties.find((t) => t.status !== "done");
    return !first ? "KO" : first.stage === "QUALIFIER" ? first.round! : "KO";
  });

  const shown = state.ties.filter((t) => (tab === "KO" ? t.stage !== "QUALIFIER" : t.round === tab));
  const nextRound = typeof tab === "number" && tab < 5 ? state.ties.filter((t) => t.round === tab + 1) : [];
  const id = state.event.id;

  return (
    <>
      <h1 className="text-2xl font-bold">คุมรอบ · กรอกผล</h1>
      {!state.event.published && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">ผู้เล่นยังเห็น &quot;Coming soon&quot; · เปิดได้ที่หน้าตั้งค่างาน</p>
      )}

      <div className="flex gap-1.5 overflow-x-auto">
        {([1, 2, 3, 4, 5, "KO"] as Tab[]).map((t) => {
          const on = t === tab;
          const ties = state.ties.filter((x) => (t === "KO" ? x.stage !== "QUALIFIER" : x.round === t));
          const done = ties.length > 0 && ties.every((x) => x.status === "done");
          return (
            <button
              key={String(t)}
              type="button"
              onClick={() => setTab(t)}
              className="min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold"
              style={{
                background: on ? "#1d4d73" : "#ffffff",
                color: on ? "#ffffff" : done ? "#8a9db3" : "#1d4d73",
                borderColor: on ? "#1d4d73" : "#b3cbe0",
              }}
            >
              {t === "KO" ? "น็อกเอาต์" : `รอบ ${t}`}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-600">
        กรอกแต้มแต่ละเซตจากใบผลที่ผู้เล่นส่งมาที่โต๊ะ แล้วกดบันทึก ·{" "}
        {tab === "KO" ? "ชนะ 2 ใน 3 เซต · ทีมแรกที่ได้ 3 คู่ชนะแมตซ์" : "ชนะ 2–0 เซต = ชนะคู่ · 1–1 = เสมอ"}
      </p>

      {shown.map((tie) => (
        <TieCard key={tie.id} eventId={id} tie={tie} teams={teams} onSaved={refresh} />
      ))}

      {nextRound.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-dashed border-brand-300 p-3">
          <h2 className="text-sm font-bold">
            รอบถัดไป · รอบที่ {nextRound[0].round} · {nextRound[0].startsAt} · ใบส่งตัว
          </h2>
          {nextRound.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <Chip team={teams.get(t.teamAId ?? "")} />
              <LineupStatus tie={t} side="a" />
              <span className="text-gray-500">vs</span>
              <Chip team={teams.get(t.teamBId ?? "")} />
              <LineupStatus tie={t} side="b" />
              <Link
                href={`/admin/games/${id}/lineup/${t.id}`}
                className="ml-auto flex min-h-10 items-center rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                คีย์ใบส่งตัว
              </Link>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function TieCard({ eventId, tie, teams, onSaved }: { eventId: string; tie: TieView; teams: Map<string, TeamView>; onSaved: () => Promise<void> }) {
  const a = teams.get(tie.teamAId ?? "");
  const b = teams.get(tie.teamBId ?? "");
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip team={a} />
        <span className="text-xs text-gray-500">vs</span>
        <Chip team={b} />
        <span className="ml-auto text-xs text-gray-600">
          {tie.label} · สนาม {tie.courtA}–{tie.courtB} · {tie.startsAt} · <b className="text-[15px] text-gray-900">{tie.pointsA}–{tie.pointsB}</b>
        </span>
      </div>
      {(!a || !b) && <p className="text-sm text-gray-500">{knockoutPlaceholder(tie.stage, tie.slot)} · รู้ทีมเมื่อรอบก่อนหน้าจบ</p>}
      {tie.projected && a && b && <p className="text-xs text-amber-800">คู่นี้ตามอันดับตอนนี้ · เปลี่ยนได้จนรอบคัดเลือกจบ</p>}
      {tie.lineupMismatch && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">ใบส่งตัวไม่ตรงทีม (คู่แข่งเปลี่ยนตามอันดับ) · กดแก้ใบส่งตัว</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
        ใบส่งตัว
        <span className="flex items-center gap-1">{a?.name ?? "ทีม A"} <LineupStatus tie={tie} side="a" /></span>
        <span className="flex items-center gap-1">{b?.name ?? "ทีม B"} <LineupStatus tie={tie} side="b" /></span>
        <Link
          href={`/admin/games/${eventId}/lineup/${tie.id}`}
          className="ml-auto flex min-h-10 items-center rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          แก้ใบส่งตัว
        </Link>
      </div>
      <div className="flex flex-col border-t border-gray-100">
        {tie.rubbers.map((r) => (
          <RubberRow key={r.id} eventId={eventId} tie={tie} rubber={r} a={a} b={b} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}

const STATUS: Record<RubberView["status"], [string, string, string]> = {
  done: ["จบ", "#e3ecf5", "#16395a"],
  live: ["รอผล", "#ffe9db", "#9a3412"],
  next: ["ถัดไป", "#eef1f5", "#475569"],
  upcoming: ["ยังไม่ลง", "#eef1f5", "#475569"],
  cancelled: ["ไม่ต้องแข่ง", "#eef1f5", "#8a9db3"],
};

function RubberRow({
  eventId,
  tie,
  rubber,
  a,
  b,
  onSaved,
}: {
  eventId: string;
  tie: TieView;
  rubber: RubberView;
  a?: TeamView;
  b?: TeamView;
  onSaved: () => Promise<void>;
}) {
  const ko = tie.stage !== "QUALIFIER";
  const setCount = ko ? 3 : 2;
  const blank = () => Array.from({ length: setCount }, (_, i) => rubber.sets[i]?.map(String) ?? ["", ""]);
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<string[][]>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const open = !rubber.finished || editing;
  const [label, bg, fg] = STATUS[rubber.status];
  const counting = rubber.liveSet != null && !rubber.finished;

  async function patch(body: object, okText: string) {
    setBusy(true);
    const res = await adminApi<{ warnings?: string[] }>(`/api/admin/games/rubbers/${rubber.id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    const warn = res.data.warnings?.length ? ` · ${res.data.warnings.join(" · ")}` : "";
    setMsg({ ok: !warn, text: okText + warn });
    setEditing(false);
    await onSaved();
  }

  function saveResult() {
    const sets = vals
      .filter(([x, y]) => x.trim() !== "" || y.trim() !== "")
      .map(([x, y]) => [Number(x), Number(y)]);
    void patch({ sets, finish: true }, `บันทึกผลคู่ ${rubber.order} แล้ว`);
  }

  // Back to "no result": scores, finished mark and any live count all cleared.
  const hasResult = rubber.finished || rubber.sets.length > 0 || rubber.liveSet != null;
  function clearResult() {
    setVals(Array.from({ length: setCount }, () => ["", ""]));
    void patch({ sets: [], finish: false, liveSet: null, liveStartedAt: null }, `ลบผลคู่ ${rubber.order} แล้ว`);
  }

  const setVal = (i: number, j: number, v: string) =>
    setVals((cur) => cur.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? v.replace(/[^0-9]/g, "") : c)) : row)));

  return (
    <div className="flex flex-col gap-1.5 border-b border-gray-100 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        <b className="text-[13px]">คู่ {rubber.order}</b>
        <select
          aria-label={`สนามของคู่ ${rubber.order}`}
          value={rubber.court}
          onChange={(e) => patch({ court: Number(e.target.value) }, "ย้ายสนามแล้ว")}
          className="rounded border border-gray-200 bg-white px-1 py-0.5 text-gray-600"
        >
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <option key={c} value={c}>
              ส.{c}
            </option>
          ))}
        </select>
        <span className="rounded-full px-2 py-[1px] font-semibold" style={{ background: bg, color: fg }}>
          {counting ? "นับสด" : label}
        </span>
        <span className="text-gray-400">{fmtMinute(rubber.startMinute)}</span>
      </div>

      {/* Who plays — each side's names over its own score boxes. */}
      <div className="grid grid-cols-[44px_minmax(0,1fr)_14px_minmax(0,1fr)] items-start gap-1.5">
        <span className="pt-1.5 text-xs text-gray-500">ผู้เล่น</span>
        <PairNamesCell players={rubber.a} team={a} />
        <span className="pt-1.5 text-center text-xs text-gray-400">vs</span>
        <PairNamesCell players={rubber.b} team={b} />
      </div>

      {rubber.status === "cancelled" && !editing ? (
        <span className="text-xs text-gray-400">แมตซ์ตัดสินแล้ว คู่นี้ไม่ต้องแข่ง</span>
      ) : open ? (
        <>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_14px_minmax(0,1fr)] items-center gap-1.5">
            {vals.map((row, i) => (
              <SetInputs key={i} i={i} row={row} a={a} b={b} order={rubber.order} onChange={setVal} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={saveResult}
              className="min-h-[42px] flex-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              บันทึกผลคู่ {rubber.order}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-3 text-sm">
                ยกเลิก
              </button>
            )}
            {!rubber.finished && (
              <Link
                href={`/admin/games/${eventId}/live/${rubber.id}`}
                className="flex min-h-[42px] items-center rounded-lg border border-orange-300 px-3 text-sm font-semibold text-orange-700"
              >
                นับสด
              </Link>
            )}
            {hasResult && <ClearResult order={rubber.order} busy={busy} onClear={clearResult} />}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold tabular-nums">{setsLine(rubber.sets)}</span>
          <span className="text-xs font-semibold text-green-700">{resultText(tie.stage, rubber.outcome, a?.name ?? "ทีม A", b?.name ?? "ทีม B")}</span>
          <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setVals(blank());
                setEditing(true);
              }}
              className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-brand-700"
            >
              แก้
            </button>
            <ClearResult order={rubber.order} busy={busy} onClear={clearResult} />
          </span>
        </div>
      )}
      {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}

/** A pair's names one per line under a bar in the team colour; a hint until the lineup is keyed. */
function PairNamesCell({ players, team }: { players: (PlayerRef | null)[]; team?: TeamView }) {
  const names = players.filter((p): p is PlayerRef => p != null).map((p) => p.name);
  return (
    <span
      className="flex min-w-0 flex-col items-center border-t-4 pt-1 text-center text-sm font-semibold leading-snug text-gray-900"
      style={{ borderColor: team?.color ?? "#dbe6f0" }}
    >
      {names.length ? (
        names.map((n, i) => (
          <span key={i} className="max-w-full truncate">
            {n}
          </span>
        ))
      ) : (
        <span className="text-xs font-normal text-gray-400">ยังไม่ส่งชื่อ</span>
      )}
    </span>
  );
}

/** "ลบผล" asks once inline, so a slip of the finger can't wipe a result. */
function ClearResult({ order, busy, onClear }: { order: number; busy: boolean; onClear: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setAsking(true)}
        className="min-h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
      >
        ลบผล
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-red-700">ลบผลคู่ {order}?</span>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          onClear();
        }}
        className="min-h-10 rounded-lg bg-red-600 px-4 font-semibold text-white"
      >
        ลบเลย
      </button>
      <button type="button" onClick={() => setAsking(false)} className="min-h-10 rounded-lg border px-4">
        ยกเลิก
      </button>
    </span>
  );
}

function SetInputs({
  i,
  row,
  a,
  b,
  order,
  onChange,
}: {
  i: number;
  row: string[];
  a?: TeamView;
  b?: TeamView;
  order: number;
  onChange: (i: number, j: number, v: string) => void;
}) {
  const box = "min-h-10 min-w-0 rounded-lg border-2 text-center text-[17px] font-bold";
  return (
    <>
      <span className="text-xs text-gray-500">เซต {i + 1}</span>
      <input
        inputMode="numeric"
        aria-label={`คู่ ${order} เซต ${i + 1} แต้ม ${a?.name ?? "ทีม A"}`}
        placeholder={a?.name ?? "A"}
        value={row[0]}
        onChange={(e) => onChange(i, 0, e.target.value)}
        className={box}
        style={{ borderColor: a?.color ?? "#b3cbe0" }}
      />
      <span className="text-center text-gray-400">–</span>
      <input
        inputMode="numeric"
        aria-label={`คู่ ${order} เซต ${i + 1} แต้ม ${b?.name ?? "ทีม B"}`}
        placeholder={b?.name ?? "B"}
        value={row[1]}
        onChange={(e) => onChange(i, 1, e.target.value)}
        className={box}
        style={{ borderColor: b?.color ?? "#b3cbe0" }}
      />
    </>
  );
}
