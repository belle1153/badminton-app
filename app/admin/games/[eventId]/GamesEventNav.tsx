"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BackLink from "@/app/BackLink";

/**
 * Top of every admin page of one event: a back button and the event's menu,
 * always in the same place, big enough for a thumb, the current page filled in.
 */
export default function GamesEventNav({ eventId, name }: { eventId: string; name: string }) {
  const pathname = usePathname();
  const base = `/admin/games/${eventId}`;
  const items = [
    { href: base, label: "คุมรอบ", icon: "⏱️", on: pathname === base || pathname.startsWith(`${base}/live`) },
    { href: `${base}/lineups`, label: "ใบส่งตัว", icon: "📝", on: pathname.startsWith(`${base}/lineup`) },
    { href: `${base}/setup`, label: "ตั้งค่า / ทีม", icon: "⚙️", on: pathname.startsWith(`${base}/setup`) },
    { href: `${base}/slips`, label: "พิมพ์ใบผล", icon: "🖨️", on: pathname.startsWith(`${base}/slips`) },
    { href: `/games/${eventId}`, label: "หน้าผู้เล่น", icon: "👀", on: false },
    { href: `/games/${eventId}/tv/standings`, label: "จอใหญ่ ↗", icon: "📺", on: false, newTab: true },
  ];
  // Back steps through history like the phone's own button; opened directly, a keyed
  // lineup falls back to the lineups list and every other page to the list of events.
  const backHref = pathname.startsWith(`${base}/lineup/`) ? `${base}/lineups` : "/admin/games";

  return (
    <nav className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <BackLink href={backHref} />
        <span className="min-w-0 truncate text-sm font-semibold text-gray-500">🏅 {name}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            target={it.newTab ? "_blank" : undefined}
            aria-current={it.on ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 text-center text-[13px] font-semibold leading-tight transition active:scale-95 ${
              it.on ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
            }`}
          >
            <span className="text-lg leading-none">{it.icon}</span>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
