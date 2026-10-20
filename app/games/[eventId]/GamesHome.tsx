"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { GamesState, RubberView, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute, knockoutPlaceholder, setsLine } from "@/lib/games/format";
import { useGamesState } from "../useGamesState";
import { DARK, DarkPage, PairAvatars, PairNames, Pill, TeamChip } from "../ui";

/** The player page: who is on which court, the table, the schedule, the knockout. */
export default function GamesHome({ initial }: { initial: GamesState }) {
  const { state } = useGamesState(initial.event.id, initial);
  const teams = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const rubbers = useMemo(() => {
    const m = new Map<string, { tie: TieView; rubber: RubberView }>();
    for (const tie of state.ties) for (const rubber of tie.rubbers) m.set(rubber.id, { tie, rubber });
    return m;
  }, [state.ties]);

  // Courts grouped by the tie currently on them, in court order.
  const groups: { tie: TieView; courts: GamesState["courts"] }[] = [];
  for (const c of state.courts) {
    if (!c.nowRubberId) continue;
    const tie = rubbers.get(c.nowRubberId)!.tie;
    const g = groups.find((x) => x.tie.id === tie.id);
    if (g) g.courts.push(c);
    else groups.push({ tie, courts: [c] });
  }

  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const knockout = state.ties.filter((t) => t.stage !== "QUALIFIER");
  const rounds = [1, 2, 3, 4, 5].map((r) => qualifier.filter((t) => t.round === r));

  return (
    <DarkPage>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="self-start py-1 text-sm font-semibold text-[#a9bdd3] hover:text-white">
          ‹ หน้าแรก
        </Link>
        <h1 className="text-2xl font-bold tracking-wide">{state.event.name}</h1>
        <span className="flex items-center gap-2 text-[13px] text-[#a9bdd3]">
          <span className="h-2 w-2 rounded-full" style={{ background: DARK.live }} />
          {stageLine(state)}
        </span>
        {!state.event.published && <Pill bg={DARK.gold} fg={DARK.ground}>แอดมินดูก่อนเปิด · ผู้เล่นยังเห็น Coming soon</Pill>}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">สนาม</h2>
          <span className="text-[11px] text-[#a9bdd3]">ผลขึ้นเมื่อแอดมินกรอกจากใบผล</span>
        </div>
        {groups.length === 0 && <p className="text-sm text-[#a9bdd3]">ยังไม่มีคู่ลงสนาม</p>}
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

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">ตารางคะแนน</h2>
          <span className="text-[11px] text-[#a9bdd3]">ชนะ 2 · เสมอ 1 · แพ้ 0</span>
        </div>
        <div className="overflow-hidden rounded-xl border" style={{ background: DARK.panel, borderColor: DARK.line }}>
          <div className="grid grid-cols-[24px_minmax(0,1fr)_44px_64px_44px] gap-1.5 border-b px-2.5 py-2 text-[11px] text-[#a9bdd3]" style={{ borderColor: DARK.lineSoft }}>
            <span>#</span>
            <span>ทีม</span>
            <span className="text-right">คะแนน</span>
            <span className="text-center">ช-ส-พ</span>
            <span className="text-right">+/-</span>
          </div>
          {state.standings.map((row, i) => {
            const team = teams.get(row.teamId);
            const top = row.rank <= 4;
            return (
              <div
                key={row.teamId}
                className="grid grid-cols-[24px_minmax(0,1fr)_44px_64px_44px] items-center gap-1.5 px-2.5 py-2 tabular-nums"
                style={{ borderTop: i === 0 ? "none" : row.rank === 5 ? `2px dashed ${DARK.live}` : `1px solid ${DARK.lineSoft}` }}
              >
                <span className="text-sm font-bold" style={{ color: top ? DARK.gold : DARK.dim }}>{row.rank}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <TeamChip team={team} />
                  <span className="text-[10px]" style={{ color: top ? DARK.gold : DARK.dim }}>{top ? "รองฯ" : "ชิงที่ 5"}</span>
                </span>
                <span className="text-right text-base font-bold">{row.points}</span>
                <span className="text-center text-xs text-[#c3cedd]">{row.won}-{row.drawn}-{row.lost}</span>
                <span className="text-right text-xs text-[#c3cedd]">{row.diff > 0 ? `+${row.diff}` : row.diff}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-[#a9bdd3]">คะแนนเท่ากัน ดู คู่ที่ชนะ → ผลตอนเจอกัน → ผลต่างแต้ม</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold">ตารางแข่ง รอบคัดเลือก</h2>
        {rounds.map((ties, r) => (
          <div key={r} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold">
                รอบที่ {r + 1} <span className="font-medium text-[#a9bdd3]">· {ties[0]?.startsAt}</span>
              </span>
              <RoundStatus ties={ties} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ties.map((t) => (
                <Link
                  key={t.id}
                  href={`/games/${state.event.id}/tie/${t.id}`}
                  className="flex flex-col gap-1 rounded-lg border px-2 py-1.5 text-xs"
                  style={{ background: DARK.panel, borderColor: t.status === "live" ? DARK.live : DARK.line }}
                >
                  <ScheduleLine team={teams.get(t.teamAId ?? "")} points={t.status === "upcoming" ? null : t.pointsA} bold={t.status === "done" && t.pointsA > t.pointsB} />
                  <ScheduleLine team={teams.get(t.teamBId ?? "")} points={t.status === "upcoming" ? null : t.pointsB} bold={t.status === "done" && t.pointsB > t.pointsA} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">รอบน็อกเอาต์</h2>
          <span className="text-[11px] text-[#a9bdd3]">ชนะ 3 ใน 5 คู่ · 2 ใน 3 เซต</span>
        </div>
        {knockout.map((t) => {
          const a = teams.get(t.teamAId ?? "");
          const b = teams.get(t.teamBId ?? "");
          const final = t.stage === "FINAL";
          return (
            <Link
              key={t.id}
              href={`/games/${state.event.id}/tie/${t.id}`}
              className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2.5 rounded-xl border px-2.5 py-2"
              style={{ background: DARK.panel, borderColor: final ? DARK.gold : t.status === "live" ? DARK.live : DARK.line }}
            >
              <span className="text-[13px] font-bold tabular-nums text-[#a9bdd3]">{t.startsAt}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] font-bold" style={{ color: final ? DARK.gold : DARK.text }}>
                  {t.label} <span className="font-medium text-[#a9bdd3]">· สนาม {t.courtA}–{t.courtB}</span>
                </span>
                {a && b ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-[#c3cedd]">
                    <TeamChip team={a} />
                    {t.status === "upcoming" ? "vs" : <b className="tabular-nums text-white">{t.pointsA}–{t.pointsB}</b>}
                    <TeamChip team={b} />
                    {t.projected && <span>(ตามอันดับตอนนี้)</span>}
                  </span>
                ) : (
                  <span className="text-xs text-[#c3cedd]">{knockoutPlaceholder(t.stage, t.slot)}</span>
                )}
              </span>
            </Link>
          );
        })}
      </section>
    </DarkPage>
  );
}

function stageLine(state: GamesState): string {
  const live = state.ties.filter((t) => t.status === "live");
  const liveQ = live.find((t) => t.stage === "QUALIFIER");
  if (liveQ) return `รอบคัดเลือก · รอบที่ ${liveQ.round} · เริ่ม ${liveQ.startsAt}`;
  if (live.length) return live.map((t) => t.label).join(" · ");
  if (state.ties.length && state.ties.every((t) => t.status === "done")) return "จบการแข่งขันแล้ว";
  const first = state.ties.find((t) => t.status === "upcoming");
  return first ? `เริ่ม ${first.startsAt} · ${state.event.date}` : "";
}

function RoundStatus({ ties }: { ties: TieView[] }) {
  if (ties.some((t) => t.status === "live")) return <span className="font-semibold" style={{ color: DARK.live }}>กำลังแข่ง</span>;
  if (ties.length && ties.every((t) => t.status === "done")) return <span className="font-semibold text-[#8a9db3]">จบแล้ว</span>;
  return null;
}

function ScheduleLine({ team, points, bold }: { team: TeamView | undefined; points: number | null; bold: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: team?.color ?? DARK.dim }} />
      <span className="flex-1 truncate" style={{ fontWeight: bold ? 700 : 500 }}>{team?.name ?? "—"}</span>
      <b className="tabular-nums">{points ?? ""}</b>
    </span>
  );
}

export function TieHeader({ eventId, tie, teams }: { eventId: string; tie: TieView; teams: Map<string, TeamView> }) {
  return (
    <Link href={`/games/${eventId}/tie/${tie.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-xs text-[#a9bdd3]">{tie.stage === "QUALIFIER" ? `แมตซ์ ${tie.slot}` : tie.label}</span>
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
