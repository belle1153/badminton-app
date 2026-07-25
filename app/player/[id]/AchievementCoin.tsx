import { rarityFor, RARITY_PALETTE } from "@/lib/achievementRarity";
import type { Achievement } from "@/lib/achievements";

/**
 * One achievement as a collectable coin. Rarity comes from the badge's target,
 * so the grid reads as tiers at a glance.
 *
 * A locked coin keeps its shape but blacks out the icon — you can see there is
 * something to win without being told what, which is the point of the grid.
 */
export default function AchievementCoin({
  achievement,
  index,
}: {
  achievement: Achievement;
  index: number;
}) {
  const { earned, icon, label, target, current, progressLabel } = achievement;
  const rarity = rarityFor(target);
  const pal = RARITY_PALETTE[rarity];

  // Layered like a struck coin: a lit face, a bevelled rim catching light from
  // the top-left, and a shadowed lower edge. The banded stops (34%/35%…) are
  // what give it a hard metal edge rather than a soft airbrushed blob.
  const ring = [
    `radial-gradient(circle at 30% 24%, rgba(255,255,255,.45) 0%, transparent 42%)`,
    `radial-gradient(circle at 72% 82%, rgba(0,0,0,.45) 0%, transparent 46%)`,
    `radial-gradient(circle at 34% 28%, ${pal.r1} 0%, ${pal.r1} 34%, ${pal.r2} 35%, ${pal.r2} 70%, ${pal.r3} 71%, ${pal.r3} 100%)`,
  ].join(", ");

  // inset rings = the coin's raised rim; outer rings = its glow in the case.
  const glow = earned
    ? [
        `inset 0 2px 3px rgba(255,255,255,.5)`,
        `inset 0 -2px 4px rgba(0,0,0,.55)`,
        `0 0 0 2px ${pal.r3}`,
        `0 0 0 4px ${pal.glow}`,
        `0 0 12px 2px ${pal.glow}aa`,
        `0 0 26px 6px ${pal.glow}55`,
      ].join(", ")
    : [
        `inset 0 2px 3px rgba(255,255,255,.14)`,
        `inset 0 -2px 4px rgba(0,0,0,.5)`,
        `0 0 0 2px ${pal.r3}`,
        `0 0 0 4px ${pal.glow}44`,
      ].join(", ");

  // Legendary coins cycle between their two glows; everything else sits still.
  const legendaryPulse = rarity === "legendary" && earned;

  const showProgress = !earned && current != null && target != null && current > 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[74px] w-[74px]">
        <div
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full ${
            legendaryPulse ? "pixel-anim" : ""
          }`}
          style={{
            background: ring,
            boxShadow: glow,
            animation: legendaryPulse ? "duoglow 3.2s ease-in-out infinite" : undefined,
          }}
        >
          {/* Sweeping highlight, so the coins read as metal rather than flat discs. */}
          <div
            className="pixel-anim pointer-events-none absolute -top-[40%] left-0 h-[180%] w-[38%]"
            style={{
              background: `linear-gradient(90deg, transparent, ${
                earned ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.2)"
              }, transparent)`,
              filter: earned ? "blur(1px)" : undefined,
              animation: `coinshine 3.2s ${(index * 0.37) % 2.4}s ease-in-out infinite`,
            }}
          />
          {/* Soft pool of colour under the icon, so it sits in the coin. */}
          {earned && (
            <div
              className="pointer-events-none absolute inset-[18%] rounded-full"
              style={{ background: `radial-gradient(circle, ${pal.glow}55 0%, transparent 70%)` }}
            />
          )}
          <span
            className="relative z-10 text-[26px] leading-none"
            style={{
              opacity: earned ? 1 : 0.32,
              filter: earned
                ? `drop-shadow(0 1px 2px rgba(0,0,0,.6)) drop-shadow(0 0 6px ${pal.glow}88)`
                : "brightness(0) opacity(.6)",
            }}
          >
            {icon}
          </span>
        </div>

        {earned && (
          <>
            <span
              className="pixel-anim pointer-events-none absolute right-1.5 top-0.5 h-[5px] w-[5px] rounded-full bg-white"
              style={{
                boxShadow: `0 0 4px 1px ${pal.glow}`,
                animation: `twinkle 2.6s ${(index * 0.4) % 2}s infinite`,
              }}
            />
            <span
              className="pixel-anim pointer-events-none absolute bottom-2 left-0 h-1 w-1 rounded-full bg-white"
              style={{
                boxShadow: `0 0 4px 1px ${pal.glow2 ?? pal.glow}`,
                animation: `twinkle 2.1s ${(index * 0.6 + 0.8) % 2}s infinite`,
              }}
            />
          </>
        )}
      </div>

      <span
        className="min-h-[26px] text-center text-[10.5px] leading-[1.3]"
        style={{ color: earned ? "#c7d2e0" : "#4a5b70" }}
      >
        {label}
      </span>

      {showProgress && (
        <div className="h-1 w-14 overflow-hidden rounded-sm bg-[#161f2b]">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, Math.round((current / target) * 100))}%`,
              background: pal.glow,
            }}
          />
        </div>
      )}
      {showProgress && progressLabel && (
        <span className="text-[9px] tabular-nums text-[#4a5b70]">{progressLabel}</span>
      )}
    </div>
  );
}
