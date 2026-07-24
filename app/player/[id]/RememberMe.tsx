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
    <div className="flex items-center gap-3 flex-wrap rounded-lg bg-brand-50 border border-brand-200 p-3">
      <span className="text-sm text-brand-800">จำไว้แล้วว่านี่คือคุณ ({name})</span>
      <button
        onClick={() => {
          clearMyPlayerId();
          setIsMe(false);
        }}
        className="ml-auto text-xs text-gray-500 hover:underline"
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
      className="self-start rounded-md border-2 border-brand-600 text-brand-700 px-4 py-2 text-sm font-medium hover:bg-brand-50"
    >
      ⭐ นี่คือฉัน — จำไว้ให้เข้าถึงเร็วขึ้น
    </button>
  );
}
