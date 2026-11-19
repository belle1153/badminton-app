"use client";

import BackLink from "@/app/BackLink";
import type { GamesState, RubberView, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute, knockoutPlaceholder, resultText } from "@/lib/games/format";
import { setsWon } from "@/lib/games/rules";
import { CARD_LABELS, cardEffectText } from "@/lib/games/cards";
import { Bump, LiveScore } from "../../../motion";
import { useGamesState } from "../../../useGamesState";
import { DARK, DarkPage, PairTiles, Pill, TeamChip } from "../../../ui";

/** One team-vs-team match: the tie score, then the five pairs. */
export default function GamesTie({ initial, tieId }: { initial: GamesState; tieId: string }) {
  const { state } = useGamesState(initial.event.id, initial);
  const tie = state.ties.find((t) => t.id === tieId)!;
  const a = state.teams.find((t) => t.id === tie.teamAId);
  const b = state.teams.find((t) => t.id === tie.teamBId);
  const knockout = tie.stage !== "QUALIFIER";
  const wins = (side: "A" | "B") => tie.rubbers.filter((r) => r.outcome === side).length;
  const done = tie.rubbers.filter((r) => r.finished).length;

  return (
    <DarkPage>
      <BackLink href={`/games/${state.event.id}`} tone="dark" />
      <span className="text-[13px] text-[#a9bdd3]">
        {tie.label} · สนาม {tie.courtA}–{tie.courtB} · {tie.startsAt}
      </span>

      <div
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border px-3 py-4"
        style={{ background: DARK.panel, borderColor: DARK.line }}
      >
        <TeamSide team={a} wins={wins("A")} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[44px] font-bold leading-none tabular-nums">
            <Bump value={tie.pointsA}>{tie.pointsA}</Bump> – <Bump value={tie.pointsB}>{tie.pointsB}</Bump>
          </span>
          <span className="text-[11px] text-[#a9bdd3]">คะแนนแมตซ์ · จบ {done} / 5 คู่</span>
          {(tie.bonusA !== 0 || tie.bonusB !== 0) && (
            <span className="text-[11px] font-semibold" style={{ color: DARK.gold }}>
              🃏 รวมโบนัสการ์ดแล้ว
            </span>
          )}
        </div>
        <TeamSide team={b} wins={wins("B")} />
      </div>
      {(!a || !b) && <p className="text-center text-sm text-[#a9bdd3]">{knockoutPlaceholder(tie.stage, tie.slot)}</p>}
      {tie.projected && a && b && <p className="text-center text-xs text-[#a9bdd3]">คู่นี้ตามอันดับตอนนี้ อาจเปลี่ยนได้จนรอบคัดเลือกจบ</p>}

      {/* One pair per row on a phone, two side by side on a wider screen. */}
      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        {tie.rubbers.map((r) => (
          <RubberCard key={r.id} tie={tie} rubber={r} a={a} b={b} />
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-[#a9bdd3]">
        {knockout
          ? "2 ใน 3 เซต เซตละ 21 แต้ม ดิวส์ไม่เกิน 30 · ชนะคู่ได้ 1 คะแนน · ทีมแรกที่ได้ 3 คะแนนชนะแมตซ์"
          : "คู่ละ 2 เซต ผู้เล่นนับแต้มกันเอง แล้วเขียนใบผลส่งโต๊ะแอดมิน · ชนะ 2–0 เซตได้ 2 คะแนน เสมอ 1–1 ได้ 1 แพ้ 0"}
        {" · ตัวเลขใหญ่ = เซตที่ชนะ · ผลขึ้นทุกจอทันทีที่แอดมินกรอก"}
      </p>
    </DarkPage>
  );
}

function TeamSide({ team, wins }: { team: TeamView | undefined; wins: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamChip team={team} size="md" />
      <span className="text-xs text-[#a9bdd3]">ชนะ {wins} คู่</span>
    </div>
  );
}

function RubberCard({ tie, rubber, a, b }: { tie: TieView; rubber: RubberView; a?: TeamView; b?: TeamView }) {
  const counting = rubber.liveSet != null && !rubber.finished;
  const done = rubber.status === "done";
  const [wa, wb] = setsWon(rubber.sets);
  const loserA = done && rubber.outcome === "B";
  const loserB = done && rubber.outcome === "A";

  const chip = (() => {
    switch (rubber.status) {
      case "done":
        return <Pill bg="#1d4d73" fg="#dbe6f0">จบแล้ว</Pill>;
      case "live":
        return <Pill bg={DARK.live} fg={DARK.ground} live>{counting ? "นับสด" : "กำลังแข่ง"}</Pill>;
      case "cancelled":
        return <Pill bg="#1a2c42" fg={DARK.dim}>ไม่ต้องแข่ง</Pill>;
      case "next":
        return <Pill bg="#1a2c42" fg="#82aacb">ถัดไป · {fmtMinute(rubber.startMinute)}</Pill>;
      default:
        return <Pill bg="#1a2c42" fg="#82aacb">{fmtMinute(rubber.startMinute)}</Pill>;
    }
  })();

  const note = done
    ? resultText(tie.stage, rubber.outcome, a?.name ?? "ทีม A", b?.name ?? "ทีม B")
    : rubber.status === "cancelled"
      ? "ตัดสินผลแมตซ์แล้ว"
      : rubber.status === "live" && !counting
        ? "ผลขึ้นเมื่อส่งใบผลให้แอดมินกรอก"
        : "";

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border px-3 py-2.5"
      style={{
        background: DARK.panel,
        borderColor: rubber.status === "live" ? DARK.live : DARK.line,
        opacity: rubber.status === "cancelled" ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold">
          คู่ {rubber.order} <span className="font-medium text-[#a9bdd3]">· สนาม {rubber.court}</span>
        </span>
        {chip}
      </div>
      {/* Both sides stretch to the taller one, so the photos line up when a name wraps. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
        <span className="flex min-w-0 items-stretch gap-1.5" style={{ opacity: loserA ? 0.5 : 1 }}>
          <span className="w-1 shrink-0 rounded-sm" style={{ background: a?.color ?? DARK.dim }} />
          <PairTiles players={rubber.a} max="72px" fallback={`คู่ ${rubber.order}`} nameClass="text-[13px] font-semibold" />
        </span>
        {/* Pops when the result comes in, and again if the admin corrects it. */}
        <Bump value={done ? `${wa}-${wb}` : ""} className="flex flex-col items-center gap-0.5 self-center">
          {done ? (
            <span className="whitespace-nowrap text-xl font-bold tabular-nums">
              <span style={{ color: rubber.outcome === "A" ? DARK.gold : DARK.dim }}>{wa}</span> –{" "}
              <span style={{ color: rubber.outcome === "B" ? DARK.gold : DARK.dim }}>{wb}</span>
            </span>
          ) : counting ? (
            <span className="text-xl font-bold tabular-nums" style={{ color: DARK.gold }}>
              <LiveScore rubber={rubber} />
            </span>
          ) : (
            <span className="text-sm text-[#a9bdd3]">vs</span>
          )}
          {/* One set per line keeps this column narrow, leaving the width to the photos. */}
          {(done || counting) &&
            (counting ? rubber.sets.slice(0, -1) : rubber.sets).map(([x, y], i) => (
              <span key={i} className="whitespace-nowrap text-[11px] leading-tight tabular-nums text-[#a9bdd3]">
                {x}–{y}
              </span>
            ))}
        </Bump>
        <span className="flex min-w-0 items-stretch justify-end gap-1.5" style={{ opacity: loserB ? 0.5 : 1 }}>
          <PairTiles
            players={rubber.b}
            max="72px"
            fallback={`คู่ ${rubber.order}`}
            align="right"
            nameClass="text-[13px] font-semibold"
          />
          <span className="w-1 shrink-0 rounded-sm" style={{ background: b?.color ?? DARK.dim }} />
        </span>
      </div>
      {tie.cards
        .filter((c) => c.order === rubber.order)
        .map((c) => (
          <span key={c.side} className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#c3cedd]">
            <Pill bg={DARK.gold} fg={DARK.ground}>🃏 {CARD_LABELS[c.kind].name}</Pill>
            {cardEffectText(c, rubber.outcome, a?.name ?? "ทีม A", b?.name ?? "ทีม B")}
          </span>
        ))}
      {note && <span className="text-[11px] text-[#a9bdd3]">{note}</span>}
    </div>
  );
}
