/* Shared pieces for the TUA TUENG GAMES screens (player, TV, live count).
   Presentational only, so both server and client components can use them. */
/* eslint-disable @next/next/no-img-element -- versioned API image URLs, like the leaderboard */

import Link from "next/link";
import BackLink from "@/app/BackLink";
import { knockoutPlaceholder } from "@/lib/games/format";
import type { PlayerRef, TeamView, TieView } from "@/lib/games/state";

export const DARK = {
  ground: "#0b1c30",
  panel: "#102843",
  line: "#2f6690",
  lineSoft: "#1d4d73",
  text: "#f2f5fa",
  muted: "#a9bdd3",
  dim: "#8a9db3",
  gold: "#ffcf4d",
  live: "#ff8a3d",
} as const;

/** Team logo, or a shield in the team colour when there is none. */
export function TeamLogo({ team, size = 22 }: { team: TeamView; size?: number }) {
  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" fill={team.color} stroke={team.color} strokeWidth="1.5" />
    </svg>
  );
}

/** Logo + coloured name chip. */
export function TeamChip({ team, size = "sm" }: { team: TeamView | null | undefined; size?: "sm" | "md" | "lg" | "xl" }) {
  const cls = {
    sm: "text-[13px] px-2.5 py-0.5 rounded-md gap-1.5",
    md: "text-[16px] px-3 py-1 rounded-lg gap-2",
    lg: "text-[20px] px-4 py-1 rounded-lg gap-2",
    xl: "text-[3vw] px-[1.2vw] py-[0.3vw] rounded-xl gap-[0.8vw]",
  }[size];
  const logo = { sm: 18, md: 22, lg: 28, xl: 48 }[size];
  if (!team) {
    return <span className={`inline-flex items-center font-bold bg-[#1a2c42] text-[#a9bdd3] ${cls}`}>—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <TeamLogo team={team} size={logo} />
      <span className={`inline-flex items-center font-bold ${cls}`} style={{ background: team.color, color: team.textColor }}>
        {team.name}
      </span>
    </span>
  );
}

const PERSON = (
  <svg viewBox="0 0 24 24" fill="#dbe6f0" aria-hidden="true" className="h-[70%] w-[70%] translate-y-[15%]">
    <circle cx="12" cy="9" r="4.5" />
    <path d="M3 24c0-5 4-8.5 9-8.5s9 3.5 9 8.5z" />
  </svg>
);

/** One player's round photo, or a person icon. */
export function Avatar({
  player,
  size = 20,
  ring = DARK.panel,
  style,
}: {
  player: PlayerRef | null;
  size?: number;
  ring?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f6690]"
      style={{ width: size, height: size, border: `2px solid ${ring}`, ...style }}
    >
      {player?.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : PERSON}
    </span>
  );
}

/** Two overlapping avatars for a pair (photo, or a person icon). */
export function PairAvatars({ players, size = 20, ring = DARK.panel }: { players: (PlayerRef | null)[]; size?: number; ring?: string }) {
  return (
    <span className="flex shrink-0">
      {players.map((p, i) => (
        <Avatar key={i} player={p} size={size} ring={ring} style={{ marginLeft: i ? -size * 0.3 : 0 }} />
      ))}
    </span>
  );
}

/** One tie as a row: time, name and courts, then both teams with the score — or who it will be. */
export function TieRow({ eventId, tie, teams }: { eventId: string; tie: TieView; teams: Map<string, TeamView> }) {
  const a = teams.get(tie.teamAId ?? "");
  const b = teams.get(tie.teamBId ?? "");
  const final = tie.stage === "FINAL";
  return (
    <Link
      href={`/games/${eventId}/tie/${tie.id}`}
      className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2.5 rounded-xl border px-2.5 py-2"
      style={{ background: DARK.panel, borderColor: final ? DARK.gold : tie.status === "live" ? DARK.live : DARK.line }}
    >
      <span className="text-[13px] font-bold tabular-nums text-[#a9bdd3]">{tie.startsAt}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-bold" style={{ color: final ? DARK.gold : DARK.text }}>
          {tie.label} <span className="font-medium text-[#a9bdd3]">· สนาม {tie.courtA}–{tie.courtB}</span>
        </span>
        {a && b ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-[#c3cedd]">
            <TeamChip team={a} />
            {tie.status === "upcoming" ? "vs" : <b className="tabular-nums text-white">{tie.pointsA}–{tie.pointsB}</b>}
            <TeamChip team={b} />
          </span>
        ) : (
          <span className="text-xs text-[#c3cedd]">{knockoutPlaceholder(tie.stage, tie.slot)}</span>
        )}
      </span>
    </Link>
  );
}

/** A pair's names one per line, so a phone shows both partners instead of cutting the second. */
export function PairNames({
  players,
  fallback,
  align = "left",
  className = "",
  style,
}: {
  players: (PlayerRef | null)[];
  fallback: string;
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}) {
  const names = players.filter((p): p is PlayerRef => p != null).map((p) => p.name);
  return (
    <span className={`flex min-w-0 flex-col leading-tight ${align === "right" ? "items-end text-right" : ""} ${className}`} style={style}>
      {(names.length ? names : [fallback]).map((n, i) => (
        <span key={i} className="max-w-full truncate">
          {n}
        </span>
      ))}
    </span>
  );
}

/** Small pill. */
export function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-[1px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

/** Dark page frame shared by the player screens. */
export function DarkPage({ children }: { children: React.ReactNode }) {
  return (
    // flex-1: fill the rest of the body's flex column, so a short tab never leaves white below.
    <div className="flex-1 font-[family-name:var(--font-pixel-body)]" style={{ background: DARK.ground, color: DARK.text }}>
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-6 px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}

/** Shown to players until the admin publishes the event. */
export function ComingSoon({ name }: { name: string }) {
  return (
    <DarkPage>
      <BackLink href="/" tone="dark" />
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-5xl">🏅</span>
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className="rounded-full bg-[#ffcf4d] px-4 py-1 text-sm font-bold text-[#0b1c30]">Coming soon</span>
        <p className="max-w-[28ch] text-sm text-[#a9bdd3]">ตารางแข่งและผลจะเปิดให้ดูที่นี่เร็วๆ นี้</p>
      </div>
    </DarkPage>
  );
}
