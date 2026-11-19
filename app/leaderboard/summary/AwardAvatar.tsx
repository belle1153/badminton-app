"use client";

import { useEffect, useRef, useState } from "react";
import type { SummaryRow } from "@/lib/missionSummary";
import { MEDAL } from "./medal";

/** Round player photo with a medal-coloured ring; a shuttlecock when there's no photo. */
export function AwardAvatar({
  row,
  size,
  rank,
  cssSize,
}: {
  row: SummaryRow;
  size: number;
  rank: number;
  /** Overrides the box size with a CSS length (e.g. min(190px, 19vh)) — the award screen fits its height. */
  cssSize?: string;
}) {
  const m = MEDAL[rank - 1];
  // Some stored photos don't decode (the photo route answers 404): show the shuttlecock instead.
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A server-rendered <img> can fail before hydration, when onError isn't wired up yet.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);
  return (
    <span
      className="box-border block shrink-0 rounded-full p-[3px]"
      style={{
        width: cssSize ?? size,
        height: cssSize ?? size,
        background: `linear-gradient(160deg, ${m.light}, ${m.mid} 45%, ${m.dark})`,
        boxShadow: rank === 1 ? `0 0 ${size / 4}px ${m.mid}99` : `0 0 ${size / 6}px ${m.mid}55`,
      }}
    >
      {row.photoUrl && !broken ? (
        // Plain <img>: the photo API is versioned with a query string, which next/image rejects.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={row.photoUrl} alt={row.name} onError={() => setBroken(true)} className="h-full w-full rounded-full bg-[#141c2b] object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full bg-[#141c2b]" style={{ fontSize: size * 0.4 }}>
          🏸
        </span>
      )}
    </span>
  );
}

