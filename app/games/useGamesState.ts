"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GamesState } from "@/lib/games/state";

/**
 * Keep a TUA TUENG GAMES snapshot fresh by polling (the "ask again every 1–2 s"
 * approach the organisers chose). Polls only while the tab is visible, refetches
 * as soon as it comes back, and keeps the last good snapshot if a request fails
 * — a flaky hall Wi-Fi just means a slightly stale screen, never a blank one.
 * Admin screens read the uncached admin endpoint so their own writes show at once.
 */
export function useGamesState(
  eventId: string,
  initial: GamesState,
  opts: { admin?: boolean; intervalMs?: number } = {}
): { state: GamesState; refresh: () => Promise<void> } {
  const { admin = false, intervalMs = 2000 } = opts;
  const [state, setState] = useState(initial);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const url = admin ? `/api/admin/games/${eventId}/state` : `/api/games/${eventId}/state`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) setState((await res.json()) as GamesState);
    } catch {
      // keep the last snapshot
    } finally {
      inFlight.current = false;
    }
  }, [eventId, admin]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, intervalMs]);

  return { state, refresh };
}
