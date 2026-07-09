"use client";

import { useEffect, useState } from "react";
import CourtCard from "./CourtCard";

interface PlayerInfo {
  id: string;
  name: string;
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

export default function CourtGrid({
  sessionId,
  isAdmin,
  editable,
  courts,
  substitutes,
}: {
  sessionId: string;
  isAdmin: boolean;
  editable: boolean;
  courts: CourtEntry[];
  substitutes: PlayerInfo[];
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
          !!c.match &&
          (c.match.team1.some((p) => p.id === selfId) || c.match.team2.some((p) => p.id === selfId));
        return (
          <CourtCard
            key={c.court}
            sessionId={sessionId}
            court={c.court}
            match={c.match}
            substitutes={substitutes}
            isSelf={isSelf}
            editable={isAdmin && editable}
          />
        );
      })}
    </div>
  );
}
