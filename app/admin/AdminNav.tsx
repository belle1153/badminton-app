"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "จัดการการลงทะเบียน", icon: "📋" },
  { href: "/admin/athletes", label: "ข้อมูลผู้เล่น", icon: "🏸" },
  { href: "/admin/announcements", label: "ประกาศ", icon: "📣" },
  { href: "/admin/rules", label: "กฎก๊วน", icon: "📖" },
  { href: "/admin/master", label: "Master ข้อมูล", icon: "💰" },
  { href: "/admin/history", label: "ประวัติย้อนหลัง", icon: "🗂️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    // Orange on purpose: an unmissable "you are in admin mode" marker, matching
    // the คู่เตรียม accent used across the admin tools.
    <div className="border-b border-orange-600 bg-orange-500 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto w-full px-4 py-2 flex items-center gap-2">
        <nav className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-white text-orange-700"
                    : "bg-orange-400/60 text-white hover:bg-white/90 hover:text-orange-700"
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
          className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/60 text-white px-3 py-1.5 text-sm font-medium hover:bg-white hover:text-red-600"
        >
          🚪<span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
}
