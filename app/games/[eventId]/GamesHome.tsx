"use client";

import Image from "next/image";
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
      <BackLink href="/" tone="dark" />
      <div className="-mt-2 flex flex-col items-center gap-2 text-center">
        <h1 className="w-full">
          <Image
            src="/games-logo-2026.webp"
            alt={state.event.name}
            width={1000}
            height={646}
            priority
            className="mx-auto h-auto w-full max-w-[340px]"
          />
        </h1>
        <span className="flex items-center gap-2 text-[13px] text-[#a9bdd3]">
          <span
            className={`h-2 w-2 rounded-full ${state.ties.some((t) => t.status === "live") ? "games-pulse" : ""}`}
            style={{ background: DARK.live }}
          />
          {stageLine(state)}
        </span>
        {!state.event.published && (
          <span className="self-center">
            <Pill bg={DARK.gold} fg={DARK.ground}>แอดมินดูก่อนเปิด · ผู้เล่นยังเห็น Coming soon</Pill>
          </span>
        )}
      </div>

      {/* Five equal tiles in one row: every tab in view on a phone, no sideways scrolling. */}
      <nav className="grid grid-cols-5 gap-1.5">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => choose(t.key)}
              aria-current={on ? "page" : undefined}
              aria-label={t.label}
              title={t.label}
              className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border px-0.5 text-[12px] font-bold leading-tight transition active:scale-[0.97] md:min-h-12 md:flex-row md:gap-2 md:text-sm"
              style={
                on
                  ? { background: DARK.gold, color: DARK.ground, borderColor: DARK.gold }
                  : { background: DARK.panel, color: DARK.muted, borderColor: DARK.line }
              }
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {t.icon}
              </span>
              <span className="md:hidden">{t.short}</span>
              <span className="hidden md:inline">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Keyed on the tab, so the one just opened fades in. */}
      <div key={tab} className="games-enter">
        {tab === "teams" && <TeamsTab state={state} />}
        {tab === "rules" && <RulesTab state={state} />}
        {tab === "schedule" && <ScheduleTab state={state} teams={teams} />}
        {tab === "running" && <RunningTab state={state} teams={teams} />}
        {tab === "standings" && <StandingsTab state={state} teams={teams} />}
      </div>
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
