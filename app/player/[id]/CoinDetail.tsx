"use client";

import { useEffect } from "react";
import { expForBadge, rarityFor, RARITY_PALETTE } from "@/lib/achievementRarity";
import type { Achievement } from "@/lib/achievements";
import AchievementCoin from "./AchievementCoin";

/**
 * What a coin is and where it came from: tap any coin, in the grid or on the
 * Season 1 shelf. No date — the app never stored when a coin was earned, and
 * working it out would mean replaying every play day.
 */
export default function CoinDetail({
  achievement,
  earnedIn,
  currentLabel,
  current,
  onClose,
}: {
  achievement: Achievement;
  /** Seasons this coin was earned in, oldest first (e.g. ["Season 1"]). */
  earnedIn: { id: number; label: string }[];
  /** The season running now, e.g. "Season 2". */
  currentLabel: string;
  /** This coin as it stands in the current season, for its progress line. */
  current?: Achievement;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pal = RARITY_PALETTE[rarityFor(achievement.target)];
  const shown = { ...achievement, earned: earnedIn.length > 0 || achievement.earned };
  const earnedNow = current?.earned ?? false;

  return (
    <div
      className="ui-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={achievement.label}
    >
      <div
        className="ui-pop-in relative flex w-full max-w-[300px] flex-col gap-3 rounded-2xl border border-white/10 bg-[#18223a] p-5 text-[13px] text-[#c7d2e0] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-2.5 top-2 rounded-full px-2 py-0.5 text-lg text-[#8fa3bd] hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        <div className="flex items-center gap-4">
          <AchievementCoin achievement={shown} index={0} size="sm" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-bold leading-snug text-white">{achievement.label}</span>
            <span>
              {pal.label} · <span className="font-semibold text-emerald-400">+{expForBadge(achievement.target)} EXP</span>
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 border-t border-white/10 pt-3 leading-relaxed">
          {earnedIn.map((s) => (
            <li key={s.id}>
              {s.label === currentLabel ? "✨" : "🏛️"} ได้ใน <b className="text-white">{s.label}</b>
            </li>
          ))}
          {current && !earnedNow && (
            <li>
              {current.current != null && current.target != null && current.current > 0
                ? `${currentLabel}: ${current.current.toLocaleString()} / ${current.target.toLocaleString()}`
                : `ยังไม่ได้ใน ${currentLabel}`}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
