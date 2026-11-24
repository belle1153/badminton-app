import { rarityFor, RARITY_PALETTE } from "@/lib/achievementRarity";
import type { Achievement } from "@/lib/achievements";

/**
 * One achievement as a struck coin: a milled metal rim, a raised face holding
 * the icon, and a tier band underneath. Rarity comes from the badge's target,
 * so the grid reads as tiers at a glance — laurels mark epic and legendary,
 * and only legendary wears the crown.
 *
 * A locked coin keeps its shape but goes grey and blacks out the icon — you
 * can see there is something to win without being told what.
 *
 * `md` is the grid coin (with band, label and progress); `sm` is the small one
 * for the Season 1 shelf and the rules list.
 */
const SIZES = { md: 76, sm: 48 } as const;

/** Laurel leaves up the lower sides of the rim — ellipses rotated outwards. */
const LAUREL = [
  [12, 44, -30],
  [17, 56, -55],
  [11, 31, -10],
  [64, 44, 30],
  [59, 56, 55],
  [65, 31, 10],
] as const;

export default function AchievementCoin({
  achievement,
  index,
  size = "md",
  onOpen,
}: {
  achievement: Achievement;
  index: number;
  size?: keyof typeof SIZES;
  /** Makes the coin a button (opens its detail sheet). */
  onOpen?: () => void;
}) {
  const { earned, icon, label, target, current, progressLabel } = achievement;
  const rarity = rarityFor(target);
  const pal = RARITY_PALETTE[rarity];
  const px = SIZES[size];
  const md = size === "md";
  const laurels = earned && (rarity === "epic" || rarity === "legendary");
  const crown = earned && rarity === "legendary";
  const showProgress = md && !earned && current != null && target != null && current > 0;
  // Unique per coin so two coins' gradients never collide in the page's SVG ids.
  const gid = `coin-${achievement.id}-${size}`;

  const coin = (
    <div
      className="relative shrink-0"
      style={{ width: px, height: px, filter: earned ? undefined : "grayscale(1) brightness(.5)" }}
    >
      {/* Glow pool behind the coin; legendary breathes gold ↔ purple. */}
      {earned && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-[8%] rounded-full ${rarity === "legendary" ? "pixel-anim" : ""}`}
          style={{
            boxShadow: `0 0 10px 2px ${pal.glow}aa, 0 0 24px 6px ${pal.glow}44`,
            animation: rarity === "legendary" ? "legendglow 3.2s ease-in-out infinite" : undefined,
          }}
        />
      )}

      <svg viewBox="0 0 76 76" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pal.r1} />
            <stop offset=".55" stopColor={pal.r2} />
            <stop offset="1" stopColor={pal.r3} />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r="33" fill={`url(#${gid}-rim)`} stroke={pal.r3} strokeWidth="1.2" />
        {/* Milled edge: short ticks all round, like a minted coin. */}
        <circle cx="38" cy="38" r="31" fill="none" stroke={pal.r1} strokeOpacity=".75" strokeWidth="3.5" strokeDasharray="1.4 2.1" />
        {laurels && (
          <g fill={pal.r1} stroke={pal.r3} strokeWidth=".6">
            {(rarity === "legendary" ? LAUREL : LAUREL.filter((_, i) => i % 3 !== 2)).map(([x, y, r]) => (
              <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3" ry="6" transform={`rotate(${r} ${x} ${y})`} />
            ))}
          </g>
        )}
        {crown && <path d="M30 6 l4 6 4-8 4 8 4-6 -2 9 h-12z" fill="#ffcf4d" stroke="#8a6416" strokeWidth=".8" />}
      </svg>

      {/* Raised face */}
      <div
        className="absolute inset-[17%] flex items-center justify-center overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${pal.f1}, ${pal.f2})`,
          boxShadow: `inset 0 2px 2px rgba(255,255,255,.35), inset 0 -2px 4px rgba(0,0,0,.6), 0 0 0 1px ${pal.r3}`,
        }}
      >
        {/* Sweeping highlight, so the face reads as metal rather than a flat disc. */}
        <div
          className="pixel-anim pointer-events-none absolute -top-[40%] left-0 h-[180%] w-[38%]"
          style={{
            background: `linear-gradient(90deg, transparent, ${earned ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.12)"}, transparent)`,
            animation: `coinshine 3.2s ${(index * 0.37) % 2.4}s ease-in-out infinite`,
          }}
        />
        <span
          className="relative z-10 leading-none"
          style={{
            fontSize: Math.round(px * 0.32),
            filter: earned
              ? `drop-shadow(0 1px 2px rgba(0,0,0,.6)) drop-shadow(0 0 6px ${pal.glow}88)`
              : "brightness(0) opacity(.6)",
          }}
        >
          {icon}
        </span>
      </div>

      {earned && md && (
        <span
          className="pixel-anim pointer-events-none absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-white"
          style={{ boxShadow: `0 0 4px 1px ${pal.glow2 ?? pal.glow}`, animation: `twinkle 2.6s ${(index * 0.4) % 2}s infinite` }}
        />
      )}

      {md && (
        <span
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 text-[8.5px] font-bold leading-[13px] tracking-[0.08em]"
          style={{ background: pal.r2, color: "#0d1420", boxShadow: "0 1px 3px rgba(0,0,0,.6)" }}
        >
          {pal.tag}
        </span>
      )}
    </div>
  );

  const body = (
    <>
      {coin}
      {md && (
        <span
          className="mt-1 min-h-[26px] text-center text-[10.5px] leading-[1.3]"
          style={{ color: earned ? "#c7d2e0" : "#4a5b70" }}
        >
          {label}
        </span>
      )}
      {showProgress && (
        <div className="h-1 w-14 overflow-hidden rounded-sm bg-[#161f2b]">
          <div
            className="h-full"
            style={{ width: `${Math.min(100, Math.round((current / target) * 100))}%`, background: pal.glow }}
          />
        </div>
      )}
      {showProgress && progressLabel && (
        <span className="text-[9px] tabular-nums text-[#4a5b70]">{progressLabel}</span>
      )}
    </>
  );

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}${earned ? "" : " (ยังไม่ได้)"}`}
      className="flex flex-col items-center gap-1.5 rounded-lg p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
    >
      {body}
    </button>
  ) : (
    <div className="flex flex-col items-center gap-1.5">{body}</div>
  );
}
