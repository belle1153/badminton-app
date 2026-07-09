"use client";

import { useEffect, useState } from "react";
import CourtCard from "./CourtCard";

interface PlayerInfo {
  id: string;
  name: string;
}

interface TeamMatch {
  id: string;
  round: number;
  team1: PlayerInfo[];
  team2: PlayerInfo[];
}

interface CourtEntry {
  court: number;
  current: TeamMatch | null;
  next: TeamMatch | null;
  nextSubstitutes: PlayerInfo[];
}

export default function CourtGrid({
  sessionId,
  isAdmin,
  courts,
}: {
  sessionId: string;
  isAdmin: boolean;
  courts: CourtEntry[];
}) {
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    setSelfId(localStorage.getItem(`badminton_signup_${sessionId}`));
  }, [sessionId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {courts.map((c) => {
        const isSelf =
          selfId != null &&
          !!c.current &&
          (c.current.team1.some((p) => p.id === selfId) || c.current.team2.some((p) => p.id === selfId));
        return (
          <CourtCard
            key={c.court}
            sessionId={sessionId}
            isAdmin={isAdmin}
            court={c.court}
            current={c.current}
            next={c.next}
            nextSubstitutes={c.nextSubstitutes}
            isSelf={isSelf}
          />
        );
      })}
    </div>
  );
}
