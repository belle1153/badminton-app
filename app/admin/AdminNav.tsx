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
    <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
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
