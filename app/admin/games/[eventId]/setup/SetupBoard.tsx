"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { GamesState } from "@/lib/games/state";
import { useGamesState } from "@/app/games/useGamesState";
import EventSettings from "./EventSettings";
import TeamEditor, { type Claim } from "./TeamEditor";

/** Setup page body: event settings, then one editor per team. Shares one fresh snapshot. */
export default function SetupBoard({ initial, athletes }: { initial: GamesState; athletes: { id: string; name: string }[] }) {
  const { state, refresh } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 10000 });
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const onDraft = useCallback((teamId: string, ids: string[]) => setDrafts((d) => ({ ...d, [teamId]: ids })), []);

  // Which team each player is with — saved, or picked in an editor and not saved yet —
  // so two open team editors can never both take the same player.
  const claims = new Map<string, Claim[]>();
  const claim = (athleteId: string, teamId: string, name: string, saved: boolean) => {
    const list = claims.get(athleteId) ?? [];
    const mine = list.find((c) => c.teamId === teamId);
    if (mine) mine.saved ||= saved;
    else list.push({ teamId, name, saved });
    claims.set(athleteId, list);
  };
  for (const t of state.teams) {
    for (const m of t.members) claim(m.id, t.id, t.name, true);
    for (const id of drafts[t.id] ?? []) claim(id, t.id, t.name, false);
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">ตั้งค่างานแข่ง</h1>
        <Link href={`/admin/games/${state.event.id}`} className="text-sm font-semibold text-brand-700">
          ไปหน้าคุมรอบ ›
        </Link>
      </div>
      <EventSettings state={state} onSaved={refresh} />
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">ทีม</h2>
          <span className="text-xs text-gray-500">6 ทีม · ทีมละ 10 คน · แก้ชื่อ สี และโลโก้ได้</span>
        </div>
        {state.teams.map((team) => (
          <TeamEditor key={team.id} team={team} athletes={athletes} claims={claims} onDraft={onDraft} onSaved={refresh} />
        ))}
      </section>
    </>
  );
}
