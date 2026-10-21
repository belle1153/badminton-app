"use client";

/* eslint-disable @next/next/no-img-element -- versioned API image URLs */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GamesState, TeamView, TieView } from "@/lib/games/state";
import { ictDateKey, ictNowMinute, slotClock } from "@/lib/games/clock";
import { knockoutPlaceholder } from "@/lib/games/format";
import { useGamesState } from "../../useGamesState";
import { DARK } from "../../ui";

/* Sized in vw so a 1920×1080 TV matches the mockups and smaller screens scale. */

function TvFrame({ children, other }: { children: React.ReactNode; other: { href: string; label: string } }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col gap-[1.2vw] overflow-hidden px-[2.9vw] py-[1.9vw] font-[family-name:var(--font-pixel-body)]"
      style={{ background: DARK.ground, color: DARK.text }}
    >
      {children}
      <Link href={other.href} className="absolute bottom-[0.6vw] right-[1vw] text-[0.8vw] text-[#4f6b88] hover:text-white">
        {other.label} ›
      </Link>
    </div>
  );
}

function TvLogo({ team, size }: { team: TeamView; size: string }) {
  if (team.logoUrl) return <img src={team.logoUrl} alt="" className="shrink-0 rounded-[0.4vw] object-cover" style={{ width: size, height: size }} />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="shrink-0" style={{ width: size, height: size }}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" fill={team.color} />
    </svg>
  );
}

function TvChip({ team, font }: { team: TeamView | undefined; font: string }) {
  if (!team) return <span style={{ fontSize: font }} className="text-[#a9bdd3]">—</span>;
  return (
    <span className="inline-flex items-center gap-[0.6vw]">
      <TvLogo team={team} size={`calc(${font} * 1.15)`} />
      {/* leading-[1.4]: room for stacked Thai marks (น้ำ) above the line */}
      <span className="rounded-[0.6vw] px-[1.2vw] py-[0.2vw] font-bold leading-[1.4]" style={{ background: team.color, color: team.textColor, fontSize: font }}>
        {team.name}
      </span>
    </span>
  );
}

/** Informational clock: round and pair slot from the timetable vs the real clock (ICT). */
function SlotClock({ state }: { state: GamesState }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Follow the server's clock, not the TV's, so every screen agrees.
    const offset = new Date(state.serverNow).getTime() - Date.now();
    const tick = () => setNow(new Date(Date.now() + offset));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [state.serverNow]);
  if (!now || ictDateKey(now) !== state.event.date) return null;
  const clock = slotClock(state.ties, { qualifier: state.event.qualifierMinutes, knockout: state.event.knockoutMinutes }, ictNowMinute(now));
  if (!clock) return null;
  const mm = String(Math.floor(clock.remainingSec / 60)).padStart(2, "0");
  const ss = String(clock.remainingSec % 60).padStart(2, "0");
  return (
    <span className="flex flex-col items-center rounded-[0.8vw] border-2 px-[1.2vw] py-[0.4vw]" style={{ background: DARK.panel, borderColor: DARK.line }}>
      <span className="text-[1.05vw] text-[#a9bdd3]">{clock.label} · เหลือ</span>
      <span className="text-[2.7vw] font-bold leading-tight tabular-nums" style={{ color: DARK.gold }}>
        {mm}:{ss}
      </span>
    </span>
  );
}

function Header({ state, title, note }: { state: GamesState; title: string; note: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-[1.2vw]">
      <div className="flex flex-col gap-[0.2vw]">
        <span className="text-[1.55vw] font-semibold tracking-wide text-[#a9bdd3]">{state.event.name}</span>
        <span className="text-[3.3vw] font-bold leading-none" style={{ color: DARK.gold }}>{title}</span>
      </div>
      <div className="flex items-center gap-[1.2vw]">
        <span className="text-right text-[1.25vw] text-[#a9bdd3]">{note}</span>
        <SlotClock state={state} />
      </div>
    </div>
  );
}

