"use client";

import Link from "next/link";
import { useState } from "react";
import type { GamesState, TeamView, TieView } from "@/lib/games/state";
import { knockoutPlaceholder, pairName } from "@/lib/games/format";
import { useGamesState } from "@/app/games/useGamesState";
import { CardChip, Chip, LineupStatus, lineupFilled } from "../LineupBits";

export type Tab = number | "KO";

const allSent = (ties: TieView[]) => ties.length > 0 && ties.every((t) => lineupFilled(t, "a") === 5 && lineupFilled(t, "b") === 5);

/** Round tabs, then one big button per team per tie that opens that team's lineup. */
export default function LineupsBoard({ initial, initialTab }: { initial: GamesState; initialTab: Tab | null }) {
  const { state } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 5000 });
  const teams = new Map(state.teams.map((t) => [t.id, t]));
  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab != null) return initialTab;
    // Open on the first round that still has a lineup missing.
    const first = initial.ties.find((t) => t.teamAId && t.teamBId && (lineupFilled(t, "a") < 5 || lineupFilled(t, "b") < 5));
    return !first ? 1 : first.stage === "QUALIFIER" ? first.round! : "KO";
  });
  const id = state.event.id;
  const tiesOf = (t: Tab) => state.ties.filter((x) => (t === "KO" ? x.stage !== "QUALIFIER" : x.round === t));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">ใบส่งตัว</h1>
        <p className="text-sm text-gray-600">กดที่ทีมเพื่อคีย์คู่ 1–5 ตามกระดาษที่กัปตันส่งมา · แก้ได้ตลอด</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {([1, 2, 3, 4, 5, "KO"] as Tab[]).map((t) => {
          const on = t === tab;
          const done = allSent(tiesOf(t));
          return (
            <button
              key={String(t)}
              type="button"
              onClick={() => setTab(t)}
              className="min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold"
              style={{
                background: on ? "#1d4d73" : "#ffffff",
                color: on ? "#ffffff" : done ? "#15803d" : "#1d4d73",
                borderColor: on ? "#1d4d73" : done ? "#86c79a" : "#b3cbe0",
              }}
            >
              {t === "KO" ? "น็อกเอาต์" : `รอบ ${t}`}
              {done && " ✓"}
            </button>
          );
        })}
      </div>

      {tiesOf(tab).map((tie) => (
        <TieLineups key={tie.id} eventId={id} tie={tie} teams={teams} />
      ))}
    </>
  );
}

function TieLineups({ eventId, tie, teams }: { eventId: string; tie: TieView; teams: Map<string, TeamView> }) {
  const sides = [
    ["A", "a", tie.teamAId],
    ["B", "b", tie.teamBId],
  ] as const;
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-gray-200 p-3">
      <h2 className="text-sm font-bold">
        {tie.stage === "QUALIFIER" ? `แมตซ์ ${tie.slot}` : tie.label}
        <span className="font-normal text-gray-500"> · สนาม {tie.courtA}–{tie.courtB} · {tie.startsAt}</span>
      </h2>
      {!tie.teamAId || !tie.teamBId ? (
        <p className="text-sm text-gray-500">{knockoutPlaceholder(tie.stage, tie.slot)} · รู้ทีมเมื่อรอบก่อนหน้าจบ</p>
      ) : (
        <>
          {tie.lineupMismatch && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">ใบส่งตัวมีชื่อที่ไม่ได้อยู่ทีมนี้ · กดเข้าไปแก้</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {sides.map(([side, key, teamId]) => {
              const team = teams.get(teamId!);
              const filled = lineupFilled(tie, key);
              return (
                <Link
                  key={side}
                  href={`/admin/games/${eventId}/lineup/${tie.id}?side=${side}`}
                  className="flex min-h-14 flex-col gap-2 rounded-xl border-2 p-3 transition hover:bg-gray-50 active:scale-[0.99]"
                  style={{ borderColor: team?.color ?? "#dbe6f0" }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip team={team} />
                    <LineupStatus tie={tie} side={key} />
                    {tie.cards
                      .filter((c) => c.side === side)
                      .map((c) => (
                        <CardChip key={c.kind} card={c} />
                      ))}
                    <span className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                      {filled ? "แก้" : "คีย์"}
                    </span>
                  </span>
                  {filled > 0 && (
                    <ol className="flex flex-col gap-0.5 text-[13px] text-gray-700">
                      {tie.rubbers.map((r) => (
                        <li key={r.id} className="truncate">
                          <b>คู่ {r.order}</b> · {pairName(r[key]) ?? "—"}
                        </li>
                      ))}
                    </ol>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
