"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

/**
 * A thin bar across the top of the screen while the next page loads, so a tap on a
 * link is answered straight away instead of the screen sitting still. It starts on
 * a click on any link to another page of this site and finishes when that page shows.
 *
 * Deliberately not `loading.tsx`: that would stream every page, which changes how
 * redirects and not-found responses behave. This only watches clicks and the path.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState(pathname);

  // The path changed, so the page asked for is on screen: run the bar out.
  if (shown !== pathname) {
    setShown(pathname);
    if (phase === "loading") setPhase("done");
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // A modified click opens the link elsewhere, so this page isn't going anywhere.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      // Another site, or this same page (a ?tab= or #anchor link): nothing to wait for.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setPhase("loading");
    };
    // The back button can land on this same path (only ?tab= differs), which never
    // changes the path: give the page a moment, then run the bar out anyway.
    let back: ReturnType<typeof setTimeout>;
    const onPop = () => {
      back = setTimeout(() => setPhase((p) => (p === "loading" ? "done" : p)), 1500);
    };
    // Capture phase: links that handle the click themselves (the back button) still count.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(back);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (phase === "idle") return;
    // "done" lasts as long as its fade; "loading" gives up quietly if the page never comes
    // (a link that turned out not to navigate), so the bar can't get stuck on screen.
    const t = setTimeout(() => setPhase("idle"), phase === "done" ? 450 : 12_000);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "idle") return null;
  return <div aria-hidden="true" className={`nav-progress ${phase === "done" ? "nav-progress-done" : ""}`} />;
}
