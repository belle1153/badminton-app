"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "แผงแอดมิน" },
  { href: "/admin/athletes", label: "ข้อมูลผู้เล่น" },
  { href: "/admin/master", label: "Master ข้อมูล" },
  { href: "/admin/history", label: "ประวัติย้อนหลัง" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-2xl mx-auto w-full px-2 flex items-center gap-1 overflow-x-auto">
        <Link
          href="/"
          className="px-3 py-3 text-sm text-gray-400 hover:text-brand-700 whitespace-nowrap"
        >
          ← หน้าแรก
        </Link>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-brand-700"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="ml-auto px-3 py-3 text-sm font-medium text-red-600 hover:text-red-700 whitespace-nowrap"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}
