"use client";

import { useCallback, useState } from "react";
import type { Achievement } from "@/lib/achievements";
import AchievementCoin from "./AchievementCoin";
import CoinDetail from "./CoinDetail";

export interface SeasonCoins {
  id: number;
  label: string;
  /** Ids of the coins earned in that season. */
  earnedIds: string[];
}

/**
 * The current season's coin grid, plus — once a later season has begun — the
 * Season 1 souvenir shelf under it. Every coin opens the same detail sheet.
 */
export default function CoinGrid({
  achievements,
  currentLabel,
  seasons,
  shelf,
}: {
  /** The current season's coins, earned or not. */
  achievements: Achievement[];
  currentLabel: string;
  /** Every started season's earned coins, oldest first. */
  seasons: SeasonCoins[];
  /** The Season 1 souvenirs, when a later season is running. */
  shelf?: { title: string; summary: string; achievements: Achievement[] };
}) {
  const [open, setOpen] = useState<Achievement | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const earnedCount = achievements.filter((a) => a.earned).length;
  const earnedIn = (id: string) => seasons.filter((s) => s.earnedIds.includes(id));

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#e2e8f2]">
            เหรียญสะสม {shelf && <span className="text-[11px] font-normal text-[#8fa3bd]">· {currentLabel}</span>}
          </h2>
          <span className="text-[11px] tabular-nums text-[#5d7086]">
            {earnedCount}/{achievements.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-3.5">
          {achievements.map((a, i) => (
            <AchievementCoin key={a.id} achievement={a} index={i} onOpen={() => setOpen(a)} />
          ))}
        </div>
      </section>

      {shelf && shelf.achievements.length > 0 && (
        <section
          className="flex flex-col gap-2.5 rounded-xl border p-3.5"
          style={{ borderColor: "#ffcf4d40", background: "linear-gradient(165deg, #2a3650, #121a2c)" }}
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[13px] font-bold text-[#ffcf4d]">{shelf.title}</h2>
            <span className="text-[11px] tabular-nums text-[#a9bdd3]">{shelf.summary}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {shelf.achievements.map((a, i) => (
              <AchievementCoin key={a.id} achievement={a} index={i} size="sm" onOpen={() => setOpen(a)} />
            ))}
          </div>
        </section>
      )}

      {open && (
        <CoinDetail
          achievement={open}
          earnedIn={earnedIn(open.id)}
          currentLabel={currentLabel}
          current={achievements.find((a) => a.id === open.id)}
          onClose={close}
        />
      )}
    </>
  );
}
