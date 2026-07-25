"use client";

import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

export interface SimilarPlayer {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

/**
 * Shown when a typed name closely matches an existing player. Picking the
 * existing player keeps one history; "ไม่ใช่ — คนใหม่" creates a separate one.
 *
 * The existing player is the prominent choice because that's the common case (a
 * regular typing their name slightly differently), but genuinely new members
 * must be able to get past this in one tap — the club really does have two
 * people called Pang.
 */
export default function IdentityConfirm({
  typedName,
  players,
  onPick,
  onCreateNew,
  onCancel,
  busy,
}: {
  typedName: string;
  players: SimilarPlayer[];
  onPick: (player: SimilarPlayer) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-amber-900">มีชื่อคล้ายกันอยู่แล้ว</p>
        <p className="text-sm text-amber-800">
          คุณพิมพ์ว่า &quot;{typedName}&quot; — ถ้าเป็นคนเดิม เลือกชื่อด้านล่างเพื่อให้สถิติรวมกัน
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(p)}
            className="flex items-center gap-2 rounded-md border-2 border-brand-300 bg-white px-3 py-2.5 text-sm font-medium hover:border-brand-500 disabled:opacity-50"
          >
            <span>ใช่ ฉันคือ &quot;{p.name}&quot;</span>
            <span className="ml-auto text-xs text-gray-400">
              มือ {SKILL_LABELS[p.skillLevel] ?? p.skillLevel}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={onCreateNew}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ไม่ใช่ — ฉันเป็นคนใหม่
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-sm text-gray-500 hover:underline disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
