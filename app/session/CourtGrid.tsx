"use client";

import { useEffect, useState } from "react";
import CourtCard from "./CourtCard";
import { getMySignups } from "@/lib/mySignups";

interface PlayerInfo {
  id: string;
  name: string;
  skillLevel: string;
}

interface TeamMatch {
  id: string;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

interface CourtEntry {
  court: number;
  match: TeamMatch | null;
}

export default function CourtGrid({ sessionId, courts }: { sessionId: string; courts: CourtEntry[] }) {
  const [myIds, setMyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMyIds(new Set(getMySignups(sessionId)));
  }, [sessionId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {courts.map((c) => {
        const isSelf =
          !!c.match &&
          (c.match.team1.some((p) => myIds.has(p.id)) || c.match.team2.some((p) => myIds.has(p.id)));
        return (
          <CourtCard key={c.court} sessionId={sessionId} court={c.court} match={c.match} isSelf={isSelf} />
        );
      })}
    </div>
  );
}
