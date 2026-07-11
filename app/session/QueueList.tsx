"use client";

import { useEffect, useState } from "react";
import { getMySignups } from "@/lib/mySignups";

interface QueuePlayer {
  id: string;
  name: string;
}

/**
 * Waiting queue shown to players: ordered by who has waited longest. The next
 * four (who go on when a court frees up) are highlighted, and the viewer's own
 * name is picked out from their saved sign-ups.
 */
export default function QueueList({
  sessionId,
  queue,
}: {
  sessionId: string;
  queue: QueuePlayer[];
}) {
  const [myIds, setMyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMyIds(new Set(getMySignups(sessionId)));
  }, [sessionId]);

  if (queue.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีคนรอคิว</p>;
  }

  return (
    <ol className="flex flex-wrap gap-1.5">
      {queue.map((p, i) => {
        const mine = myIds.has(p.id);
        return (
          <li
            key={p.id}
            className={`text-sm rounded-full px-3 py-1 border ${
              mine
                ? "bg-brand-600 text-white border-brand-600 font-semibold"
                : i < 4
                  ? "bg-brand-50 border-brand-300 text-brand-800"
                  : "bg-gray-50 border-gray-200 text-gray-600"
            }`}
          >
            <span className={`mr-1 ${mine ? "text-white/70" : "text-gray-400"}`}>{i + 1}.</span>
            {p.name}
          </li>
        );
      })}
    </ol>
  );
}
