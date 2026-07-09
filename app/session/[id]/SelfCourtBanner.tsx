"use client";

import { useEffect, useState } from "react";

interface MatchPlayerInfo {
  id: string;
  name: string;
}

interface MatchInfo {
  court: number;
  round: number;
  team1: MatchPlayerInfo[];
  team2: MatchPlayerInfo[];
}

export default function SelfCourtBanner({
  sessionId,
  matches,
}: {
  sessionId: string;
  matches: MatchInfo[];
}) {
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    setSelfId(localStorage.getItem(`badminton_signup_${sessionId}`));
  }, [sessionId]);

  if (!selfId) return null;

  const match = matches.find(
    (m) => m.team1.some((p) => p.id === selfId) || m.team2.some((p) => p.id === selfId)
  );
  if (!match) return null;

  const onTeam1 = match.team1.some((p) => p.id === selfId);
  const myTeam = onTeam1 ? match.team1 : match.team2;
  const oppTeam = onTeam1 ? match.team2 : match.team1;

  return (
    <div className="rounded-md bg-brand-50 border border-brand-200 p-3 text-sm">
      <p className="font-semibold text-brand-800">
        คุณอยู่คอร์ท {match.court} (รอบที่ {match.round})
      </p>
      <p className="text-brand-700">
        ทีมคุณ: {myTeam.map((p) => p.name).join(" + ")} · คู่แข่ง: {oppTeam.map((p) => p.name).join(" + ")}
      </p>
    </div>
  );
}
