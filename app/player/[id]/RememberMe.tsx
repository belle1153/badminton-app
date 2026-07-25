"use client";

import { useEffect, useState } from "react";
import { getMyPlayerId, setMyPlayerId, clearMyPlayerId } from "@/lib/myPlayer";

/**
 * Marks this profile as "me" so the home page can link straight here. Purely a
 * shortcut — the profile URL is what actually identifies the player, so if
 * storage is unavailable nothing breaks, the button just won't stick.
 */
export default function RememberMe({ athleteId, name }: { athleteId: string; name: string }) {
  const [isMe, setIsMe] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMe(getMyPlayerId() === athleteId);
  }, [athleteId]);

  if (isMe == null) return null; // avoid a flash of the wrong state

  return isMe ? (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[#384a63] bg-[#232f42] p-3">
      <span className="text-[13px] text-[#c7d2e0]">จำไว้แล้วว่านี่คือคุณ ({name})</span>
      <button
        onClick={() => {
          clearMyPlayerId();
          setIsMe(false);
        }}
        className="ml-auto text-[11px] text-[#8095ad] hover:text-white hover:underline"
      >
        ไม่ใช่ฉัน
      </button>
    </div>
  ) : (
    <button
      onClick={() => {
        setMyPlayerId(athleteId);
        setIsMe(true);
      }}
      className="self-start rounded border-2 border-[#4f83ac] bg-[#232f42] px-4 py-2 text-[13px] font-semibold text-[#8fc4ff] hover:border-[#8fc4ff]"
    >
      ⭐ นี่คือฉัน — จำไว้ให้เข้าถึงเร็วขึ้น
    </button>
  );
}
