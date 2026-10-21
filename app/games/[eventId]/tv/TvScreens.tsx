"use client";

/* eslint-disable @next/next/no-img-element -- versioned API image URLs */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { GamesState, PlayerRef, RubberView, TeamView, TieView } from "@/lib/games/state";
import { CARD_LABELS } from "@/lib/games/cards";
import { ictDateKey, ictNowMinute, slotClock } from "@/lib/games/clock";
import { fmtMinute, knockoutPlaceholder, setsLine } from "@/lib/games/format";
import { setsWon } from "@/lib/games/rules";
import { tvTies } from "@/lib/games/tv";
import { useGamesState } from "../../useGamesState";
import { DARK } from "../../ui";
import { liveScore } from "../RunningTab";

/* Sized in vw so a 1920×1080 TV matches the mockups and smaller screens scale. */

function TvFrame({
  children,
  other,
  hideCursor = false,
}: {
  children: React.ReactNode;
  other?: { href: string; label: string };
  hideCursor?: boolean;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col gap-[1.2vw] overflow-hidden px-[2.9vw] py-[1.9vw] font-[family-name:var(--font-pixel-body)] ${hideCursor ? "cursor-none" : ""}`}
      style={{ background: DARK.ground, color: DARK.text }}
    >
      {children}
      {other && (
        <Link href={other.href} className="absolute bottom-[0.6vw] right-[1vw] text-[0.8vw] text-[#4f6b88] hover:text-white">
          {other.label} ›
        </Link>
      )}
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
  return (
    <TvFrame other={{ href: `/games/${state.event.id}/tv/schedule`, label: "ตารางแข่ง" }}>
      <StandingsView state={state} />
    </TvFrame>
  );
}

/** Header + the six-row table, shared by the standings screen and the rotating one. */
function StandingsView({ state }: { state: GamesState }) {
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const finishedTies = qualifier.filter((t) => t.status === "done").length;
  const cols = "6vw minmax(0,1fr) 10vw 7vw 7vw 7vw 11vw";
  // No semi-final split until all 15 qualifier ties are done: the order can still change.
  const split = state.qualifierDone;

  return (
    <>
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
        คะแนนเท่ากัน ดู ผลต่างแต้ม → คู่ที่ชนะตอนเจอกัน → ผลต่างแต้มตอนเจอกัน{split && " · เส้นประ = ตัดเข้ารอบรองชนะเลิศ"}
      </span>
    </>
  );
}

export type TvMode = "rotate" | "matches" | "standings";

const TV_MODES: { key: TvMode; label: string }[] = [
  { key: "rotate", label: "สลับอัตโนมัติ 10 วิ" },
  { key: "matches", label: "แมตซ์ที่กำลังแข่ง" },
  { key: "standings", label: "ตารางคะแนนรวม" },
];
const ROTATE_MS = 10_000;

/**
 * The main big screen: the matches in play and the table, switching every 10 s,
 * or held on one of them. Moving the mouse or tapping brings up the buttons
 * (keys 1–3 work too); the mode is kept in the URL so a reload keeps it.
 */
export function TvShow({ initial, initialMode }: { initial: GamesState; initialMode: TvMode }) {
  const { state } = useGamesState(initial.event.id, initial);
  const [mode, setMode] = useState<TvMode>(initialMode);
  const [view, setView] = useState<"matches" | "standings">("matches");
  const [controls, setControls] = useState(true);

  useEffect(() => {
    if (mode !== "rotate") return;
    const t = setInterval(() => setView((v) => (v === "matches" ? "standings" : "matches")), ROTATE_MS);
    return () => clearInterval(t);
  }, [mode]);

  const choose = useCallback((m: TvMode) => {
    setMode(m);
    window.history.replaceState(null, "", `?mode=${m}`);
  }, []);

  // The buttons show for a few seconds after any mouse move, tap or key, then hide.
  useEffect(() => {
    let hide = setTimeout(() => setControls(false), 4000);
    const wake = () => {
      setControls(true);
      clearTimeout(hide);
      hide = setTimeout(() => setControls(false), 3000);
    };
    const onKey = (e: KeyboardEvent) => {
      const m = TV_MODES[Number(e.key) - 1];
      if (m) choose(m.key);
      wake();
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(hide);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", onKey);
    };
  }, [choose]);

  const shown = mode === "rotate" ? view : mode;

  return (
    <TvFrame hideCursor={!controls}>
      <style>{"@keyframes tvprog { from { width: 0 } to { width: 100% } }"}</style>
      {mode === "rotate" && (
        <span
          key={view}
          className="absolute left-0 top-0 h-[0.3vw]"
          style={{ background: DARK.gold, animation: `tvprog ${ROTATE_MS}ms linear forwards` }}
        />
      )}
      {shown === "matches" ? <MatchesView state={state} /> : <StandingsView state={state} />}
      <div
        className="absolute bottom-[1.2vw] left-1/2 flex -translate-x-1/2 gap-[0.5vw] rounded-full border-2 p-[0.4vw] transition-opacity duration-300"
        style={{ background: DARK.panel, borderColor: DARK.line, opacity: controls ? 1 : 0, pointerEvents: controls ? "auto" : "none" }}
      >
        {TV_MODES.map((m, i) => (
          <button
            key={m.key}
            type="button"
            onClick={() => choose(m.key)}
            className="rounded-full px-[1.2vw] py-[0.5vw] text-[1vw] font-bold"
            style={m.key === mode ? { background: DARK.gold, color: DARK.ground } : { color: DARK.muted }}
          >
            {i + 1} · {m.label}
          </button>
        ))}
      </div>
    </TvFrame>
  );
}

/** The ties in play (or next), side by side, each with its five pairs. */
function MatchesView({ state }: { state: GamesState }) {
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const ties = tvTies(state.ties);
  const first = ties[0];
  const note = !first ? "" : first.stage === "QUALIFIER" ? `รอบคัดเลือก · รอบที่ ${first.round} · ${first.startsAt}` : "รอบน็อกเอาต์";
  return (
    <>
      <Header state={state} title="แมตซ์ที่กำลังแข่ง" note={note} />
      {ties.length === 0 ? (
        <p className="text-[1.6vw] text-[#a9bdd3]">ยังไม่มีแมตซ์</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-[1.2vw]" style={{ gridTemplateColumns: `repeat(${ties.length}, minmax(0, 1fr))` }}>
          {ties.map((t) => (
            <TvTiePanel key={t.id} tie={t} teams={teams} />
          ))}
        </div>
      )}
    </>
  );
}

function TvTiePanel({ tie, teams }: { tie: TieView; teams: Map<string, TeamView> }) {
  const a = teams.get(tie.teamAId ?? "");
  const b = teams.get(tie.teamBId ?? "");
  const live = tie.status === "live";
  return (
    <div
      className="flex min-h-0 flex-col gap-[0.5vw] rounded-[1vw] border-[3px] p-[1vw]"
      style={{ background: DARK.panel, borderColor: live ? DARK.live : DARK.line }}
    >
      <div className="flex items-center justify-between text-[1.05vw] text-[#a9bdd3]">
        <span>
          {tie.stage === "QUALIFIER" ? `แมตซ์ ${tie.slot}` : tie.label} · สนาม {tie.courtA}–{tie.courtB}
        </span>
        <span
          className="rounded-full px-[0.7vw] font-bold"
          style={live ? { background: DARK.live, color: DARK.ground } : { color: DARK.muted }}
        >
          {live ? "กำลังแข่ง" : tie.status === "done" ? "จบแล้ว" : `เริ่ม ${tie.startsAt}`}
        </span>
      </div>
      {a && b ? (
        // Sized so two 7-letter team names and a two-digit score fit a third of a 16:9 screen.
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[0.8vw]">
          <span className="justify-self-start">
            <TvChip team={a} font="1.2vw" />
          </span>
          <span className="text-[2.9vw] font-bold leading-none tabular-nums">
            {tie.pointsA}–{tie.pointsB}
          </span>
          <span className="justify-self-end">
            <TvChip team={b} font="1.2vw" />
          </span>
        </div>
      ) : (
        <span className="text-[1.3vw] text-[#c3cedd]">{knockoutPlaceholder(tie.stage, tie.slot)}</span>
      )}
      {(tie.bonusA !== 0 || tie.bonusB !== 0) && (
        <span className="text-center text-[0.9vw] font-semibold" style={{ color: DARK.gold }}>
          🃏 รวมโบนัสการ์ดแล้ว
        </span>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {tie.rubbers.map((r) => (
          <TvRubberRow key={r.id} tie={tie} rubber={r} />
        ))}
      </div>
    </div>
  );
}

function TvRubberRow({ tie, rubber }: { tie: TieView; rubber: RubberView }) {
  const counting = rubber.liveSet != null && !rubber.finished;
  const done = rubber.status === "done";
  const [wa, wb] = setsWon(rubber.sets);
  const card = tie.cards.find((c) => c.order === rubber.order);
  const center = done ? (
    <span className="flex flex-col items-center">
      <b className="text-[1.9vw] leading-none tabular-nums">
        <span style={{ color: rubber.outcome === "A" ? DARK.gold : DARK.text }}>{wa}</span>–
        <span style={{ color: rubber.outcome === "B" ? DARK.gold : DARK.text }}>{wb}</span>
      </b>
      <span className="text-[0.85vw] tabular-nums text-[#a9bdd3]">{setsLine(rubber.sets)}</span>
    </span>
  ) : counting ? (
    <b className="text-[1.9vw] tabular-nums" style={{ color: DARK.gold }}>
      {liveScore(rubber)}
    </b>
  ) : rubber.status === "cancelled" ? (
    <span className="text-[0.9vw] text-[#8a9db3]">ไม่ต้องแข่ง</span>
  ) : rubber.status === "live" ? (
    <span className="rounded-full px-[0.6vw] text-[0.9vw] font-bold" style={{ background: DARK.live, color: DARK.ground }}>
      กำลังแข่ง
    </span>
  ) : (
    <span className="text-[1vw] text-[#a9bdd3]">{fmtMinute(rubber.startMinute)}</span>
  );
  return (
    <div
      className="grid flex-1 grid-cols-[3.4vw_minmax(0,1fr)_7.5vw_minmax(0,1fr)] items-center gap-[0.5vw] border-t py-[0.3vw]"
      style={{ borderColor: DARK.lineSoft, opacity: rubber.status === "cancelled" ? 0.5 : 1 }}
    >
      <span className="flex flex-col text-[0.95vw] font-bold leading-tight">
        คู่ {rubber.order}
        <span className="font-normal text-[#a9bdd3]">ส.{rubber.court}</span>
      </span>
      <TvNames players={rubber.a} dim={done && rubber.outcome === "B"} />
      <span className="flex flex-col items-center gap-[0.2vw]">
        {center}
        {card && (
          <span className="text-[0.75vw] font-bold" style={{ color: DARK.gold }}>
            🃏 {CARD_LABELS[card.kind].name}
          </span>
        )}
      </span>
      <TvNames players={rubber.b} dim={done && rubber.outcome === "A"} right />
    </div>
  );
}

/** A pair's names, one per line, big enough to read from the back of the hall. */
function TvNames({ players, dim, right = false }: { players: (PlayerRef | null)[]; dim: boolean; right?: boolean }) {
  const names = players.filter((p): p is PlayerRef => p != null).map((p) => p.name);
  return (
    <span
      className={`flex min-w-0 flex-col text-[1.1vw] font-semibold leading-tight ${right ? "items-end text-right" : ""}`}
      style={{ color: dim ? DARK.dim : DARK.text }}
    >
      {names.length ? (
        names.map((n, i) => (
          <span key={i} className="max-w-full truncate">
            {n}
          </span>
        ))
      ) : (
        <span className="text-[0.9vw] font-normal text-[#8a9db3]">ยังไม่ส่งชื่อ</span>
      )}
    </span>
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