export function TvStandings({ initial }: { initial: GamesState }) {
  const { state } = useGamesState(initial.event.id, initial);
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const finishedTies = qualifier.filter((t) => t.status === "done").length;
  const cols = "6vw minmax(0,1fr) 10vw 7vw 7vw 7vw 11vw";
  // No semi-final split until all 15 qualifier ties are done: the order can still change.
  const split = state.qualifierDone;

  return (
    <TvFrame other={{ href: `/games/${state.event.id}/tv/schedule`, label: "ตารางแข่ง" }}>
      <Header
        state={state}
        title="ตารางคะแนน"
        note={
          <>
            รอบคัดเลือก · จบ {finishedTies} จาก {qualifier.length} แมตซ์
            <br />
            ชนะ 2 · เสมอ 1 · แพ้ 0
          </>
        }
      />
      <div className="flex flex-1 flex-col overflow-hidden rounded-[1.25vw] border-[3px]" style={{ background: DARK.panel, borderColor: DARK.line }}>
        <div className="grid items-center border-b-[3px] px-[2vw] py-[0.8vw] text-[1.35vw] text-[#a9bdd3]" style={{ gridTemplateColumns: cols, borderColor: DARK.lineSoft }}>
          <span>อันดับ</span>
          <span>ทีม</span>
          <span className="text-right">คะแนน</span>
          <span className="text-right">ชนะ</span>
          <span className="text-right">เสมอ</span>
          <span className="text-right">แพ้</span>
          <span className="text-right">ผลต่างแต้ม</span>
        </div>
        {state.standings.map((row, i) => {
          const top = split && row.rank <= 4;
          return (
            <div
              key={row.teamId}
              className="grid flex-1 items-center px-[2vw] tabular-nums"
              style={{
                gridTemplateColumns: cols,
                borderTop: i === 0 ? "none" : split && row.rank === 5 ? `4px dashed ${DARK.live}` : `2px solid ${DARK.lineSoft}`,
              }}
            >
              {/* leading-none: at the default line height these numerals made six rows taller than a 1080p screen */}
              <span className="text-[4vw] font-bold leading-none" style={{ color: top ? DARK.gold : DARK.dim }}>{row.rank}</span>
              <span className="flex items-center gap-[1.1vw]">
                <TvChip team={teams.get(row.teamId)} font="2.8vw" />
                {split && <span className="text-[1.25vw]" style={{ color: top ? DARK.gold : DARK.dim }}>{top ? "เข้ารอบรองฯ" : "ชิงอันดับ 5"}</span>}
              </span>
              <span className="text-right text-[4.8vw] font-bold leading-none">{row.points}</span>
              <span className="text-right text-[2.3vw] text-[#c3cedd]">{row.won}</span>
              <span className="text-right text-[2.3vw] text-[#c3cedd]">{row.drawn}</span>
              <span className="text-right text-[2.3vw] text-[#c3cedd]">{row.lost}</span>
              <span className="text-right text-[2.3vw] text-[#c3cedd]">{row.diff > 0 ? `+${row.diff}` : row.diff}</span>
            </div>
          );
        })}
      </div>
      <span className="text-[1.15vw] text-[#a9bdd3]">
        คะแนนเท่ากัน ดู คู่ที่ชนะ → ผลตอนเจอกัน → ผลต่างแต้ม{split && " · เส้นประ = ตัดเข้ารอบรองชนะเลิศ"}
      </span>
    </TvFrame>
  );
}

