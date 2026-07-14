"use client";

import { useEffect, useState } from "react";
import { getMySignups } from "@/lib/mySignups";

interface P {
  id: string;
  name: string;
}

export interface QueuePair {
  players: P[]; // 2 people (or 1 leftover at the tail)
}

/**
 * Waiting queue shown as prepared pairs (คู่เตรียม): the balanced teams the
 * next games will use, in queue order. First three pairs are highlighted as
 * up-next; the viewer's own name is picked out.
 */
export default function QueuePairs({
  sessionId,
  pairs,
}: {
  sessionId: string;
  pairs: QueuePair[];
}) {
  const [myIds, setMyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMyIds(new Set(getMySignups(sessionId)));
  }, [sessionId]);

  if (pairs.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีคนรอคิว</p>;
  }

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {pairs.map((pair, i) => {
        const mine = pair.players.some((p) => myIds.has(p.id));
        const upNext = i < 3;
        return (
          <li
            key={pair.players.map((p) => p.id).join("-")}
            className={`rounded-lg border px-2.5 py-2 text-sm flex flex-col gap-0.5 ${
              mine
                ? "bg-brand-600 text-white border-brand-600"
                : upNext
                  ? "bg-brand-50 border-brand-300 text-brand-900"
                  : "bg-gray-50 border-gray-200 text-gray-600"
            }`}
          >
            <span className={`text-[10px] ${mine ? "text-white/70" : "text-gray-400"}`}>
              คู่เตรียม {i + 1}
              {pair.players.length < 2 ? " (รอจับคู่)" : ""}
            </span>
            {pair.players.map((p) => (
              <span key={p.id} className="truncate font-medium">
                {p.name}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
