"use client";

import BackLink from "@/app/BackLink";
import type { GamesState, RubberView, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute, knockoutPlaceholder, resultText, setsLine } from "@/lib/games/format";
import { setsWon } from "@/lib/games/rules";
import { useGamesState } from "../../../useGamesState";
import { DARK, DarkPage, PairAvatars, PairNames, Pill, TeamChip } from "../../../ui";
import { liveScore } from "../../GamesHome";

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
            {tie.pointsA} – {tie.pointsB}
          </span>
          <span className="text-[11px] text-[#a9bdd3]">คะแนนแมตซ์ · จบ {done} / 5 คู่</span>
        </div>
        <TeamSide team={b} wins={wins("B")} />
      </div>
      {(!a || !b) && <p className="text-center text-sm text-[#a9bdd3]">{knockoutPlaceholder(tie.stage, tie.slot)}</p>}
      {tie.projected && a && b && <p className="text-center text-xs text-[#a9bdd3]">คู่นี้ตามอันดับตอนนี้ อาจเปลี่ยนได้จนรอบคัดเลือกจบ</p>}

      {tie.rubbers.map((r) => (
        <RubberCard key={r.id} tie={tie} rubber={r} a={a} b={b} />
      ))}

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
        return <Pill bg={DARK.live} fg={DARK.ground}>{counting ? "นับสด" : "กำลังแข่ง"}</Pill>;
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-[30px] w-1 shrink-0 rounded-sm" style={{ background: a?.color ?? DARK.dim }} />
          <PairAvatars players={rubber.a} size={22} />
          <PairNames
            players={rubber.a}
            fallback={`คู่ ${rubber.order}`}
            className="text-[13px]"
            style={{ fontWeight: loserA ? 500 : 700, color: loserA ? DARK.dim : DARK.text }}
          />
        </span>
        <span className="flex flex-col items-center gap-0.5">
          {done ? (
            <span className="whitespace-nowrap text-xl font-bold tabular-nums">
              <span style={{ color: rubber.outcome === "A" ? DARK.gold : DARK.dim }}>{wa}</span> –{" "}
              <span style={{ color: rubber.outcome === "B" ? DARK.gold : DARK.dim }}>{wb}</span>
            </span>
          ) : counting ? (
            <span className="text-xl font-bold tabular-nums" style={{ color: DARK.gold }}>{liveScore(rubber)}</span>
          ) : (
            <span className="text-sm text-[#a9bdd3]">vs</span>
          )}
          {(done || counting) && rubber.sets.length > 0 && (
            <span className="whitespace-nowrap text-[11px] tabular-nums text-[#a9bdd3]">
              {setsLine(counting ? rubber.sets.slice(0, -1) : rubber.sets)}
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1.5">
          <PairNames
            players={rubber.b}
            fallback={`คู่ ${rubber.order}`}
            align="right"
            className="text-[13px]"
            style={{ fontWeight: loserB ? 500 : 700, color: loserB ? DARK.dim : DARK.text }}
          />
          <PairAvatars players={rubber.b} size={22} />
          <span className="h-[30px] w-1 shrink-0 rounded-sm" style={{ background: b?.color ?? DARK.dim }} />
        </span>
      </div>
      {note && <span className="text-[11px] text-[#a9bdd3]">{note}</span>}
    </div>
  );
}
