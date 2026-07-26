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
      className="rounded-2xl border-2 border-sky-400 bg-[#141d2b] p-6 flex flex-col items-center gap-1.5 text-center shadow-[0_0_16px_rgba(79,159,230,0.35)] hover:border-sky-300 hover:shadow-[0_0_22px_rgba(79,159,230,0.55)] transition"
    >
      <span className="text-4xl">🚀</span>
      <span className="font-bold text-lg text-sky-300">Mission โคตรตึง!</span>
      <span className="text-xs text-slate-400">เกมที่เล่น / ชนะแพ้ / คู่ที่เล่นด้วย</span>
    </Link>
  );
}
