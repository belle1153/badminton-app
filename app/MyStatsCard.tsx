"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyPlayerId } from "@/lib/myPlayer";

/**
 * Entry point to the stats pages. Links straight to your own profile once you've
 * marked one as "me", otherwise to the name picker. Client-side because the
 * "me" shortcut lives in localStorage — the page itself works either way.
 */
export default function MyStatsCard() {
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => setMyId(getMyPlayerId()), []);

  return (
    <Link
      href={myId ? `/player/${myId}` : "/player"}
      className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-6 flex flex-col items-center gap-1.5 text-center hover:border-amber-400 transition"
    >
      <span className="text-4xl">📊</span>
      <span className="font-bold text-lg text-amber-900">
        {myId ? "สถิติของฉัน" : "สถิติผู้เล่น"}
      </span>
      <span className="text-xs text-gray-500">เกมที่เล่น / ชนะแพ้ / คู่ที่เล่นด้วย</span>
    </Link>
  );
}