export function TvSchedule({ initial }: { initial: GamesState }) {
  const { state } = useGamesState(initial.event.id, initial);
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const knockout = state.ties.filter((t) => t.stage !== "QUALIFIER");
  const rounds = [1, 2, 3, 4, 5].map((r) => qualifier.filter((t) => t.round === r));

  return (
    <TvFrame other={{ href: `/games/${state.event.id}/tv/standings`, label: "ตารางคะแนน" }}>
      <Header
        state={state}
        title="ตารางแข่งและผล"
        note={
          <>
            ตัวเลข = คะแนนแมตซ์
            <br />
            กรอบส้ม = กำลังแข่ง
          </>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-[1.9vw]">
        <div className="flex flex-col gap-[0.7vw]">
          {rounds.map((ties, r) => (
            <div key={r} className="grid flex-1 grid-cols-[7.8vw_repeat(3,minmax(0,1fr))] gap-[0.7vw]">
              <span className="flex flex-col justify-center text-[1.55vw] font-bold">
                รอบ {r + 1}
                <span className="text-[1.15vw] font-medium" style={{ color: ties.some((t) => t.status === "live") ? DARK.live : DARK.dim }}>
                  {ties.some((t) => t.status === "live") ? "กำลังแข่ง" : ties.every((t) => t.status === "done") ? "จบแล้ว" : ties[0]?.startsAt}
                </span>
              </span>
              {ties.map((t) => (
                <ScheduleCell key={t.id} tie={t} teams={teams} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-[0.7vw]">
          <span className="text-[1.8vw] font-bold">
            รอบน็อกเอาต์ <span className="text-[1.15vw] font-medium text-[#a9bdd3]">ชนะ 3 ใน 5 คู่</span>
          </span>
          {knockout.map((t) => {
            const a = teams.get(t.teamAId ?? "");
            const b = teams.get(t.teamBId ?? "");
            const final = t.stage === "FINAL";
            return (
              <span
                key={t.id}
                className="flex flex-1 flex-col justify-center gap-[0.3vw] rounded-[0.7vw] border-[3px] px-[1.15vw]"
                style={{ background: DARK.panel, borderColor: final ? DARK.gold : t.status === "live" ? DARK.live : DARK.line }}
              >
                <span className="text-[1.45vw] font-bold" style={{ color: final ? DARK.gold : DARK.text }}>
                  {t.startsAt} · {t.label}
                </span>
                {a && b ? (
                  <span className="flex items-center gap-[0.8vw] text-[1.25vw] text-[#c3cedd]">
                    <TvChip team={a} font="1.3vw" />
                    {t.status === "upcoming" ? "vs" : <b className="tabular-nums text-white">{t.pointsA}–{t.pointsB}</b>}
                    <TvChip team={b} font="1.3vw" />
                    {t.projected && <span>(ตามอันดับตอนนี้)</span>}
                  </span>
                ) : (
                  <span className="text-[1.25vw] text-[#c3cedd]">{knockoutPlaceholder(t.stage, t.slot)}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </TvFrame>
  );
}

function ScheduleCell({ tie, teams }: { tie: TieView; teams: Map<string, TeamView> }) {
  const line = (teamId: string | null, points: number, other: number) => {
    const team = teams.get(teamId ?? "");
    return (
      <span className="flex items-center gap-[0.6vw]">
        <span className="h-[0.95vw] w-[0.95vw] rounded-[0.2vw]" style={{ background: team?.color ?? DARK.dim }} />
        <span className="flex-1 truncate" style={{ fontWeight: tie.status === "done" && points > other ? 700 : 500 }}>{team?.name ?? "—"}</span>
        <b className="tabular-nums">{tie.status === "upcoming" ? "" : points}</b>
      </span>
    );
  };
  return (
    <span
      className="flex flex-col justify-center gap-[0.3vw] rounded-[0.7vw] border-[3px] px-[0.95vw] text-[1.45vw]"
      style={{ background: DARK.panel, borderColor: tie.status === "live" ? DARK.live : DARK.line }}
    >
      {line(tie.teamAId, tie.pointsA, tie.pointsB)}
      {line(tie.teamBId, tie.pointsB, tie.pointsA)}
    </span>
  );
}
