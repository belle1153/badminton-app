"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a page that people leave open (sign-up list, courts board) in sync
 * without a manual reload: re-fetches server data on an interval and when
 * the tab regains focus.
 */
export default function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
