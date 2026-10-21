"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GamesState, RubberView, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute, setsLine } from "@/lib/games/format";
import { DARK, PairAvatars, PairNames, Pill, TeamChip, TieRow } from "../ui";

type Stage = "Q" | "KO";

/**
 * Match Running: a qualifier / knockout switch (opening on the stage in play),
 * then for that stage what is on court now, what is next, and what is done.
 */
export default function RunningTab({ state, teams }: { state: GamesState; teams: Map<string, TeamView> }) {
  const koStarted = state.ties.some((t) => t.stage !== "QUALIFIER" && t.status !== "upcoming");
  const [stage, setStage] = useState<Stage>(state.qualifierDone || koStarted ? "KO" : "Q");
  const inStage = (t: TieView) => (stage === "KO") === (t.stage !== "QUALIFIER");

  const rubbers = useMemo(() => {
    const m = new Map<string, { tie: TieView; rubber: RubberView }>();
    for (const tie of state.ties) for (const rubber of tie.rubbers) m.set(rubber.id, { tie, rubber });
    return m;
  }, [state.ties]);

  // Courts grouped by the tie currently on them, in court order — this stage only.
  const groups: { tie: TieView; courts: GamesState["courts"] }[] = [];
  for (const c of state.courts) {
    if (!c.nowRubberId) continue;
    const tie = rubbers.get(c.nowRubberId)!.tie;
    if (!inStage(tie)) continue;
    const g = groups.find((x) => x.tie.id === tie.id);
    if (g) g.courts.push(c);
    else groups.push({ tie, courts: [c] });
  }

  const ties = state.ties.filter(inStage);
  const onCourt = new Set(groups.map((g) => g.tie.id));
  const upcoming = ties.filter((t) => t.status === "upcoming" && !onCourt.has(t.id)).slice(0, stage === "Q" ? 3 : 5);
  const done = ties.filter((t) => t.status === "done").reverse();
  const firstKo = state.ties.find((t) => t.stage !== "QUALIFIER");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl border p-1" style={{ background: DARK.panel, borderColor: DARK.line }}>
        {(["Q", "KO"] as Stage[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className="min-h-10 rounded-lg text-sm font-bold"
            style={s === stage ? { background: DARK.gold, color: DARK.ground } : { color: DARK.muted }}
          >
            {s === "Q" ? "รอบคัดเลือก" : "รอบน็อกเอาต์"}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">บนสนาม</h2>
          <span className="text-[11px] text-[#a9bdd3]">ผลขึ้นเมื่อแอดมินกรอกจากใบผล</span>
        </div>
        {groups.length === 0 && (
          <p className="text-sm text-[#a9bdd3]">
            {stage === "KO" && !state.qualifierDone
              ? `เริ่มหลังจบรอบคัดเลือก${firstKo ? ` · นัดแรก ${firstKo.startsAt}` : ""}`
              : "ยังไม่มีคู่ลงสนาม"}
          </p>
        )}
        {groups.map(({ tie, courts }) => (
          <div key={tie.id} className="flex flex-col gap-1.5">
            <TieHeader eventId={state.event.id} tie={tie} teams={teams} />
            {courts.map((c) => {
              const { rubber } = rubbers.get(c.nowRubberId!)!;
              const next = c.nextRubberId ? rubbers.get(c.nextRubberId) : undefined;
              return (
                <CourtCard
                  key={c.court}
                  eventId={state.event.id}
                  court={c.court}
                  started={c.nowStarted}
                  tie={tie}
                  rubber={rubber}
                  teams={teams}
                  nextText={next ? nextText(next.tie, next.rubber, tie, teams) : null}
                />
              );
            })}
          </div>
        ))}
      </section>

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">ถัดไป</h2>
          {upcoming.map((t) => (
            <TieRow key={t.id} eventId={state.event.id} tie={t} teams={teams} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">จบแล้ว</h2>
          {done.map((t) => (
            <TieRow key={t.id} eventId={state.event.id} tie={t} teams={teams} />
          ))}
        </section>
      )}
    </div>
  );
}

function TieHeader({ eventId, tie, teams }: { eventId: string; tie: TieView; teams: Map<string, TeamView> }) {
  return (
    <Link href={`/games/${eventId}/tie/${tie.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-xs text-[#a9bdd3]">{tie.stage === "QUALIFIER" ? `แมตซ์ ${tie.matchNo}` : tie.label}</span>
      <span className="flex items-center gap-2.5">
        <TeamChip team={teams.get(tie.teamAId ?? "")} />
        <b className="text-lg tabular-nums">{tie.pointsA}–{tie.pointsB}</b>
        <TeamChip team={teams.get(tie.teamBId ?? "")} />
      </span>
      <span className="justify-self-end text-xs text-[#a9bdd3]">ดูแมตซ์ ›</span>
    </Link>
  );
}

function CourtCard({
  eventId,
  court,
  started,
  tie,
  rubber,
  teams,
  nextText,
}: {
  eventId: string;
  court: number;
  started: boolean;
  tie: TieView;
  rubber: RubberView;
  teams: Map<string, TeamView>;
  nextText: string | null;
}) {
  const a = teams.get(tie.teamAId ?? "");
  const b = teams.get(tie.teamBId ?? "");
  const counting = rubber.liveSet != null;
  return (
    <Link
      href={`/games/${eventId}/tie/${tie.id}`}
      className="flex flex-col gap-2 rounded-xl border p-2.5"
      style={{ background: DARK.panel, borderColor: DARK.line }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold">
          สนาม {court} <span className="font-medium text-[#a9bdd3]">· คู่ {rubber.order}</span>
        </span>
        {counting ? (
          <Pill bg={DARK.live} fg={DARK.ground}>นับสด</Pill>
        ) : started ? (
          <Pill bg={DARK.live} fg={DARK.ground}>กำลังแข่ง</Pill>
        ) : (
          <Pill bg="#1a2c42" fg="#82aacb">รอลง · {fmtMinute(rubber.startMinute)}</Pill>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-[26px] w-1 shrink-0 rounded-sm" style={{ background: a?.color ?? DARK.dim }} />
          <PairAvatars players={rubber.a} />
          <PairNames players={rubber.a} fallback={`คู่ ${rubber.order}`} className="text-xs font-semibold" />
        </span>
        {counting ? (
          <span className="flex flex-col items-center">
            <b className="text-lg tabular-nums" style={{ color: DARK.gold }}>{liveScore(rubber)}</b>
            {rubber.sets.length > 1 && <span className="text-[10px] text-[#a9bdd3]">{setsLine(rubber.sets.slice(0, -1))}</span>}
          </span>
        ) : (
          <span className="text-[13px] text-[#a9bdd3]">vs</span>
        )}
        <span className="flex min-w-0 items-center justify-end gap-1.5">
          <PairNames players={rubber.b} fallback={`คู่ ${rubber.order}`} align="right" className="text-xs font-semibold" />
          <PairAvatars players={rubber.b} />
          <span className="h-[26px] w-1 shrink-0 rounded-sm" style={{ background: b?.color ?? DARK.dim }} />
        </span>
      </div>
      {nextText && <span className="text-[11px] text-[#a9bdd3]">ถัดไปบนสนามนี้: {nextText}</span>}
    </Link>
  );
}

/** The set being counted live, e.g. "11–9". */
export function liveScore(rubber: RubberView): string {
  const cur = rubber.sets[(rubber.liveSet ?? 1) - 1];
  return cur ? `${cur[0]}–${cur[1]}` : "0–0";
}

function nextText(tie: TieView, rubber: RubberView, currentTie: TieView, teams: Map<string, TeamView>): string {
  const time = fmtMinute(rubber.startMinute);
  if (tie.id === currentTie.id) return `คู่ ${rubber.order} · ${time}`;
  const a = teams.get(tie.teamAId ?? "")?.name ?? "?";
  const b = teams.get(tie.teamBId ?? "")?.name ?? "?";
  return `${tie.stage === "QUALIFIER" ? `รอบ ${tie.round}` : tie.label} · ${a} vs ${b} · ${time}`;
}
