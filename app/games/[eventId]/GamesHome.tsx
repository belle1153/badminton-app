"use client";

import { useMemo, useState } from "react";
import BackLink from "@/app/BackLink";
import type { GamesState } from "@/lib/games/state";
import { useGamesState } from "../useGamesState";
import { DARK, DarkPage, Pill } from "../ui";
import { RulesTab, ScheduleTab, StandingsTab, TeamsTab } from "./InfoTabs";
import RunningTab from "./RunningTab";
import { TABS, type TabKey } from "./tabs";

/**
 * The player page: the event header, then five tabs. The open tab is kept in the
 * URL (?tab=) so a shared link opens it; without one it opens on Match Running
 * once play has started, else on the teams.
 */
export default function GamesHome({ initial, initialTab }: { initial: GamesState; initialTab: TabKey | null }) {
  const { state } = useGamesState(initial.event.id, initial);
  const teams = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const [tab, setTab] = useState<TabKey>(
    () => initialTab ?? (initial.ties.some((t) => t.status !== "upcoming") ? "running" : "teams")
  );

  function choose(key: TabKey) {
    setTab(key);
    // Replace, not push: switching tabs shouldn't fill up the back button's history.
    window.history.replaceState(null, "", `?tab=${key}`);
  }

  return (
    <DarkPage>
      <div className="flex flex-col gap-1.5">
        <BackLink href="/" tone="dark" />
        <h1 className="text-2xl font-bold tracking-wide">{state.event.name}</h1>
        <span className="flex items-center gap-2 text-[13px] text-[#a9bdd3]">
          <span className="h-2 w-2 rounded-full" style={{ background: DARK.live }} />
          {stageLine(state)}
        </span>
        {!state.event.published && <Pill bg={DARK.gold} fg={DARK.ground}>แอดมินดูก่อนเปิด · ผู้เล่นยังเห็น Coming soon</Pill>}
      </div>

      {/* 3 + 2 on a phone, so every tab is in view without sideways scrolling. */}
      <nav className="grid grid-cols-6 gap-1.5">
        {TABS.map((t, i) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => choose(t.key)}
              aria-current={on ? "page" : undefined}
              className={`${i < 3 ? "col-span-2" : "col-span-3"} min-h-11 rounded-xl border px-1 text-[13px] font-bold leading-tight`}
              style={
                on
                  ? { background: DARK.gold, color: DARK.ground, borderColor: DARK.gold }
                  : { background: DARK.panel, color: DARK.muted, borderColor: DARK.line }
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "teams" && <TeamsTab state={state} />}
      {tab === "rules" && <RulesTab state={state} />}
      {tab === "schedule" && <ScheduleTab state={state} teams={teams} />}
      {tab === "running" && <RunningTab state={state} teams={teams} />}
      {tab === "standings" && <StandingsTab state={state} teams={teams} />}
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
