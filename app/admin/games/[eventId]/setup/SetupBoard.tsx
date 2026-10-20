"use client";

import Link from "next/link";
import type { GamesState } from "@/lib/games/state";
import { useGamesState } from "@/app/games/useGamesState";
import EventSettings from "./EventSettings";
import TeamEditor from "./TeamEditor";

/** Setup page body: event settings, then one editor per team. Shares one fresh snapshot. */
export default function SetupBoard({ initial, athletes }: { initial: GamesState; athletes: { id: string; name: string }[] }) {
  const { state, refresh } = useGamesState(initial.event.id, initial, { admin: true, intervalMs: 10000 });
  const taken = new Map<string, string>();
  for (const t of state.teams) for (const m of t.members) taken.set(m.id, t.name);

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
          <TeamEditor key={team.id} team={team} athletes={athletes} taken={taken} onSaved={refresh} />
        ))}
      </section>
    </>
  );
}
