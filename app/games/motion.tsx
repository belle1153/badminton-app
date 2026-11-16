"use client";

/* Motion for the TUA TUENG GAMES screens. The keyframes are the .games-* classes
   in globals.css, where a reduced-motion preference switches them off. */

import { useLayoutEffect, useRef, useState } from "react";
import type { RubberView } from "@/lib/games/state";

/** How many times `value` has changed since the first render. */
function useChanges(value: string | number): number {
  const [seen, setSeen] = useState(value);
  const [changes, setChanges] = useState(0);
  if (seen !== value) {
    setSeen(value);
    setChanges(changes + 1);
  }
  return changes;
}

/**
 * Wraps a score so it pops and flashes gold when `value` changes. Nothing moves on
 * the first render, so a page load stays still and only a number that just changed
 * draws the eye. Pass `className` (with a display) when it wraps more than a number.
 */
export function Bump({
  value,
  className = "inline-block",
  children,
}: {
  value: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  const changes = useChanges(value);
  // A new key remounts the span, which restarts the animation for every change.
  return (
    <span key={changes} className={`${className} ${changes ? "games-bump" : ""}`}>
      {children}
    </span>
  );
}

/**
 * Fades its content in when `id` changes: the next round on the big screen, the
 * other stage on the player page. Still on the first render, where the page or
 * view around it is already coming in.
 */
export function Swap({
  id,
  className = "",
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const changes = useChanges(id);
  return (
    <div key={changes} className={`${className} ${changes ? "games-enter" : ""}`} style={style}>
      {children}
    </div>
  );
}

/** The set being counted live, e.g. "11–9"; a side pops each time it scores. */
export function LiveScore({ rubber }: { rubber: RubberView }) {
  const [x, y] = rubber.sets[(rubber.liveSet ?? 1) - 1] ?? [0, 0];
  return (
    <>
      <Bump value={x}>{x}</Bump>–<Bump value={y}>{y}</Bump>
    </>
  );
}

// Row positions outlive the list itself: the big screen swaps views every 10 s and the
// player page swaps tabs, and a team that moved meanwhile should still slide on return.
const remembered = new Map<string, { height: number; tops: Map<string, number> }>();

/**
 * Slides rows to their new places when their order changes (a team moving up the
 * table) instead of jumping. Put the returned ref on the list and `data-flip={id}`
 * on each row; `order` is the ids joined in their current order, `name` tells this
 * list from the others. Rows that are `relative` with their own background pass
 * over each other cleanly, the one moving up on top.
 */
export function useFlip<T extends HTMLElement>(order: string, name: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const before = remembered.get(name);
    // A different height means a resized screen, where the old positions say nothing.
    const moved = before?.height === list.offsetHeight && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tops = new Map<string, number>();
    for (const row of list.querySelectorAll<HTMLElement>("[data-flip]")) {
      const id = row.dataset.flip!;
      // offsetTop, not the bounding box: it ignores transforms still in flight.
      const top = row.offsetTop;
      tops.set(id, top);
      const was = before?.tops.get(id);
      if (moved && was != null && was !== top) {
        const zIndex = was > top ? 2 : 1;
        row.animate([{ transform: `translateY(${was - top}px)`, zIndex }, { transform: "none", zIndex }], {
          duration: 700,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    remembered.set(name, { height: list.offsetHeight, tops });
  }, [order, name]);
  return ref;
}
