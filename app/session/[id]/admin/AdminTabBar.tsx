"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabBar({ base }: { base: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: base, label: "เช็คอิน", icon: "✅" },
    { href: `${base}/match`, label: "จัดการแมท", icon: "🏸" },
    { href: `${base}/history`, label: "ประวัติแมท", icon: "📜" },
    { href: `${base}/cost`, label: "คำนวณเงิน", icon: "💰" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around max-w-2xl mx-auto w-full z-40">
      {tabs.map((tab) => {
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active ? "text-brand-700" : "text-gray-400"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
