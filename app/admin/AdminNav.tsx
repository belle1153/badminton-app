"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV = [
  { href: "/admin", label: "จัดการการลงทะเบียน", icon: "📋" },
  { href: "/admin/athletes", label: "ข้อมูลผู้เล่น", icon: "🏸" },
  // ประกาศ + กฎ share one page, so the nav stays narrow enough to reach every item.
  { href: "/admin/announcements", label: "ประกาศ & กฎ", icon: "📣" },
  { href: "/admin/master", label: "Master ข้อมูล", icon: "💰" },
  { href: "/admin/withdrawals", label: "ประวัติถอนชื่อ", icon: "🚫" },
  { href: "/admin/history", label: "ประวัติย้อนหลัง", icon: "🗂️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  // Drag-to-scroll + wheel-to-scroll so the single-row nav pans with a mouse on
  // desktop (the scrollbar is hidden for a clean mobile swipe, which otherwise
  // leaves the overflow unreachable with a mouse). Touch keeps native scrolling.
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return; // leave touch/pen to native scroll
    const el = navRef.current;
    if (!el) return;
    // Deliberately NOT capturing the pointer here. Capture retargets pointerup
    // to the <nav>, so the browser fires the click on the nav instead of the
    // <Link> under the cursor and the menu stops navigating with a mouse
    // entirely. Capture only once it's a real drag — see onPointerMove.
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = navRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4 && !drag.current.moved) {
      drag.current.moved = true;
      // Past the threshold this is a pan, not a click: take the pointer so it
      // keeps tracking if the cursor leaves the nav. The click it ends with is
      // swallowed by onClickCapture below.
      if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = drag.current.startLeft - dx;
  }
  function endDrag(e: React.PointerEvent) {
    const el = navRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    drag.current.down = false;
  }
  // Swallow the click that ends a drag so panning never navigates.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="max-w-5xl mx-auto w-full px-4 py-2 flex items-center gap-2">
        {/* Phone: one swipeable row (native touch scrolling). Desktop: wrap
            instead, so every item is visible without scrolling — the scrollbar
            is hidden there, leaving only drag/wheel, which isn't discoverable
            and made the overflowing items feel unreachable. */}
        <nav
          ref={navRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:cursor-auto"
        >
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                draggable={false}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          title="ออกจากระบบ"
          className="shrink-0 flex items-center gap-1.5 rounded-full border border-red-200 text-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-50"
        >
          🚪<span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
}
