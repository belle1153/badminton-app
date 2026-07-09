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
    <nav className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-200 p-4 flex flex-row sm:flex-col gap-2 sm:gap-1 overflow-x-auto sm:min-h-screen">
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-brand-700 whitespace-nowrap sm:mb-4 self-center sm:self-auto"
      >
        ← หน้าแรก
      </Link>
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
              active ? "bg-brand-600 text-white" : "text-brand-700 hover:bg-brand-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="sm:mt-auto rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 whitespace-nowrap text-left"
      >
        ออกจากระบบ
      </button>
    </nav>
  );
}
